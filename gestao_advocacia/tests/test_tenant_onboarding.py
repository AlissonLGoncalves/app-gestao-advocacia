# Testes do wizard de onboarding: GET /tenant/onboarding-status e POST /tenant/complete-onboarding.

import json


def test_tenant_novo_comeca_sem_onboarding(auth_client, db):
    res = auth_client.get("/api/v1/tenant/onboarding-status")
    assert res.status_code == 200
    data = json.loads(res.data)
    assert data["onboarding_completed"] is False
    assert data["onboarding_completed_at"] is None


def test_post_complete_onboarding_marca_e_e_idempotente(auth_client, db):
    res1 = auth_client.post("/api/v1/tenant/complete-onboarding")
    assert res1.status_code == 200
    data1 = json.loads(res1.data)
    assert data1["onboarding_completed"] is True
    timestamp_inicial = data1["onboarding_completed_at"]
    assert timestamp_inicial is not None

    # Segunda chamada nao deve sobrescrever o timestamp original.
    res2 = auth_client.post("/api/v1/tenant/complete-onboarding")
    assert res2.status_code == 200
    data2 = json.loads(res2.data)
    assert data2["onboarding_completed_at"] == timestamp_inicial

    status = json.loads(auth_client.get("/api/v1/tenant/onboarding-status").data)
    assert status["onboarding_completed"] is True


def test_complete_onboarding_isolamento_entre_tenants(client, auth_client, db):
    # Tenant 1 (auth_client) completa onboarding.
    auth_client.post("/api/v1/tenant/complete-onboarding")

    # Registra um segundo usuario (cria novo tenant).
    reg = client.post(
        "/api/v1/auth/register",
        json={
            "username": "outro_escritorio",
            "email": "outro_esc@teste.com",
            "password": "Senha1234!",
            "role": "admin",
            "aceite_termos": True,
            "aceite_lgpd": True,
            "versao_termos": "v1.0",
            "versao_lgpd": "v1.0",
        },
    )
    assert reg.status_code == 201

    login = client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "outro_escritorio", "password": "Senha1234!"},
    )
    token_outro = json.loads(login.data)["access_token"]
    headers_outro = {"Authorization": f"Bearer {token_outro}"}

    # Tenant 2 ainda nao completou — confirma que o flag nao foi compartilhado.
    res = client.get("/api/v1/tenant/onboarding-status", headers=headers_outro)
    assert res.status_code == 200
    data = json.loads(res.data)
    assert data["onboarding_completed"] is False


def test_tenant_to_dict_inclui_onboarding_completed_at(auth_client, db):
    auth_client.post("/api/v1/tenant/complete-onboarding")
    res = auth_client.get("/api/v1/tenant/")
    assert res.status_code == 200
    data = json.loads(res.data)
    assert "onboarding_completed_at" in data
    assert data["onboarding_completed_at"] is not None


def test_assistente_nao_pode_completar_onboarding(client, db):
    # Cria tenant via admin e convida assistente teria caminho mais longo.
    # Solucao mais simples: registrar usuario, mudar role no DB para assistente.
    from extensions import db as _db
    from models import User

    reg = client.post(
        "/api/v1/auth/register",
        json={
            "username": "assist_user",
            "email": "assist@teste.com",
            "password": "Senha1234!",
            "role": "admin",
            "aceite_termos": True,
            "aceite_lgpd": True,
            "versao_termos": "v1.0",
            "versao_lgpd": "v1.0",
        },
    )
    assert reg.status_code == 201

    user = User.query.filter_by(username="assist_user").first()
    user.role = "assistente"
    _db.session.commit()

    login = client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "assist_user", "password": "Senha1234!"},
    )
    token = json.loads(login.data)["access_token"]
    res = client.post(
        "/api/v1/tenant/complete-onboarding",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403
