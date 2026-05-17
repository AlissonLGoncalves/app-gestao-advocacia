# tests/test_itens_agenda_api.py
# Testes do endpoint /v1/itens-agenda (PR D1 — modelo unificado).
# Cobertura: CRUD basico, validacoes de tipo/status, filtros por tipo/caso.

import json
from datetime import datetime, timedelta, timezone


def _futuro_iso(dias=3):
    return (
        (datetime.now(timezone.utc) + timedelta(days=dias))
        .replace(microsecond=0)
        .isoformat()
    )


# ---------- Listagem ----------

def test_list_vazia(auth_client, db):
    response = auth_client.get("/api/v1/itens-agenda")
    assert response.status_code == 200
    assert json.loads(response.data) == []


# ---------- Criacao de tarefa (tipo=tarefa) ----------

def test_criar_tarefa_minima(auth_client, db):
    # Tarefa nao exige data_inicio — pode existir so no kanban sem
    # prazo definido.
    response = auth_client.post(
        "/api/v1/itens-agenda",
        json={"titulo": "Tarefa Kanban Simples", "tipo": "tarefa"},
    )
    assert response.status_code == 201, response.data
    data = json.loads(response.data)
    assert data["tipo"] == "tarefa"
    assert data["status"] == "Pendente"
    assert data["prioridade"] == "Normal"
    assert data["categoria"] == "Outros"


def test_criar_tarefa_com_vencimento(auth_client, db):
    response = auth_client.post(
        "/api/v1/itens-agenda",
        json={
            "titulo": "Petição inicial",
            "tipo": "tarefa",
            "categoria": "Peticionamento",
            "data_vencimento": _futuro_iso(7),
            "prioridade": "Alta",
        },
    )
    assert response.status_code == 201, response.data
    data = json.loads(response.data)
    assert data["categoria"] == "Peticionamento"
    assert data["prioridade"] == "Alta"
    assert data["data_vencimento"] is not None


# ---------- Criacao de evento (tipo=evento) ----------

def test_criar_evento_exige_data_inicio(auth_client, db):
    # Evento sem data_inicio deve falhar com 400.
    response = auth_client.post(
        "/api/v1/itens-agenda",
        json={"titulo": "Audiencia sem data", "tipo": "evento"},
    )
    assert response.status_code == 400


def test_criar_evento_sucesso(auth_client, db):
    response = auth_client.post(
        "/api/v1/itens-agenda",
        json={
            "titulo": "Audiência de instrução",
            "tipo": "evento",
            "categoria": "Audiencia",
            "data_inicio": _futuro_iso(10),
            "data_fim": _futuro_iso(10),
        },
    )
    assert response.status_code == 201, response.data
    data = json.loads(response.data)
    assert data["tipo"] == "evento"
    assert data["data_inicio"] is not None


# ---------- Validacoes ----------

def test_titulo_obrigatorio(auth_client, db):
    response = auth_client.post(
        "/api/v1/itens-agenda", json={"tipo": "tarefa"}
    )
    assert response.status_code == 400


def test_tipo_invalido_rejeitado(auth_client, db):
    response = auth_client.post(
        "/api/v1/itens-agenda",
        json={"titulo": "x", "tipo": "naoexiste"},
    )
    assert response.status_code == 400


def test_status_invalido_rejeitado(auth_client, db):
    response = auth_client.post(
        "/api/v1/itens-agenda",
        json={"titulo": "x", "tipo": "tarefa", "status": "FooBar"},
    )
    assert response.status_code == 400


def test_data_invalida_rejeitada(auth_client, db):
    response = auth_client.post(
        "/api/v1/itens-agenda",
        json={
            "titulo": "x",
            "tipo": "evento",
            "data_inicio": "isso-nao-eh-data",
        },
    )
    assert response.status_code == 400


# ---------- Detalhe / Update / Delete ----------

def test_get_detalhe(auth_client, db):
    post = auth_client.post(
        "/api/v1/itens-agenda",
        json={"titulo": "Detalhar", "tipo": "tarefa"},
    )
    item_id = json.loads(post.data)["id"]

    response = auth_client.get(f"/api/v1/itens-agenda/{item_id}")
    assert response.status_code == 200
    assert json.loads(response.data)["id"] == item_id


def test_update_status_e_categoria(auth_client, db):
    post = auth_client.post(
        "/api/v1/itens-agenda",
        json={"titulo": "Update teste", "tipo": "tarefa"},
    )
    item_id = json.loads(post.data)["id"]

    response = auth_client.put(
        f"/api/v1/itens-agenda/{item_id}",
        json={"status": "Em Andamento", "categoria": "Prazo"},
    )
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data["status"] == "Em Andamento"
    assert data["categoria"] == "Prazo"


def test_delete(auth_client, db):
    post = auth_client.post(
        "/api/v1/itens-agenda",
        json={"titulo": "Deletar", "tipo": "tarefa"},
    )
    item_id = json.loads(post.data)["id"]

    response = auth_client.delete(f"/api/v1/itens-agenda/{item_id}")
    assert response.status_code == 204

    after = auth_client.get(f"/api/v1/itens-agenda/{item_id}")
    assert after.status_code == 404


# ---------- Filtros ----------

def test_filtro_por_tipo(auth_client, db):
    auth_client.post(
        "/api/v1/itens-agenda",
        json={"titulo": "T1", "tipo": "tarefa"},
    )
    auth_client.post(
        "/api/v1/itens-agenda",
        json={
            "titulo": "E1",
            "tipo": "evento",
            "data_inicio": _futuro_iso(),
        },
    )

    response = auth_client.get("/api/v1/itens-agenda?tipo=evento")
    assert response.status_code == 200
    itens = json.loads(response.data)
    assert len(itens) == 1
    assert itens[0]["tipo"] == "evento"


def test_filtro_por_status(auth_client, db):
    auth_client.post(
        "/api/v1/itens-agenda",
        json={"titulo": "Pendente1", "tipo": "tarefa"},
    )
    auth_client.post(
        "/api/v1/itens-agenda",
        json={
            "titulo": "Concluida1",
            "tipo": "tarefa",
            "status": "Concluido",
        },
    )

    response = auth_client.get("/api/v1/itens-agenda?status=Concluido")
    assert response.status_code == 200
    itens = json.loads(response.data)
    assert len(itens) == 1
    assert itens[0]["status"] == "Concluido"
