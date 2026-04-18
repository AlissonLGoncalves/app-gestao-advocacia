# Arquivo: tests/test_eventos_api.py
# Testes para as rotas da API de Eventos da Agenda.

import json
from datetime import datetime, timedelta, timezone


def _inicio_futuro():
    return (datetime.now(timezone.utc) + timedelta(days=3)).replace(microsecond=0).isoformat()


def test_get_eventos_lista_vazia(auth_client, db):
    response = auth_client.get("/api/eventos")
    assert response.status_code == 200
    data = json.loads(response.data)
    assert isinstance(data, list)
    assert len(data) == 0


def test_create_evento_sucesso(auth_client, db):
    payload = {
        "titulo": "Evento Inicial",
        "data_inicio": _inicio_futuro(),
        "descricao": "Descrição teste",
        "tipo_evento": "Reunião",
    }
    response = auth_client.post("/api/eventos", json=payload)
    assert response.status_code == 201, response.data
    data = json.loads(response.data)
    assert data["title"] == payload["titulo"]
    assert data["start"] is not None


def test_create_evento_dados_incompletos(auth_client, db):
    response = auth_client.post("/api/eventos", json={"titulo": "Sem data"})
    assert response.status_code == 400


def test_get_evento_especifico_existente(auth_client, db):
    res_post = auth_client.post(
        "/api/eventos", json={"titulo": "Evento GET", "data_inicio": _inicio_futuro()}
    )
    assert res_post.status_code == 201
    evento_id = json.loads(res_post.data)["id"]

    response = auth_client.get(f"/api/eventos/{evento_id}")
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data["id"] == evento_id


def test_update_evento_sucesso(auth_client, db):
    res_post = auth_client.post(
        "/api/eventos", json={"titulo": "Evento Update", "data_inicio": _inicio_futuro()}
    )
    assert res_post.status_code == 201
    evento = json.loads(res_post.data)

    payload = {
        "titulo": "Evento Atualizado",
        "data_inicio": _inicio_futuro(),
        "descricao": "Mudou",
        "tipo_evento": "Prazo",
    }
    response = auth_client.put(f"/api/eventos/{evento['id']}", json=payload)
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data["title"] == payload["titulo"]


def test_delete_evento_sucesso(auth_client, db):
    res_post = auth_client.post(
        "/api/eventos", json={"titulo": "Evento Delete", "data_inicio": _inicio_futuro()}
    )
    assert res_post.status_code == 201
    evento_id = json.loads(res_post.data)["id"]

    response_delete = auth_client.delete(f"/api/eventos/{evento_id}")
    assert response_delete.status_code == 204

    response_get = auth_client.get(f"/api/eventos/{evento_id}")
    assert response_get.status_code == 404
