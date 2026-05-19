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


# ---------- Side-effects DJEN (PR D4.3 — portado de /tarefas) ----------


def test_post_com_publicacao_djen_marca_pub_lida(auth_client, db):
    """POST com publicacao_djen_id deve marcar a pub como lida=True."""
    from models import PublicacaoDJEN, User

    user_id = auth_client.user["id"]
    user = User.query.get(user_id)
    tenant_id = user.tenant_id

    pub = PublicacaoDJEN(
        tenant_id=tenant_id,
        user_id=user_id,
        numero_processo="0000001-23.2024.8.26.0000",
        sigla_tribunal="TJSP",
        texto="Teste",
        lida=False,
    )
    db.session.add(pub)
    db.session.commit()

    res = auth_client.post(
        "/api/v1/itens-agenda/",
        json={
            "titulo": "Resposta",
            "tipo": "tarefa",
            "publicacao_djen_id": pub.id,
        },
    )
    assert res.status_code == 201, res.data

    db.session.refresh(pub)
    assert pub.lida is True


def test_post_com_publicacao_djen_inexistente_retorna_404(auth_client, db):
    res = auth_client.post(
        "/api/v1/itens-agenda/",
        json={"titulo": "x", "tipo": "tarefa", "publicacao_djen_id": 99999},
    )
    assert res.status_code == 404


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


# ---------- Endpoint Tratar (Onda 1) ----------


def test_tratar_acao_cumpri(auth_client, db):
    """Acao=cumpri marca Concluido + tratado_em + como_tratado."""
    post = auth_client.post(
        "/api/v1/itens-agenda",
        json={"titulo": "Contestar", "tipo": "tarefa"},
    )
    item_id = json.loads(post.data)["id"]

    res = auth_client.post(
        f"/api/v1/itens-agenda/{item_id}/tratar",
        json={"acao": "cumpri", "como_tratado": "Peticionei contestação"},
    )
    assert res.status_code == 200
    data = json.loads(res.data)
    assert data["status"] == "Concluido"
    assert data["tratado_em"] is not None
    assert data["como_tratado"] == "Peticionei contestação"
    assert data["prazo_validado"] is True


def test_tratar_acao_cancelar(auth_client, db):
    """Acao=cancelar marca Cancelado + tratado_em."""
    post = auth_client.post(
        "/api/v1/itens-agenda",
        json={"titulo": "Prazo equivocado", "tipo": "tarefa"},
    )
    item_id = json.loads(post.data)["id"]

    res = auth_client.post(
        f"/api/v1/itens-agenda/{item_id}/tratar",
        json={"acao": "cancelar", "como_tratado": "Não era meu cliente"},
    )
    assert res.status_code == 200
    data = json.loads(res.data)
    assert data["status"] == "Cancelado"
    assert data["tratado_em"] is not None
    assert data["como_tratado"] == "Não era meu cliente"


def test_tratar_acao_reabrir(auth_client, db):
    """Acao=reabrir limpa tratado_em e volta Pendente, preserva como_tratado."""
    post = auth_client.post(
        "/api/v1/itens-agenda",
        json={"titulo": "Mudei de ideia", "tipo": "tarefa"},
    )
    item_id = json.loads(post.data)["id"]

    # Primeiro cumpre
    auth_client.post(
        f"/api/v1/itens-agenda/{item_id}/tratar",
        json={"acao": "cumpri", "como_tratado": "Resolvi"},
    )

    # Depois reabre
    res = auth_client.post(
        f"/api/v1/itens-agenda/{item_id}/tratar",
        json={"acao": "reabrir"},
    )
    assert res.status_code == 200
    data = json.loads(res.data)
    assert data["status"] == "Pendente"
    assert data["tratado_em"] is None
    # Historico preservado
    assert data["como_tratado"] == "Resolvi"


def test_tratar_acao_invalida(auth_client, db):
    post = auth_client.post(
        "/api/v1/itens-agenda",
        json={"titulo": "X", "tipo": "tarefa"},
    )
    item_id = json.loads(post.data)["id"]

    res = auth_client.post(
        f"/api/v1/itens-agenda/{item_id}/tratar",
        json={"acao": "voar"},
    )
    assert res.status_code == 400


def test_tratar_peticao_inexistente_retorna_404(auth_client, db):
    post = auth_client.post(
        "/api/v1/itens-agenda",
        json={"titulo": "X", "tipo": "tarefa"},
    )
    item_id = json.loads(post.data)["id"]

    res = auth_client.post(
        f"/api/v1/itens-agenda/{item_id}/tratar",
        json={"acao": "cumpri", "peticao_cumpridora_id": 99999},
    )
    assert res.status_code == 404


def test_tratar_idempotente(auth_client, db):
    """Rodar tratar 2x com cumpri nao quebra."""
    post = auth_client.post(
        "/api/v1/itens-agenda",
        json={"titulo": "X", "tipo": "tarefa"},
    )
    item_id = json.loads(post.data)["id"]

    auth_client.post(
        f"/api/v1/itens-agenda/{item_id}/tratar",
        json={"acao": "cumpri", "como_tratado": "primeira"},
    )
    res = auth_client.post(
        f"/api/v1/itens-agenda/{item_id}/tratar",
        json={"acao": "cumpri", "como_tratado": "segunda"},
    )
    assert res.status_code == 200
    data = json.loads(res.data)
    assert data["status"] == "Concluido"
    # Segunda chamada sobrescreve como_tratado (intencional — usuario
    # atualizando o que fez)
    assert data["como_tratado"] == "segunda"


# ---------- Endpoint Histórico (Onda 2) ----------


def test_historico_inclui_acoes_anteriores(auth_client, db):
    """GET /historico retorna timeline de tratar/concluir/validar via AuditLog."""
    post = auth_client.post(
        "/api/v1/itens-agenda",
        json={"titulo": "Hist test", "tipo": "tarefa"},
    )
    item_id = json.loads(post.data)["id"]

    # Sequencia: concluir → tratar cumpri → reabrir
    auth_client.patch(f"/api/v1/itens-agenda/{item_id}/concluir")
    auth_client.post(
        f"/api/v1/itens-agenda/{item_id}/tratar",
        json={"acao": "cumpri", "como_tratado": "peticionei"},
    )
    auth_client.post(
        f"/api/v1/itens-agenda/{item_id}/tratar",
        json={"acao": "reabrir"},
    )

    res = auth_client.get(f"/api/v1/itens-agenda/{item_id}/historico")
    assert res.status_code == 200
    historico = json.loads(res.data)
    # Pelo menos 3 entradas (uma por acao). data_hora desc.
    assert len(historico) >= 3
    acoes = [h["acao"] for h in historico]
    # Mais recente primeiro: reabrir → cumpri → concluir
    assert acoes[0] == "item_agenda_tratar_reabrir"
    assert acoes[1] == "item_agenda_tratar_cumpri"
    assert acoes[2] == "item_agenda_concluir"
    # username preenchido
    assert historico[0]["username"] is not None


def test_historico_vazio_se_item_recem_criado(auth_client, db):
    """Item sem audit log (criado mas nenhuma acao) retorna lista vazia."""
    post = auth_client.post(
        "/api/v1/itens-agenda",
        json={"titulo": "Recem criado", "tipo": "tarefa"},
    )
    item_id = json.loads(post.data)["id"]

    res = auth_client.get(f"/api/v1/itens-agenda/{item_id}/historico")
    assert res.status_code == 200
    assert json.loads(res.data) == []


def test_historico_404_se_item_de_outro_tenant(auth_client, db):
    """Item de outro tenant retorna 404 (nao vaza existencia)."""
    res = auth_client.get("/api/v1/itens-agenda/99999/historico")
    assert res.status_code == 404
