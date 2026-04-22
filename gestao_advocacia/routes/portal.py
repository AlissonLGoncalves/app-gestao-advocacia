from datetime import datetime

from flask_jwt_extended import get_jwt_identity, jwt_required
from flask_restx import Resource

from extensions import db
from models import Caso, Cliente, Documento, EventoAgenda, Recebimento, User


def register_portal_routes(portal_ns):

    def _get_portal_cliente(user_id):
        user = db.session.get(User, user_id)
        if not user or user.role != "cliente" or not user.portal_cliente_id:
            return None, None
        cliente = db.session.get(Cliente, user.portal_cliente_id)
        return user, cliente

    @portal_ns.route("/situacao")
    class PortalSituacao(Resource):
        @jwt_required()
        @portal_ns.doc(
            security="jsonWebToken",
            description="Retorna situação consolidada do cliente no portal.",
        )
        def get(self):
            user_id = get_jwt_identity()
            user, cliente = _get_portal_cliente(user_id)
            if not cliente:
                return {"message": "Acesso restrito ao Portal do Cliente."}, 403

            casos = Caso.query.filter_by(cliente_id=cliente.id).all()
            caso_ids = [c.id for c in casos]

            casos_data = [
                {
                    "id": c.id,
                    "titulo": c.titulo,
                    "numero_processo": c.numero_processo,
                    "status": c.status,
                    "area_direito": c.area_direito,
                    "fase_processual": c.fase_processual,
                    "vara_juizo": c.vara_juizo,
                    "data_atualizacao": c.data_atualizacao.isoformat() if c.data_atualizacao else None,
                }
                for c in casos
            ]

            agora = datetime.utcnow()
            eventos_raw = (
                EventoAgenda.query.filter(
                    EventoAgenda.tenant_id == user.tenant_id,
                    EventoAgenda.data_inicio >= agora,
                )
                .order_by(EventoAgenda.data_inicio.asc())
                .limit(10)
                .all()
            )
            eventos_data = [
                {
                    "id": e.id,
                    "titulo": e.titulo,
                    "data_inicio": e.data_inicio.isoformat() if e.data_inicio else None,
                    "data_fim": e.data_fim.isoformat() if e.data_fim else None,
                    "tipo_evento": e.tipo_evento,
                    "descricao": e.descricao,
                }
                for e in eventos_raw
            ]

            docs_raw = (
                Documento.query.filter(Documento.caso_id.in_(caso_ids))
                .order_by(Documento.data_upload.desc())
                .limit(10)
                .all()
            )
            docs_data = [
                {
                    "id": d.id,
                    "nome_arquivo": d.nome_arquivo,
                    "data_upload": d.data_upload.isoformat() if d.data_upload else None,
                    "caso_id": d.caso_id,
                }
                for d in docs_raw
            ]

            recebimentos_raw = Recebimento.query.filter(
                Recebimento.caso_id.in_(caso_ids),
                Recebimento.recebido == False,  # noqa: E712
            ).all()
            pendencias = [
                {
                    "id": r.id,
                    "descricao": r.descricao,
                    "valor": str(r.valor),
                    "data_vencimento": r.data_recebimento.isoformat() if r.data_recebimento else None,
                }
                for r in recebimentos_raw
            ]

            return {
                "cliente": {
                    "id": cliente.id,
                    "nome": cliente.nome_razao_social,
                    "email": cliente.email,
                    "telefone": cliente.telefone,
                },
                "casos": casos_data,
                "proximos_eventos": eventos_data,
                "documentos_recentes": docs_data,
                "pendencias_financeiras": pendencias,
            }, 200
