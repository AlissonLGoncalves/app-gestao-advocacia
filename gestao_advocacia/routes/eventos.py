from datetime import datetime

from flask import request
from flask_jwt_extended import get_jwt_identity, jwt_required
from flask_restx import Resource

from extensions import db
from helpers import get_item_or_404, get_list_query, get_tenant_id, tenant_scoped
from models import EventoAgenda


def register_eventos_routes(app, eventos_ns, evento_input_model_dto, evento_model_dto):
    @eventos_ns.route("/")
    class EventoListAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @eventos_ns.marshal_list_with(evento_model_dto)
        @eventos_ns.doc(security="jsonWebToken")
        def get(self):
            user_id = get_jwt_identity()
            eventos = get_list_query(EventoAgenda).order_by(EventoAgenda.data_inicio.asc()).all()
            return eventos

        @jwt_required()
        @tenant_scoped
        @eventos_ns.expect(evento_input_model_dto)
        @eventos_ns.marshal_with(evento_model_dto, code=201)
        @eventos_ns.doc(security="jsonWebToken")
        def post(self):
            user_id = get_jwt_identity()
            data = request.get_json()
            if not data.get("titulo") or not data.get("data_inicio"):
                return {"message": "Titulo e data de inicio sao obrigatorios para o evento."}, 400
            try:
                data_inicio_obj = datetime.fromisoformat(data["data_inicio"])
                data_fim_obj = (
                    datetime.fromisoformat(data["data_fim"]) if data.get("data_fim") else None
                )
            except ValueError:
                return {
                    "message": "Formato de data invalido. Utilize o formato ISO 8601 (ex: YYYY-MM-DDTHH:MM:SS)."
                }, 400
            novo_evento = EventoAgenda(
                titulo=data["titulo"],
                data_inicio=data_inicio_obj,
                data_fim=data_fim_obj,
                descricao=data.get("descricao"),
                tipo_evento=data.get("tipo_evento", "Outros"),
                prioridade=data.get("prioridade", "Normal"),
                status_evento=data.get("status_evento", "Pendente"),
                user_id=user_id,
                tenant_id=get_tenant_id(),
            )
            db.session.add(novo_evento)
            db.session.commit()
            app.logger.info(
                f"Novo evento '{novo_evento.titulo}' (ID: {novo_evento.id}) criado para usuario ID {user_id}."
            )
            return novo_evento, 201

    @eventos_ns.route("/<int:evento_id_param>")
    @eventos_ns.response(404, "Evento nao encontrado ou nao pertence ao usuario.")
    @eventos_ns.param("evento_id_param", "O ID unico do evento da agenda")
    class EventoDetailAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @eventos_ns.marshal_with(evento_model_dto)
        @eventos_ns.doc(security="jsonWebToken")
        def get(self, evento_id_param):
            user_id = get_jwt_identity()
            evento = get_item_or_404(EventoAgenda, evento_id_param)
            return evento

        @jwt_required()
        @tenant_scoped
        @eventos_ns.expect(evento_input_model_dto)
        @eventos_ns.marshal_with(evento_model_dto)
        @eventos_ns.doc(security="jsonWebToken")
        def put(self, evento_id_param):
            user_id = get_jwt_identity()
            evento = get_item_or_404(EventoAgenda, evento_id_param)
            data = request.get_json()
            if not data.get("titulo") or not data.get("data_inicio"):
                return {
                    "message": "Titulo e data de inicio sao obrigatorios para atualizacao do evento."
                }, 400
            try:
                data_inicio_obj = datetime.fromisoformat(data["data_inicio"])
                data_fim_obj = (
                    datetime.fromisoformat(data["data_fim"]) if data.get("data_fim") else None
                )
            except ValueError:
                return {"message": "Formato de data invalido. Utilize ISO 8601."}, 400
            evento.titulo = data["titulo"]
            evento.data_inicio = data_inicio_obj
            evento.data_fim = data_fim_obj
            evento.descricao = data.get("descricao", evento.descricao)
            evento.tipo_evento = data.get("tipo_evento", evento.tipo_evento)
            evento.prioridade = data.get("prioridade", evento.prioridade)
            evento.status_evento = data.get("status_evento", evento.status_evento)
            db.session.commit()
            app.logger.info(f"Evento ID {evento.id} atualizado pelo usuario ID {user_id}.")
            return evento

        @jwt_required()
        @tenant_scoped
        @eventos_ns.response(204, "Evento deletado com sucesso.")
        @eventos_ns.doc(security="jsonWebToken")
        def delete(self, evento_id_param):
            user_id = get_jwt_identity()
            evento = get_item_or_404(EventoAgenda, evento_id_param)
            db.session.delete(evento)
            db.session.commit()
            app.logger.info(
                f"Evento ID {evento.id} ('{evento.titulo}') deletado pelo usuario ID {user_id}."
            )
            return "", 204
