# Testes para o endpoint PUT /api/v1/tarefas/reorder e ordenacao do GET.

import json


def _criar_tarefa(auth_client, titulo, status="A Fazer"):
    res = auth_client.post(
        "/api/v1/tarefas",
        json={"titulo": titulo, "status": status, "prioridade": "Normal"},
    )
    assert res.status_code == 201, res.data
    return json.loads(res.data)


def _listar(auth_client, status=None):
    res = auth_client.get("/api/v1/tarefas")
    assert res.status_code == 200
    items = json.loads(res.data)
    if status is not None:
        items = [t for t in items if t["status"] == status]
    return items


def test_post_seta_posicao_no_fim_da_coluna(auth_client, db):
    t1 = _criar_tarefa(auth_client, "primeira")
    t2 = _criar_tarefa(auth_client, "segunda")
    t3 = _criar_tarefa(auth_client, "terceira")
    assert t1["posicao"] < t2["posicao"] < t3["posicao"]


def test_get_ordena_por_status_posicao(auth_client, db):
    a1 = _criar_tarefa(auth_client, "A1", status="A Fazer")
    f1 = _criar_tarefa(auth_client, "F1", status="Fazendo")
    a2 = _criar_tarefa(auth_client, "A2", status="A Fazer")

    auth_client.put(
        "/api/v1/tarefas/reorder",
        json={"columns": {"A Fazer": [a2["id"], a1["id"]], "Fazendo": [f1["id"]]}},
    )

    a_fazer = _listar(auth_client, status="A Fazer")
    assert [t["id"] for t in a_fazer] == [a2["id"], a1["id"]]
    assert a_fazer[0]["posicao"] == 1 and a_fazer[1]["posicao"] == 2


def test_reorder_intra_coluna(auth_client, db):
    ids = [_criar_tarefa(auth_client, f"t{i}")["id"] for i in range(3)]
    nova_ordem = [ids[2], ids[0], ids[1]]

    res = auth_client.put(
        "/api/v1/tarefas/reorder",
        json={"columns": {"A Fazer": nova_ordem}},
    )
    assert res.status_code == 200
    assert json.loads(res.data)["updated"] == 3

    a_fazer = _listar(auth_client, status="A Fazer")
    assert [t["id"] for t in a_fazer] == nova_ordem


def test_reorder_move_entre_colunas(auth_client, db):
    t1 = _criar_tarefa(auth_client, "card-a", status="A Fazer")
    t2 = _criar_tarefa(auth_client, "card-b", status="A Fazer")

    res = auth_client.put(
        "/api/v1/tarefas/reorder",
        json={
            "columns": {
                "A Fazer": [t2["id"]],
                "Fazendo": [t1["id"]],
            }
        },
    )
    assert res.status_code == 200

    todas = _listar(auth_client)
    por_id = {t["id"]: t for t in todas}
    assert por_id[t1["id"]]["status"] == "Fazendo"
    assert por_id[t1["id"]]["posicao"] == 1
    assert por_id[t2["id"]]["status"] == "A Fazer"
    assert por_id[t2["id"]]["posicao"] == 1


def test_reorder_body_invalido(auth_client, db):
    res = auth_client.put("/api/v1/tarefas/reorder", json={})
    assert res.status_code == 400

    res = auth_client.put("/api/v1/tarefas/reorder", json={"columns": {"A Fazer": "nao-eh-lista"}})
    assert res.status_code == 400


def test_reorder_ignora_ids_de_outro_tenant(client, auth_client, db):
    # Cria tarefa no tenant do auth_client.
    minha = _criar_tarefa(auth_client, "minha-tarefa")

    # Registra um segundo usuario (gera novo tenant) e cria tarefa nesse outro tenant.
    reg = client.post(
        "/api/v1/auth/register",
        json={
            "username": "outroescritorio",
            "email": "outro@teste.com",
            "password": "Senha1234!",
            "role": "admin",
            "aceite_termos": True,
            "aceite_lgpd": True,
            "versao_termos": "v1.0",
            "versao_lgpd": "v1.0",
        },
    )
    assert reg.status_code == 201, reg.data

    login = client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "outroescritorio", "password": "Senha1234!"},
    )
    token_outro = json.loads(login.data)["access_token"]
    headers_outro = {"Authorization": f"Bearer {token_outro}"}

    cria_outro = client.post(
        "/api/v1/tarefas",
        json={"titulo": "do-outro", "status": "A Fazer"},
        headers=headers_outro,
    )
    assert cria_outro.status_code == 201
    do_outro = json.loads(cria_outro.data)

    posicao_original_outro = do_outro["posicao"]

    # auth_client (tenant 1) tenta reordenar incluindo o id do tenant 2.
    res = auth_client.put(
        "/api/v1/tarefas/reorder",
        json={"columns": {"A Fazer": [do_outro["id"], minha["id"]]}},
    )
    assert res.status_code == 200
    # Apenas a tarefa do proprio tenant deve ter sido atualizada.
    assert json.loads(res.data)["updated"] == 1

    # Verifica que a tarefa do outro tenant nao mudou de posicao.
    res_outro = client.get("/api/v1/tarefas", headers=headers_outro)
    items_outro = json.loads(res_outro.data)
    assert any(
        t["id"] == do_outro["id"] and t["posicao"] == posicao_original_outro for t in items_outro
    )
