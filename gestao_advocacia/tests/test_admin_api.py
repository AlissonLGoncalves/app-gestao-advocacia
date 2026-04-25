"""admin-fase0: testes do backoffice super-admin.

Cobertura:
- 403 para role admin normal
- listagem cross-tenant
- detalhe com contadores
- audit log de suspensao
- bloqueio de login para tenant suspenso
- superadmin nao bloqueado por status
- redaction de campos sensiveis no after_json

Fixtures: cria usuarios superadmin/admin diretamente no DB (registro publico nao
permite role=superadmin) e gera tokens via create_access_token.
"""

import json

import pytest
from flask_jwt_extended import create_access_token

from extensions import db as _db
from models import AdminAuditLog, Tenant, User

ADMIN_BASE = "/admin/v1"
APP_BASE = "/api/v1"


def _criar_tenant(nome, status="ativo", documento=None, email="contato@x.com"):
    t = Tenant(
        nome_escritorio=nome,
        documento=documento,
        email_contato=email,
        status=status,
    )
    _db.session.add(t)
    _db.session.commit()
    return t


def _criar_user(*, username, email, role, tenant_id=None, password="Senha1234!"):
    u = User(
        username=username,
        email=email,
        role=role,
        tenant_id=tenant_id,
    )
    u.set_password(password)
    _db.session.add(u)
    _db.session.commit()
    return u


def _token_para(app, user):
    with app.app_context():
        return create_access_token(
            identity=str(user.id),
            additional_claims={"role": user.role},
        )


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# 1) Role admin normal recebe 403
# ---------------------------------------------------------------------------
def test_superadmin_acesso_negado_para_admin_normal(app, client, db):
    tenant = _criar_tenant("Escritorio A")
    admin = _criar_user(
        username="adm_norm",
        email="adm_norm@x.com",
        role="admin",
        tenant_id=tenant.id,
    )
    token = _token_para(app, admin)

    resp = client.get(f"{ADMIN_BASE}/tenants", headers=_auth_headers(token))
    assert resp.status_code == 403
    payload = json.loads(resp.data)
    # Mensagem generica — nao revela detalhes do recurso
    assert "negado" in (payload.get("message") or "").lower()


# ---------------------------------------------------------------------------
# 2) Superadmin lista todos os tenants (cross-tenant)
# ---------------------------------------------------------------------------
def test_superadmin_lista_tenants(app, client, db):
    t1 = _criar_tenant("Escritorio Alpha", documento="11111111000111")
    t2 = _criar_tenant("Escritorio Beta", documento="22222222000122")
    sa = _criar_user(
        username="sa_lista", email="sa_lista@x.com", role="superadmin", tenant_id=t1.id
    )
    token = _token_para(app, sa)

    resp = client.get(f"{ADMIN_BASE}/tenants", headers=_auth_headers(token))
    assert resp.status_code == 200
    data = json.loads(resp.data)
    nomes = [t["nome_escritorio"] for t in data["items"]]
    assert "Escritorio Alpha" in nomes
    assert "Escritorio Beta" in nomes
    assert data["total"] >= 2


# ---------------------------------------------------------------------------
# 3) Detalhe com contadores
# ---------------------------------------------------------------------------
def test_superadmin_detalhe_tenant_com_contadores(app, client, db):
    tenant = _criar_tenant("Escritorio Detalhe")
    owner = _criar_user(
        username="owner_x", email="owner_x@x.com", role="admin", tenant_id=tenant.id
    )
    _criar_user(
        username="assist_x", email="assist_x@x.com", role="assistente", tenant_id=tenant.id
    )
    sa = _criar_user(
        username="sa_det", email="sa_det@x.com", role="superadmin", tenant_id=None
    )
    token = _token_para(app, sa)

    resp = client.get(f"{ADMIN_BASE}/tenants/{tenant.id}", headers=_auth_headers(token))
    assert resp.status_code == 200
    data = json.loads(resp.data)
    assert data["id"] == tenant.id
    assert data["total_usuarios"] == 2
    assert data["total_clientes"] == 0
    assert data["total_casos"] == 0
    assert data["owner"]["id"] == owner.id


def test_superadmin_detalhe_tenant_404(app, client, db):
    sa = _criar_user(username="sa_404", email="sa_404@x.com", role="superadmin")
    token = _token_para(app, sa)
    resp = client.get(f"{ADMIN_BASE}/tenants/99999", headers=_auth_headers(token))
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# 4) Audit log de suspensao
# ---------------------------------------------------------------------------
def test_admin_audit_log_registra_suspensao(app, client, db):
    tenant = _criar_tenant("Para Suspender")
    sa = _criar_user(
        username="sa_susp", email="sa_susp@x.com", role="superadmin", tenant_id=None
    )
    token = _token_para(app, sa)

    resp = client.post(
        f"{ADMIN_BASE}/tenants/{tenant.id}/suspender",
        headers=_auth_headers(token),
        json={"motivo": "inadimplencia"},
    )
    assert resp.status_code == 200
    data = json.loads(resp.data)
    assert data["status"] == "suspenso"

    log = (
        AdminAuditLog.query.filter_by(action="suspender", target_tenant_id=tenant.id)
        .order_by(AdminAuditLog.id.desc())
        .first()
    )
    assert log is not None
    assert log.admin_user_id == sa.id
    assert log.target_type == "tenant"
    assert log.target_id == tenant.id
    after = json.loads(log.after_json)
    assert after["status"] == "suspenso"
    assert after["motivo"] == "inadimplencia"


def test_admin_reativar_volta_status_ativo(app, client, db):
    tenant = _criar_tenant("Para Reativar", status="suspenso")
    sa = _criar_user(username="sa_re", email="sa_re@x.com", role="superadmin")
    token = _token_para(app, sa)

    resp = client.post(
        f"{ADMIN_BASE}/tenants/{tenant.id}/reativar",
        headers=_auth_headers(token),
        json={},
    )
    assert resp.status_code == 200
    assert json.loads(resp.data)["status"] == "ativo"


# ---------------------------------------------------------------------------
# 5) Login bloqueado para tenant suspenso
# ---------------------------------------------------------------------------
def test_login_bloqueado_para_tenant_suspenso(app, client, db):
    tenant = _criar_tenant("Suspenso Login", status="suspenso")
    user = _criar_user(
        username="user_susp",
        email="user_susp@x.com",
        role="admin",
        tenant_id=tenant.id,
    )

    resp = client.post(
        f"{APP_BASE}/auth/login",
        json={"username_or_email": "user_susp", "password": "Senha1234!"},
    )
    assert resp.status_code == 403
    payload = json.loads(resp.data)
    assert "suspensa" in (payload.get("message") or "").lower()

    # LoginAudit registrado com motivo correto
    from models import LoginAudit
    audit = (
        LoginAudit.query.filter_by(user_id=user.id).order_by(LoginAudit.id.desc()).first()
    )
    assert audit is not None
    assert audit.sucesso is False
    assert audit.motivo_falha == "tenant_suspenso"


# ---------------------------------------------------------------------------
# 6) Superadmin nao e bloqueado mesmo se o tenant dele estiver suspenso
# ---------------------------------------------------------------------------
def test_superadmin_nunca_bloqueado_por_tenant_suspenso(app, client, db):
    tenant = _criar_tenant("Tenant do SA Suspenso", status="suspenso")
    _criar_user(
        username="sa_nobloq",
        email="sa_nobloq@x.com",
        role="superadmin",
        tenant_id=tenant.id,
    )

    resp = client.post(
        f"{APP_BASE}/auth/login",
        json={"username_or_email": "sa_nobloq", "password": "Senha1234!"},
    )
    assert resp.status_code == 200
    data = json.loads(resp.data)
    assert "access_token" in data
    assert data["user"]["role"] == "superadmin"


# ---------------------------------------------------------------------------
# 7) Redaction: senha nao aparece no after_json
# ---------------------------------------------------------------------------
def test_redaction_admin_audit_log_nao_persiste_senha(app, client, db):
    """Verifica que registrar_admin_audit faz redaction de chaves sensiveis.

    Chamamos o helper diretamente (nao ha endpoint que aceite senha no body),
    pois a obrigacao de redaction e do helper, nao das rotas.
    """
    from helpers.admin_security import redact_sensitive

    payload = {
        "username": "joao",
        "password": "SenhaSecreta!",
        "nested": {"token": "abc.def.ghi", "ok": True},
        "list": [{"refresh_token": "xyz"}, "plain"],
    }
    redacted = redact_sensitive(payload)
    serialized = json.dumps(redacted)

    assert "SenhaSecreta!" not in serialized
    assert "abc.def.ghi" not in serialized
    assert "xyz" not in serialized
    assert redacted["password"] == "***REDACTED***"
    assert redacted["nested"]["token"] == "***REDACTED***"
    assert redacted["nested"]["ok"] is True
    assert redacted["list"][0]["refresh_token"] == "***REDACTED***"
    assert redacted["list"][1] == "plain"


# ---------------------------------------------------------------------------
# 8) /me confirma role superadmin
# ---------------------------------------------------------------------------
def test_admin_me_retorna_dados_do_superadmin(app, client, db):
    sa = _criar_user(username="sa_me", email="sa_me@x.com", role="superadmin")
    token = _token_para(app, sa)

    resp = client.get(f"{ADMIN_BASE}/me", headers=_auth_headers(token))
    assert resp.status_code == 200
    data = json.loads(resp.data)
    assert data["role"] == "superadmin"
    assert data["username"] == "sa_me"


# ---------------------------------------------------------------------------
# 9) Anotacao: limite de chars + sanitizacao + audit
# ---------------------------------------------------------------------------
def test_admin_anotacao_strip_html_e_audit(app, client, db):
    tenant = _criar_tenant("Tenant Anotacao")
    sa = _criar_user(username="sa_anot", email="sa_anot@x.com", role="superadmin")
    token = _token_para(app, sa)

    resp = client.post(
        f"{ADMIN_BASE}/tenants/{tenant.id}/anotacao",
        headers=_auth_headers(token),
        json={"texto": "Cliente <script>alert(1)</script> em risco"},
    )
    assert resp.status_code == 201
    data = json.loads(resp.data)
    assert "<script>" not in data["texto"]
    assert "Cliente" in data["texto"]

    log = (
        AdminAuditLog.query.filter_by(action="anotacao_criada", target_tenant_id=tenant.id)
        .order_by(AdminAuditLog.id.desc())
        .first()
    )
    assert log is not None
