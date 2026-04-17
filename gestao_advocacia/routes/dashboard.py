from datetime import datetime

from flask_jwt_extended import get_jwt_identity, jwt_required
from flask_restx import Resource

from extensions import db
from models import Caso, Cliente, Despesa, EventoAgenda, PublicacaoDJEN, Recebimento


def register_dashboard_routes(app, dashboard_ns):
    @dashboard_ns.route('/stats')
    class DashboardStatsAPI(Resource):
        @jwt_required()
        @dashboard_ns.doc(security='jsonWebToken', description='Retorna estatisticas consolidadas para o Dashboard.')
        def get(self):
            user_id = get_jwt_identity()

            total_clientes = Cliente.query.filter_by(user_id=user_id).count()

            status_inativos = ['Concluido', 'Arquivado', 'Encerrado']
            casos_ativos = Caso.query.filter(
                Caso.user_id == user_id,
                ~Caso.status.in_(status_inativos)
            ).count()

            recebimentos_pendentes = Recebimento.query.filter_by(user_id=user_id, recebido=False).all()
            recebimentos_pendentes_qtd = len(recebimentos_pendentes)
            recebimentos_pendentes_valor = sum(float(r.valor) for r in recebimentos_pendentes)

            despesas_a_pagar = Despesa.query.filter_by(user_id=user_id, pago=False).all()
            despesas_a_pagar_qtd = len(despesas_a_pagar)
            despesas_a_pagar_valor = sum(float(d.valor) for d in despesas_a_pagar)

            agora = datetime.utcnow()
            proximos_eventos = EventoAgenda.query.filter(
                EventoAgenda.user_id == user_id,
                EventoAgenda.data_inicio >= agora
            ).order_by(EventoAgenda.data_inicio.asc()).limit(5).all()

            eventos_lista = []
            for ev in proximos_eventos:
                eventos_lista.append({
                    'id': ev.id,
                    'titulo': ev.titulo,
                    'data_inicio': ev.data_inicio.isoformat() if ev.data_inicio else None,
                    'data_fim': ev.data_fim.isoformat() if ev.data_fim else None,
                    'descricao': ev.descricao
                })

            try:
                djen_nao_lidas = PublicacaoDJEN.query.filter_by(
                    tenant_id=user.tenant_id,
                    lida=False,
                    triagem_ignorada=False,
                ).count()
                djen_sem_vinculo = PublicacaoDJEN.query.filter_by(
                    tenant_id=user.tenant_id,
                    triagem_ignorada=False,
                ).filter(PublicacaoDJEN.caso_id.is_(None)).count()
            except Exception:
                db.session.rollback()
                djen_nao_lidas = 0
                djen_sem_vinculo = 0

            return {
                'total_clientes': total_clientes,
                'casos_ativos': casos_ativos,
                'recebimentos_pendentes': {
                    'quantidade': recebimentos_pendentes_qtd,
                    'valor_total': round(recebimentos_pendentes_valor, 2)
                },
                'despesas_a_pagar': {
                    'quantidade': despesas_a_pagar_qtd,
                    'valor_total': round(despesas_a_pagar_valor, 2)
                },
                'proximos_eventos': eventos_lista,
                'alertas_djen': {
                    'nao_lidas': djen_nao_lidas,
                    'pendentes_triagem': djen_sem_vinculo,
                },
            }, 200
