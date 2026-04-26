"""admin-fase0: rotas do backoffice super-admin.

Namespace montado em /admin/v1. Todos os endpoints exigem JWT com claim
role=='superadmin' E (se configurado) IP em ADMIN_IP_ALLOWLIST.

Queries operam ACROSS tenants — NUNCA reusar helpers de tenant.py daqui.
Mutacoes registram AdminAuditLog atomicamente (rollback total se log falhar).
"""

import re

from flask import request
from flask_jwt_extended import get_jwt_identity, jwt_required
from flask_restx import Resource

from extensions import db, limiter
from helpers.admin_security import registrar_admin_audit, superadmin_required
from models import (
    AdminAuditLog,
    Caso,
    Cliente,
    LoginAudit,
    Tenant,
    TenantAnotacao,
    User,
)

ADMIN_RATE_LIMIT = "60 per minute"
PAGINATION_DEFAULT = 25
PAGINATION_MAX = 100
ANOTACAO_MAX_CHARS = 5000
MOTIVO_MAX_CHARS = 500
TARGET_TYPE_TENANT = "tenant"


def _strip_html_tags(value):
    """Remove tags HTML/script de forma simples para texto puro de anotacao."""
    if not value:
        return ""
    sem_tags = re.sub(r"<[^>]*>", "", str(value))
    return sem_tags.strip()


def _parse_int_param(raw, default, minimum, maximum):
    try:
        value = int(raw) if raw is not None else default
    except (TypeError, ValueError):
        value = default
    return max(minimum, min(maximum, value))


def register_admin_routes(admin_ns):
    @admin_ns.route("/me")
    class AdminMe(Resource):
        @limiter.limit(ADMIN_RATE_LIMIT)
        @jwt_required()
        @superadmin_required
        @admin_ns.doc(
            security="jsonWebToken",
            description="Retorna dados do super-admin autenticado. Usado pelo SuperAdminRoute do frontend para confirmar role server-side.",
        )
        def get(self):
            user_id = get_jwt_identity()
            user = db.session.get(User, int(user_id)) if user_id else None
            if not user:
                return {"message": "Acesso negado."}, 403
            return {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role,
            }, 200

    @admin_ns.route("/tenants")
    class AdminTenantsList(Resource):
        @limiter.limit(ADMIN_RATE_LIMIT)
        @jwt_required()
        @superadmin_required
        @admin_ns.doc(
            security="jsonWebToken",
            description=(
                "Lista paginada de tenants (escritorios). Busca por nome_escritorio, documento "
                "ou email_contato. Filtro por status. Pagina e size validados."
            ),
            params={
                "q": "Termo de busca (nome, documento ou email)",
                "status": "Filtro por status (ativo|suspenso|cancelado)",
                "page": "Pagina (default 1)",
                "size": f"Itens por pagina (default {PAGINATION_DEFAULT}, max {PAGINATION_MAX})",
            },
        )
        def get(self):
            args = request.args
            q = (args.get("q") or "").strip()
            status = (args.get("status") or "").strip()
            page = _parse_int_param(args.get("page"), 1, 1, 10_000)
            size = _parse_int_param(args.get("size"), PAGINATION_DEFAULT, 1, PAGINATION_MAX)

            query = db.session.query(Tenant)

            if q:
                like = f"%{q}%"
                query = query.filter(
                    db.or_(
                        Tenant.nome_escritorio.ilike(like),
                        Tenant.documento.ilike(like),
                        Tenant.email_contato.ilike(like),
                    )
                )

            if status in {"ativo", "suspenso", "cancelado"}:
                query = query.filter(Tenant.status == status)

            total = query.count()
            tenants = (
                query.order_by(Tenant.created_at.desc().nullslast(), Tenant.id.desc())
                .offset((page - 1) * size)
                .limit(size)
                .all()
            )

            items = []
            for t in tenants:
                total_usuarios = db.session.query(User).filter(User.tenant_id == t.id).count()
                items.append(
                    {
                        **t.to_dict(),
                        "total_usuarios": total_usuarios,
                    }
                )

            return {
                "items": items,
                "total": total,
                "page": page,
                "size": size,
            }, 200

    @admin_ns.route("/tenants/<int:tenant_id>")
    class AdminTenantDetail(Resource):
        @limiter.limit(ADMIN_RATE_LIMIT)
        @jwt_required()
        @superadmin_required
        @admin_ns.doc(security="jsonWebToken")
        def get(self, tenant_id):
            tenant = db.session.get(Tenant, tenant_id)
            if not tenant:
                return {"message": "Tenant nao encontrado."}, 404

            total_usuarios = db.session.query(User).filter(User.tenant_id == tenant_id).count()
            total_clientes = (
                db.session.query(Cliente).filter(Cliente.tenant_id == tenant_id).count()
            )
            total_casos = db.session.query(Caso).filter(Caso.tenant_id == tenant_id).count()

            owner = (
                db.session.query(User)
                .filter(User.tenant_id == tenant_id, User.role == "admin")
                .order_by(User.id.asc())
                .first()
            )

            ultimo_login_owner = None
            if owner:
                ultimo = (
                    db.session.query(LoginAudit)
                    .filter(LoginAudit.user_id == owner.id, LoginAudit.sucesso.is_(True))
                    .order_by(LoginAudit.criado_em.desc())
                    .first()
                )
                if ultimo and ultimo.criado_em:
                    ultimo_login_owner = ultimo.criado_em.isoformat()

            return {
                **tenant.to_dict(),
                "owner": (
                    {
                        "id": owner.id,
                        "username": owner.username,
                        "email": owner.email,
                        "nome_completo": owner.nome_completo,
                    }
                    if owner
                    else None
                ),
                "total_usuarios": total_usuarios,
                "total_clientes": total_clientes,
                "total_casos": total_casos,
                "ultimo_login_owner": ultimo_login_owner,
                # TODO Fase 1: plano, billing, score de churn, metricas de uso avancadas
            }, 200

    @admin_ns.route("/tenants/<int:tenant_id>/usuarios")
    class AdminTenantUsuarios(Resource):
        @limiter.limit(ADMIN_RATE_LIMIT)
        @jwt_required()
        @superadmin_required
        @admin_ns.doc(security="jsonWebToken")
        def get(self, tenant_id):
            tenant = db.session.get(Tenant, tenant_id)
            if not tenant:
                return {"message": "Tenant nao encontrado."}, 404

            usuarios = (
                db.session.query(User)
                .filter(User.tenant_id == tenant_id)
                .order_by(User.id.asc())
                .all()
            )
            # to_dict() ja exclui password_hash
            return {"items": [u.to_dict() for u in usuarios]}, 200

    @admin_ns.route("/tenants/<int:tenant_id>/atividade")
    class AdminTenantAtividade(Resource):
        @limiter.limit(ADMIN_RATE_LIMIT)
        @jwt_required()
        @superadmin_required
        @admin_ns.doc(
            security="jsonWebToken",
            description="Ultimos 50 eventos do AdminAuditLog filtrados por target_tenant_id.",
        )
        def get(self, tenant_id):
            tenant = db.session.get(Tenant, tenant_id)
            if not tenant:
                return {"message": "Tenant nao encontrado."}, 404

            eventos = (
                db.session.query(AdminAuditLog)
                .filter(AdminAuditLog.target_tenant_id == tenant_id)
                .order_by(AdminAuditLog.created_at.desc())
                .limit(50)
                .all()
            )
            return {"items": [e.to_dict() for e in eventos]}, 200

    def _mutar_status_tenant(tenant_id, novo_status, action_label):
        """Helper interno: aplica status novo + audit log atomicamente."""
        tenant = db.session.get(Tenant, tenant_id)
        if not tenant:
            return {"message": "Tenant nao encontrado."}, 404

        before = {"status": tenant.status}
        data = request.get_json(silent=True) or {}
        motivo = (data.get("motivo") or "").strip()[:MOTIVO_MAX_CHARS]

        try:
            tenant.status = novo_status
            registrar_admin_audit(
                action=action_label,
                target_type=TARGET_TYPE_TENANT,
                target_id=tenant.id,
                target_tenant_id=tenant.id,
                before=before,
                after={"status": novo_status, "motivo": motivo},
            )
            db.session.commit()
        except Exception:
            db.session.rollback()
            raise

        return tenant.to_dict(), 200

    @admin_ns.route("/tenants/<int:tenant_id>/suspender")
    class AdminTenantSuspender(Resource):
        @limiter.limit(ADMIN_RATE_LIMIT)
        @jwt_required()
        @superadmin_required
        @admin_ns.doc(security="jsonWebToken")
        def post(self, tenant_id):
            return _mutar_status_tenant(tenant_id, "suspenso", "suspender")

    @admin_ns.route("/tenants/<int:tenant_id>/reativar")
    class AdminTenantReativar(Resource):
        @limiter.limit(ADMIN_RATE_LIMIT)
        @jwt_required()
        @superadmin_required
        @admin_ns.doc(security="jsonWebToken")
        def post(self, tenant_id):
            return _mutar_status_tenant(tenant_id, "ativo", "reativar")

    @admin_ns.route("/tenants/<int:tenant_id>/anotacao")
    class AdminTenantAnotacaoCreate(Resource):
        @limiter.limit(ADMIN_RATE_LIMIT)
        @jwt_required()
        @superadmin_required
        @admin_ns.doc(
            security="jsonWebToken",
            description=f"Cria anotacao interna sobre o tenant. Texto puro, max {ANOTACAO_MAX_CHARS} chars.",
        )
        def post(self, tenant_id):
            tenant = db.session.get(Tenant, tenant_id)
            if not tenant:
                return {"message": "Tenant nao encontrado."}, 404

            data = request.get_json(silent=True) or {}
            texto_raw = data.get("texto") or ""
            texto = _strip_html_tags(texto_raw)[:ANOTACAO_MAX_CHARS]

            if not texto:
                return {"message": "Texto da anotacao e obrigatorio."}, 400

            admin_user_id = int(get_jwt_identity())

            try:
                anotacao = TenantAnotacao(
                    tenant_id=tenant_id,
                    admin_user_id=admin_user_id,
                    texto=texto,
                )
                db.session.add(anotacao)
                db.session.flush()
                registrar_admin_audit(
                    action="anotacao_criada",
                    target_type=TARGET_TYPE_TENANT,
                    target_id=tenant.id,
                    target_tenant_id=tenant.id,
                    before=None,
                    after={"anotacao_id": anotacao.id, "len": len(texto)},
                )
                db.session.commit()
            except Exception:
                db.session.rollback()
                raise

            return anotacao.to_dict(), 201

    @admin_ns.route("/tenants/<int:tenant_id>/anotacoes")
    class AdminTenantAnotacoesList(Resource):
        @limiter.limit(ADMIN_RATE_LIMIT)
        @jwt_required()
        @superadmin_required
        @admin_ns.doc(security="jsonWebToken")
        def get(self, tenant_id):
            tenant = db.session.get(Tenant, tenant_id)
            if not tenant:
                return {"message": "Tenant nao encontrado."}, 404

            anotacoes = (
                db.session.query(TenantAnotacao)
                .filter(TenantAnotacao.tenant_id == tenant_id)
                .order_by(TenantAnotacao.created_at.desc())
                .all()
            )
            return {"items": [a.to_dict() for a in anotacoes]}, 200
