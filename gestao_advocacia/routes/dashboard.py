from datetime import datetime, timedelta
from collections import defaultdict

from flask import request
from flask_jwt_extended import get_jwt_identity, jwt_required
from flask_restx import Resource

from extensions import db
from helpers import get_tenant_id
from models import Caso, Cliente, Despesa, EventoAgenda, PublicacaoDJEN, Recebimento


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

            recebimentos_pendentes = Recebimento.query.filter_by(
                user_id=user_id, recebido=False
            ).all()
            recebimentos_pendentes_qtd = len(recebimentos_pendentes)
            recebimentos_pendentes_valor = sum(float(r.valor) for r in recebimentos_pendentes)

            despesas_a_pagar = Despesa.query.filter_by(user_id=user_id, pago=False).all()
            despesas_a_pagar_qtd = len(despesas_a_pagar)
            despesas_a_pagar_valor = sum(float(d.valor) for d in despesas_a_pagar)

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

            return {
                "total_clientes": total_clientes,
                "casos_ativos": casos_ativos,
                "recebimentos_pendentes": {
                    "quantidade": recebimentos_pendentes_qtd,
                    "valor_total": round(recebimentos_pendentes_valor, 2),
                },
                "despesas_a_pagar": {
                    "quantidade": despesas_a_pagar_qtd,
                    "valor_total": round(despesas_a_pagar_valor, 2),
                },
                "proximos_eventos": eventos_lista,
                "alertas_djen": {
                    "nao_lidas": djen_nao_lidas,
                    "pendentes_triagem": djen_sem_vinculo,
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
            user_id = get_jwt_identity()
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

            # Query base: publicacoes do tenant com vinculo ou triagem processada
            query = (
                PublicacaoDJEN.query.filter(
                    PublicacaoDJEN.tenant_id == tenant_id,
                    PublicacaoDJEN.data_disponibilizacao >= data_inicio,
                    PublicacaoDJEN.ativo == True,
                )
                .filter(
                    db.or_(
                        PublicacaoDJEN.caso_id.isnot(None),
                        db.and_(
                            PublicacaoDJEN.triagem_ignorada == False,
                            PublicacaoDJEN.status_origem.in_(
                                ["criado_automaticamente", "revisado_manual"]
                            ),
                        ),
                    )
                )
                .order_by(PublicacaoDJEN.data_disponibilizacao.desc())
            )

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
                                cliente_nome = cliente.nome
                                cliente_id = cliente.id

                    resumo = pub.texto[:200] if pub.texto else ""

                    grupo_item = {
                        "id": pub.id,
                        "cliente_nome": cliente_nome,
                        "cliente_id": cliente_id,
                        "caso_id": pub.caso_id,
                        "numero_processo": pub.numero_processo or "",
                        "tribunal": pub.sigla_tribunal or "",
                        "orgao": pub.nome_orgao or "",
                        "tipo_comunicacao": pub.tipo_comunicacao or "",
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

