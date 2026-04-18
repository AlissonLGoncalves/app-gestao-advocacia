from datetime import datetime

from flask import request
from flask_jwt_extended import get_jwt_identity, jwt_required
from flask_restx import Resource

from extensions import db
from helpers import get_item_or_404, get_list_query, get_tenant_id, query_for_tenant, tenant_scoped
from models import Caso, Despesa


def register_despesas_routes(
    app, despesas_ns, despesa_input_model_dto, despesa_model_dto, finance_access_required
):
    @despesas_ns.route("/")
    class DespesaListAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @finance_access_required
        @despesas_ns.marshal_list_with(despesa_model_dto)
        @despesas_ns.doc(security="jsonWebToken")
        def get(self):
            user_id = get_jwt_identity()
            despesas = get_list_query(Despesa).order_by(Despesa.data_despesa.desc()).all()
            return despesas

        @jwt_required()
        @tenant_scoped
        @despesas_ns.expect(despesa_input_model_dto)
        @despesas_ns.marshal_with(despesa_model_dto, code=201)
        @despesas_ns.doc(security="jsonWebToken")
        def post(self):
            user_id = get_jwt_identity()
            data = request.get_json()
            if not all(k in data for k in ("descricao", "valor", "data_despesa")):
                return {"message": "Descrição, valor e data são obrigatórios."}, 400
            try:
                valor_decimal = float(data["valor"])
                if valor_decimal <= 0:
                    return {"message": "Valor da despesa deve ser positivo."}, 400
                data_despesa_obj = datetime.strptime(data["data_despesa"], "%Y-%m-%d").date()
            except ValueError:
                return {"message": "Formato de valor ou data inválido."}, 400
            caso_id_val = data.get("caso_id")
            if caso_id_val:
                if not query_for_tenant(Caso).filter_by(id=caso_id_val).first():
                    return {"message": f"Caso ID {caso_id_val} não encontrado."}, 404
            nova_despesa = Despesa(
                descricao=data["descricao"],
                valor=valor_decimal,
                data_despesa=data_despesa_obj,
                pago=data.get("pago", False),
                caso_id=caso_id_val,
                user_id=user_id,
                tenant_id=get_tenant_id(),
            )
            db.session.add(nova_despesa)
            db.session.commit()
            app.logger.info(f"Nova despesa ID {nova_despesa.id} criada para usuário ID {user_id}.")
            return nova_despesa, 201

    @despesas_ns.route("/<int:despesa_id_param>")
    @despesas_ns.response(404, "Despesa não encontrada.")
    @despesas_ns.param("despesa_id_param", "O ID da despesa")
    class DespesaDetailAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @finance_access_required
        @despesas_ns.marshal_with(despesa_model_dto)
        @despesas_ns.doc(security="jsonWebToken")
        def get(self, despesa_id_param):
            user_id = get_jwt_identity()
            despesa = get_item_or_404(Despesa, despesa_id_param)
            return despesa

        @jwt_required()
        @tenant_scoped
        @despesas_ns.expect(despesa_input_model_dto)
        @despesas_ns.marshal_with(despesa_model_dto)
        @despesas_ns.doc(security="jsonWebToken")
        def put(self, despesa_id_param):
            user_id = get_jwt_identity()
            despesa = get_item_or_404(Despesa, despesa_id_param)
            data = request.get_json()
            if not all(k in data for k in ("descricao", "valor", "data_despesa")):
                return {"message": "Descrição, valor e data são obrigatórios."}, 400
            try:
                valor_decimal = float(data["valor"])
                if valor_decimal <= 0:
                    return {"message": "Valor da despesa deve ser positivo."}, 400
                data_despesa_obj = datetime.strptime(data["data_despesa"], "%Y-%m-%d").date()
            except ValueError:
                return {"message": "Formato de valor ou data inválido."}, 400
            caso_id_val = data.get("caso_id")
            if "caso_id" in data:
                if caso_id_val is not None:
                    if not query_for_tenant(Caso).filter_by(id=caso_id_val).first():
                        return {"message": f"Caso ID {caso_id_val} não encontrado."}, 404
                    despesa.caso_id = caso_id_val
                else:
                    despesa.caso_id = None
            despesa.descricao = data["descricao"]
            despesa.valor = valor_decimal
            despesa.data_despesa = data_despesa_obj
            despesa.pago = data.get("pago", despesa.pago)
            db.session.commit()
            app.logger.info(f"Despesa ID {despesa.id} atualizada pelo usuário ID {user_id}.")
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
            app.logger.info(f"Despesa ID {despesa.id} deletada pelo usuário ID {user_id}.")
            return "", 204
