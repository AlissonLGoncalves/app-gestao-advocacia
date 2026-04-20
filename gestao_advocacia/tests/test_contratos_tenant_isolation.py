import json
from datetime import date


def _register_and_login(client, suffix):
    username = f"contratos_tenant_{suffix}"
    email = f"contratos_tenant_{suffix}@example.com"
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
    return data["access_token"], data["user"]


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


def _auth_json(client, method, url, token, payload=None):
    fn = getattr(client, method)
    return fn(url, headers=_headers(token), json=payload)


def _make_base_data(client, token, tag):
    cliente_resp = _auth_json(
        client,
        "post",
        "/api/v1/clientes",
        token,
        {
            "nome_razao_social": f"Cliente Contrato {tag}",
            "cpf_cnpj": f"111222333{tag:02d}",
            "tipo_pessoa": "PF",
            "email": f"cliente_contrato_{tag}@example.com",
        },
    )
    assert cliente_resp.status_code == 201, cliente_resp.data
    cliente_id = json.loads(cliente_resp.data)["id"]

    caso_resp = _auth_json(
        client,
        "post",
        "/api/v1/casos",
        token,
        {
            "titulo": f"Caso Contrato {tag}",
            "status": "Ativo",
            "tipo_acao": "Cível",
            "cliente_id": cliente_id,
            "numero_processo": f"0001234-12.2026.8.16.{2000 + tag}",
            "data_distribuicao": date.today().isoformat(),
        },
    )
    assert caso_resp.status_code == 201, caso_resp.data
    caso_id = json.loads(caso_resp.data)["id"]

    return cliente_id, caso_id


def test_post_contrato_caso_outro_tenant_retorna_404(client, db):
    token_a, _ = _register_and_login(client, "a")
    token_b, _ = _register_and_login(client, "b")

    cliente_a_id, _ = _make_base_data(client, token_a, 1)
    _, caso_b_id = _make_base_data(client, token_b, 2)

    resp = _auth_json(
        client,
        "post",
        "/api/v1/contratos",
        token_a,
        {
            "tipo_honorario": "Fixo",
            "valor_total": 1200.0,
            "status": "Ativo",
            "caso_id": caso_b_id,
            "cliente_id": cliente_a_id,
            "notas_condicoes": "Tentativa cross-tenant",
        },
    )

    assert resp.status_code == 404
    assert "Caso não encontrado." in json.loads(resp.data)["message"]


def test_post_contrato_caso_mesmo_tenant_cria_ok(client, db):
    token_a, _ = _register_and_login(client, "ok")
    cliente_a_id, caso_a_id = _make_base_data(client, token_a, 3)

    resp = _auth_json(
        client,
        "post",
        "/api/v1/contratos",
        token_a,
        {
            "tipo_honorario": "Fixo",
            "valor_total": 1500.0,
            "status": "Ativo",
            "caso_id": caso_a_id,
            "cliente_id": cliente_a_id,
            "notas_condicoes": "Contrato no mesmo tenant",
        },
    )

    assert resp.status_code == 201, resp.data
    data = json.loads(resp.data)
    assert data["caso_id"] == caso_a_id
    assert data["cliente_id"] == cliente_a_id
