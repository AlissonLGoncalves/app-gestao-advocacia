"""Backfill idempotente das tabelas legadas (tarefa_prazo + evento_agenda)
para a tabela unificada item_agenda (PR D2).

Estrategia Expand → Migrate → Contract:
  - D1: tabela item_agenda criada vazia (paralela).
  - D2 (este script): popula item_agenda com dados existentes, e os
    endpoints /tarefas e /eventos passam a fazer dual-write.
  - D3: frontend migra pra /v1/itens-agenda.
  - D4: dropa as tabelas legadas.

Idempotencia: cada ItemAgenda carrega legacy_tarefa_id ou legacy_evento_id
apontando pro registro de origem. Re-rodar nao duplica — atualiza in-place.

Uso:
    # dry-run (padrao) — soh estatisticas, nada eh comitado
    python -m scripts.maintenance.backfill_itens_agenda

    # apply pra todos os tenants
    python -m scripts.maintenance.backfill_itens_agenda --apply

    # restringe a um tenant especifico
    python -m scripts.maintenance.backfill_itens_agenda --apply --tenant-id 1

    # ajusta tamanho do batch (default 500)
    python -m scripts.maintenance.backfill_itens_agenda --apply --batch-size 1000

Validacao pos-execucao recomendada:
    # numeros devem bater
    SELECT COUNT(*) FROM tarefa_prazo;
    SELECT COUNT(*) FROM item_agenda WHERE legacy_tarefa_id IS NOT NULL;
    SELECT COUNT(*) FROM evento_agenda;
    SELECT COUNT(*) FROM item_agenda WHERE legacy_evento_id IS NOT NULL;
"""

from __future__ import annotations

import argparse
import json
import os
import sys

_BASE_DIR = os.path.join(os.path.dirname(__file__), "..", "..")
sys.path.insert(0, os.path.abspath(_BASE_DIR))


def _build_app():
    from app import create_app  # noqa: PLC0415

    return create_app()


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Comita as mudancas. Sem isso, eh dry-run (default seguro).",
    )
    parser.add_argument(
        "--tenant-id",
        type=int,
        default=None,
        help="Restringe a um tenant (default: todos).",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=500,
        help="Registros por commit (default 500).",
    )
    args = parser.parse_args()

    app = _build_app()
    with app.app_context():
        from services.itens_agenda_sync import backfill_all  # noqa: PLC0415

        stats = backfill_all(
            apply=args.apply,
            batch_size=args.batch_size,
            tenant_id=args.tenant_id,
        )
        print(json.dumps(stats, indent=2, default=str))

        if not args.apply:
            print(
                "\n[DRY-RUN] Nenhuma alteracao foi comitada. "
                "Re-rode com --apply para persistir.",
                file=sys.stderr,
            )


if __name__ == "__main__":
    main()
