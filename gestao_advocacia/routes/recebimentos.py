"""Routes para /recebimentos.

Apos a Fase 1 do "Recebimento Robusto", o modelo Recebimento ganhou colunas
de verdade pra status, data_vencimento, data_pagamento, categoria, cliente_id,
forma_pagamento, notas e recorrencia_id. Os endpoints aqui ja escrevem nessas
colunas e mantem os campos antigos (data_recebimento, recebido) sincronizados
pra nao quebrar codigo legado.

Novo: POST /recebimentos/serie cria N recebimentos vinculados a uma
RecorrenciaRecebimento (parcelamento fechado ou honorario recorrente).
"""

from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal

from flask import request
from flask_jwt_extended import get_jwt_identity, jwt_required
from flask_restx import Resource

from extensions import db
from helpers import get_item_or_404, get_list_query, get_tenant_id, query_for_tenant, tenant_scoped
from models import Caso, Cliente, Recebimento, RecorrenciaRecebimento

# Status validos. Centralizado pra reuso (validacao + dashboard).
STATUS_VALIDOS = {"Pendente", "Pago", "Vencido", "Cancelado", "Em Negociacao"}
STATUS_PAGO = "Pago"

# Tipos validos de recebimento (Etapa 6). Lista fechada — frontend usa
# dropdown. "Outros" cobre casos atipicos sem mudar codigo.
TIPOS_RECEBIMENTO_VALIDOS = {
    "Diretamente do cliente",
    "Precatorio",
    "RPV",
    "Deposito judicial",
    "Acordo extrajudicial",
    "Outros",
}


def _validar_ano_previsao(data):
    """Retorna (ano|None, erro|None). Aceita ausente, None, '' ou int valido."""
    if "ano_previsao" not in data:
        return None, None
    raw = data.get("ano_previsao")
    if raw in (None, ""):
        return None, None
    try:
        ano = int(raw)
    except (TypeError, ValueError):
        return None, "ano_previsao deve ser um numero inteiro (YYYY)."
    if ano < 1900 or ano > 2200:
        return None, "ano_previsao fora do intervalo permitido (1900-2200)."
    return ano, None


def _validar_tipo_recebimento(data):
    """Retorna (tipo|None, erro|None). Aceita ausente, None, '' ou string valida."""
    if "tipo_recebimento" not in data:
        return None, None
    raw = data.get("tipo_recebimento")
    if raw in (None, ""):
        return None, None
    if not isinstance(raw, str):
        return None, "tipo_recebimento deve ser texto."
    tipo = raw.strip()
    if tipo not in TIPOS_RECEBIMENTO_VALIDOS:
        return (
            None,
            f"tipo_recebimento invalido. Use um de: {sorted(TIPOS_RECEBIMENTO_VALIDOS)}",
        )
    return tipo, None


def _parse_date_optional(raw):
    """Aceita string ISO ou None. Retorna (date|None, erro|None)."""
    if not raw:
        return None, None
    if isinstance(raw, date):
        return raw, None
    try:
        return datetime.strptime(raw.strip(), "%Y-%m-%d").date(), None
    except (ValueError, AttributeError):
        return None, f"Formato de data invalido: {raw!r}. Use YYYY-MM-DD."


def _normalize_status(data, default="Pendente"):
    """Resolve o status do payload.

    Aceita campo `status` (preferido). Cai pra alias legado `recebido`
    (boolean) se status nao vier. Default usado pra POST; PUT deve passar o
    status atual como default pra preservar.
    """
    status = data.get("status")
    if isinstance(status, str) and status.strip():
        s = status.strip()
        if s not in STATUS_VALIDOS:
            return None, f"status invalido. Use um de: {sorted(STATUS_VALIDOS)}"
        return s, None
    if "recebido" in data and data["recebido"] is not None:
        return (STATUS_PAGO if bool(data["recebido"]) else "Pendente"), None
    return default, None


def _validar_caso_e_cliente(data, current_caso_id=None, current_cliente_id=None):
    """Valida caso_id e cliente_id no payload (se presentes). Retorna
    (caso_id, cliente_id, erro)."""
    caso_id = data.get("caso_id") if "caso_id" in data else current_caso_id
    cliente_id = data.get("cliente_id") if "cliente_id" in data else current_cliente_id

    if caso_id is not None:
        caso = query_for_tenant(Caso).filter_by(id=caso_id).first()
        if not caso:
            return None, None, f"Caso ID {caso_id} nao encontrado."
        # Se cliente_id nao foi explicitamente enviado, deduzir do caso.
        if "cliente_id" not in data and cliente_id is None:
            cliente_id = caso.cliente_id

    if cliente_id is not None:
        cliente = query_for_tenant(Cliente).filter_by(id=cliente_id).first()
        if not cliente:
            return None, None, f"Cliente ID {cliente_id} nao encontrado."

    return caso_id, cliente_id, None


def _aplicar_data_pagamento(recebimento, data, status_novo):
    """Aplica regra de data_pagamento:
    - Se payload trouxe data_pagamento explicita: usa ela.
    - Senao, se status virou 'Pago' agora e nao tem data_pagamento: usa hoje.
    - Se status saiu de 'Pago': limpa data_pagamento.
    """
    raw = data.get("data_pagamento")
    if raw is not None:  # explicitamente enviada (mesmo que string vazia)
        if raw == "":
            recebimento.data_pagamento = None
        else:
            parsed, err = _parse_date_optional(raw)
            if err:
                return err
            recebimento.data_pagamento = parsed
        return None

    # Alias legado: data_recebimento — se enviada e status=Pago, usa ela
    if status_novo == STATUS_PAGO and not recebimento.data_pagamento:
        legacy = data.get("data_recebimento")
        if legacy:
            parsed, err = _parse_date_optional(legacy)
            if err:
                return err
            recebimento.data_pagamento = parsed
        else:
            recebimento.data_pagamento = date.today()
    elif status_novo != STATUS_PAGO:
        recebimento.data_pagamento = None
    return None


def _proxima_data(base, frequencia, indice):
    """Retorna a data da N-esima parcela a partir de `base`.

    indice=0 retorna a propria base, indice=1 retorna a 2a parcela etc.
    """
    freq = (frequencia or "MENSAL").upper()
    if freq == "SEMANAL":
        return base + timedelta(days=7 * indice)
    if freq == "QUINZENAL":
        return base + timedelta(days=15 * indice)
    if freq == "ANUAL":
        # Trata 29/02: cai pra 28/02 em anos nao bissextos.
        try:
            return base.replace(year=base.year + indice)
        except ValueError:
            return base.replace(year=base.year + indice, day=28)
    # MENSAL (default)
    ano = base.year
    mes = base.month + indice
    while mes > 12:
        mes -= 12
        ano += 1
    dia = base.day
    # Se o dia nao existe no mes alvo (ex: 31 em fev), usa o ultimo dia.
    while dia > 28:
        try:
            return date(ano, mes, dia)
        except ValueError:
            dia -= 1
    return date(ano, mes, dia)


def register_recebimentos_routes(
    app,
    recebimentos_ns,
    recebimento_input_model_dto,
    recebimento_model_dto,
    recebimento_serie_input_dto,
    recebimento_serie_output_dto,
    finance_access_required,
):
    @recebimentos_ns.route("/")
    class RecebimentoListAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @finance_access_required
        @recebimentos_ns.marshal_list_with(recebimento_model_dto)
        @recebimentos_ns.doc(security="jsonWebToken")
        def get(self):
            recebimentos = (
                get_list_query(Recebimento)
                .order_by(Recebimento.data_vencimento.desc().nullslast())
                .all()
            )
            return recebimentos

        @jwt_required()
        @tenant_scoped
        @recebimentos_ns.expect(recebimento_input_model_dto)
        @recebimentos_ns.marshal_with(recebimento_model_dto, code=201)
        @recebimentos_ns.doc(security="jsonWebToken")
        def post(self):
            user_id = get_jwt_identity()
            data = request.get_json() or {}
            if "descricao" not in data or "valor" not in data:
                recebimentos_ns.abort(400, message="Descricao e valor sao obrigatorios.")
            try:
                valor_decimal = float(data["valor"])
                if valor_decimal <= 0:
                    recebimentos_ns.abort(400, message="Valor deve ser positivo.")
            except (TypeError, ValueError):
                recebimentos_ns.abort(400, message="Formato de valor invalido.")

            # Datas (todas opcionais)
            data_venc, err = _parse_date_optional(
                data.get("data_vencimento") or data.get("data_recebimento")
            )
            if err:
                recebimentos_ns.abort(400, message=err)

            status_novo, err = _normalize_status(data, default="Pendente")
            if err:
                recebimentos_ns.abort(400, message=err)

            caso_id, cliente_id, err = _validar_caso_e_cliente(data)
            if err:
                recebimentos_ns.abort(404, message=err)

            ano_previsao, err = _validar_ano_previsao(data)
            if err:
                recebimentos_ns.abort(400, message=err)
            tipo_recebimento, err = _validar_tipo_recebimento(data)
            if err:
                recebimentos_ns.abort(400, message=err)

            novo = Recebimento(
                descricao=data["descricao"],
                valor=valor_decimal,
                data_vencimento=data_venc,
                status=status_novo,
                categoria=data.get("categoria"),
                forma_pagamento=data.get("forma_pagamento"),
                notas=data.get("notas"),
                cliente_id=cliente_id,
                caso_id=caso_id,
                user_id=user_id,
                tenant_id=get_tenant_id(),
                ano_previsao=ano_previsao,
                tipo_recebimento=tipo_recebimento,
            )
            err = _aplicar_data_pagamento(novo, data, status_novo)
            if err:
                recebimentos_ns.abort(400, message=err)
            novo.sync_legacy_fields()
            db.session.add(novo)
            db.session.commit()
            app.logger.info(f"Novo recebimento ID {novo.id} criado para usuario {user_id}.")
            return novo, 201

    @recebimentos_ns.route("/<int:recebimento_id_param>")
    @recebimentos_ns.response(404, "Recebimento nao encontrado.")
    @recebimentos_ns.param("recebimento_id_param", "ID do recebimento")
    class RecebimentoDetailAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @finance_access_required
        @recebimentos_ns.marshal_with(recebimento_model_dto)
        @recebimentos_ns.doc(security="jsonWebToken")
        def get(self, recebimento_id_param):
            return get_item_or_404(Recebimento, recebimento_id_param)

        @jwt_required()
        @tenant_scoped
        @recebimentos_ns.expect(recebimento_input_model_dto)
        @recebimentos_ns.marshal_with(recebimento_model_dto)
        @recebimentos_ns.doc(security="jsonWebToken")
        def put(self, recebimento_id_param):
            user_id = get_jwt_identity()
            recebimento = get_item_or_404(Recebimento, recebimento_id_param)
            data = request.get_json() or {}

            if "descricao" in data:
                recebimento.descricao = data["descricao"]
            if "valor" in data:
                try:
                    valor_decimal = float(data["valor"])
                    if valor_decimal <= 0:
                        recebimentos_ns.abort(400, message="Valor deve ser positivo.")
                    recebimento.valor = valor_decimal
                except (TypeError, ValueError):
                    recebimentos_ns.abort(400, message="Formato de valor invalido.")

            if "data_vencimento" in data or "data_recebimento" in data:
                data_venc, err = _parse_date_optional(
                    data.get("data_vencimento") or data.get("data_recebimento")
                )
                if err:
                    recebimentos_ns.abort(400, message=err)
                recebimento.data_vencimento = data_venc

            status_novo, err = _normalize_status(data, default=recebimento.status)
            if err:
                recebimentos_ns.abort(400, message=err)
            recebimento.status = status_novo

            if "categoria" in data:
                recebimento.categoria = data["categoria"]
            if "forma_pagamento" in data:
                recebimento.forma_pagamento = data["forma_pagamento"]
            if "notas" in data:
                recebimento.notas = data["notas"]

            caso_id, cliente_id, err = _validar_caso_e_cliente(
                data,
                current_caso_id=recebimento.caso_id,
                current_cliente_id=recebimento.cliente_id,
            )
            if err:
                recebimentos_ns.abort(404, message=err)
            recebimento.caso_id = caso_id
            recebimento.cliente_id = cliente_id

            if "ano_previsao" in data:
                ano_previsao, err = _validar_ano_previsao(data)
                if err:
                    recebimentos_ns.abort(400, message=err)
                recebimento.ano_previsao = ano_previsao
            if "tipo_recebimento" in data:
                tipo_recebimento, err = _validar_tipo_recebimento(data)
                if err:
                    recebimentos_ns.abort(400, message=err)
                recebimento.tipo_recebimento = tipo_recebimento

            err = _aplicar_data_pagamento(recebimento, data, status_novo)
            if err:
                recebimentos_ns.abort(400, message=err)

            recebimento.sync_legacy_fields()
            db.session.commit()
            app.logger.info(f"Recebimento ID {recebimento.id} atualizado por usuario {user_id}.")
            return recebimento

        @jwt_required()
        @tenant_scoped
        @recebimentos_ns.response(204, "Recebimento deletado.")
        @recebimentos_ns.doc(security="jsonWebToken")
        def delete(self, recebimento_id_param):
            user_id = get_jwt_identity()
            recebimento = get_item_or_404(Recebimento, recebimento_id_param)
            db.session.delete(recebimento)
            db.session.commit()
            app.logger.info(f"Recebimento ID {recebimento.id} deletado por usuario {user_id}.")
            return "", 204

    # ===== Historico de pagamentos recebidos (status=Pago) =====
    @recebimentos_ns.route("/historico")
    class RecebimentoHistoricoAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @finance_access_required
        @recebimentos_ns.doc(
            security="jsonWebToken",
            params={
                "ano": "Ano (YYYY). Default: ano corrente.",
                "mes": "Mes (1-12). Opcional: se omitido, retorna o ano inteiro.",
            },
            description=(
                "Historico de recebimentos pagos (status=Pago) agrupado por "
                "data_pagamento. Retorna itens do periodo + totais consolidados "
                "(mes, ano), breakdown por categoria e por mes (12 buckets)."
            ),
        )
        def get(self):
            hoje = date.today()
            try:
                ano = int(request.args.get("ano") or hoje.year)
            except (TypeError, ValueError):
                recebimentos_ns.abort(400, message="ano invalido. Use YYYY.")
            if ano < 1900 or ano > 2200:
                recebimentos_ns.abort(400, message="ano fora do intervalo permitido.")

            mes_raw = request.args.get("mes")
            mes = None
            if mes_raw not in (None, ""):
                try:
                    mes = int(mes_raw)
                except (TypeError, ValueError):
                    recebimentos_ns.abort(400, message="mes invalido. Use 1-12.")
                if mes < 1 or mes > 12:
                    recebimentos_ns.abort(400, message="mes deve estar entre 1 e 12.")

            # Janela do ano inteiro (sempre buscamos o ano todo pra montar
            # `por_mes` e `total_ano`; o filtro de mes so afeta `itens` e
            # `total_mes`).
            ini_ano = date(ano, 1, 1)
            fim_ano = date(ano, 12, 31)

            query = query_for_tenant(Recebimento).filter(
                Recebimento.status == STATUS_PAGO,
                Recebimento.data_pagamento.isnot(None),
                Recebimento.data_pagamento >= ini_ano,
                Recebimento.data_pagamento <= fim_ano,
            )
            recebimentos_ano = query.order_by(Recebimento.data_pagamento.desc()).all()

            # Buckets por mes (1..12). Inicializa zerado pra UI nao ter que
            # preencher meses faltantes.
            por_mes_total = [Decimal("0") for _ in range(12)]
            por_mes_qtd = [0 for _ in range(12)]
            total_ano = Decimal("0")
            por_categoria_acc = defaultdict(lambda: {"total": Decimal("0"), "qtd": 0})

            # Itens filtrados pelo mes (se houver). `total_mes`/`qtd_mes` so
            # existem quando o usuario filtrou mes especifico.
            itens_filtrados = []
            total_mes = Decimal("0") if mes else None
            qtd_mes = 0 if mes else None

            for r in recebimentos_ano:
                valor = Decimal(str(r.valor))
                total_ano += valor
                m_idx = r.data_pagamento.month
                por_mes_total[m_idx - 1] += valor
                por_mes_qtd[m_idx - 1] += 1

                cat = r.categoria or "Sem categoria"
                por_categoria_acc[cat]["total"] += valor
                por_categoria_acc[cat]["qtd"] += 1

                if mes is None or m_idx == mes:
                    itens_filtrados.append(r.to_dict())
                    if mes is not None:
                        total_mes += valor
                        qtd_mes += 1

            por_categoria = [
                {"categoria": cat, "total": str(v["total"]), "qtd": v["qtd"]}
                for cat, v in sorted(
                    por_categoria_acc.items(), key=lambda kv: kv[1]["total"], reverse=True
                )
            ]
            por_mes = [
                {"mes": m + 1, "total": str(por_mes_total[m]), "qtd": por_mes_qtd[m]}
                for m in range(12)
            ]

            return {
                "ano": ano,
                "mes": mes,
                "itens": itens_filtrados,
                "total_mes": str(total_mes) if total_mes is not None else None,
                "total_ano": str(total_ano),
                "qtd_mes": qtd_mes,
                "qtd_ano": len(recebimentos_ano),
                "por_categoria": por_categoria,
                "por_mes": por_mes,
            }

    # ===== Novo endpoint: criar serie (recorrente ou parcelada) =====
    @recebimentos_ns.route("/serie")
    class RecebimentoSerieAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @recebimentos_ns.expect(recebimento_serie_input_dto)
        @recebimentos_ns.marshal_with(recebimento_serie_output_dto, code=201)
        @recebimentos_ns.doc(security="jsonWebToken")
        def post(self):
            """Cria uma serie de recebimentos a partir de uma config.

            Tipo PARCELADO: gera total_parcelas recebimentos, com vencimentos
            espacados conforme frequencia (default MENSAL). Numero da parcela
            preenchido (1..N).

            Tipo RECORRENTE: gera total_parcelas (ou 12 se omitido) recebimentos
            "pra frente". Recorrencia fica `ativo=True` pra futura renovacao
            automatica (cron — fora de escopo desta fase).
            """
            user_id = get_jwt_identity()
            data = request.get_json() or {}

            tipo = (data.get("tipo") or "").strip().upper()
            if tipo not in ("RECORRENTE", "PARCELADO"):
                recebimentos_ns.abort(400, message="tipo deve ser RECORRENTE ou PARCELADO.")

            try:
                valor_parcela = float(data["valor_parcela"])
                if valor_parcela <= 0:
                    raise ValueError
            except (KeyError, TypeError, ValueError):
                recebimentos_ns.abort(400, message="valor_parcela invalido.")

            data_inicio, err = _parse_date_optional(data.get("data_inicio"))
            if err or not data_inicio:
                recebimentos_ns.abort(400, message=err or "data_inicio obrigatoria.")

            frequencia = (data.get("frequencia") or "MENSAL").upper()
            if frequencia not in ("MENSAL", "SEMANAL", "QUINZENAL", "ANUAL"):
                recebimentos_ns.abort(400, message="frequencia invalida.")

            total_parcelas = data.get("total_parcelas")
            if tipo == "PARCELADO":
                if not total_parcelas or int(total_parcelas) < 1:
                    recebimentos_ns.abort(400, message="total_parcelas obrigatorio para PARCELADO.")
                total_parcelas = int(total_parcelas)
            else:  # RECORRENTE
                total_parcelas = int(total_parcelas) if total_parcelas else 12
            if total_parcelas > 120:
                recebimentos_ns.abort(400, message="total_parcelas excede limite (120).")

            descricao = (data.get("descricao") or "").strip()
            if not descricao:
                recebimentos_ns.abort(400, message="descricao obrigatoria.")

            caso_id, cliente_id, err = _validar_caso_e_cliente(data)
            if err:
                recebimentos_ns.abort(404, message=err)

            data_fim = _proxima_data(data_inicio, frequencia, total_parcelas - 1)

            recorrencia = RecorrenciaRecebimento(
                tenant_id=get_tenant_id(),
                user_id=user_id,
                tipo=tipo,
                frequencia=frequencia,
                valor_parcela=valor_parcela,
                total_parcelas=total_parcelas,
                data_inicio=data_inicio,
                data_fim=data_fim,
                ativo=True,
                descricao=descricao,
                categoria=data.get("categoria"),
                cliente_id=cliente_id,
                caso_id=caso_id,
            )
            db.session.add(recorrencia)
            db.session.flush()  # pra ter o id antes de criar parcelas

            parcelas = []
            for i in range(total_parcelas):
                venc = _proxima_data(data_inicio, frequencia, i)
                label = (
                    f"{descricao} ({i + 1}/{total_parcelas})"
                    if tipo == "PARCELADO"
                    else f"{descricao} — {venc.strftime('%m/%Y')}"
                )
                rec = Recebimento(
                    descricao=label,
                    valor=valor_parcela,
                    data_vencimento=venc,
                    status="Pendente",
                    categoria=data.get("categoria"),
                    notas=data.get("notas"),
                    cliente_id=cliente_id,
                    caso_id=caso_id,
                    user_id=user_id,
                    tenant_id=get_tenant_id(),
                    recorrencia_id=recorrencia.id,
                    numero_parcela=i + 1,
                )
                rec.sync_legacy_fields()
                db.session.add(rec)
                parcelas.append(rec)

            db.session.commit()
            app.logger.info(
                f"Serie {tipo} (id={recorrencia.id}) com {total_parcelas} parcelas "
                f"criada para usuario {user_id}."
            )
            return {
                "recorrencia_id": recorrencia.id,
                "tipo": tipo,
                "total_geradas": len(parcelas),
                "parcelas": parcelas,
            }, 201
