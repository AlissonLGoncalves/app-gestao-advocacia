"""Adapters de busca de processo por tribunal (Epic #12 / #186).

Cada adapter sabe consultar UM tribunal (ou familia de tribunais) e
devolve dados padronizados que alimentam o fluxo de criar Caso.

A escolha do adapter e feita pelo orquestrador a partir do tribunal_codigo
detectado em `utils/tribunal_detector.detectar_tribunal_do_cnj`.

MVP: 1 adapter (DataJud) que cobre praticamente todos os tribunais via API
publica do CNJ. Adapters especificos (PROJUDI scrape, eproc XML, PJe) podem
ser adicionados em PRs separadas conforme demanda.
"""

from __future__ import annotations

from .base import BaseTribunalAdapter, BuscaProcessoResultado
from .datajud import DataJudAdapter

__all__ = ["BaseTribunalAdapter", "BuscaProcessoResultado", "DataJudAdapter", "selecionar_adapter"]


def selecionar_adapter(tribunal_info: dict) -> BaseTribunalAdapter | None:
    """Escolhe o adapter mais adequado para o tribunal informado.

    Args:
        tribunal_info: dict retornado por detectar_tribunal_do_cnj

    Returns:
        Instancia do adapter ou None se nao houver suporte.
    """
    if not tribunal_info or not tribunal_info.get("suportado"):
        return None
    # MVP: tudo cai no DataJud. Se o segmento/TR nao tiver alias DataJud,
    # o proprio adapter retorna falha controlada.
    return DataJudAdapter()
