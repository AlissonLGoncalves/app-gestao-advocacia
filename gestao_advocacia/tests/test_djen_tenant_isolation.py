import json
from datetime import date

from app import PublicacaoDJEN, User, db


def _register_and_login(client, suffix):
    username = f"djen_tenant_{suffix}"
    email = f"djen_tenant_{suffix}@example.com"
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
            "nome_razao_social": f"Cliente DJEN {tag}",
            "cpf_cnpj": f"999888777{tag:02d}",
            "tipo_pessoa": "PF",
            "email": f"cliente_djen_{tag}@example.com",
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
            "titulo": f"Caso DJEN {tag}",
            "status": "Ativo",
            "tipo_acao": "Cível",
            "cliente_id": cliente_id,
            "numero_processo": f"0001234-12.2026.8.16.{3000 + tag}",
            "data_distribuicao": date.today().isoformat(),
        },
    )
    assert caso_resp.status_code == 201, caso_resp.data
    caso_id = json.loads(caso_resp.data)["id"]

    return cliente_id, caso_id


def _criar_publicacao_no_tenant(user, djen_id):
    pub = PublicacaoDJEN(
        tenant_id=user.tenant_id,
        user_id=user.id,
        djen_id=djen_id,
        hash_comunicacao=f"hash-{djen_id}",
        numero_processo="0001234-12.2026.8.16.0001",
        sigla_tribunal="TJPR",
        nome_orgao="1ª Vara Cível",
        tipo_comunicacao="Intimação",
        data_disponibilizacao=date.today(),
        texto="Publicação de teste de isolamento.",
        lida=False,
        origem_busca="oab",
    )
    db.session.add(pub)
    db.session.commit()
    return pub


def test_patch_vinculo_caso_outro_tenant_retorna_404(client, db, app):
    token_a, user_a = _register_and_login(client, "a")
    token_b, _ = _register_and_login(client, "b")

    with app.app_context():
        user_db_a = User.query.get(user_a["id"])
        pub = _criar_publicacao_no_tenant(user_db_a, djen_id=9101)
        pub_id = pub.id

    _, caso_b_id = _make_base_data(client, token_b, 7)

    resp = _auth_json(
        client,
        "patch",
        f"/api/v1/djen/publicacoes/{pub_id}",
        token_a,
        {"caso_id": caso_b_id},
    )

    assert resp.status_code == 404
