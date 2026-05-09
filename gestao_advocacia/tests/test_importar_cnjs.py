"""Testes do Epic #5 (#179): triagem em lote de CNJs."""

import json

from app import Caso, Cliente, User, db


def _register_and_login(client, suffix):
    username = f"imp_{suffix}"
    email = f"imp_{suffix}@example.com"
    password = "Senha1234!"
    reg = client.post(
        "/api/v1/auth/register",
        json={
            "username": username,
            "email": email,
            "password": password,
            "role": "admin",
            "aceite_termos": True,
            "aceite_lgpd": True,
            "versao_termos": "v1.0",
            "versao_lgpd": "v1.0",
        },
    )
    assert reg.status_code == 201, reg.data

    login = client.post(
        "/api/v1/auth/login",
        json={"username_or_email": username, "password": password},
    )
    assert login.status_code == 200, login.data
    data = json.loads(login.data)
    with client.application.app_context():
        user = db.session.get(User, data["user"]["id"])
        data["user"]["tenant_id"] = user.tenant_id
    return data["access_token"], data["user"]


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


# CNJs validos (DV calculado pelo proprio algoritmo do projeto via testes existentes)
CNJ_VALIDO_TJPR = "0000472-75.2025.8.16.0075"
CNJ_VALIDO_TJSP = "0000001-84.2020.8.26.0001"
CNJ_VALIDO_TRT2 = "1234567-66.2026.5.02.0001"


def test_lista_vazia_retorna_400(client):
    token, _ = _register_and_login(client, "vazio")
    res = client.post(
        "/api/v1/casos/importar-cnjs",
        json={"cnjs": []},
        headers=_headers(token),
    )
    assert res.status_code == 400
    assert res.get_json()["code"] == "empty_list"


def test_payload_sem_cnjs_retorna_400(client):
    token, _ = _register_and_login(client, "nopayload")
    res = client.post(
        "/api/v1/casos/importar-cnjs",
        json={},
        headers=_headers(token),
    )
    assert res.status_code == 400
    assert res.get_json()["code"] == "invalid_payload"


def test_excede_limite_de_40_retorna_400(client):
    token, _ = _register_and_login(client, "excedente")
    cnjs = [CNJ_VALIDO_TJPR] * 41
    res = client.post(
        "/api/v1/casos/importar-cnjs",
        json={"cnjs": cnjs},
        headers=_headers(token),
    )
    assert res.status_code == 400
    assert res.get_json()["code"] == "too_many"


def test_cnj_valido_retorna_status_valido(client):
    token, _ = _register_and_login(client, "valido")
    res = client.post(
        "/api/v1/casos/importar-cnjs",
        json={"cnjs": [CNJ_VALIDO_TJPR]},
        headers=_headers(token),
    )
    assert res.status_code == 200
    body = res.get_json()
    assert body["stats"] == {"valido": 1, "invalido": 0, "duplicado": 0}
    assert body["resultados"][0]["status"] == "valido"
    assert body["resultados"][0]["cnj_normalizado"] == CNJ_VALIDO_TJPR


def test_cnj_apenas_digitos_e_normalizado(client):
    token, _ = _register_and_login(client, "digitos")
    cnj_digits = "00004727520258160075"
    res = client.post(
        "/api/v1/casos/importar-cnjs",
        json={"cnjs": [cnj_digits]},
        headers=_headers(token),
    )
    assert res.status_code == 200
    resultado = res.get_json()["resultados"][0]
    assert resultado["status"] == "valido"
    assert resultado["cnj_normalizado"] == CNJ_VALIDO_TJPR


def test_cnj_tamanho_invalido_retorna_invalido(client):
    token, _ = _register_and_login(client, "tamanho")
    res = client.post(
        "/api/v1/casos/importar-cnjs",
        json={"cnjs": ["123", "abcdef"]},
        headers=_headers(token),
    )
    assert res.status_code == 200
    body = res.get_json()
    assert body["stats"]["invalido"] == 2
    motivos = {r["motivo"] for r in body["resultados"]}
    assert "tamanho_invalido" in motivos


def test_cnj_dv_invalido_retorna_invalido(client):
    token, _ = _register_and_login(client, "dv")
    cnj_dv_errado = "0000001-99.2020.8.26.0001"  # DV claramente errado
    res = client.post(
        "/api/v1/casos/importar-cnjs",
        json={"cnjs": [cnj_dv_errado]},
        headers=_headers(token),
    )
    assert res.status_code == 200
    body = res.get_json()
    assert body["stats"]["invalido"] == 1
    assert body["resultados"][0]["motivo"] == "dv_invalido"


def test_duplicado_no_mesmo_lote(client):
    token, _ = _register_and_login(client, "duplote")
    res = client.post(
        "/api/v1/casos/importar-cnjs",
        json={"cnjs": [CNJ_VALIDO_TJPR, CNJ_VALIDO_TJPR]},
        headers=_headers(token),
    )
    assert res.status_code == 200
    body = res.get_json()
    assert body["stats"] == {"valido": 1, "invalido": 0, "duplicado": 1}
    assert body["resultados"][1]["motivo"] == "duplicado_no_lote"


def test_duplicado_no_tenant(client):
    token, user = _register_and_login(client, "duptenant")
    with client.application.app_context():
        cliente = Cliente(
            tenant_id=user["tenant_id"],
            nome_razao_social="Cliente",
            cpf_cnpj="111.222.333-44",
            tipo_pessoa="PF",
            user_id=user["id"],
        )
        db.session.add(cliente)
        db.session.flush()
        caso = Caso(
            titulo="Caso existente",
            numero_processo=CNJ_VALIDO_TJPR,
            cliente_id=cliente.id,
            user_id=user["id"],
            tenant_id=user["tenant_id"],
        )
        db.session.add(caso)
        db.session.commit()
        caso_id = caso.id

    res = client.post(
        "/api/v1/casos/importar-cnjs",
        json={"cnjs": [CNJ_VALIDO_TJPR]},
        headers=_headers(token),
    )
    assert res.status_code == 200
    body = res.get_json()
    assert body["stats"]["duplicado"] == 1
    assert body["resultados"][0]["motivo"] == "ja_existe_no_tenant"
    assert body["resultados"][0]["caso_id"] == caso_id


def test_payload_misto_retorna_stats_consistentes(client):
    token, _ = _register_and_login(client, "misto")
    res = client.post(
        "/api/v1/casos/importar-cnjs",
        json={
            "cnjs": [
                CNJ_VALIDO_TJPR,
                CNJ_VALIDO_TJSP,
                CNJ_VALIDO_TJPR,  # duplicado no lote
                "invalido",
                CNJ_VALIDO_TRT2,
            ]
        },
        headers=_headers(token),
    )
    assert res.status_code == 200
    body = res.get_json()
    assert body["stats"] == {"valido": 3, "invalido": 1, "duplicado": 1}
    assert body["total"] == 5


def test_sem_token_retorna_401(client):
    res = client.post("/api/v1/casos/importar-cnjs", json={"cnjs": [CNJ_VALIDO_TJPR]})
    assert res.status_code == 401
