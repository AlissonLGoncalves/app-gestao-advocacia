from datetime import datetime

from flask import request
from flask_jwt_extended import get_jwt_identity, jwt_required
from flask_restx import Resource

from extensions import db
from helpers import get_item_or_404, get_list_query, get_tenant_id, query_for_tenant, tenant_scoped
from models import Caso, Recebimento


def register_recebimentos_routes(
    app,
    recebimentos_ns,
    recebimento_input_model_dto,
    recebimento_model_dto,
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
            user_id = get_jwt_identity()
            recebimentos = (
                get_list_query(Recebimento).order_by(Recebimento.data_recebimento.desc()).all()
            )
            return recebimentos

        @jwt_required()
        @tenant_scoped
        @recebimentos_ns.expect(recebimento_input_model_dto)
        @recebimentos_ns.marshal_with(recebimento_model_dto, code=201)
        @recebimentos_ns.doc(security="jsonWebToken")
        def post(self):
            user_id = get_jwt_identity()
            data = request.get_json()
            if not all(k in data for k in ("descricao", "valor", "data_recebimento")):
                return {"message": "Descrição, valor e data são obrigatórios."}, 400
            try:
                valor_decimal = float(data["valor"])
                if valor_decimal <= 0:
                    return {"message": "Valor do recebimento deve ser positivo."}, 400
                data_recebimento_obj = datetime.strptime(
                    data["data_recebimento"], "%Y-%m-%d"
                ).date()
            except ValueError:
                return {"message": "Formato de valor ou data inválido."}, 400
            caso_id_val = data.get("caso_id")
            if caso_id_val:
                if not query_for_tenant(Caso).filter_by(id=caso_id_val).first():
                    return {"message": f"Caso ID {caso_id_val} não encontrado."}, 404
            novo_recebimento = Recebimento(
                descricao=data["descricao"],
                valor=valor_decimal,
                data_recebimento=data_recebimento_obj,
                recebido=data.get("recebido", False),
                caso_id=caso_id_val,
                user_id=user_id,
                tenant_id=get_tenant_id(),
            )
            db.session.add(novo_recebimento)
            db.session.commit()
            app.logger.info(
                f"Novo recebimento ID {novo_recebimento.id} criado para usuário ID {user_id}."
            )
            return novo_recebimento, 201

    @recebimentos_ns.route("/<int:recebimento_id_param>")
    @recebimentos_ns.response(404, "Recebimento não encontrado.")
    @recebimentos_ns.param("recebimento_id_param", "O ID do recebimento")
    class RecebimentoDetailAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @finance_access_required
        @recebimentos_ns.marshal_with(recebimento_model_dto)
        @recebimentos_ns.doc(security="jsonWebToken")
        def get(self, recebimento_id_param):
            user_id = get_jwt_identity()
            recebimento = get_item_or_404(Recebimento, recebimento_id_param)
            return recebimento

        @jwt_required()
        @tenant_scoped
        @recebimentos_ns.expect(recebimento_input_model_dto)
        @recebimentos_ns.marshal_with(recebimento_model_dto)
        @recebimentos_ns.doc(security="jsonWebToken")
        def put(self, recebimento_id_param):
            user_id = get_jwt_identity()
            recebimento = get_item_or_404(Recebimento, recebimento_id_param)
            data = request.get_json()
            if not all(k in data for k in ("descricao", "valor", "data_recebimento")):
                return {"message": "Descrição, valor e data são obrigatórios."}, 400
            try:
                valor_decimal = float(data["valor"])
                if valor_decimal <= 0:
                    return {"message": "Valor do recebimento deve ser positivo."}, 400
                data_recebimento_obj = datetime.strptime(
                    data["data_recebimento"], "%Y-%m-%d"
                ).date()
            except ValueError:
                return {"message": "Formato de valor ou data inválido."}, 400
            caso_id_val = data.get("caso_id")
            if "caso_id" in data:
                if caso_id_val is not None:
                    if not query_for_tenant(Caso).filter_by(id=caso_id_val).first():
                        return {"message": f"Caso ID {caso_id_val} não encontrado."}, 404
                    recebimento.caso_id = caso_id_val
                else:
                    recebimento.caso_id = None
            recebimento.descricao = data["descricao"]
            recebimento.valor = valor_decimal
            recebimento.data_recebimento = data_recebimento_obj
            recebimento.recebido = data.get("recebido", recebimento.recebido)
            db.session.commit()
            app.logger.info(
                f"Recebimento ID {recebimento.id} atualizado pelo usuário ID {user_id}."
            )
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
            app.logger.info(f"Recebimento ID {recebimento.id} deletado pelo usuário ID {user_id}.")
            return "", 204
