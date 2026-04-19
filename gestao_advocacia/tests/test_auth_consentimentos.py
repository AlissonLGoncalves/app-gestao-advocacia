"""Testes para persistência de consentimento LGPD/Termos de Uso (A1)."""

import json

from models import ConsentimentoUsuario

BASE = "/api/v1/auth"

PAYLOAD_VALIDO = {
    "username": "user_consent",
    "email": "consent@teste.com",
    "password": "Senha1234!",
    "role": "admin",
    "aceite_termos": True,
    "aceite_lgpd": True,
    "versao_termos": "v1.0",
    "versao_lgpd": "v1.0",
}


def test_register_com_aceite_persiste_dois_consentimentos(client, db):
    resp = client.post(f"{BASE}/register", json=PAYLOAD_VALIDO)
    assert resp.status_code == 201

    registros = ConsentimentoUsuario.query.all()
    tipos = {r.tipo for r in registros}
    assert tipos == {"termos_uso", "lgpd"}
    assert len(registros) == 2


def test_register_sem_aceite_termos_retorna_400(client, db):
    payload = {
        **PAYLOAD_VALIDO,
        "aceite_termos": False,
        "email": "a1b@teste.com",
        "username": "a1b",
    }
    resp = client.post(f"{BASE}/register", json=payload)
    assert resp.status_code == 400
    data = json.loads(resp.data)
    assert "Termos de Uso" in data["message"]


def test_register_sem_aceite_lgpd_retorna_400(client, db):
    payload = {**PAYLOAD_VALIDO, "aceite_lgpd": False, "email": "a1c@teste.com", "username": "a1c"}
    resp = client.post(f"{BASE}/register", json=payload)
    assert resp.status_code == 400
    data = json.loads(resp.data)
    assert "LGPD" in data["message"]


def test_register_sem_versao_termos_retorna_400(client, db):
    payload = {
        **PAYLOAD_VALIDO,
        "versao_termos": "",
        "email": "a1d@teste.com",
        "username": "a1d",
    }
    resp = client.post(f"{BASE}/register", json=payload)
    assert resp.status_code == 400
    data = json.loads(resp.data)
    assert "Vers" in data["message"]


def test_me_consentimentos_retorna_lista(auth_client):
    resp = auth_client.get(f"{BASE}/me/consentimentos")
    assert resp.status_code == 200
    data = json.loads(resp.data)
    assert isinstance(data, list)
    assert len(data) == 2
    tipos = {item["tipo"] for item in data}
    assert tipos == {"termos_uso", "lgpd"}


def test_consentimento_persiste_hash_quando_fornecido(client, db):
    payload = {
        **PAYLOAD_VALIDO,
        "email": "a1e@teste.com",
        "username": "a1e",
        "hash_termos_uso": "abc123def456",
    }
    resp = client.post(f"{BASE}/register", json=payload)
    assert resp.status_code == 201

    termos = ConsentimentoUsuario.query.filter_by(tipo="termos_uso").first()
    assert termos is not None
    assert termos.hash_documento == "abc123def456"
