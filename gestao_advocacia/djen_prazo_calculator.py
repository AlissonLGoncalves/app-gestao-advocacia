"""Calculador de prazos para tarefas auto-geradas a partir de publicacoes DJEN.

Feature Kanban<>DJEN: quando uma publicacao chega importante e vinculada a
um caso, criamos automaticamente uma TarefaPrazo. O prazo (data_vencimento)
e' calculado pela tabela de regras abaixo a partir de:

  1. data_disponibilizacao da publicacao (ponto de partida obrigatorio)
  2. tipo_comunicacao + texto (para inferir a natureza do prazo)

Filosofia: PRAZO CONSERVADOR. Quando ha duvida sobre a natureza, usa o
menor prazo razoavel (5 dias uteis aproximados = 7 dias corridos). Sempre
preferimos um prazo "antes" a perder a intimacao. O advogado pode editar
e marcar prazo_validado=True via card do Kanban.

Saida: dict com:
  - data_vencimento (datetime): D+N a partir da disponibilizacao
  - dias (int): N usado (auditoria)
  - regra (str): nome curto da regra aplicada (auditoria)
  - prioridade (str): Urgente/Alta/Normal de acordo com a regra

Nao usa IA: e' deterministico (regex + tipo). Roda em microssegundos.
"""

from __future__ import annotations

import re
from datetime import date, datetime, time, timedelta
from typing import Optional


# Tabela de regras: ordem importa — a primeira que casar e' usada.
# Cada regra: (palavras_no_texto, tipos_que_combinam, dias, prioridade, nome).
# Dias sao corridos (mais conservador). Para prazos processuais reais o
# advogado deve confirmar via card e ajustar se for em dias uteis.
_REGRAS = [
    # Recursos — 15 dias uteis CPC; usamos 15 corridos por seguranca
    (
        re.compile(r"\b(apelac|recurs(o|ar)\b|embargos? de declarac|embargos? infringentes|agravo de instrument)", re.I),
        {"intimacao", "intimação", "sentenca", "sentença", "decisao", "decisão", "acordao", "acórdão"},
        15, "Alta", "recurso_15d",
    ),
    # Contestacao — sem \b final pra casar "contestacao/contestaçao"
    (
        re.compile(r"\b(contestac|contestaç|conteste\b|defes(a|ar)\b)", re.I),
        {"intimacao", "intimação", "citacao", "citação"},
        15, "Alta", "contestacao_15d",
    ),
    # Citacao com prazo de pagamento (cumprimento de sentenca)
    (
        re.compile(r"\b(cumprimento de sentenc|pague|pagamento.{0,30}volunt|multa.{0,30}10%)", re.I),
        {"intimacao", "intimação", "citacao", "citação", "decisao", "decisão"},
        15, "Urgente", "cumprimento_sentenca_15d",
    ),
    # Manifestacao geral (parecer, especificacao de provas, replica)
    (
        re.compile(r"\b(manifest|impugn|repli(c|qu)a|especifica(r|cao|ção).{0,20}prov)", re.I),
        {"intimacao", "intimação"},
        15, "Normal", "manifestacao_15d",
    ),
    # Audiencia designada — alerta com 7 dias de antecedencia padrao;
    # data real da audiencia exige parser dedicado, fica como TODO
    (
        re.compile(r"\b(audienc|designad.{0,30}(audi|sess))", re.I),
        {"intimacao", "intimação", "despacho", "decisao", "decisão"},
        7, "Urgente", "audiencia_7d",
    ),
    # Embargos de declaracao (5 dias)
    (
        re.compile(r"\bembargos? de declarac", re.I),
        set(),  # qualquer tipo
        5, "Alta", "embargos_declaracao_5d",
    ),
    # Sentenca/Decisao generica sem palavra-chave de recurso — prazo
    # conservador de 15d para o advogado decidir se recorre
    (
        re.compile(r".*"),  # catch-all
        {"sentenca", "sentença", "acordao", "acórdão"},
        15, "Alta", "sentenca_revisao_15d",
    ),
    # Decisao/Despacho generico — 5 dias para cumprir/manifestar
    (
        re.compile(r".*"),
        {"decisao", "decisão", "despacho"},
        5, "Normal", "decisao_despacho_5d",
    ),
]

# Fallback ultra-conservador para tipos nao mapeados. Usado quando nenhuma
# regra acima casar.
_FALLBACK_DIAS = 5
_FALLBACK_PRIORIDADE = "Normal"
_FALLBACK_REGRA = "fallback_conservador_5d"


def _normalizar_tipo(tipo: Optional[str]) -> str:
    return (tipo or "").strip().lower()


def _para_datetime(data_disp) -> datetime:
    """Aceita date ou datetime — retorna sempre datetime as 12:00 (meio-dia)
    para evitar surpresas de timezone em conversoes posteriores."""
    if isinstance(data_disp, datetime):
        return data_disp.replace(hour=12, minute=0, second=0, microsecond=0)
    if isinstance(data_disp, date):
        return datetime.combine(data_disp, time(hour=12))
    # String iso fallback
    if isinstance(data_disp, str):
        try:
            return datetime.fromisoformat(data_disp).replace(hour=12, minute=0, second=0, microsecond=0)
        except ValueError:
            pass
    # Sem data de partida — usa hoje meio-dia
    return datetime.combine(date.today(), time(hour=12))


def calcular_prazo(
    tipo_comunicacao: Optional[str],
    texto: Optional[str],
    data_disponibilizacao,
) -> dict:
    """Calcula prazo a partir da publicacao DJEN.

    Args:
        tipo_comunicacao: ex. "Intimacao", "Sentenca", "Despacho"
        texto: corpo da publicacao (para regex de palavras-gatilho)
        data_disponibilizacao: date/datetime/iso str — ponto de partida

    Returns:
        dict com data_vencimento (datetime), dias (int), regra (str),
        prioridade (str).
    """
    tipo_norm = _normalizar_tipo(tipo_comunicacao)
    texto_norm = texto or ""
    base = _para_datetime(data_disponibilizacao)

    for padrao, tipos_validos, dias, prioridade, nome in _REGRAS:
        if tipos_validos and tipo_norm not in tipos_validos:
            continue
        if not padrao.search(texto_norm):
            continue
        return {
            "data_vencimento": base + timedelta(days=dias),
            "dias": dias,
            "regra": nome,
            "prioridade": prioridade,
        }

    return {
        "data_vencimento": base + timedelta(days=_FALLBACK_DIAS),
        "dias": _FALLBACK_DIAS,
        "regra": _FALLBACK_REGRA,
        "prioridade": _FALLBACK_PRIORIDADE,
    }
