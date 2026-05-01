"""Teste critico de regressao do refactor admin_session no /auth/login (Batch 4).

O endpoint POST /api/v1/auth/login foi refatorado para usar
admin_session() ao buscar o user no DB pre-autenticacao. Se isso
quebrar, login derruba para 100% dos usuarios — esse teste e a
ultima linha de defesa.

Roda em qualquer dialeto: SQLite valida o code path admin_session
funcionalmente (sem RLS); Postgres em CI/staging adicionalmente valida
o escape via BYPASSRLS no DB real.
"""


def test_login_credenciais_validas_retorna_200(client, two_tenants):
    """Login com user_a + senha correta retorna access_token e user.dict()."""
    response = client.post(
        "/api/v1/auth/login",
        json={
            "username_or_email": two_tenants.admin_a.email,
            "password": two_tenants.admin_password,
        },
    )
    assert response.status_code == 200, response.data
    payload = response.get_json()
    assert payload.get("access_token")
    assert payload["user"]["id"] == two_tenants.admin_a.id
    assert payload["user"]["email"] == two_tenants.admin_a.email


def test_login_credenciais_invalidas_retorna_401(client, two_tenants):
    """Senha errada -> 401, nao 500 ou hang."""
    response = client.post(
        "/api/v1/auth/login",
        json={
            "username_or_email": two_tenants.admin_a.email,
            "password": "senha-errada-proposital",
        },
    )
    assert response.status_code == 401


def test_login_email_inexistente_retorna_401(client, two_tenants):
    """Email que nao existe na base — 401, sem expor a info."""
    response = client.post(
        "/api/v1/auth/login",
        json={
            "username_or_email": "naoexiste@nowhere.local",
            "password": "qualquer-senha",
        },
    )
    assert response.status_code == 401


def test_login_isolamento_tenants(client, two_tenants):
    """Login do admin_a retorna user com tenant_id correto (do A, nao B)."""
    response = client.post(
        "/api/v1/auth/login",
        json={
            "username_or_email": two_tenants.admin_a.email,
            "password": two_tenants.admin_password,
        },
    )
    assert response.status_code == 200
    user = response.get_json()["user"]
    # to_dict() pode nao expor tenant_id diretamente, mas o id deve ser do A
    assert user["id"] == two_tenants.admin_a.id
    assert user["id"] != two_tenants.admin_b.id
