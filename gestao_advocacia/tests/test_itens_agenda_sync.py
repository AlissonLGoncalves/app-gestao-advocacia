# tests/test_itens_agenda_sync.py
# Testes do dual-write e do backfill (PR D2).
#
# Cobertura:
#   - dual-write em /tarefas (POST/PUT/PATCH validar-prazo/PATCH concluir/DELETE/reorder)
#   - dual-write em /eventos (POST/PUT/DELETE)
#   - backfill idempotente (re-rodar nao duplica)
#   - mapeamento de status entre TarefaPrazo/EventoAgenda e ItemAgenda

import json
from datetime import datetime, timedelta, timezone


def _futuro_iso(dias=3):
    return (datetime.now(timezone.utc) + timedelta(days=dias)).replace(microsecond=0).isoformat()


# ---------- Dual-write em /tarefas ----------


def test_post_tarefa_cria_item_agenda(auth_client, db):
    from models import ItemAgenda

    payload = {
        "titulo": "Tarefa via API",
        "tipo_tarefa": "Prazo",
        "status": "A Fazer",
        "data_vencimento": _futuro_iso(5),
    }
    res = auth_client.post("/api/v1/tarefas", json=payload)
    assert res.status_code == 201, res.data
    tarefa_id = json.loads(res.data)["id"]

    item = ItemAgenda.query.filter_by(legacy_tarefa_id=tarefa_id).first()
    assert item is not None
    assert item.tipo == "tarefa"
    assert item.titulo == "Tarefa via API"
    assert item.status == "Pendente"  # "A Fazer" -> "Pendente"
    assert item.categoria == "Prazo"


def test_put_tarefa_atualiza_item_agenda(auth_client, db):
    from models import ItemAgenda

    res_post = auth_client.post(
        "/api/v1/tarefas",
        json={"titulo": "Original", "status": "A Fazer"},
    )
    tarefa_id = json.loads(res_post.data)["id"]

    res_put = auth_client.put(
        f"/api/v1/tarefas/{tarefa_id}",
        json={"titulo": "Atualizada", "status": "Fazendo", "prioridade": "Alta"},
    )
    assert res_put.status_code == 200

    item = ItemAgenda.query.filter_by(legacy_tarefa_id=tarefa_id).first()
    assert item.titulo == "Atualizada"
    assert item.status == "Em Andamento"  # "Fazendo" -> "Em Andamento"
    assert item.prioridade == "Alta"


def test_delete_tarefa_remove_item_agenda(auth_client, db):
    from models import ItemAgenda

    res_post = auth_client.post("/api/v1/tarefas", json={"titulo": "ParaDeletar"})
    tarefa_id = json.loads(res_post.data)["id"]
    assert ItemAgenda.query.filter_by(legacy_tarefa_id=tarefa_id).count() == 1

    res_del = auth_client.delete(f"/api/v1/tarefas/{tarefa_id}")
    assert res_del.status_code == 204
    assert ItemAgenda.query.filter_by(legacy_tarefa_id=tarefa_id).count() == 0


def test_patch_concluir_atualiza_status_item(auth_client, db):
    from models import ItemAgenda

    res_post = auth_client.post("/api/v1/tarefas", json={"titulo": "Concluir"})
    tarefa_id = json.loads(res_post.data)["id"]

    res = auth_client.patch(f"/api/v1/tarefas/{tarefa_id}/concluir")
    assert res.status_code == 200

    item = ItemAgenda.query.filter_by(legacy_tarefa_id=tarefa_id).first()
    assert item.status == "Concluido"


def test_reorder_atualiza_posicao_item(auth_client, db):
    from models import ItemAgenda

    ids = []
    for i in range(3):
        res = auth_client.post(
            "/api/v1/tarefas",
            json={"titulo": f"T{i}", "status": "A Fazer"},
        )
        ids.append(json.loads(res.data)["id"])

    # Inverte a ordem
    res = auth_client.put(
        "/api/v1/tarefas/reorder",
        json={"columns": {"Fazendo": list(reversed(ids))}},
    )
    assert res.status_code == 200

    for indice, tarefa_id in enumerate(reversed(ids), start=1):
        item = ItemAgenda.query.filter_by(legacy_tarefa_id=tarefa_id).first()
        assert item.status == "Em Andamento"  # "Fazendo" mapeia pra "Em Andamento"
        assert item.posicao == indice


# ---------- Dual-write em /eventos ----------


def test_post_evento_cria_item_agenda(auth_client, db):
    from models import ItemAgenda

    payload = {
        "titulo": "Audiência inicial",
        "data_inicio": _futuro_iso(7),
        "tipo_evento": "Audiência",
    }
    res = auth_client.post("/api/v1/eventos", json=payload)
    assert res.status_code == 201, res.data
    evento_id = json.loads(res.data)["id"]

    item = ItemAgenda.query.filter_by(legacy_evento_id=evento_id).first()
    assert item is not None
    assert item.tipo == "evento"
    assert item.titulo == "Audiência inicial"
    assert item.status == "Pendente"
    # categoria deve ser normalizada
    assert item.categoria == "Audiencia"
    assert item.data_inicio is not None


def test_put_evento_atualiza_item(auth_client, db):
    from models import ItemAgenda

    res_post = auth_client.post(
        "/api/v1/eventos",
        json={"titulo": "Antes", "data_inicio": _futuro_iso(2)},
    )
    evento_id = json.loads(res_post.data)["id"]

    res_put = auth_client.put(
        f"/api/v1/eventos/{evento_id}",
        json={
            "titulo": "Depois",
            "data_inicio": _futuro_iso(2),
            "status_evento": "Cancelado",
        },
    )
    assert res_put.status_code == 200

    item = ItemAgenda.query.filter_by(legacy_evento_id=evento_id).first()
    assert item.titulo == "Depois"
    assert item.status == "Cancelado"


def test_delete_evento_remove_item(auth_client, db):
    from models import ItemAgenda

    res_post = auth_client.post(
        "/api/v1/eventos",
        json={"titulo": "ParaDeletar", "data_inicio": _futuro_iso()},
    )
    evento_id = json.loads(res_post.data)["id"]
    assert ItemAgenda.query.filter_by(legacy_evento_id=evento_id).count() == 1

    res_del = auth_client.delete(f"/api/v1/eventos/{evento_id}")
    assert res_del.status_code == 204
    assert ItemAgenda.query.filter_by(legacy_evento_id=evento_id).count() == 0


# ---------- Backfill idempotente ----------


def test_backfill_dry_run_nao_persiste(auth_client, db, app):
    """Dry-run reporta numeros mas nao comita."""
    from models import ItemAgenda, TarefaPrazo

    # Cria tarefa direto via SQL (bypassa o dual-write da rota pra simular
    # dado legado pre-existente).
    from models import User as _User
    from services.itens_agenda_sync import backfill_all

    user_id = auth_client.user["id"]
    user = _User.query.get(user_id)
    tenant_id = user.tenant_id
    tarefa = TarefaPrazo(
        titulo="Legada",
        status="A Fazer",
        user_id=user_id,
        tenant_id=tenant_id,
    )
    db.session.add(tarefa)
    db.session.commit()

    # Limpa o item_agenda criado por dual-write pra simular gap
    ItemAgenda.query.filter_by(legacy_tarefa_id=tarefa.id).delete()
    db.session.commit()

    stats = backfill_all(apply=False)
    assert stats["dry_run"] is True
    assert stats["tarefas_novas"] >= 1
    # Nada foi comitado
    assert ItemAgenda.query.filter_by(legacy_tarefa_id=tarefa.id).count() == 0


def test_backfill_apply_persiste_e_eh_idempotente(auth_client, db, app):
    """Apply persiste; re-rodar nao duplica."""
    from models import EventoAgenda, ItemAgenda, TarefaPrazo
    from models import User as _User
    from services.itens_agenda_sync import backfill_all

    user_id = auth_client.user["id"]
    user = _User.query.get(user_id)
    tenant_id = user.tenant_id
    tarefa = TarefaPrazo(titulo="Legada T", status="Fazendo", user_id=user_id, tenant_id=tenant_id)
    evento = EventoAgenda(
        titulo="Legado E",
        data_inicio=datetime.utcnow() + timedelta(days=1),
        user_id=user_id,
        tenant_id=tenant_id,
    )
    db.session.add_all([tarefa, evento])
    db.session.commit()

    # Limpa espelhos criados pelo dual-write da rota — aqui simulamos
    # dados legados (pre-D2)
    ItemAgenda.query.filter_by(legacy_tarefa_id=tarefa.id).delete()
    ItemAgenda.query.filter_by(legacy_evento_id=evento.id).delete()
    db.session.commit()

    # 1a execucao
    stats1 = backfill_all(apply=True)
    assert stats1["tarefas_novas"] >= 1
    assert stats1["eventos_novos"] >= 1
    item_t = ItemAgenda.query.filter_by(legacy_tarefa_id=tarefa.id).first()
    item_e = ItemAgenda.query.filter_by(legacy_evento_id=evento.id).first()
    assert item_t is not None
    assert item_t.status == "Em Andamento"
    assert item_e is not None
    item_t_id = item_t.id
    item_e_id = item_e.id

    # 2a execucao — idempotente: nao duplica, atualiza
    stats2 = backfill_all(apply=True)
    assert stats2["tarefas_novas"] == 0
    assert stats2["eventos_novos"] == 0
    assert stats2["tarefas_atualizadas"] >= 1
    assert stats2["eventos_atualizados"] >= 1
    assert ItemAgenda.query.filter_by(legacy_tarefa_id=tarefa.id).count() == 1
    assert ItemAgenda.query.filter_by(legacy_evento_id=evento.id).count() == 1
    # IDs preservados
    assert ItemAgenda.query.filter_by(legacy_tarefa_id=tarefa.id).first().id == item_t_id
    assert ItemAgenda.query.filter_by(legacy_evento_id=evento.id).first().id == item_e_id


# ---------- Mapeamento de status ----------


def test_status_mapping_tarefa(auth_client, db):
    """Cobre os 3 status de TarefaPrazo -> 3 status de ItemAgenda."""
    from models import ItemAgenda

    casos = [
        ("A Fazer", "Pendente"),
        ("Fazendo", "Em Andamento"),
        ("Concluído", "Concluido"),
    ]
    for status_tarefa, status_esperado in casos:
        res = auth_client.post(
            "/api/v1/tarefas",
            json={"titulo": f"Status-{status_tarefa}", "status": status_tarefa},
        )
        assert res.status_code == 201
        tarefa_id = json.loads(res.data)["id"]
        item = ItemAgenda.query.filter_by(legacy_tarefa_id=tarefa_id).first()
        assert (
            item.status == status_esperado
        ), f"Esperado {status_esperado}, obtido {item.status} para {status_tarefa}"
