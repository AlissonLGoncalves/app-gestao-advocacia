from flask_jwt_extended import get_jwt_identity, jwt_required
from flask_restx import Resource

from extensions import db
from helpers import get_tenant_id
from models import AuditLog, User


def register_auditoria_routes(audit_ns, audit_log_model_dto):
    @audit_ns.route('/')
    class AuditLogListAPI(Resource):
        @jwt_required()
        @audit_ns.marshal_list_with(audit_log_model_dto)
        @audit_ns.doc(security='jsonWebToken', description='Lista o log de auditoria LGPD do Escritório.')
        def get(self):
            tenant_id = get_tenant_id()
            user_id = get_jwt_identity()
            user = db.session.get(User, user_id)
            if not user or user.role != 'admin':
                return []

            logs = AuditLog.query.filter_by(tenant_id=tenant_id).order_by(AuditLog.data_hora.desc()).limit(200).all()
            return logs
