# Arquivo: tests/test_clientes_api.py
# Testes para as rotas da API de Clientes usando pytest-flask.

import json

from app import Cliente

CLIENTE_PF = {
    "nome_razao_social": "Cliente Teste PF Pytest",
    "cpf_cnpj": "123.456.789-00",
    "tipo_pessoa": "PF",
    "email": "pf.teste.pytest@email.com",
}


def test_get_clientes_lista_vazia(auth_client, db):
    response = auth_client.get("/api/v1/clientes")
    assert response.status_code == 200
    data = json.loads(response.data)
    assert isinstance(data, list)
    assert len(data) == 0


def test_create_cliente_pf_sucesso(auth_client, db):
    response = auth_client.post("/api/v1/clientes", json=CLIENTE_PF)
    assert response.status_code == 201
    data = json.loads(response.data)
    assert data["nome_razao_social"] == CLIENTE_PF["nome_razao_social"]
    assert data["cpf_cnpj"] == CLIENTE_PF["cpf_cnpj"]

    cliente_db = db.session.get(Cliente, data["id"])
    assert cliente_db is not None


def test_create_cliente_dados_incompletos(auth_client, db):
    response = auth_client.post("/api/v1/clientes", json={"nome_razao_social": "Incompleto"})
    assert response.status_code == 400


def test_create_cliente_cpf_cnpj_duplicado(auth_client, db):
    r1 = auth_client.post("/api/v1/clientes", json=CLIENTE_PF)
    assert r1.status_code == 201

    payload = {
        "nome_razao_social": "Outro Cliente PF",
        "cpf_cnpj": CLIENTE_PF["cpf_cnpj"],
        "tipo_pessoa": "PF",
    }
    response = auth_client.post("/api/v1/clientes", json=payload)
    assert response.status_code == 409


def test_get_cliente_especifico_existente(auth_client, db):
    res_post = auth_client.post("/api/v1/clientes", json=CLIENTE_PF)
    assert res_post.status_code == 201
    cliente_id = json.loads(res_post.data)["id"]

    response = auth_client.get(f"/api/v1/clientes/{cliente_id}")
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data["id"] == cliente_id


def test_get_cliente_especifico_nao_existente(auth_client, db):
    response = auth_client.get("/api/v1/clientes/99999")
    assert response.status_code == 404
    data = json.loads(response.data)
    assert "message" in data


def test_update_cliente_sucesso(auth_client, db):
    res_post = auth_client.post("/api/v1/clientes", json=CLIENTE_PF)
    assert res_post.status_code == 201
    cliente_id = json.loads(res_post.data)["id"]

    payload = {
        "nome_razao_social": "Cliente Atualizado",
        "cpf_cnpj": CLIENTE_PF["cpf_cnpj"],
        "tipo_pessoa": "PF",
        "email": "email.atualizado.pytest@email.com",
        "telefone": "00000-0000",
    }
    response = auth_client.put(f"/api/v1/clientes/{cliente_id}", json=payload)
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data["email"] == payload["email"]


def test_delete_cliente_sucesso(auth_client, db):
    res_post = auth_client.post("/api/v1/clientes", json=CLIENTE_PF)
    assert res_post.status_code == 201
    cliente_id = json.loads(res_post.data)["id"]

    response_delete = auth_client.delete(f"/api/v1/clientes/{cliente_id}")
    assert response_delete.status_code == 204

    response_get = auth_client.get(f"/api/v1/clientes/{cliente_id}")
    assert response_get.status_code == 404
