# services/itens_agenda_sync.py
# Servico de sincronizacao TarefaPrazo/EventoAgenda → ItemAgenda (PR D2).
#
# Estrategia Expand → Migrate → Contract:
#   - D1 (mergeado): tabela item_agenda criada paralela.
#   - D2 (este PR): dual-write em /tarefas e /eventos + backfill idempotente.
#     Toda escrita nos endpoints legados replica em item_agenda; o backfill
#     popula os dados ja existentes. Mantemos os endpoints legados como
#     fonte de verdade ainda — eh dual-write, nao migracao destrutiva.
#   - D3: frontend migra pra /v1/itens-agenda.
#   - D4: dropa /tarefas e /eventos.
#
# Idempotencia: cada ItemAgenda carrega legacy_tarefa_id ou legacy_evento_id
# apontando pro registro de origem. Re-rodar backfill ou re-chamar
# upsert_* nao duplica — atualiza o registro existente.

from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

from extensions import db
from models import EventoAgenda, ItemAgenda, TarefaPrazo

logger = logging.getLogger(__name__)

# ---------- Mapeamentos de enums ----------

# TarefaPrazo.status -> ItemAgenda.status
STATUS_TAREFA_MAP = {
    "A Fazer": "Pendente",
    "Fazendo": "Em Andamento",
    "Em Andamento": "Em Andamento",
    "Concluído": "Concluido",
    "Concluido": "Concluido",
}

# EventoAgenda.status_evento -> ItemAgenda.status
STATUS_EVENTO_MAP = {
    "Pendente": "Pendente",
    "Em Andamento": "Em Andamento",
    "Concluído": "Concluido",
    "Concluido": "Concluido",
    "Cancelado": "Cancelado",
}

# Normaliza acentos das categorias (XSD/dados legados podem ter ambos).
CATEGORIA_NORMALIZE = {
    "Audiência": "Audiencia",
    "Audiencia": "Audiencia",
    "Reunião": "Reuniao",
    "Reuniao": "Reuniao",
    "Petição": "Peticionamento",
    "Peticionamento": "Peticionamento",
    "Ligação": "Ligacao",
    "Ligacao": "Ligacao",
    "Prazo": "Prazo",
    "Lembrete": "Lembrete",
    "Outros": "Outros",
}


def _normalizar_categoria(valor: Optional[str], default: str = "Outros") -> str:
    if not valor:
        return default
    return CATEGORIA_NORMALIZE.get(valor.strip(), valor.strip())


# ---------- Sync TarefaPrazo -> ItemAgenda ----------


def sync_tarefa(tarefa: TarefaPrazo) -> ItemAgenda:
    """Upsert idempotente do ItemAgenda espelho de uma TarefaPrazo.

    - Se ja existe (legacy_tarefa_id=tarefa.id), atualiza in-place.
    - Caso contrario, cria.

    Nao faz commit — deixa o caller controlar a transacao (importante pra
    rotas que ja chamam commit no fim do handler, e pra batches no
    backfill que comitam em lotes).
    """
    item = ItemAgenda.query.filter_by(legacy_tarefa_id=tarefa.id).first()
    novo = item is None
    if novo:
        item = ItemAgenda(legacy_tarefa_id=tarefa.id)

    item.tenant_id = tarefa.tenant_id
    item.user_id = tarefa.user_id
    item.tipo = "tarefa"
    item.categoria = _normalizar_categoria(tarefa.tipo_tarefa, default="Outros")
    item.titulo = tarefa.titulo
    item.descricao = tarefa.descricao
    item.status = STATUS_TAREFA_MAP.get(tarefa.status or "A Fazer", "Pendente")
    item.prioridade = tarefa.prioridade or "Normal"
    item.data_vencimento = tarefa.data_vencimento
    # Tarefa nao tem data_inicio nativa, mas mantemos paralelo a
    # data_vencimento pra facilitar query "o que vence essa semana"
    # via campo unico no D3.
    item.data_inicio = tarefa.data_vencimento
    item.data_fim = None
    item.posicao = tarefa.posicao or 0
    item.caso_id = tarefa.caso_id
    item.publicacao_djen_id = tarefa.publicacao_djen_id
    item.prazo_validado = bool(tarefa.prazo_validado)
    item.prazo_calculado_por_ia = bool(tarefa.prazo_calculado_por_ia)
    item.prazo_dias_origem = tarefa.prazo_dias_origem
    item.origem_id = tarefa.origem_id
    if novo and tarefa.data_criacao:
        # Preserva a data_criacao original no backfill — relevante pra
        # historico/auditoria. Em creates novos via dual-write, deixa o
        # default do model populando agora.
        item.data_criacao = tarefa.data_criacao

    if novo:
        db.session.add(item)
    return item


def delete_item_da_tarefa(tarefa_id: int) -> int:
    """Remove o ItemAgenda espelho quando a TarefaPrazo eh deletada.

    Retorna o numero de registros removidos (0 ou 1).
    """
    count = ItemAgenda.query.filter_by(legacy_tarefa_id=tarefa_id).delete()
    return count


# ---------- Sync EventoAgenda -> ItemAgenda ----------


def sync_evento(evento: EventoAgenda) -> ItemAgenda:
    """Upsert idempotente do ItemAgenda espelho de um EventoAgenda."""
    item = ItemAgenda.query.filter_by(legacy_evento_id=evento.id).first()
    novo = item is None
    if novo:
        item = ItemAgenda(legacy_evento_id=evento.id)

    item.tenant_id = evento.tenant_id
    item.user_id = evento.user_id
    item.tipo = "evento"
    item.categoria = _normalizar_categoria(evento.tipo_evento, default="Outros")
    item.titulo = evento.titulo
    item.descricao = evento.descricao
    item.status = STATUS_EVENTO_MAP.get(evento.status_evento or "Pendente", "Pendente")
    item.prioridade = evento.prioridade or "Normal"
    item.data_inicio = evento.data_inicio
    item.data_fim = evento.data_fim
    item.data_vencimento = None
    item.posicao = 0
    item.notificacoes_enviadas = evento.notificacoes_enviadas or {}
    item.caso_id = None  # EventoAgenda nao tem caso_id nativo
    item.publicacao_djen_id = None
    item.prazo_validado = True
    item.prazo_calculado_por_ia = False

    if novo:
        db.session.add(item)
    return item


def delete_item_do_evento(evento_id: int) -> int:
    count = ItemAgenda.query.filter_by(legacy_evento_id=evento_id).delete()
    return count


# ---------- Backfill ----------


def backfill_all(
    apply: bool = False, batch_size: int = 500, tenant_id: Optional[int] = None
) -> dict:
    """Backfill idempotente das tabelas legadas pra item_agenda.

    Args:
        apply: se False (dry-run), so conta o que seria feito sem commitar.
        batch_size: numero de registros por commit (para nao estourar
            memoria/lock em DB grande).
        tenant_id: se informado, restringe ao tenant.

    Retorna estatisticas: {
        "tarefas_novas": N,
        "tarefas_atualizadas": N,
        "eventos_novos": N,
        "eventos_atualizados": N,
        "dry_run": bool,
        "started_at": iso,
        "finished_at": iso,
    }
    """
    started_at = datetime.utcnow()
    stats = {
        "tarefas_novas": 0,
        "tarefas_atualizadas": 0,
        "eventos_novos": 0,
        "eventos_atualizados": 0,
        "dry_run": not apply,
        "started_at": started_at.isoformat(),
        "tenant_id": tenant_id,
    }

    # --- Tarefas ---
    tarefa_q = TarefaPrazo.query
    if tenant_id is not None:
        tarefa_q = tarefa_q.filter(TarefaPrazo.tenant_id == tenant_id)

    processados = 0
    for tarefa in tarefa_q.yield_per(batch_size):
        existia = (
            db.session.query(ItemAgenda.id).filter(ItemAgenda.legacy_tarefa_id == tarefa.id).first()
            is not None
        )
        sync_tarefa(tarefa)
        if existia:
            stats["tarefas_atualizadas"] += 1
        else:
            stats["tarefas_novas"] += 1
        processados += 1
        if apply and processados % batch_size == 0:
            db.session.commit()

    if apply:
        db.session.commit()
    else:
        db.session.rollback()

    # --- Eventos ---
    evento_q = EventoAgenda.query
    if tenant_id is not None:
        evento_q = evento_q.filter(EventoAgenda.tenant_id == tenant_id)

    processados = 0
    for evento in evento_q.yield_per(batch_size):
        existia = (
            db.session.query(ItemAgenda.id).filter(ItemAgenda.legacy_evento_id == evento.id).first()
            is not None
        )
        sync_evento(evento)
        if existia:
            stats["eventos_atualizados"] += 1
        else:
            stats["eventos_novos"] += 1
        processados += 1
        if apply and processados % batch_size == 0:
            db.session.commit()

    if apply:
        db.session.commit()
    else:
        db.session.rollback()

    stats["finished_at"] = datetime.utcnow().isoformat()
    logger.info("backfill_itens_agenda concluido: %s", stats)
    return stats
