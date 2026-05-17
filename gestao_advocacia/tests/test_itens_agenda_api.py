# tests/test_itens_agenda_api.py
# Testes do endpoint /v1/itens-agenda (PR D1 — modelo unificado).
# Cobertura: CRUD basico, validacoes de tipo/status, filtros por tipo/caso.

import json
from datetime import datetime, timedelta, timezone


def _futuro_iso(dias=3):
    return (datetime.now(timezone.utc) + timedelta(days=dias)).replace(microsecond=0).isoformat()


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
    response = auth_client.post("/api/v1/itens-agenda", json={"tipo": "tarefa"})
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


# ---------- Endpoints do Kanban (PR D4.1) ----------


def test_reorder_atualiza_status_e_posicao(auth_client, db):
    """Reorder de 3 tarefas entre colunas: distribui status + posicao."""
    ids = []
    for i in range(3):
        res = auth_client.post(
            "/api/v1/itens-agenda",
            json={"titulo": f"K{i}", "tipo": "tarefa", "status": "Pendente"},
        )
        ids.append(json.loads(res.data)["id"])

    # Distribui: 1 em Pendente, 2 em Em Andamento
    res = auth_client.put(
        "/api/v1/itens-agenda/reorder",
        json={
            "columns": {
                "Pendente": [ids[0]],
                "Em Andamento": [ids[1], ids[2]],
            }
        },
    )
    assert res.status_code == 200
    assert json.loads(res.data)["updated"] == 3

    # Confere posicao
    r0 = json.loads(auth_client.get(f"/api/v1/itens-agenda/{ids[0]}").data)
    r1 = json.loads(auth_client.get(f"/api/v1/itens-agenda/{ids[1]}").data)
    r2 = json.loads(auth_client.get(f"/api/v1/itens-agenda/{ids[2]}").data)
    assert (r0["status"], r0["posicao"]) == ("Pendente", 1)
    assert (r1["status"], r1["posicao"]) == ("Em Andamento", 1)
    assert (r2["status"], r2["posicao"]) == ("Em Andamento", 2)


def test_reorder_status_invalido_rejeitado(auth_client, db):
    res = auth_client.put(
        "/api/v1/itens-agenda/reorder",
        json={"columns": {"NaoExiste": [1]}},
    )
    assert res.status_code == 400


def test_reorder_columns_payload_invalido_rejeitado(auth_client, db):
    res = auth_client.put(
        "/api/v1/itens-agenda/reorder",
        json={"columns": "string em vez de dict"},
    )
    assert res.status_code == 400


def test_reorder_so_mexe_em_tarefa_nao_em_evento(auth_client, db):
    """Reorder so deve afetar tipo='tarefa'. Eventos sao ignorados."""
    from datetime import datetime, timedelta, timezone

    inicio_futuro = (
        (datetime.now(timezone.utc) + timedelta(days=2)).replace(microsecond=0).isoformat()
    )
    tarefa = auth_client.post(
        "/api/v1/itens-agenda",
        json={"titulo": "T", "tipo": "tarefa", "status": "Pendente"},
    )
    evento = auth_client.post(
        "/api/v1/itens-agenda",
        json={"titulo": "E", "tipo": "evento", "data_inicio": inicio_futuro},
    )
    tarefa_id = json.loads(tarefa.data)["id"]
    evento_id = json.loads(evento.data)["id"]

    # Tenta mover ambos pra "Em Andamento"
    res = auth_client.put(
        "/api/v1/itens-agenda/reorder",
        json={"columns": {"Em Andamento": [tarefa_id, evento_id]}},
    )
    assert res.status_code == 200
    # Apenas a tarefa foi atualizada
    assert json.loads(res.data)["updated"] == 1

    # Evento mantem status original
    ev_atual = json.loads(auth_client.get(f"/api/v1/itens-agenda/{evento_id}").data)
    assert ev_atual["status"] == "Pendente"


def test_validar_prazo_marca_validado(auth_client, db):
    res = auth_client.post(
        "/api/v1/itens-agenda",
        json={
            "titulo": "IA prazo",
            "tipo": "tarefa",
            "prazo_calculado_por_ia": True,
            "prazo_validado": False,
        },
    )
    item_id = json.loads(res.data)["id"]

    res = auth_client.patch(f"/api/v1/itens-agenda/{item_id}/validar-prazo")
    assert res.status_code == 200
    data = json.loads(res.data)
    assert data["prazo_validado"] is True


def test_validar_prazo_aceita_nova_data_e_prioridade(auth_client, db):
    res = auth_client.post(
        "/api/v1/itens-agenda",
        json={"titulo": "IA prazo 2", "tipo": "tarefa", "prazo_validado": False},
    )
    item_id = json.loads(res.data)["id"]

    res = auth_client.patch(
        f"/api/v1/itens-agenda/{item_id}/validar-prazo",
        json={"data_vencimento": "2026-12-01", "prioridade": "Alta"},
    )
    assert res.status_code == 200
    data = json.loads(res.data)
    assert data["prazo_validado"] is True
    assert data["data_vencimento"] is not None
    assert data["prioridade"] == "Alta"


def test_concluir_marca_concluido_e_validado(auth_client, db):
    res = auth_client.post(
        "/api/v1/itens-agenda",
        json={"titulo": "ParaConcluir", "tipo": "tarefa"},
    )
    item_id = json.loads(res.data)["id"]

    res = auth_client.patch(f"/api/v1/itens-agenda/{item_id}/concluir")
    assert res.status_code == 200
    data = json.loads(res.data)
    assert data["status"] == "Concluido"
    assert data["prazo_validado"] is True


def test_concluir_idempotente(auth_client, db):
    res = auth_client.post(
        "/api/v1/itens-agenda",
        json={"titulo": "X", "tipo": "tarefa", "status": "Concluido"},
    )
    item_id = json.loads(res.data)["id"]

    # Concluir item ja concluido nao quebra
    res = auth_client.patch(f"/api/v1/itens-agenda/{item_id}/concluir")
    assert res.status_code == 200
    assert json.loads(res.data)["status"] == "Concluido"
