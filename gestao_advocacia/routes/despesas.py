"""Routes para /despesas.

Apos a Fase 1 do "Despesa Robusto", o modelo Despesa ganhou colunas de
verdade (status, data_vencimento, data_pagamento, categoria, cliente_id,
fornecedor, forma_pagamento, notas, recorrencia_id). Espelha estrutural-
mente recebimentos.py. Campos legados (pago, data_despesa) sao mantidos
sincronizados pra nao quebrar dashboard antigo.

Novo: POST /despesas/serie cria N parcelas vinculadas a uma
RecorrenciaDespesa (aluguel mensal, compra parcelada com fornecedor, etc).
"""

from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal

from flask import request
from flask_jwt_extended import get_jwt_identity, jwt_required
from flask_restx import Resource

from extensions import db
from helpers import get_item_or_404, get_list_query, get_tenant_id, query_for_tenant, tenant_scoped
from models import Caso, Cliente, Despesa, RecorrenciaDespesa

# Status validos (mesmo set do Recebimento — uniformidade no app).
STATUS_VALIDOS = {"Pendente", "Programado", "Pago", "Vencido", "Cancelado", "Em Negociacao"}
STATUS_PAGO = "Pago"


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
    """Resolve o status do payload, com fallback para `pago` legado."""
    status = data.get("status")
    if isinstance(status, str) and status.strip():
        s = status.strip()
        if s not in STATUS_VALIDOS:
            return None, f"status invalido. Use um de: {sorted(STATUS_VALIDOS)}"
        return s, None
    if "pago" in data and data["pago"] is not None:
        return (STATUS_PAGO if bool(data["pago"]) else "Pendente"), None
    return default, None


def _validar_caso_e_cliente(data, current_caso_id=None, current_cliente_id=None):
    """Valida caso_id e cliente_id no payload (se presentes)."""
    caso_id = data.get("caso_id") if "caso_id" in data else current_caso_id
    cliente_id = data.get("cliente_id") if "cliente_id" in data else current_cliente_id

    if caso_id is not None:
        caso = query_for_tenant(Caso).filter_by(id=caso_id).first()
        if not caso:
            return None, None, f"Caso ID {caso_id} nao encontrado."
        if "cliente_id" not in data and cliente_id is None:
            cliente_id = caso.cliente_id

    if cliente_id is not None:
        cliente = query_for_tenant(Cliente).filter_by(id=cliente_id).first()
        if not cliente:
            return None, None, f"Cliente ID {cliente_id} nao encontrado."

    return caso_id, cliente_id, None


def _aplicar_data_pagamento(despesa, data, status_novo):
    """Aplica data_pagamento conforme regra (mesma logica do Recebimento)."""
    raw = data.get("data_pagamento")
    if raw is not None:
        if raw == "":
            despesa.data_pagamento = None
        else:
            parsed, err = _parse_date_optional(raw)
            if err:
                return err
            despesa.data_pagamento = parsed
        return None

    if status_novo == STATUS_PAGO and not despesa.data_pagamento:
        legacy = data.get("data_despesa")
        if legacy:
            parsed, err = _parse_date_optional(legacy)
            if err:
                return err
            despesa.data_pagamento = parsed
        else:
            despesa.data_pagamento = date.today()
    elif status_novo != STATUS_PAGO:
        despesa.data_pagamento = None
    return None


def _proxima_data(base, frequencia, indice):
    """N-esima data a partir de base (mesma logica do recebimento)."""
    freq = (frequencia or "MENSAL").upper()
    if freq == "SEMANAL":
        return base + timedelta(days=7 * indice)
    if freq == "QUINZENAL":
        return base + timedelta(days=15 * indice)
    if freq == "ANUAL":
        try:
            return base.replace(year=base.year + indice)
        except ValueError:
            return base.replace(year=base.year + indice, day=28)
    # MENSAL
    ano = base.year
    mes = base.month + indice
    while mes > 12:
        mes -= 12
        ano += 1
    dia = base.day
    while dia > 28:
        try:
            return date(ano, mes, dia)
        except ValueError:
            dia -= 1
    return date(ano, mes, dia)


def register_despesas_routes(
    app,
    despesas_ns,
    despesa_input_model_dto,
    despesa_model_dto,
    despesa_serie_input_dto,
    despesa_serie_output_dto,
    finance_access_required,
):
    @despesas_ns.route("/")
    class DespesaListAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @finance_access_required
        @despesas_ns.marshal_list_with(despesa_model_dto)
        @despesas_ns.doc(security="jsonWebToken")
        def get(self):
            despesas = (
                get_list_query(Despesa).order_by(Despesa.data_vencimento.desc().nullslast()).all()
            )
            return despesas

        @jwt_required()
        @tenant_scoped
        @despesas_ns.expect(despesa_input_model_dto)
        @despesas_ns.marshal_with(despesa_model_dto, code=201)
        @despesas_ns.doc(security="jsonWebToken")
        def post(self):
            user_id = get_jwt_identity()
            data = request.get_json() or {}
            if "descricao" not in data or "valor" not in data:
                despesas_ns.abort(400, message="Descricao e valor sao obrigatorios.")
            try:
                valor_decimal = float(data["valor"])
                if valor_decimal <= 0:
                    despesas_ns.abort(400, message="Valor deve ser positivo.")
            except (TypeError, ValueError):
                despesas_ns.abort(400, message="Formato de valor invalido.")

            data_venc, err = _parse_date_optional(
                data.get("data_vencimento") or data.get("data_despesa")
            )
            if err:
                despesas_ns.abort(400, message=err)

            status_novo, err = _normalize_status(data, default="Pendente")
            if err:
                despesas_ns.abort(400, message=err)

            caso_id, cliente_id, err = _validar_caso_e_cliente(data)
            if err:
                despesas_ns.abort(404, message=err)

            nova = Despesa(
                descricao=data["descricao"],
                valor=valor_decimal,
                data_vencimento=data_venc,
                status=status_novo,
                categoria=data.get("categoria"),
                forma_pagamento=data.get("forma_pagamento"),
                notas=data.get("notas"),
                fornecedor=data.get("fornecedor"),
                cliente_id=cliente_id,
                caso_id=caso_id,
                user_id=user_id,
                tenant_id=get_tenant_id(),
            )
            err = _aplicar_data_pagamento(nova, data, status_novo)
            if err:
                despesas_ns.abort(400, message=err)
            nova.sync_legacy_fields()
            db.session.add(nova)
            db.session.commit()
            app.logger.info(f"Nova despesa ID {nova.id} criada para usuario {user_id}.")
            return nova, 201

    @despesas_ns.route("/<int:despesa_id_param>")
    @despesas_ns.response(404, "Despesa nao encontrada.")
    @despesas_ns.param("despesa_id_param", "O ID da despesa")
    class DespesaDetailAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @finance_access_required
        @despesas_ns.marshal_with(despesa_model_dto)
        @despesas_ns.doc(security="jsonWebToken")
        def get(self, despesa_id_param):
            return get_item_or_404(Despesa, despesa_id_param)

        @jwt_required()
        @tenant_scoped
        @despesas_ns.expect(despesa_input_model_dto)
        @despesas_ns.marshal_with(despesa_model_dto)
        @despesas_ns.doc(security="jsonWebToken")
        def put(self, despesa_id_param):
            user_id = get_jwt_identity()
            despesa = get_item_or_404(Despesa, despesa_id_param)
            data = request.get_json() or {}

            if "descricao" in data:
                despesa.descricao = data["descricao"]
            if "valor" in data:
                try:
                    valor_decimal = float(data["valor"])
                    if valor_decimal <= 0:
                        despesas_ns.abort(400, message="Valor deve ser positivo.")
                    despesa.valor = valor_decimal
                except (TypeError, ValueError):
                    despesas_ns.abort(400, message="Formato de valor invalido.")

            if "data_vencimento" in data or "data_despesa" in data:
                data_venc, err = _parse_date_optional(
                    data.get("data_vencimento") or data.get("data_despesa")
                )
                if err:
                    despesas_ns.abort(400, message=err)
                despesa.data_vencimento = data_venc

            status_novo, err = _normalize_status(data, default=despesa.status)
            if err:
                despesas_ns.abort(400, message=err)
            despesa.status = status_novo

            if "categoria" in data:
                despesa.categoria = data["categoria"]
            if "forma_pagamento" in data:
                despesa.forma_pagamento = data["forma_pagamento"]
            if "notas" in data:
                despesa.notas = data["notas"]
            if "fornecedor" in data:
                despesa.fornecedor = data["fornecedor"]

            caso_id, cliente_id, err = _validar_caso_e_cliente(
                data,
                current_caso_id=despesa.caso_id,
                current_cliente_id=despesa.cliente_id,
            )
            if err:
                despesas_ns.abort(404, message=err)
            despesa.caso_id = caso_id
            despesa.cliente_id = cliente_id

            err = _aplicar_data_pagamento(despesa, data, status_novo)
            if err:
                despesas_ns.abort(400, message=err)

            despesa.sync_legacy_fields()
            db.session.commit()
            app.logger.info(f"Despesa ID {despesa.id} atualizada por usuario {user_id}.")
            return despesa

        @jwt_required()
        @tenant_scoped
        @despesas_ns.response(204, "Despesa deletada.")
        @despesas_ns.doc(security="jsonWebToken")
        def delete(self, despesa_id_param):
            user_id = get_jwt_identity()
            despesa = get_item_or_404(Despesa, despesa_id_param)
            db.session.delete(despesa)
            db.session.commit()
            app.logger.info(f"Despesa ID {despesa.id} deletada por usuario {user_id}.")
            return "", 204

    # ===== Historico de despesas pagas (status=Pago) =====
    @despesas_ns.route("/historico")
    class DespesaHistoricoAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @finance_access_required
        @despesas_ns.doc(
            security="jsonWebToken",
            params={
                "ano": "Ano (YYYY). Default: ano corrente.",
                "mes": "Mes (1-12). Opcional: se omitido, retorna o ano inteiro.",
            },
            description=(
                "Historico de despesas pagas (status=Pago) agrupado por "
                "data_pagamento. Espelha /recebimentos/historico — usado pra "
                "compor visao de Entrada x Saida (Etapa 4)."
            ),
        )
        def get(self):
            hoje = date.today()
            try:
                ano = int(request.args.get("ano") or hoje.year)
            except (TypeError, ValueError):
                despesas_ns.abort(400, message="ano invalido. Use YYYY.")
            if ano < 1900 or ano > 2200:
                despesas_ns.abort(400, message="ano fora do intervalo permitido.")

            mes_raw = request.args.get("mes")
            mes = None
            if mes_raw not in (None, ""):
                try:
                    mes = int(mes_raw)
                except (TypeError, ValueError):
                    despesas_ns.abort(400, message="mes invalido. Use 1-12.")
                if mes < 1 or mes > 12:
                    despesas_ns.abort(400, message="mes deve estar entre 1 e 12.")

            ini_ano = date(ano, 1, 1)
            fim_ano = date(ano, 12, 31)

            query = query_for_tenant(Despesa).filter(
                Despesa.status == STATUS_PAGO,
                Despesa.data_pagamento.isnot(None),
                Despesa.data_pagamento >= ini_ano,
                Despesa.data_pagamento <= fim_ano,
            )
            despesas_ano = query.order_by(Despesa.data_pagamento.desc()).all()

            por_mes_total = [Decimal("0") for _ in range(12)]
            por_mes_qtd = [0 for _ in range(12)]
            total_ano = Decimal("0")
            por_categoria_acc = defaultdict(lambda: {"total": Decimal("0"), "qtd": 0})

            itens_filtrados = []
            total_mes = Decimal("0") if mes else None
            qtd_mes = 0 if mes else None

            for d in despesas_ano:
                valor = Decimal(str(d.valor))
                total_ano += valor
                m_idx = d.data_pagamento.month
                por_mes_total[m_idx - 1] += valor
                por_mes_qtd[m_idx - 1] += 1

                cat = d.categoria or "Sem categoria"
                por_categoria_acc[cat]["total"] += valor
                por_categoria_acc[cat]["qtd"] += 1

                if mes is None or m_idx == mes:
                    itens_filtrados.append(d.to_dict())
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
                "qtd_ano": len(despesas_ano),
                "por_categoria": por_categoria,
                "por_mes": por_mes,
            }

    # ===== Endpoint: criar serie (RECORRENTE ou PARCELADO) =====
    @despesas_ns.route("/serie")
    class DespesaSerieAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @despesas_ns.expect(despesa_serie_input_dto)
        @despesas_ns.marshal_with(despesa_serie_output_dto, code=201)
        @despesas_ns.doc(security="jsonWebToken")
        def post(self):
            """Cria serie de despesas (aluguel mensal, compra parcelada etc).

            RECORRENTE: aluguel/conta mensal indefinida (gera N pra frente,
            default 12, recorrencia fica ativa pra renovacao futura).
            PARCELADO: divida fechada em N parcelas iguais.
            """
            user_id = get_jwt_identity()
            data = request.get_json() or {}

            tipo = (data.get("tipo") or "").strip().upper()
            if tipo not in ("RECORRENTE", "PARCELADO"):
                despesas_ns.abort(400, message="tipo deve ser RECORRENTE ou PARCELADO.")

            try:
                valor_parcela = float(data["valor_parcela"])
                if valor_parcela <= 0:
                    raise ValueError
            except (KeyError, TypeError, ValueError):
                despesas_ns.abort(400, message="valor_parcela invalido.")

            data_inicio, err = _parse_date_optional(data.get("data_inicio"))
            if err or not data_inicio:
                despesas_ns.abort(400, message=err or "data_inicio obrigatoria.")

            frequencia = (data.get("frequencia") or "MENSAL").upper()
            if frequencia not in ("MENSAL", "SEMANAL", "QUINZENAL", "ANUAL"):
                despesas_ns.abort(400, message="frequencia invalida.")

            total_parcelas = data.get("total_parcelas")
            if tipo == "PARCELADO":
                if not total_parcelas or int(total_parcelas) < 1:
                    despesas_ns.abort(400, message="total_parcelas obrigatorio para PARCELADO.")
                total_parcelas = int(total_parcelas)
            else:
                total_parcelas = int(total_parcelas) if total_parcelas else 12
            if total_parcelas > 120:
                despesas_ns.abort(400, message="total_parcelas excede limite (120).")

            descricao = (data.get("descricao") or "").strip()
            if not descricao:
                despesas_ns.abort(400, message="descricao obrigatoria.")

            caso_id, cliente_id, err = _validar_caso_e_cliente(data)
            if err:
                despesas_ns.abort(404, message=err)

            data_fim = _proxima_data(data_inicio, frequencia, total_parcelas - 1)

            recorrencia = RecorrenciaDespesa(
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
                fornecedor=data.get("fornecedor"),
                categoria=data.get("categoria"),
                cliente_id=cliente_id,
                caso_id=caso_id,
            )
            db.session.add(recorrencia)
            db.session.flush()

            parcelas = []
            for i in range(total_parcelas):
                venc = _proxima_data(data_inicio, frequencia, i)
                label = (
                    f"{descricao} ({i + 1}/{total_parcelas})"
                    if tipo == "PARCELADO"
                    else f"{descricao} — {venc.strftime('%m/%Y')}"
                )
                desp = Despesa(
                    descricao=label,
                    valor=valor_parcela,
                    data_vencimento=venc,
                    status="Pendente",
                    categoria=data.get("categoria"),
                    fornecedor=data.get("fornecedor"),
                    notas=data.get("notas"),
                    cliente_id=cliente_id,
                    caso_id=caso_id,
                    user_id=user_id,
                    tenant_id=get_tenant_id(),
                    recorrencia_id=recorrencia.id,
                    numero_parcela=i + 1,
                )
                desp.sync_legacy_fields()
                db.session.add(desp)
                parcelas.append(desp)

            db.session.commit()
            app.logger.info(
                f"Serie despesa {tipo} (id={recorrencia.id}) com {total_parcelas} "
                f"parcelas criada por usuario {user_id}."
            )
            return {
                "recorrencia_id": recorrencia.id,
                "tipo": tipo,
                "total_geradas": len(parcelas),
                "parcelas": parcelas,
            }, 201
