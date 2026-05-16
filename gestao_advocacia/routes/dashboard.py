from collections import defaultdict
from datetime import date, datetime, timedelta

from flask import request
from flask_jwt_extended import get_jwt_identity, jwt_required
from flask_restx import Resource
from sqlalchemy import func

from extensions import db
from helpers import get_tenant_id
from models import (
    AccessRequest,
    Caso,
    Cliente,
    Despesa,
    EventoAgenda,
    PublicacaoDJEN,
    Recebimento,
    TarefaPrazo,
    User,
)


def register_dashboard_routes(app, dashboard_ns):
    @dashboard_ns.route("/stats")
    class DashboardStatsAPI(Resource):
        @jwt_required()
        @dashboard_ns.doc(
            security="jsonWebToken",
            description="Retorna estatisticas consolidadas para o Dashboard.",
        )
        def get(self):
            user_id = get_jwt_identity()
            tenant_id = get_tenant_id()

            total_clientes = Cliente.query.filter_by(user_id=user_id).count()

            status_inativos = ["Concluido", "Arquivado", "Encerrado"]
            casos_ativos = Caso.query.filter(
                Caso.user_id == user_id, ~Caso.status.in_(status_inativos)
            ).count()

            # Apos Fase 1 do Recebimento Robusto: contamos por `status` ao
            # inves do boolean legado `recebido`. Pendente = qualquer status
            # diferente de "Pago" ou "Cancelado".
            recebimentos_pendentes = Recebimento.query.filter(
                Recebimento.user_id == user_id,
                ~Recebimento.status.in_(["Pago", "Cancelado"]),
            ).all()
            recebimentos_pendentes_qtd = len(recebimentos_pendentes)
            recebimentos_pendentes_valor = sum(float(r.valor) for r in recebimentos_pendentes)

            # "A Receber" = pendentes com vencimento futuro (programados).
            # Util pra projecao de caixa no dashboard.
            hoje_date = datetime.utcnow().date()
            recebimentos_a_receber = [
                r
                for r in recebimentos_pendentes
                if r.data_vencimento and r.data_vencimento >= hoje_date
            ]
            recebimentos_a_receber_qtd = len(recebimentos_a_receber)
            recebimentos_a_receber_valor = sum(float(r.valor) for r in recebimentos_a_receber)

            # "Atrasados" = pendentes com vencimento ja passado.
            recebimentos_atrasados = [
                r
                for r in recebimentos_pendentes
                if r.data_vencimento and r.data_vencimento < hoje_date
            ]
            recebimentos_atrasados_qtd = len(recebimentos_atrasados)
            recebimentos_atrasados_valor = sum(float(r.valor) for r in recebimentos_atrasados)

            # Apos Despesa Robusto Fase 1: conta por status (nao mais
            # boolean `pago`). Pendente = qualquer status != Pago/Cancelado.
            despesas_a_pagar = Despesa.query.filter(
                Despesa.user_id == user_id,
                ~Despesa.status.in_(["Pago", "Cancelado"]),
            ).all()
            despesas_a_pagar_qtd = len(despesas_a_pagar)
            despesas_a_pagar_valor = sum(float(d.valor) for d in despesas_a_pagar)

            # Despesas "a pagar" (programadas futuras) vs "atrasadas".
            despesas_programadas = [
                d for d in despesas_a_pagar if d.data_vencimento and d.data_vencimento >= hoje_date
            ]
            despesas_programadas_qtd = len(despesas_programadas)
            despesas_programadas_valor = sum(float(d.valor) for d in despesas_programadas)

            despesas_atrasadas = [
                d for d in despesas_a_pagar if d.data_vencimento and d.data_vencimento < hoje_date
            ]
            despesas_atrasadas_qtd = len(despesas_atrasadas)
            despesas_atrasadas_valor = sum(float(d.valor) for d in despesas_atrasadas)

            agora = datetime.utcnow()
            proximos_eventos = (
                EventoAgenda.query.filter(
                    EventoAgenda.user_id == user_id, EventoAgenda.data_inicio >= agora
                )
                .order_by(EventoAgenda.data_inicio.asc())
                .limit(5)
                .all()
            )

            eventos_lista = []
            for ev in proximos_eventos:
                eventos_lista.append(
                    {
                        "id": ev.id,
                        "titulo": ev.titulo,
                        "data_inicio": ev.data_inicio.isoformat() if ev.data_inicio else None,
                        "data_fim": ev.data_fim.isoformat() if ev.data_fim else None,
                        "descricao": ev.descricao,
                    }
                )

            try:
                djen_nao_lidas = PublicacaoDJEN.query.filter_by(
                    tenant_id=tenant_id,
                    lida=False,
                    triagem_ignorada=False,
                ).count()
                djen_sem_vinculo = (
                    PublicacaoDJEN.query.filter_by(
                        tenant_id=tenant_id,
                        triagem_ignorada=False,
                    )
                    .filter(PublicacaoDJEN.caso_id.is_(None))
                    .count()
                )
            except Exception:
                db.session.rollback()
                djen_nao_lidas = 0
                djen_sem_vinculo = 0

            hoje = datetime.utcnow().date()

            # Badges do menu lateral: contadores de itens "atrasados" por
            # area financeira. Recebimento vencido = data_vencimento <= hoje
            # e status != Pago/Cancelado. Mesma logica pra Despesa.
            try:
                recebimentos_vencidos = Recebimento.query.filter(
                    Recebimento.user_id == user_id,
                    ~Recebimento.status.in_(["Pago", "Cancelado"]),
                    Recebimento.data_vencimento.isnot(None),
                    Recebimento.data_vencimento <= hoje,
                ).count()
                despesas_vencidas = Despesa.query.filter(
                    Despesa.user_id == user_id,
                    ~Despesa.status.in_(["Pago", "Cancelado"]),
                    Despesa.data_vencimento.isnot(None),
                    Despesa.data_vencimento <= hoje,
                ).count()
            except Exception:
                db.session.rollback()
                recebimentos_vencidos = 0
                despesas_vencidas = 0

            # Solicitacoes de acesso pendentes — so visivel pra superadmin.
            # Frontend filtra exibicao via userRole; backend devolve sempre
            # pra evitar branchear a resposta.
            solicitacoes_pendentes = 0
            try:
                user = User.query.get(user_id)
                if user and user.role == "superadmin":
                    solicitacoes_pendentes = AccessRequest.query.filter_by(status="pending").count()
            except Exception:
                db.session.rollback()
                solicitacoes_pendentes = 0

            try:
                tarefas_vencidas = TarefaPrazo.query.filter(
                    TarefaPrazo.user_id == user_id,
                    TarefaPrazo.status != "Concluído",
                    TarefaPrazo.data_vencimento.isnot(None),
                    db.func.date(TarefaPrazo.data_vencimento) < hoje,
                ).count()
                tarefas_vencendo_hoje = TarefaPrazo.query.filter(
                    TarefaPrazo.user_id == user_id,
                    TarefaPrazo.status != "Concluído",
                    TarefaPrazo.data_vencimento.isnot(None),
                    db.func.date(TarefaPrazo.data_vencimento) == hoje,
                ).count()
                # Feature Kanban<>DJEN: prazos gerados pela IA que ainda
                # nao foram confirmados pelo advogado. Entra no badge do
                # menu Prazos como sinal de "tem coisa pra revisar".
                tarefas_aguardando_confirmacao = TarefaPrazo.query.filter(
                    TarefaPrazo.user_id == user_id,
                    TarefaPrazo.status != "Concluído",
                    TarefaPrazo.prazo_validado.is_(False),
                ).count()
            except Exception:
                db.session.rollback()
                tarefas_vencidas = 0
                tarefas_vencendo_hoje = 0
                tarefas_aguardando_confirmacao = 0

            return {
                "total_clientes": total_clientes,
                "casos_ativos": casos_ativos,
                "recebimentos_pendentes": {
                    "quantidade": recebimentos_pendentes_qtd,
                    "valor_total": round(recebimentos_pendentes_valor, 2),
                },
                "recebimentos_a_receber": {
                    "quantidade": recebimentos_a_receber_qtd,
                    "valor_total": round(recebimentos_a_receber_valor, 2),
                },
                "recebimentos_atrasados": {
                    "quantidade": recebimentos_atrasados_qtd,
                    "valor_total": round(recebimentos_atrasados_valor, 2),
                },
                "despesas_a_pagar": {
                    "quantidade": despesas_a_pagar_qtd,
                    "valor_total": round(despesas_a_pagar_valor, 2),
                },
                "despesas_programadas": {
                    "quantidade": despesas_programadas_qtd,
                    "valor_total": round(despesas_programadas_valor, 2),
                },
                "despesas_atrasadas": {
                    "quantidade": despesas_atrasadas_qtd,
                    "valor_total": round(despesas_atrasadas_valor, 2),
                },
                "proximos_eventos": eventos_lista,
                "alertas_djen": {
                    "nao_lidas": djen_nao_lidas,
                    "pendentes_triagem": djen_sem_vinculo,
                },
                "alertas_tarefas": {
                    "vencidas": tarefas_vencidas,
                    "vencendo_hoje": tarefas_vencendo_hoje,
                    "aguardando_confirmacao": tarefas_aguardando_confirmacao,
                },
                "alertas_financeiro": {
                    "recebimentos_vencidos": recebimentos_vencidos,
                    "despesas_vencidas": despesas_vencidas,
                },
                "alertas_admin": {
                    "solicitacoes_pendentes": solicitacoes_pendentes,
                },
            }, 200

    @dashboard_ns.route("/publicacoes-recentes")
    class PublicacoesRecentesAPI(Resource):
        @jwt_required()
        @dashboard_ns.doc(
            security="jsonWebToken",
            description="Retorna publicacoes DJEN dos ultimos N dias, agrupadas por data.",
            params={"dias": "Numero de dias (1-30, default=7)"},
        )
        def get(self):
            get_jwt_identity()
            tenant_id = get_tenant_id()

            # Validar parametro dias
            dias_param = request.args.get("dias", "7", type=str).strip()
            try:
                dias = int(dias_param)
                if dias < 1 or dias > 30:
                    dias = 7
            except (ValueError, TypeError):
                dias = 7

            # Data inicial (hoje - dias)
            hoje = datetime.utcnow().date()
            data_inicio = hoje - timedelta(days=dias - 1)

            # Query base: TODAS as publicacoes do tenant no periodo (incluindo as
            # ainda em triagem). O widget eh a "caixa de entrada" do advogado —
            # filtrar so as ja vinculadas escondia justamente o que precisa de acao.
            query = PublicacaoDJEN.query.filter(
                PublicacaoDJEN.tenant_id == tenant_id,
                PublicacaoDJEN.data_disponibilizacao >= data_inicio,
                PublicacaoDJEN.ativo.is_(True),
            ).order_by(PublicacaoDJEN.data_disponibilizacao.desc())

            publicacoes = query.all()

            # Agrupar por data
            grupos_dict = defaultdict(list)
            for pub in publicacoes:
                if pub.data_disponibilizacao:
                    data_str = pub.data_disponibilizacao.isoformat()
                    cliente_nome = "N/A"
                    cliente_id = None
                    if pub.caso_id:
                        caso = Caso.query.get(pub.caso_id)
                        if caso and caso.cliente_id:
                            cliente = Cliente.query.get(caso.cliente_id)
                            if cliente:
                                cliente_nome = cliente.nome_razao_social
                                cliente_id = cliente.id

                    resumo = pub.texto[:200] if pub.texto else ""

                    grupo_item = {
                        "id": pub.id,
                        "cliente_nome": cliente_nome,
                        "cliente_id": cliente_id,
                        "caso_id": pub.caso_id,
                        "numero_processo": pub.numero_processo or "",
                        "numero_processo_mascara": getattr(pub, "numero_processo_mascara", "")
                        or "",
                        "tribunal": pub.sigla_tribunal or "",
                        "sigla_tribunal": pub.sigla_tribunal or "",
                        "orgao": pub.nome_orgao or "",
                        "nome_orgao": pub.nome_orgao or "",
                        "tipo_comunicacao": pub.tipo_comunicacao or "",
                        "data_disponibilizacao": (
                            pub.data_disponibilizacao.isoformat()
                            if pub.data_disponibilizacao
                            else None
                        ),
                        "hash_comunicacao": getattr(pub, "hash_comunicacao", "") or "",
                        "link": getattr(pub, "link", "") or "",
                        "origem_busca": getattr(pub, "origem_busca", "") or "",
                        "resumo": resumo,
                        "lida": pub.lida,
                    }
                    grupos_dict[data_str].append(grupo_item)

            # Montar grupos com rotulos
            grupos_list = []
            for i in range(dias):
                data_check = hoje - timedelta(days=i)
                data_str = data_check.isoformat()

                if i == 0:
                    rotulo = "Hoje"
                elif i == 1:
                    rotulo = "Ontem"
                else:
                    rotulo = f"{i} dias atrás"

                publicacoes_data = grupos_dict.get(data_str, [])

                if publicacoes_data:
                    grupos_list.append(
                        {
                            "data": data_str,
                            "rotulo": rotulo,
                            "publicacoes": publicacoes_data,
                        }
                    )

            return {
                "dias": dias,
                "grupos": grupos_list,
            }, 200

    @dashboard_ns.route("/charts/casos-por-status")
    class DashboardCasosPorStatusAPI(Resource):
        @jwt_required()
        @dashboard_ns.doc(
            security="jsonWebToken",
            description="Distribuicao de casos do tenant por status (PieChart).",
        )
        def get(self):
            tenant_id = get_tenant_id()
            rows = (
                db.session.query(Caso.status, func.count(Caso.id))
                .filter(Caso.tenant_id == tenant_id)
                .group_by(Caso.status)
                .all()
            )
            return {
                "items": [
                    {"label": status or "Sem status", "value": int(qtd)} for status, qtd in rows
                ]
            }, 200

    @dashboard_ns.route("/charts/casos-por-area")
    class DashboardCasosPorAreaAPI(Resource):
        @jwt_required()
        @dashboard_ns.doc(
            security="jsonWebToken",
            description="Distribuicao de casos do tenant por area do direito (PieChart).",
        )
        def get(self):
            tenant_id = get_tenant_id()
            rows = (
                db.session.query(Caso.area_direito, func.count(Caso.id))
                .filter(Caso.tenant_id == tenant_id)
                .group_by(Caso.area_direito)
                .all()
            )
            return {
                "items": [
                    {"label": area or "Nao informada", "value": int(qtd)} for area, qtd in rows
                ]
            }, 200

    @dashboard_ns.route("/charts/financeiro-mensal")
    class DashboardFinanceiroMensalAPI(Resource):
        @jwt_required()
        @dashboard_ns.doc(
            security="jsonWebToken",
            description=(
                "Receita (recebimentos pagos) e despesa (despesas pagas) agregadas por mes "
                "nos ultimos 12 meses para BarChart/LineChart."
            ),
        )
        def get(self):
            tenant_id = get_tenant_id()
            hoje = date.today()
            # Primeiro dia do mes 11 meses atras = janela de 12 meses cheia.
            ano_inicio = hoje.year
            mes_inicio = hoje.month - 11
            while mes_inicio <= 0:
                mes_inicio += 12
                ano_inicio -= 1
            data_inicio = date(ano_inicio, mes_inicio, 1)

            # Receita = recebimentos pagos (preferir data_pagamento; cair pra
            # data_recebimento legado quando ainda nao migrado).
            recebimentos = Recebimento.query.filter(
                Recebimento.tenant_id == tenant_id,
                Recebimento.status == "Pago",
                db.or_(
                    Recebimento.data_pagamento >= data_inicio,
                    db.and_(
                        Recebimento.data_pagamento.is_(None),
                        Recebimento.data_recebimento >= data_inicio,
                    ),
                ),
            ).all()
            # Despesas pagas: preferir data_pagamento; fallback pra
            # data_despesa legado (registros pre-migration).
            despesas = Despesa.query.filter(
                Despesa.tenant_id == tenant_id,
                Despesa.status == "Pago",
                db.or_(
                    Despesa.data_pagamento >= data_inicio,
                    db.and_(
                        Despesa.data_pagamento.is_(None),
                        Despesa.data_despesa >= data_inicio,
                    ),
                ),
            ).all()

            buckets = {}
            for i in range(12):
                ano = ano_inicio
                mes = mes_inicio + i
                while mes > 12:
                    mes -= 12
                    ano += 1
                chave = f"{ano:04d}-{mes:02d}"
                buckets[chave] = {"mes": chave, "receita": 0.0, "despesa": 0.0}

            for r in recebimentos:
                ref = r.data_pagamento or r.data_recebimento
                if not ref:
                    continue
                chave = ref.strftime("%Y-%m")
                if chave in buckets:
                    buckets[chave]["receita"] += float(r.valor or 0)
            for d in despesas:
                ref = d.data_pagamento or d.data_despesa
                if not ref:
                    continue
                chave = ref.strftime("%Y-%m")
                if chave in buckets:
                    buckets[chave]["despesa"] += float(d.valor or 0)

            items = sorted(buckets.values(), key=lambda b: b["mes"])
            for b in items:
                b["receita"] = round(b["receita"], 2)
                b["despesa"] = round(b["despesa"], 2)
            return {"items": items}, 200

    @dashboard_ns.route("/charts/publicacoes-por-dia")
    class DashboardPublicacoesPorDiaAPI(Resource):
        @jwt_required()
        @dashboard_ns.doc(
            security="jsonWebToken",
            description="Publicacoes DJEN por dia nos ultimos 30 dias (LineChart).",
        )
        def get(self):
            tenant_id = get_tenant_id()
            hoje = date.today()
            data_inicio = hoje - timedelta(days=29)

            rows = (
                db.session.query(
                    PublicacaoDJEN.data_disponibilizacao, func.count(PublicacaoDJEN.id)
                )
                .filter(
                    PublicacaoDJEN.tenant_id == tenant_id,
                    PublicacaoDJEN.data_disponibilizacao.isnot(None),
                    PublicacaoDJEN.data_disponibilizacao >= data_inicio,
                )
                .group_by(PublicacaoDJEN.data_disponibilizacao)
                .all()
            )
            por_dia = {d.isoformat(): int(qtd) for d, qtd in rows if d}
            items = []
            for i in range(30):
                d = data_inicio + timedelta(days=i)
                chave = d.isoformat()
                items.append({"data": chave, "quantidade": por_dia.get(chave, 0)})
            return {"items": items}, 200
