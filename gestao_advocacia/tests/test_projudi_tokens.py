# tests/test_projudi_tokens.py
# Issue #302 — routes/projudi.py (962 linhas) estava sem testes. Cobre o
# núcleo de segurança: geração de token do agent (hash-only no banco),
# listagem sem vazar o valor cru, autenticação Bearer do agent (/auth/me)
# e revogação (token revogado deixa de autenticar).

import hashlib
import json


def _criar_token(auth_client, nome="agent-teste"):
    resp = auth_client.post("/api/v1/projudi/auth/tokens", json={"nome": nome})
    assert resp.status_code == 201, resp.data
    return json.loads(resp.data)


def test_criar_token_retorna_valor_cru_uma_vez(auth_client, db):
    data = _criar_token(auth_client)
    assert data["token"]  # valor cru presente na criação
    assert len(data["token"]) >= 40
    info = data["info"]
    # metadados não vazam o cru nem o hash
    assert data["token"] not in json.dumps(info)
    assert info.get("nome") == "agent-teste"
    assert info.get("ativo") is True


def test_banco_guarda_so_o_hash(auth_client, db):
    from models import ProjudiAgentToken

    data = _criar_token(auth_client)
    row = ProjudiAgentToken.query.order_by(ProjudiAgentToken.id.desc()).first()
    assert row.token_hash == hashlib.sha256(data["token"].encode()).hexdigest()
    assert row.token_hash != data["token"]


def test_listagem_nao_vaza_token(auth_client, db):
    data = _criar_token(auth_client)
    resp = auth_client.get("/api/v1/projudi/auth/tokens")
    assert resp.status_code == 200
    listagem = json.loads(resp.data)
    assert len(listagem) >= 1
    assert data["token"] not in resp.get_data(as_text=True)


def test_auth_me_com_token_valido(client, auth_client, db):
    data = _criar_token(auth_client)
    resp = client.get(
        "/api/v1/projudi/auth/me",
        headers={"Authorization": f"Bearer {data['token']}"},
    )
    assert resp.status_code == 200
    me = json.loads(resp.data)
    assert me["token_id"] == data["info"]["id"]
    assert me["tenant_id"]


def test_auth_me_sem_ou_com_token_invalido(client, db):
    assert client.get("/api/v1/projudi/auth/me").status_code == 401
    resp = client.get(
        "/api/v1/projudi/auth/me",
        headers={"Authorization": "Bearer token-invalido-qualquer"},
    )
    assert resp.status_code == 401


def test_revogar_token_corta_acesso_do_agent(client, auth_client, db):
    data = _criar_token(auth_client)
    token_id = data["info"]["id"]

    # antes: autentica
    ok = client.get(
        "/api/v1/projudi/auth/me",
        headers={"Authorization": f"Bearer {data['token']}"},
    )
    assert ok.status_code == 200

    # revoga
    resp = auth_client.delete(f"/api/v1/projudi/auth/tokens/{token_id}")
    assert resp.status_code == 200
    assert json.loads(resp.data)["info"]["ativo"] is False

    # depois: 401
    negado = client.get(
        "/api/v1/projudi/auth/me",
        headers={"Authorization": f"Bearer {data['token']}"},
    )
    assert negado.status_code == 401


def test_revogar_token_inexistente_retorna_404(auth_client, db):
    resp = auth_client.delete("/api/v1/projudi/auth/tokens/999999")
    assert resp.status_code == 404


def test_gerenciar_tokens_exige_jwt(client, db):
    assert client.get("/api/v1/projudi/auth/tokens").status_code == 401
    assert client.post("/api/v1/projudi/auth/tokens", json={}).status_code == 401
