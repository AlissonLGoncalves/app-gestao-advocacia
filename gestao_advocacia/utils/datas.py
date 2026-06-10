"""Helpers de data com timezone explícito.

Por que existe: os jobs do APScheduler rodavam com "hoje" inconsistente —
`datetime.utcnow().date()` em alertas_tasks e `date.today()` em
notificacoes_tasks. No Fly.io o servidor roda em UTC, então entre 21h e
00h (horário de Brasília) o UTC já virou o dia seguinte: prazos e
notificações podiam ser calculados com off-by-one.

Para app jurídico brasileiro a referência correta de "hoje" é o dia civil
em America/Sao_Paulo (mesma timezone já usada pelo SCHEDULER_TIMEZONE em
config.py e pelo guard de horário do DJEN em routes/djen.py).
"""

from __future__ import annotations

from datetime import date, datetime
from zoneinfo import ZoneInfo

TZ_BRASIL = ZoneInfo("America/Sao_Paulo")


def agora_brasil() -> datetime:
    """Datetime atual (aware) em America/Sao_Paulo."""
    return datetime.now(TZ_BRASIL)


def hoje_brasil() -> date:
    """Dia civil atual no Brasil — usar em qualquer comparação de prazo."""
    return agora_brasil().date()
