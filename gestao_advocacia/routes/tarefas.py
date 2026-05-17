from datetime import datetime

from flask import request
from flask_jwt_extended import get_jwt_identity, jwt_required
from flask_restx import Resource, abort
from sqlalchemy import func

from extensions import db
from helpers import get_item_or_404, get_list_query, get_tenant_id, tenant_scoped
from models import PublicacaoDJEN, TarefaPrazo
from services.itens_agenda_sync import (
    delete_item_da_tarefa,
    sync_tarefa,
)


def register_tarefas_routes(tarefas_ns, tarefa_input_model_dto, tarefa_model_dto):
    @tarefas_ns.route("/")
    class TarefaListAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @tarefas_ns.marshal_list_with(tarefa_model_dto)
        @tarefas_ns.doc(security="jsonWebToken")
        def get(self):
            tarefas = (
                get_list_query(TarefaPrazo)
                .order_by(
                    TarefaPrazo.status.asc(),
                    TarefaPrazo.posicao.asc().nulls_last(),
                    TarefaPrazo.id.asc(),
                )
                .all()
            )
            return tarefas

        @jwt_required()
        @tenant_scoped
        @tarefas_ns.expect(tarefa_input_model_dto)
        @tarefas_ns.marshal_with(tarefa_model_dto, code=201)
        @tarefas_ns.doc(security="jsonWebToken")
        def post(self):
            user_id = get_jwt_identity()
            tenant_id = get_tenant_id()
            data = request.get_json()

            dv = data.get("data_vencimento")
            data_vencimento_obj = None
            if dv:
                try:
                    data_vencimento_obj = datetime.fromisoformat(dv.replace("Z", "+00:00"))
                except ValueError:
                    pass

            status = data.get("status", "A Fazer")

            # Insere o card no fim da coluna (max posicao + 1) para nao alterar a ordem dos demais.
            max_posicao = (
                db.session.query(func.max(TarefaPrazo.posicao))
                .filter(TarefaPrazo.tenant_id == tenant_id, TarefaPrazo.status == status)
                .scalar()
            )
            proxima_posicao = (max_posicao or 0) + 1

            # Epic #3 (#177): se vier publicacao_djen_id, valida que pertence
            # ao tenant, deriva caso_id automaticamente quando nao informado
            # explicitamente, e marca a publicacao como 'lida' (tratada).
            publicacao_djen_id = data.get("publicacao_djen_id")
            caso_id = data.get("caso_id")
            pub_djen = None
            if publicacao_djen_id:
                pub_djen = PublicacaoDJEN.query.filter_by(
                    id=int(publicacao_djen_id), tenant_id=tenant_id
                ).first()
                if not pub_djen:
                    abort(404, "Publicacao DJEN nao encontrada.")
                # Auto-derivacao: se a pub esta vinculada a um caso e o user
                # nao escolheu outro caso, herda. Mantem flexibilidade pra
                # criar tarefa noutro caso (usuario sobreescreve via UI).
                if not caso_id and pub_djen.caso_id:
                    caso_id = pub_djen.caso_id

            nova_tarefa = TarefaPrazo(
                titulo=data["titulo"],
                descricao=data.get("descricao"),
                status=status,
                prioridade=data.get("prioridade", "Normal"),
                tipo_tarefa=data.get("tipo_tarefa", "Prazo"),
                data_vencimento=data_vencimento_obj,
                origem_id=data.get("origem_id"),
                caso_id=caso_id,
                publicacao_djen_id=int(publicacao_djen_id) if publicacao_djen_id else None,
                posicao=proxima_posicao,
                user_id=user_id,
                tenant_id=tenant_id,
            )

            db.session.add(nova_tarefa)

            # Marca publicacao como tratada (lida=true) — segue o padrao do
            # botao "marcar como lida" existente. Se a pub ja estava lida,
            # idempotente.
            if pub_djen and not pub_djen.lida:
                pub_djen.lida = True

            # PR D2: flush para garantir tarefa.id antes do sync, depois
            # cria o espelho em item_agenda. Ambas escritas comitam juntas
            # — se o sync falhar, a tarefa nao eh persistida (atomico).
            db.session.flush()
            sync_tarefa(nova_tarefa)

            db.session.commit()
            return nova_tarefa, 201

    @tarefas_ns.route("/reorder")
    class TarefaReorderAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @tarefas_ns.doc(security="jsonWebToken")
        def put(self):
            """Reordena tarefas dentro/entre colunas do kanban.

            Body esperado:
                {"columns": {"A Fazer": [12, 5, 3], "Fazendo": [8, 2]}}

            Para cada coluna recebida, define status=<coluna> e posicao=<indice na lista+1>
            apenas para tarefas pertencentes ao tenant atual. IDs desconhecidos sao ignorados
            silenciosamente para nao vazar existencia cross-tenant.
            """
            tenant_id = get_tenant_id()
            data = request.get_json(silent=True) or {}
            columns = data.get("columns")
            if not isinstance(columns, dict):
                abort(400, "Campo 'columns' deve ser um objeto status -> [ids].")

            # Coleta todos os ids referenciados e busca de uma vez para validar tenant.
            todos_ids = []
            for ids in columns.values():
                if not isinstance(ids, list):
                    abort(400, "Cada coluna precisa ser uma lista de ids inteiros.")
                todos_ids.extend(ids)

            if not todos_ids:
                return {"updated": 0}, 200

            tarefas = TarefaPrazo.query.filter(
                TarefaPrazo.tenant_id == tenant_id,
                TarefaPrazo.id.in_(todos_ids),
            ).all()
            por_id = {t.id: t for t in tarefas}

            atualizadas = 0
            tarefas_alteradas = []
            for status, ids in columns.items():
                for indice, tarefa_id in enumerate(ids, start=1):
                    tarefa = por_id.get(tarefa_id)
                    if tarefa is None:
                        continue
                    tarefa.status = status
                    tarefa.posicao = indice
                    tarefas_alteradas.append(tarefa)
                    atualizadas += 1

            # PR D2: replica em item_agenda. Reorder mexe em status+posicao,
            # ambos refletidos no espelho.
            for tarefa in tarefas_alteradas:
                sync_tarefa(tarefa)

            db.session.commit()
            return {"updated": atualizadas}, 200

    @tarefas_ns.route("/<int:id>/validar-prazo")
    class TarefaValidarPrazoAPI(Resource):
        """Feature Kanban<>DJEN: marca prazo como validado pelo advogado.

        Aceita opcionalmente nova data_vencimento no body. Sem corpo apenas
        confirma o prazo calculado pela IA. Esta acao remove o badge "IA -
        confirmar prazo" do card no Kanban.
        """

        @jwt_required()
        @tenant_scoped
        @tarefas_ns.marshal_with(tarefa_model_dto)
        @tarefas_ns.doc(security="jsonWebToken")
        def patch(self, id):
            tarefa = get_item_or_404(TarefaPrazo, id)
            data = request.get_json(silent=True) or {}

            dv = data.get("data_vencimento")
            if dv:
                try:
                    tarefa.data_vencimento = datetime.fromisoformat(dv.replace("Z", "+00:00"))
                except ValueError:
                    abort(400, "data_vencimento invalida (esperado ISO 8601).")

            if "prioridade" in data and data["prioridade"]:
                tarefa.prioridade = data["prioridade"]

            tarefa.prazo_validado = True
            sync_tarefa(tarefa)  # PR D2: dual-write
            db.session.commit()
            return tarefa

    @tarefas_ns.route("/<int:id>/concluir")
    class TarefaConcluirAPI(Resource):
        """Feature Kanban<>DJEN: atalho de 1 clique para 'já cumpri / não era prazo'.

        Marca status=Concluido + prazo_validado=True. Idempotente para tarefas
        ja concluidas.
        """

        @jwt_required()
        @tenant_scoped
        @tarefas_ns.marshal_with(tarefa_model_dto)
        @tarefas_ns.doc(security="jsonWebToken")
        def patch(self, id):
            tarefa = get_item_or_404(TarefaPrazo, id)
            tarefa.status = "Concluído"
            tarefa.prazo_validado = True
            sync_tarefa(tarefa)  # PR D2: dual-write
            db.session.commit()
            return tarefa

    @tarefas_ns.route("/<int:id>")
    class TarefaDetailAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @tarefas_ns.marshal_with(tarefa_model_dto)
        @tarefas_ns.doc(security="jsonWebToken")
        def get(self, id):
            tarefa = get_item_or_404(TarefaPrazo, id)
            return tarefa

        @jwt_required()
        @tenant_scoped
        @tarefas_ns.expect(tarefa_input_model_dto)
        @tarefas_ns.marshal_with(tarefa_model_dto)
        @tarefas_ns.doc(security="jsonWebToken")
        def put(self, id):
            tarefa = get_item_or_404(TarefaPrazo, id)
            data = request.get_json()

            tarefa.titulo = data.get("titulo", tarefa.titulo)
            tarefa.descricao = data.get("descricao", tarefa.descricao)
            tarefa.status = data.get("status", tarefa.status)
            tarefa.prioridade = data.get("prioridade", tarefa.prioridade)
            tarefa.tipo_tarefa = data.get("tipo_tarefa", tarefa.tipo_tarefa)
            if "caso_id" in data:
                tarefa.caso_id = data.get("caso_id")

            dv = data.get("data_vencimento")
            if dv is not None:
                if dv == "":
                    tarefa.data_vencimento = None
                else:
                    try:
                        tarefa.data_vencimento = datetime.fromisoformat(dv.replace("Z", "+00:00"))
                    except ValueError:
                        pass

            sync_tarefa(tarefa)  # PR D2: dual-write
            db.session.commit()
            return tarefa

        @jwt_required()
        @tenant_scoped
        @tarefas_ns.response(204, "Deletado com sucesso")
        @tarefas_ns.doc(security="jsonWebToken")
        def delete(self, id):
            tarefa = get_item_or_404(TarefaPrazo, id)
            delete_item_da_tarefa(tarefa.id)  # PR D2: dual-write
            db.session.delete(tarefa)
            db.session.commit()
            return "", 204
