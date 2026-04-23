from flask import request
from flask_jwt_extended import get_jwt_identity, jwt_required
from flask_restx import Resource

from extensions import db
from helpers import get_tenant_id
from models import Tenant, User


def register_tenant_routes(tenant_ns):
    @tenant_ns.route("/")
    class TenantResource(Resource):
        @jwt_required()
        @tenant_ns.doc(
            security="jsonWebToken",
            description="Retorna os dados do escritório (tenant) do usuário autenticado.",
        )
        def get(self):
            tenant_id = get_tenant_id()
            if not tenant_id:
                return {"message": "Tenant não encontrado."}, 404
            tenant = db.session.get(Tenant, tenant_id)
            if not tenant:
                return {"message": "Tenant não encontrado."}, 404
            return tenant.to_dict(), 200

        @jwt_required()
        @tenant_ns.doc(
            security="jsonWebToken",
            description="Atualiza os dados do escritório. Apenas admins podem alterar.",
        )
        @tenant_ns.response(403, "Acesso negado: apenas administradores.")
        @tenant_ns.response(404, "Tenant não encontrado.")
        def put(self):
            user_id = get_jwt_identity()
            user = db.session.get(User, user_id)
            if not user or user.role != "admin":
                return {
                    "message": "Apenas administradores podem editar os dados do escritório."
                }, 403

            tenant_id = get_tenant_id()
            if not tenant_id:
                return {"message": "Tenant não encontrado."}, 404
            tenant = db.session.get(Tenant, tenant_id)
            if not tenant:
                return {"message": "Tenant não encontrado."}, 404

            data = request.get_json() or {}

            if "nome_escritorio" in data:
                nome = str(data["nome_escritorio"]).strip()
                if not nome:
                    return {"message": "Nome do escritório não pode ser vazio."}, 400
                tenant.nome_escritorio = nome

            for campo in (
                "email_contato",
                "telefone",
                "numero_oab_escritorio",
                "sigla_oab_escritorio",
                "endereco",
            ):
                if campo in data:
                    valor = data[campo]
                    setattr(tenant, campo, str(valor).strip() if valor else None)

            db.session.commit()
            return tenant.to_dict(), 200
