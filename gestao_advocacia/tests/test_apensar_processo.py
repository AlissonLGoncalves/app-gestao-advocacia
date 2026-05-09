"""Testes do Epic #8 (#182): apensar processos + alterar instancia."""

import json

from app import Caso, Cliente, User, db


def _register_and_login(client, suffix):
    username = f"apens_{suffix}"
    email = f"apens_{suffix}@example.com"
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
    data = json.loads(login.data)
    with client.application.app_context():
        user = db.session.get(User, data["user"]["id"])
        data["user"]["tenant_id"] = user.tenant_id
    return data["access_token"], data["user"]


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


def _criar_dois_casos(app, user_id, tenant_id):
    with app.app_context():
        cliente = Cliente(
            tenant_id=tenant_id,
            nome_razao_social="Cliente Apensar",
            cpf_cnpj="111.222.333-44",
            tipo_pessoa="PF",
            user_id=user_id,
        )
        db.session.add(cliente)
        db.session.flush()
        principal = Caso(
            titulo="Processo principal",
            cliente_id=cliente.id,
            user_id=user_id,
            tenant_id=tenant_id,
            instancia="1ª Instância",
        )
        apenso = Caso(
            titulo="Processo apenso",
            cliente_id=cliente.id,
            user_id=user_id,
            tenant_id=tenant_id,
        )
        db.session.add_all([principal, apenso])
        db.session.commit()
        return principal.id, apenso.id


# ---------------------------------------------------------------------------
# POST /casos/{id}/apensar
# ---------------------------------------------------------------------------
def test_apensar_caso_a_outro_principal(client):
    token, user = _register_and_login(client, "ok")
    principal_id, apenso_id = _criar_dois_casos(client.application, user["id"], user["tenant_id"])

    res = client.post(
        f"/api/v1/casos/{apenso_id}/apensar",
        json={"caso_principal_id": principal_id},
        headers=_headers(token),
    )
    assert res.status_code == 200
    body = res.get_json()
    assert body["caso"]["caso_principal_id"] == principal_id
    assert body["caso"]["eh_apenso"] is True


def test_apensar_caso_a_si_mesmo_retorna_400(client):
    token, user = _register_and_login(client, "self")
    principal_id, _ = _criar_dois_casos(client.application, user["id"], user["tenant_id"])

    res = client.post(
        f"/api/v1/casos/{principal_id}/apensar",
        json={"caso_principal_id": principal_id},
        headers=_headers(token),
    )
    assert res.status_code == 400
    assert res.get_json()["code"] == "self_apensar"


def test_apensar_a_caso_inexistente_retorna_404(client):
    token, user = _register_and_login(client, "noexist")
    _, apenso_id = _criar_dois_casos(client.application, user["id"], user["tenant_id"])

    res = client.post(
        f"/api/v1/casos/{apenso_id}/apensar",
        json={"caso_principal_id": 99999},
        headers=_headers(token),
    )
    assert res.status_code == 404
    assert res.get_json()["code"] == "principal_nao_encontrado"


def test_apensar_sem_caso_principal_id_retorna_400(client):
    token, user = _register_and_login(client, "missing")
    _, apenso_id = _criar_dois_casos(client.application, user["id"], user["tenant_id"])

    res = client.post(
        f"/api/v1/casos/{apenso_id}/apensar",
        json={},
        headers=_headers(token),
    )
    assert res.status_code == 400
    assert res.get_json()["code"] == "missing_caso_principal_id"


def test_apensar_segue_cadeia_ate_o_topo(client):
    """Se A esta apenso a B, e usuario apensa C a B, vai pra B (topo)."""
    token, user = _register_and_login(client, "cadeia")
    with client.application.app_context():
        cliente = Cliente(
            tenant_id=user["tenant_id"],
            nome_razao_social="X",
            cpf_cnpj="222.333.444-55",
            tipo_pessoa="PF",
            user_id=user["id"],
        )
        db.session.add(cliente)
        db.session.flush()
        topo = Caso(
            titulo="Topo",
            cliente_id=cliente.id,
            user_id=user["id"],
            tenant_id=user["tenant_id"],
        )
        meio = Caso(
            titulo="Meio",
            cliente_id=cliente.id,
            user_id=user["id"],
            tenant_id=user["tenant_id"],
        )
        novo = Caso(
            titulo="Novo",
            cliente_id=cliente.id,
            user_id=user["id"],
            tenant_id=user["tenant_id"],
        )
        db.session.add_all([topo, meio, novo])
        db.session.flush()
        meio.caso_principal_id = topo.id
        db.session.commit()
        topo_id, meio_id, novo_id = topo.id, meio.id, novo.id

    # Apensa novo a meio — mas meio aponta pra topo, entao deve ir pra topo
    res = client.post(
        f"/api/v1/casos/{novo_id}/apensar",
        json={"caso_principal_id": meio_id},
        headers=_headers(token),
    )
    assert res.status_code == 200
    body = res.get_json()
    assert body["caso"]["caso_principal_id"] == topo_id


# ---------------------------------------------------------------------------
# DELETE /casos/{id}/apensar (desapensar)
# ---------------------------------------------------------------------------
def test_desapensar_caso(client):
    token, user = _register_and_login(client, "desap")
    principal_id, apenso_id = _criar_dois_casos(client.application, user["id"], user["tenant_id"])

    # Apensa primeiro
    client.post(
        f"/api/v1/casos/{apenso_id}/apensar",
        json={"caso_principal_id": principal_id},
        headers=_headers(token),
    )

    # Desapensa
    res = client.delete(f"/api/v1/casos/{apenso_id}/apensar", headers=_headers(token))
    assert res.status_code == 200
    assert res.get_json()["caso"]["caso_principal_id"] is None


def test_desapensar_caso_nao_apensado_retorna_400(client):
    token, user = _register_and_login(client, "noapens")
    _, apenso_id = _criar_dois_casos(client.application, user["id"], user["tenant_id"])

    res = client.delete(f"/api/v1/casos/{apenso_id}/apensar", headers=_headers(token))
    assert res.status_code == 400
    assert res.get_json()["code"] == "nao_apensado"


# ---------------------------------------------------------------------------
# GET /casos/{id}/apensos
# ---------------------------------------------------------------------------
def test_listar_apensos_de_um_caso(client):
    token, user = _register_and_login(client, "listar")
    principal_id, apenso_id = _criar_dois_casos(client.application, user["id"], user["tenant_id"])
    client.post(
        f"/api/v1/casos/{apenso_id}/apensar",
        json={"caso_principal_id": principal_id},
        headers=_headers(token),
    )

    res = client.get(f"/api/v1/casos/{principal_id}/apensos", headers=_headers(token))
    assert res.status_code == 200
    body = res.get_json()
    assert body["total"] == 1
    assert body["apensos"][0]["id"] == apenso_id


def test_listar_apensos_vazio(client):
    token, user = _register_and_login(client, "vazio")
    principal_id, _ = _criar_dois_casos(client.application, user["id"], user["tenant_id"])

    res = client.get(f"/api/v1/casos/{principal_id}/apensos", headers=_headers(token))
    assert res.status_code == 200
    assert res.get_json()["total"] == 0


# ---------------------------------------------------------------------------
# PATCH /casos/{id}/instancia
# ---------------------------------------------------------------------------
def test_alterar_instancia_do_caso(client):
    token, user = _register_and_login(client, "instancia")
    principal_id, _ = _criar_dois_casos(client.application, user["id"], user["tenant_id"])

    res = client.patch(
        f"/api/v1/casos/{principal_id}/instancia",
        json={"instancia": "2ª Instância"},
        headers=_headers(token),
    )
    assert res.status_code == 200
    body = res.get_json()
    assert body["instancia_anterior"] == "1ª Instância"
    assert body["instancia_atual"] == "2ª Instância"
    assert body["caso"]["instancia"] == "2ª Instância"


def test_alterar_instancia_sem_campo_retorna_400(client):
    token, user = _register_and_login(client, "noinst")
    principal_id, _ = _criar_dois_casos(client.application, user["id"], user["tenant_id"])

    res = client.patch(
        f"/api/v1/casos/{principal_id}/instancia",
        json={},
        headers=_headers(token),
    )
    assert res.status_code == 400
    assert res.get_json()["code"] == "missing_instancia"


def test_alterar_instancia_vazia_retorna_400(client):
    token, user = _register_and_login(client, "empty")
    principal_id, _ = _criar_dois_casos(client.application, user["id"], user["tenant_id"])

    res = client.patch(
        f"/api/v1/casos/{principal_id}/instancia",
        json={"instancia": "   "},
        headers=_headers(token),
    )
    assert res.status_code == 400
    assert res.get_json()["code"] == "instancia_vazia"


def test_endpoints_sem_token_retornam_401(client):
    """Auth gate em todos os 4 endpoints novos."""
    for method, url in [
        ("post", "/api/v1/casos/1/apensar"),
        ("delete", "/api/v1/casos/1/apensar"),
        ("get", "/api/v1/casos/1/apensos"),
        ("patch", "/api/v1/casos/1/instancia"),
    ]:
        res = getattr(client, method)(url)
        assert res.status_code == 401, f"{method.upper()} {url} deveria retornar 401"
