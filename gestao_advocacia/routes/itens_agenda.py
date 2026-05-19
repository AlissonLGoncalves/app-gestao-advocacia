# routes/itens_agenda.py
# CRUD do modelo unificado ItemAgenda (PR D1). Endpoint paralelo a
# /tarefas e /eventos — nao substitui ainda. Frontend continua usando os
# antigos ate D3.
from datetime import datetime

from flask import request
from flask_jwt_extended import get_jwt_identity, jwt_required
from flask_restx import Resource

from extensions import db
from helpers import get_item_or_404, get_list_query, get_tenant_id, tenant_scoped
from models import ItemAgenda, PublicacaoDJEN

# Whitelist de valores aceitos para tipo/status/categoria. Mantemos
# permissivo o suficiente pra absorver dados legados (D2 backfill) sem
# rejeicao, mas validamos pra evitar entrada lixo via API.
TIPOS_VALIDOS = {"tarefa", "evento"}
STATUS_VALIDOS = {"Pendente", "Em Andamento", "Concluido", "Cancelado"}


def _parse_dt(valor):
    """Aceita None, ISO 8601 completo ou data 'YYYY-MM-DD'.

    Retorna (datetime|None, erro_msg|None). Mantemos tolerante porque o
    frontend manda formatos diferentes pra data_vencimento (data pura) e
    data_inicio (com hora).
    """
    if valor in (None, "", "null"):
        return None, None
    try:
        # tenta ISO completo primeiro
        return datetime.fromisoformat(valor), None
    except (ValueError, TypeError):
        return None, f"Formato de data invalido: {valor!r}. Use ISO 8601."


def register_itens_agenda_routes(app, ns, input_dto, output_dto):
    @ns.route("/")
    class ItemAgendaListAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @ns.marshal_list_with(output_dto)
        @ns.doc(security="jsonWebToken")
        def get(self):
            # Filtros opcionais via query string. Mantidos enxutos pra
            # D1; D3 pode expandir conforme as views do frontend pedirem.
            query = get_list_query(ItemAgenda)
            tipo = request.args.get("tipo")
            if tipo:
                query = query.filter(ItemAgenda.tipo == tipo)
            status = request.args.get("status")
            if status:
                query = query.filter(ItemAgenda.status == status)
            caso_id = request.args.get("caso_id", type=int)
            if caso_id is not None:
                query = query.filter(ItemAgenda.caso_id == caso_id)
            # Ordem default: data_inicio asc (eventos no calendar), depois
            # data_vencimento asc, depois data_criacao desc. Frontend pode
            # reordenar do lado dele se precisar.
            itens = query.order_by(
                ItemAgenda.data_inicio.asc().nullslast(),
                ItemAgenda.data_vencimento.asc().nullslast(),
                ItemAgenda.data_criacao.desc(),
            ).all()
            return itens

        @jwt_required()
        @tenant_scoped
        @ns.expect(input_dto)
        @ns.marshal_with(output_dto, code=201)
        @ns.doc(security="jsonWebToken")
        def post(self):
            user_id = get_jwt_identity()
            data = request.get_json() or {}

            titulo = (data.get("titulo") or "").strip()
            if not titulo:
                return {"message": "titulo eh obrigatorio."}, 400

            tipo = (data.get("tipo") or "tarefa").strip()
            if tipo not in TIPOS_VALIDOS:
                return {
                    "message": f"tipo invalido: {tipo!r}. Valores aceitos: {sorted(TIPOS_VALIDOS)}."
                }, 400

            # Evento exige data_inicio. Tarefa pode nao ter data
            # (kanban sem prazo definido).
            data_inicio, err = _parse_dt(data.get("data_inicio"))
            if err:
                return {"message": err}, 400
            if tipo == "evento" and data_inicio is None:
                return {"message": "data_inicio eh obrigatoria para tipo=evento."}, 400

            data_fim, err = _parse_dt(data.get("data_fim"))
            if err:
                return {"message": err}, 400

            data_vencimento, err = _parse_dt(data.get("data_vencimento"))
            if err:
                return {"message": err}, 400

            status = data.get("status") or "Pendente"
            if status not in STATUS_VALIDOS:
                return {
                    "message": f"status invalido: {status!r}. Valores aceitos: {sorted(STATUS_VALIDOS)}."
                }, 400

            # Side-effects herdados de /tarefas (PR D4.3): se vier
            # publicacao_djen_id, valida tenant, auto-deriva caso_id
            # se omitido, e marca a pub como 'lida' (tratada). Preserva
            # o fluxo Kanban<>DJEN da Epic #3.
            tenant_id = get_tenant_id()
            publicacao_djen_id = data.get("publicacao_djen_id")
            caso_id = data.get("caso_id")
            pub_djen = None
            if publicacao_djen_id:
                pub_djen = PublicacaoDJEN.query.filter_by(
                    id=int(publicacao_djen_id), tenant_id=tenant_id
                ).first()
                if not pub_djen:
                    return {"message": "Publicacao DJEN nao encontrada."}, 404
                if not caso_id and pub_djen.caso_id:
                    caso_id = pub_djen.caso_id

            item = ItemAgenda(
                tenant_id=tenant_id,
                user_id=user_id,
                tipo=tipo,
                categoria=data.get("categoria") or "Outros",
                titulo=titulo,
                descricao=data.get("descricao"),
                status=status,
                prioridade=data.get("prioridade") or "Normal",
                data_inicio=data_inicio,
                data_fim=data_fim,
                data_vencimento=data_vencimento,
                posicao=data.get("posicao", 0),
                caso_id=caso_id,
                publicacao_djen_id=int(publicacao_djen_id) if publicacao_djen_id else None,
                prazo_validado=bool(data.get("prazo_validado", True)),
                prazo_calculado_por_ia=bool(data.get("prazo_calculado_por_ia", False)),
                prazo_dias_origem=data.get("prazo_dias_origem"),
                origem_id=data.get("origem_id"),
                notificacoes_enviadas=data.get("notificacoes_enviadas") or {},
            )
            db.session.add(item)
            # Marca pub como tratada (lida=true) — idempotente.
            if pub_djen and not pub_djen.lida:
                pub_djen.lida = True
            db.session.commit()
            app.logger.info(
                f"ItemAgenda criado (id={item.id}, tipo={item.tipo}, "
                f"titulo='{item.titulo}') por user {user_id}."
            )
            return item, 201

    @ns.route("/<int:item_id>")
    @ns.response(404, "ItemAgenda nao encontrado ou nao pertence ao tenant.")
    @ns.param("item_id", "ID do item da agenda")
    class ItemAgendaDetailAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @ns.marshal_with(output_dto)
        @ns.doc(security="jsonWebToken")
        def get(self, item_id):
            return get_item_or_404(ItemAgenda, item_id)

        @jwt_required()
        @tenant_scoped
        @ns.expect(input_dto)
        @ns.marshal_with(output_dto)
        @ns.doc(security="jsonWebToken")
        def put(self, item_id):
            user_id = get_jwt_identity()
            item = get_item_or_404(ItemAgenda, item_id)
            data = request.get_json() or {}

            if "titulo" in data:
                titulo = (data.get("titulo") or "").strip()
                if not titulo:
                    return {"message": "titulo nao pode ser vazio."}, 400
                item.titulo = titulo

            if "tipo" in data:
                tipo = data["tipo"]
                if tipo not in TIPOS_VALIDOS:
                    return {"message": f"tipo invalido: {tipo!r}."}, 400
                item.tipo = tipo

            if "status" in data:
                status = data["status"]
                if status not in STATUS_VALIDOS:
                    return {"message": f"status invalido: {status!r}."}, 400
                item.status = status

            # Datas: cada uma eh opcional, validamos so se vier no payload.
            for campo in ("data_inicio", "data_fim", "data_vencimento"):
                if campo in data:
                    valor, err = _parse_dt(data[campo])
                    if err:
                        return {"message": err}, 400
                    setattr(item, campo, valor)

            # Demais campos: aplicacao direta se presentes.
            for campo in (
                "categoria",
                "descricao",
                "prioridade",
                "posicao",
                "caso_id",
                "publicacao_djen_id",
                "prazo_validado",
                "prazo_calculado_por_ia",
                "prazo_dias_origem",
                "origem_id",
                "notificacoes_enviadas",
            ):
                if campo in data:
                    setattr(item, campo, data[campo])

            db.session.commit()
            app.logger.info(f"ItemAgenda {item.id} atualizado por user {user_id}.")
            return item

        @jwt_required()
        @tenant_scoped
        @ns.response(204, "Item deletado com sucesso.")
        @ns.doc(security="jsonWebToken")
        def delete(self, item_id):
            user_id = get_jwt_identity()
            item = get_item_or_404(ItemAgenda, item_id)
            db.session.delete(item)
            db.session.commit()
            app.logger.info(f"ItemAgenda {item.id} deletado por user {user_id}.")
            return "", 204

    # --- Endpoints do Kanban (PR D4.1) ---
    # Reorder + validar-prazo + concluir: mirroram os equivalentes de
    # /tarefas, mas usando ItemAgenda como fonte. Necessarios pra
    # PrazosPage (kanban) migrar do legado /tarefas pra /itens-agenda
    # sem perder funcionalidade.

    @ns.route("/reorder")
    class ItemAgendaReorderAPI(Resource):
        """Reordena tarefas no Kanban (drag-drop).

        Body:
            {"columns": {"Pendente": [12, 5, 3], "Em Andamento": [8]}}

        Para cada coluna, atualiza status=<coluna> e posicao=<indice+1>.
        IDs desconhecidos sao ignorados silenciosamente (nao vaza
        existencia cross-tenant). So mexe em itens com tipo='tarefa' —
        eventos nao tem kanban.
        """

        @jwt_required()
        @tenant_scoped
        @ns.doc(security="jsonWebToken")
        def put(self):
            tenant_id = get_tenant_id()
            data = request.get_json(silent=True) or {}
            columns = data.get("columns")
            if not isinstance(columns, dict):
                return {"message": "Campo 'columns' deve ser um objeto status -> [ids]."}, 400

            todos_ids = []
            for status, ids in columns.items():
                if status not in STATUS_VALIDOS:
                    return {
                        "message": f"Status invalido na coluna: {status!r}. Aceitos: {sorted(STATUS_VALIDOS)}."
                    }, 400
                if not isinstance(ids, list):
                    return {"message": "Cada coluna precisa ser uma lista de ids."}, 400
                todos_ids.extend(ids)

            if not todos_ids:
                return {"updated": 0}, 200

            # Filtra por tenant + tipo='tarefa' (kanban so mexe em tarefas)
            itens = ItemAgenda.query.filter(
                ItemAgenda.tenant_id == tenant_id,
                ItemAgenda.tipo == "tarefa",
                ItemAgenda.id.in_(todos_ids),
            ).all()
            por_id = {i.id: i for i in itens}

            atualizadas = 0
            for status, ids in columns.items():
                for indice, item_id in enumerate(ids, start=1):
                    item = por_id.get(item_id)
                    if item is None:
                        continue
                    item.status = status
                    item.posicao = indice
                    atualizadas += 1

            db.session.commit()
            return {"updated": atualizadas}, 200

    @ns.route("/<int:item_id>/validar-prazo")
    class ItemAgendaValidarPrazoAPI(Resource):
        """Marca prazo IA como validado pelo advogado.

        Mirror de /tarefas/{id}/validar-prazo. Aceita opcionalmente nova
        data_vencimento + prioridade no body. Remove o badge "IA —
        confirmar prazo" do card no Kanban.
        """

        @jwt_required()
        @tenant_scoped
        @ns.marshal_with(output_dto)
        @ns.doc(security="jsonWebToken")
        def patch(self, item_id):
            item = get_item_or_404(ItemAgenda, item_id)
            data = request.get_json(silent=True) or {}

            if "data_vencimento" in data:
                valor, err = _parse_dt(data["data_vencimento"])
                if err:
                    return {"message": err}, 400
                item.data_vencimento = valor

            if "prioridade" in data and data["prioridade"]:
                item.prioridade = data["prioridade"]

            item.prazo_validado = True
            db.session.commit()
            return item

    @ns.route("/<int:item_id>/concluir")
    class ItemAgendaConcluirAPI(Resource):
        """Atalho de 1 clique: marca status='Concluido' + prazo_validado=True.

        Mirror de /tarefas/{id}/concluir. Idempotente para itens ja
        concluidos.
        """

        @jwt_required()
        @tenant_scoped
        @ns.marshal_with(output_dto)
        @ns.doc(security="jsonWebToken")
        def patch(self, item_id):
            item = get_item_or_404(ItemAgenda, item_id)
            item.status = "Concluido"
            item.prazo_validado = True
            db.session.commit()
            return item

    # --- Tratamento (Onda 1) ---
    # Endpoint dedicado pra registrar como o prazo foi tratado.
    # Distinto de PATCH /concluir (que so muda status):
    #   - acao='cumpri'   → status=Concluido + tratado_em=now + como_tratado
    #   - acao='cancelar' → status=Cancelado + tratado_em=now + como_tratado
    #   - acao='reabrir'  → status=Pendente + limpa tratado_em (reabertura)
    # Idempotente: re-rodar com mesma acao nao quebra.

    ACOES_TRATAMENTO = {"cumpri", "cancelar", "reabrir"}

    @ns.route("/<int:item_id>/tratar")
    class ItemAgendaTratarAPI(Resource):
        """Registra o tratamento dado ao prazo pelo advogado."""

        @jwt_required()
        @tenant_scoped
        @ns.marshal_with(output_dto)
        @ns.doc(security="jsonWebToken")
        def post(self, item_id):
            from datetime import datetime as _dt  # noqa: PLC0415

            item = get_item_or_404(ItemAgenda, item_id)
            data = request.get_json(silent=True) or {}

            acao = (data.get("acao") or "").strip()
            if acao not in ACOES_TRATAMENTO:
                return {
                    "message": (
                        f"Acao invalida: {acao!r}. " f"Aceitas: {sorted(ACOES_TRATAMENTO)}."
                    )
                }, 400

            como_tratado = (data.get("como_tratado") or "").strip() or None
            peticao_id = data.get("peticao_cumpridora_id")

            # Validar peticao_cumpridora pertence ao tenant (defesa contra
            # cross-tenant). Documento.id resolvido via FK ja restringe ao
            # banco; aqui adicionamos check explicito.
            if peticao_id is not None:
                from models import Documento  # noqa: PLC0415

                pet = Documento.query.filter_by(
                    id=int(peticao_id), tenant_id=item.tenant_id
                ).first()
                if not pet:
                    return {"message": "Peticao cumpridora nao encontrada neste tenant."}, 404

            if acao == "cumpri":
                item.status = "Concluido"
                item.prazo_validado = True
                item.tratado_em = _dt.utcnow()
                if como_tratado is not None:
                    item.como_tratado = como_tratado
                if peticao_id is not None:
                    item.peticao_cumpridora_id = int(peticao_id)
            elif acao == "cancelar":
                item.status = "Cancelado"
                item.prazo_validado = True
                item.tratado_em = _dt.utcnow()
                if como_tratado is not None:
                    item.como_tratado = como_tratado
            elif acao == "reabrir":
                # Reabre o prazo: limpa tratado_em e volta pra Pendente.
                # Preserva como_tratado/peticao_cumpridora_id no historico
                # (nao apagamos — viram referencia do "ja tentei tratar
                # mas voltou").
                item.status = "Pendente"
                item.tratado_em = None

            db.session.commit()
            return item
