# Arquivo: tests/test_recebimentos_api.py
# Testes para as rotas da API de Recebimentos.

import json
from datetime import date

from app import Recebimento


def criar_cliente_teste(auth_client, sufixo="00"):
    payload = {
        "nome_razao_social": f"Cliente Teste Rec {sufixo}",
        "cpf_cnpj": f"111.222.333-{sufixo}",
        "tipo_pessoa": "PF",
    }
    resp = auth_client.post("/api/v1/clientes", json=payload)
    assert resp.status_code == 201, resp.data
    return json.loads(resp.data)["id"]


def criar_caso_teste(auth_client, cliente_id, sufixo=""):
    payload = {
        "cliente_id": cliente_id,
        "titulo": f"Caso para Recebimento {sufixo}",
        "status": "Ativo",
        "tipo_acao": "Consultivo",
        "data_distribuicao": date.today().isoformat(),
    }
    resp = auth_client.post("/api/v1/casos", json=payload)
    assert resp.status_code == 201, resp.data
    return json.loads(resp.data)["id"]


RECEB_BASE = {
    "descricao": "HonorÃ¡rios Iniciais",
    "valor": "1500.75",
    "data_recebimento": date.today().isoformat(),
    "recebido": False,
}


def test_get_recebimentos_lista_vazia(auth_client, db):
    response = auth_client.get("/api/v1/recebimentos")
    assert response.status_code == 200
    data = json.loads(response.data)
    assert isinstance(data, list)
    assert len(data) == 0


def test_create_recebimento_sucesso(auth_client, db):
    cliente_id = criar_cliente_teste(auth_client, "01")
    caso_id = criar_caso_teste(auth_client, cliente_id, "01")

    payload = {**RECEB_BASE, "caso_id": caso_id}
    response = auth_client.post("/api/v1/recebimentos", json=payload)
    assert response.status_code == 201
    data = json.loads(response.data)
    assert data["descricao"] == payload["descricao"]
    assert data["caso_id"] == caso_id

    receb_db = db.session.get(Recebimento, data["id"])
    assert receb_db is not None


def test_update_recebimento_sucesso(auth_client, db):
    cliente_id = criar_cliente_teste(auth_client, "02")
    caso_id = criar_caso_teste(auth_client, cliente_id, "02")

    res_post = auth_client.post("/api/v1/recebimentos", json={**RECEB_BASE, "caso_id": caso_id})
    assert res_post.status_code == 201
    receb_id = json.loads(res_post.data)["id"]

    payload = {
        "descricao": "Recebimento Atualizado",
        "valor": "2000.00",
        "data_recebimento": date.today().isoformat(),
        "recebido": True,
        "caso_id": caso_id,
    }
    response = auth_client.put(f"/api/v1/recebimentos/{receb_id}", json=payload)
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data["recebido"] is True


def test_delete_recebimento_sucesso(auth_client, db):
    cliente_id = criar_cliente_teste(auth_client, "03")
    caso_id = criar_caso_teste(auth_client, cliente_id, "03")

    res_post = auth_client.post("/api/v1/recebimentos", json={**RECEB_BASE, "caso_id": caso_id})
    assert res_post.status_code == 201
    receb_id = json.loads(res_post.data)["id"]

    response_delete = auth_client.delete(f"/api/v1/recebimentos/{receb_id}")
    assert response_delete.status_code == 204

    response_get = auth_client.get(f"/api/v1/recebimentos/{receb_id}")
    assert response_get.status_code == 404
