from datetime import datetime

from flask import request
from flask_jwt_extended import get_jwt_identity, jwt_required
from flask_restx import Resource

from extensions import db
from helpers import get_item_or_404, get_list_query, get_tenant_id, query_for_tenant, tenant_scoped
from models import Caso, Recebimento


def _parse_data_recebimento(data):
    """Aceita data_vencimento OU data_recebimento (alias). Retorna (date, erro).

    Frontend tem dois campos separados mas o DB so tem um (`data_recebimento`).
    Preferimos data_vencimento se vier preenchida (eh o campo de uso mais
    comum no formulario), caindo de volta pra data_recebimento. Pelo menos um
    e obrigatorio.
    """
    raw = (data.get("data_vencimento") or data.get("data_recebimento") or "").strip()
    if not raw:
        return None, "Data (vencimento ou recebimento) e obrigatoria."
    try:
        return datetime.strptime(raw, "%Y-%m-%d").date(), None
    except ValueError:
        return None, "Formato de data invalido. Use YYYY-MM-DD."


def _resolve_recebido(data, default):
    """Resolve o booleano `recebido` a partir do payload.

    Prioridade: campo explicito `recebido` > derivado do `status` ("Pago"
    => True, qualquer outro => False) > valor default (usado no UPDATE pra
    preservar o estado atual quando nada eh enviado).
    """
    if "recebido" in data and data["recebido"] is not None:
        return bool(data["recebido"])
    status = data.get("status")
    if isinstance(status, str) and status.strip():
        return status.strip().lower() == "pago"
    return default


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
            data = request.get_json() or {}
            if "descricao" not in data or "valor" not in data:
                return {"message": "Descrição e valor são obrigatórios."}, 400
            try:
                valor_decimal = float(data["valor"])
                if valor_decimal <= 0:
                    return {"message": "Valor do recebimento deve ser positivo."}, 400
            except (TypeError, ValueError):
                return {"message": "Formato de valor inválido."}, 400
            data_recebimento_obj, erro = _parse_data_recebimento(data)
            if erro:
                return {"message": erro}, 400
            caso_id_val = data.get("caso_id")
            if caso_id_val:
                if not query_for_tenant(Caso).filter_by(id=caso_id_val).first():
                    return {"message": f"Caso ID {caso_id_val} não encontrado."}, 404
            novo_recebimento = Recebimento(
                descricao=data["descricao"],
                valor=valor_decimal,
                data_recebimento=data_recebimento_obj,
                recebido=_resolve_recebido(data, default=False),
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
            data = request.get_json() or {}
            if "descricao" not in data or "valor" not in data:
                return {"message": "Descrição e valor são obrigatórios."}, 400
            try:
                valor_decimal = float(data["valor"])
                if valor_decimal <= 0:
                    return {"message": "Valor do recebimento deve ser positivo."}, 400
            except (TypeError, ValueError):
                return {"message": "Formato de valor inválido."}, 400
            data_recebimento_obj, erro = _parse_data_recebimento(data)
            if erro:
                return {"message": erro}, 400
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
            recebimento.recebido = _resolve_recebido(data, default=recebimento.recebido)
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
