import json

from models import LoginAudit

BASE = "/api/v1/auth"


def test_login_sucesso_cria_login_audit(client, db):
    reg_resp = client.post(
        f"{BASE}/register",
        json={
            "username": "auditok",
            "email": "auditok@teste.com",
            "password": "Senha1234!",
            "role": "admin",
            "aceite_termos": True,
            "aceite_lgpd": True,
            "versao_termos": "v1.0",
            "versao_lgpd": "v1.0",
        },
    )
    assert reg_resp.status_code == 201

    resp = client.post(
        f"{BASE}/login",
        json={"username_or_email": "auditok", "password": "Senha1234!"},
    )
    assert resp.status_code == 200

    item = LoginAudit.query.order_by(LoginAudit.id.desc()).first()
    assert item is not None
    assert item.sucesso is True
    assert item.motivo_falha is None
    assert item.user_id is not None


def test_login_falha_cria_login_audit(client, db):
    reg_resp = client.post(
        f"{BASE}/register",
        json={
            "username": "auditfail",
            "email": "auditfail@teste.com",
            "password": "Senha1234!",
            "role": "admin",
            "aceite_termos": True,
            "aceite_lgpd": True,
            "versao_termos": "v1.0",
            "versao_lgpd": "v1.0",
        },
    )
    assert reg_resp.status_code == 201

    resp = client.post(
        f"{BASE}/login",
        json={"username_or_email": "auditfail", "password": "SenhaErrada!"},
    )
    assert resp.status_code == 401

    item = LoginAudit.query.order_by(LoginAudit.id.desc()).first()
    assert item is not None
    assert item.sucesso is False
    assert item.motivo_falha == "invalid_credentials"
    assert item.user_id is not None


def test_me_historico_login_retorna_ultimos(auth_client, db):
    resp = auth_client.get(f"{BASE}/me/historico-login?limit=10")
    assert resp.status_code == 200
    data = json.loads(resp.data)
    assert isinstance(data, list)
    assert len(data) >= 1
    assert "sucesso" in data[0]
    assert "criado_em" in data[0]
