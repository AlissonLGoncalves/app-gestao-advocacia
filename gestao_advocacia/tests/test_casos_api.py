# Arquivo: tests/test_casos_api.py
# Testes para as rotas da API de Casos.

import json
from datetime import date

from app import Caso

CASO_BASE = {
    "titulo": "Caso Teste Inicial",
    "status": "Ativo",
    "tipo_acao": "CÃ­vel",
    "valor_causa": "10000.00",
    "data_distribuicao": date.today().isoformat(),
}


def criar_cliente_teste(auth_client):
    payload = {
        "nome_razao_social": "Cliente Para Casos Teste",
        "cpf_cnpj": "111.222.333-44",
        "tipo_pessoa": "PF",
        "email": "cliente.casos@teste.com",
    }
    response = auth_client.post("/api/v1/clientes", json=payload)
    assert response.status_code == 201, response.data
    return json.loads(response.data)["id"]


def test_get_casos_lista_vazia(auth_client, db):
    response = auth_client.get("/api/v1/casos")
    assert response.status_code == 200
    data = json.loads(response.data)
    assert isinstance(data, list)
    assert len(data) == 0


def test_create_caso_sucesso(auth_client, db):
    cliente_id = criar_cliente_teste(auth_client)
    payload = {**CASO_BASE, "cliente_id": cliente_id}

    response = auth_client.post("/api/v1/casos", json=payload)
    assert response.status_code == 201
    data = json.loads(response.data)
    assert data["cliente_id"] == cliente_id
    assert data["titulo"] == payload["titulo"]

    caso_db = db.session.get(Caso, data["id"])
    assert caso_db is not None


def test_create_caso_cliente_inexistente(auth_client, db):
    payload = {**CASO_BASE, "cliente_id": 99999}
    response = auth_client.post("/api/v1/casos", json=payload)
    assert response.status_code == 404


def test_create_caso_dados_incompletos(auth_client, db):
    response = auth_client.post("/api/v1/casos", json={"titulo": "Caso Incompleto"})
    assert response.status_code == 400


def test_get_caso_especifico_existente(auth_client, db):
    cliente_id = criar_cliente_teste(auth_client)
    payload = {**CASO_BASE, "cliente_id": cliente_id, "titulo": "Caso EspecÃ­fico"}
    res_post = auth_client.post("/api/v1/casos", json=payload)
    assert res_post.status_code == 201
    caso_id = json.loads(res_post.data)["id"]

    response = auth_client.get(f"/api/v1/casos/{caso_id}")
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data["id"] == caso_id


def test_get_caso_especifico_nao_existente(auth_client, db):
    response = auth_client.get("/api/v1/casos/99999")
    assert response.status_code == 404
    data = json.loads(response.data)
    assert "message" in data


def test_update_caso_sucesso(auth_client, db):
    cliente_id = criar_cliente_teste(auth_client)
    res_post = auth_client.post("/api/v1/casos", json={**CASO_BASE, "cliente_id": cliente_id})
    assert res_post.status_code == 201
    caso_id = json.loads(res_post.data)["id"]

    payload = {
        "titulo": "Caso Atualizado",
        "status": "Encerrado",
        "tipo_acao": "CÃ­vel",
        "notas_caso": "Atualizado via pytest",
    }
    response = auth_client.put(f"/api/v1/casos/{caso_id}", json=payload)
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data["titulo"] == payload["titulo"]


def test_delete_caso_sucesso(auth_client, db):
    cliente_id = criar_cliente_teste(auth_client)
    res_post = auth_client.post("/api/v1/casos", json={**CASO_BASE, "cliente_id": cliente_id})
    assert res_post.status_code == 201
    caso_id = json.loads(res_post.data)["id"]

    response_delete = auth_client.delete(f"/api/v1/casos/{caso_id}")
    assert response_delete.status_code == 204

    response_get = auth_client.get(f"/api/v1/casos/{caso_id}")
    assert response_get.status_code == 404

