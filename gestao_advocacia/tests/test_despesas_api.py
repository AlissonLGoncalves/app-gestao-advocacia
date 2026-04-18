# Arquivo: tests/test_despesas_api.py
# Testes para as rotas da API de Despesas.

import json
from datetime import date

from app import Despesa


def criar_cliente_teste(auth_client, sufixo="00"):
    payload = {
        "nome_razao_social": f"Cliente Para Despesa {sufixo}",
        "cpf_cnpj": f"222.333.444-{sufixo}",
        "tipo_pessoa": "PF",
    }
    resp = auth_client.post("/api/v1/clientes", json=payload)
    assert resp.status_code == 201, resp.data
    return json.loads(resp.data)["id"]


def criar_caso_teste(auth_client, cliente_id, sufixo=""):
    payload = {
        "cliente_id": cliente_id,
        "titulo": f"Caso para Despesa {sufixo}",
        "status": "Ativo",
        "tipo_acao": "Administrativo",
        "data_distribuicao": date.today().isoformat(),
    }
    resp = auth_client.post("/api/v1/casos", json=payload)
    assert resp.status_code == 201, resp.data
    return json.loads(resp.data)["id"]


DESPESA_BASE = {
    "descricao": "Pagamento de Custas",
    "valor": "350.50",
    "data_despesa": date.today().isoformat(),
    "pago": False,
}


def test_get_despesas_lista_vazia(auth_client, db):
    response = auth_client.get("/api/v1/despesas")
    assert response.status_code == 200
    data = json.loads(response.data)
    assert isinstance(data, list)
    assert len(data) == 0


def test_create_despesa_com_caso_sucesso(auth_client, db):
    cliente_id = criar_cliente_teste(auth_client, "01")
    caso_id = criar_caso_teste(auth_client, cliente_id, "01")

    payload = {**DESPESA_BASE, "caso_id": caso_id}
    response = auth_client.post("/api/v1/despesas", json=payload)
    assert response.status_code == 201
    data = json.loads(response.data)
    assert data["descricao"] == payload["descricao"]
    assert data["caso_id"] == caso_id

    despesa_db = db.session.get(Despesa, data["id"])
    assert despesa_db is not None


def test_update_despesa_sucesso(auth_client, db):
    cliente_id = criar_cliente_teste(auth_client, "02")
    caso_id = criar_caso_teste(auth_client, cliente_id, "02")

    res_post = auth_client.post("/api/v1/despesas", json={**DESPESA_BASE, "caso_id": caso_id})
    assert res_post.status_code == 201
    despesa_id = json.loads(res_post.data)["id"]

    payload = {
        "descricao": "Despesa Atualizada",
        "valor": "400.00",
        "data_despesa": date.today().isoformat(),
        "pago": True,
        "caso_id": caso_id,
    }
    response = auth_client.put(f"/api/v1/despesas/{despesa_id}", json=payload)
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data["pago"] is True


def test_delete_despesa_sucesso(auth_client, db):
    cliente_id = criar_cliente_teste(auth_client, "03")
    caso_id = criar_caso_teste(auth_client, cliente_id, "03")

    res_post = auth_client.post("/api/v1/despesas", json={**DESPESA_BASE, "caso_id": caso_id})
    assert res_post.status_code == 201
    despesa_id = json.loads(res_post.data)["id"]

    response_delete = auth_client.delete(f"/api/v1/despesas/{despesa_id}")
    assert response_delete.status_code == 204

    response_get = auth_client.get(f"/api/v1/despesas/{despesa_id}")
    assert response_get.status_code == 404

