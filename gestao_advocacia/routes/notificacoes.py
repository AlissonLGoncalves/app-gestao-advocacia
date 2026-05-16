"""Endpoints /notificacoes pro usuario logado.

GET   /notificacoes              lista notificacoes (filtros: lida, tipo, limit)
GET   /notificacoes/unread-count count rapido (pra badge do sino)
PUT   /notificacoes/<id>/lida    marca uma como lida
POST  /notificacoes/marcar-todas marca todas as nao lidas como lidas
DELETE /notificacoes/<id>        remove (limpa visualmente)

As notificacoes sao criadas pelo cron (notificacoes_tasks.py) ou por
outras fontes futuras. Endpoint nao expoe POST direto pra criar
(notificacoes sao geradas pelo sistema, nao pelo user).
"""

from datetime import datetime

from flask import request
from flask_jwt_extended import get_jwt_identity, jwt_required
from flask_restx import Resource, fields

from extensions import db
from models import Notificacao


def register_notificacoes_routes(app, notificacoes_ns):
    notificacao_dto = notificacoes_ns.model(
        "Notificacao",
        {
            "id": fields.Integer(readonly=True),
            "tipo": fields.String,
            "severidade": fields.String,
            "titulo": fields.String,
            "mensagem": fields.String,
            "link": fields.String,
            "lida": fields.Boolean,
            "data_criacao": fields.DateTime(dt_format="iso8601"),
            "data_leitura": fields.DateTime(dt_format="iso8601"),
        },
    )

    @notificacoes_ns.route("/")
    class NotificacaoListAPI(Resource):
        @jwt_required()
        @notificacoes_ns.marshal_list_with(notificacao_dto)
        @notificacoes_ns.doc(security="jsonWebToken")
        def get(self):
            user_id = get_jwt_identity()
            q = Notificacao.query.filter_by(user_id=user_id)
            if request.args.get("lida") == "false":
                q = q.filter_by(lida=False)
            elif request.args.get("lida") == "true":
                q = q.filter_by(lida=True)
            tipo = request.args.get("tipo")
            if tipo:
                q = q.filter_by(tipo=tipo)
            try:
                limit = int(request.args.get("limit", 50))
                limit = max(1, min(limit, 200))
            except (TypeError, ValueError):
                limit = 50
            return q.order_by(Notificacao.data_criacao.desc()).limit(limit).all()

    @notificacoes_ns.route("/unread-count")
    class NotificacaoUnreadCountAPI(Resource):
        @jwt_required()
        @notificacoes_ns.doc(security="jsonWebToken")
        def get(self):
            user_id = get_jwt_identity()
            count = Notificacao.query.filter_by(user_id=user_id, lida=False).count()
            return {"count": count}, 200

    @notificacoes_ns.route("/<int:notif_id>/lida")
    class NotificacaoMarcarLidaAPI(Resource):
        @jwt_required()
        @notificacoes_ns.marshal_with(notificacao_dto)
        @notificacoes_ns.doc(security="jsonWebToken")
        def put(self, notif_id):
            user_id = get_jwt_identity()
            notif = Notificacao.query.filter_by(id=notif_id, user_id=user_id).first()
            if not notif:
                notificacoes_ns.abort(404, message="Notificacao nao encontrada.")
            if not notif.lida:
                notif.lida = True
                notif.data_leitura = datetime.utcnow()
                db.session.commit()
            return notif

    @notificacoes_ns.route("/marcar-todas")
    class NotificacaoMarcarTodasAPI(Resource):
        @jwt_required()
        @notificacoes_ns.doc(security="jsonWebToken")
        def post(self):
            user_id = get_jwt_identity()
            agora = datetime.utcnow()
            n = Notificacao.query.filter_by(user_id=user_id, lida=False).update(
                {"lida": True, "data_leitura": agora}, synchronize_session=False
            )
            db.session.commit()
            return {"marcadas": n}, 200

    @notificacoes_ns.route("/<int:notif_id>")
    class NotificacaoDeleteAPI(Resource):
        @jwt_required()
        @notificacoes_ns.response(204, "Notificacao removida.")
        @notificacoes_ns.doc(security="jsonWebToken")
        def delete(self, notif_id):
            user_id = get_jwt_identity()
            notif = Notificacao.query.filter_by(id=notif_id, user_id=user_id).first()
            if not notif:
                notificacoes_ns.abort(404, message="Notificacao nao encontrada.")
            db.session.delete(notif)
            db.session.commit()
            return "", 204
