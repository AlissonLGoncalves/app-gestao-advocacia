"""Detector hibrido (regex + IA) de prazos processuais em texto livre.

Usado pelo endpoint POST /api/projudi/movimentacoes para identificar quando
uma movimentacao gera um prazo (TarefaPrazo no Kanban) — ex.: 'intima-se
para contestar em 15 dias uteis'.

Camadas:
1. REGEX (gratuito, instantaneo) — padroes comuns
2. IA Gemini (so quando regex nao acha mas texto eh sugestivo)

Retorno padrao: dict com {tipo, dias, uteis, vencimento_iso, fonte} ou None.
"""

from __future__ import annotations

import re
from datetime import date, datetime, timedelta

# ---------------------------------------------------------------------------
# Camada 1: regex
# ---------------------------------------------------------------------------

# Mapeia palavra-chave → tipo padronizado de prazo
_TIPOS_POR_PALAVRA = [
    (r"contesta(?:r|cao|ç[ãa]o)", "contestacao"),
    (r"r[eé]plica", "replica"),
    (r"tr[eé]plica", "treplica"),
    (r"impugna(?:r|cao|ç[ãa]o)", "impugnacao"),
    (r"recorr(?:er|so)|recurso", "recurso"),
    (r"embargos?(?:\s+de\s+declara[cç][ãa]o)?", "embargos"),
    (r"alega[cç][õo]es\s+finais", "alegacoes_finais"),
    (r"cumprimento\s+de\s+senten[cç]a|cumpri(?:r|mento)", "cumprimento"),
    (r"manifesta(?:r|cao|ç[ãa]o)", "manifestacao"),
    (r"defesa\s+pr[eé]via|resposta", "defesa"),
    (r"pareceres?", "parecer"),
]

# Padrao numero + dias (uteis ou corridos)
_RE_DIAS_PRAZO = re.compile(
    r"\b(\d{1,3})\s*(?:\(?[a-z\s]*\)?\s*)?dias?\s*(?:[uú]teis|corridos|consecutivos)?",
    re.IGNORECASE,
)

# Frases-gatilho que indicam que ha prazo (ajuda separar 'em 15 dias estara
# pronto' de 'intime-se para X em 15 dias')
_GATILHOS = [
    # Inclui as formas imperativas "intime-se"/"cite-se"/"notifique-se" —
    # como os tribunais de fato escrevem. Bug achado pelos testes (#302):
    # "Cite-se para apresentar contestação em 15 dias" não disparava.
    r"\bintim(?:a(?:r|do|m|cao|ç[ãa]o)?|e(?:m|-se)?)\b",
    r"\bnotifi(?:ca(?:r|do|m|cao|ç[ãa]o)?|que(?:m|-se)?)\b",
    r"\bcit(?:a(?:r|do|m|cao|ç[ãa]o)?|e(?:m|-se)?)\b",
    r"\bdetermin(?:a(?:r|do|m|cao|ç[ãa]o)?|e(?:m|-se)?)\b",
    r"\bcumpra(?:m|-se)?\b",
    r"\bprazo\s+(?:de|para)",
    r"\bno\s+prazo\s+de",
    r"\bdentro\s+de",
    r"\bsob\s+pena\s+de",
]
_RE_GATILHO = re.compile("|".join(_GATILHOS), re.IGNORECASE)


def _calcular_vencimento(data_referencia: date, dias: int, uteis: bool) -> date:
    """Adiciona N dias (uteis ou corridos) a uma data."""
    if not uteis:
        return data_referencia + timedelta(days=dias)
    # Dias uteis: pula sabado (5) e domingo (6). Nao considera feriados —
    # heuristica suficiente para detector. Quem assina o prazo confere.
    cur = data_referencia
    contador = 0
    while contador < dias:
        cur = cur + timedelta(days=1)
        if cur.weekday() < 5:
            contador += 1
    return cur


def detectar_prazo_regex(texto: str, data_referencia: date | None = None) -> dict | None:
    """Tenta detectar prazo via regex. Retorna dict ou None."""
    if not texto:
        return None
    if data_referencia is None:
        data_referencia = date.today()

    texto_lower = texto.lower()

    # Tem gatilho? (sem isso, nao supomos prazo)
    if not _RE_GATILHO.search(texto_lower):
        return None

    # Acha N dias
    match = _RE_DIAS_PRAZO.search(texto_lower)
    if not match:
        return None
    dias_str = match.group(1)
    try:
        dias = int(dias_str)
    except ValueError:
        return None
    if dias < 1 or dias > 365:
        return None

    # uteis vs corridos
    fragment = texto_lower[match.start() : match.start() + 80]
    uteis = bool(re.search(r"[uú]teis", fragment))
    # Default: dias uteis em civil (CPC art. 219)
    if "corridos" not in fragment and "consecutivos" not in fragment:
        uteis = True

    # Tipo do prazo (qual peca/ato)
    tipo = "outro"
    for padrao, tipo_padronizado in _TIPOS_POR_PALAVRA:
        if re.search(padrao, texto_lower):
            tipo = tipo_padronizado
            break

    vencimento = _calcular_vencimento(data_referencia, dias, uteis)

    return {
        "tipo": tipo,
        "dias": dias,
        "uteis": uteis,
        "vencimento_iso": vencimento.isoformat(),
        "fonte": "regex",
        "data_referencia": data_referencia.isoformat(),
    }


# ---------------------------------------------------------------------------
# Camada 2: IA (Gemini) — fallback
# ---------------------------------------------------------------------------


def detectar_prazo_ia(texto: str, data_referencia: date | None = None) -> dict | None:
    """Fallback Gemini. Custo: ~\\$0.0015/chamada (gemini-2.5-pro). So roda
    quando o texto tem >100 chars e regex nao retornou nada.

    Short-circuits adicionais (gratis) pra reduzir gasto a medida que escalamos:
    - Textos puramente operacionais (Conclusos, Juntada, Certidao) sao log puro
      sem prazo — pula IA inteira.
    - Textos sem nenhuma das palavras-gatilho ("prazo", "dias", "intimad",
      "ciencia", "manifest", "contestac") tipicamente nao tem prazo processual.
    """
    if not texto or len(texto) < 100:
        return None

    txt_lower = texto.lower()
    # Skip: log operacional puro (conclusos, juntadas) sem palavra-gatilho.
    sem_gatilho = not any(
        kw in txt_lower
        for kw in (
            "prazo",
            "dias",
            "intimad",
            "ciencia",
            "ciência",
            "manifest",
            "contestac",
            "contestaç",
            "recurso",
            "embargo",
            "alegac",
            "alegaç",
        )
    )
    if sem_gatilho:
        return None

    try:
        from gemini_service import get_gemini_client, is_enabled  # noqa: PLC0415
    except Exception:
        return None
    if not is_enabled():
        return None
    client = get_gemini_client()
    if client is None:
        return None

    if data_referencia is None:
        data_referencia = date.today()

    prompt = f"""Voce eh um analista juridico brasileiro. Analise o texto de uma movimentacao
processual e determine se ha um PRAZO PROCESSUAL para uma parte cumprir.

Retorne APENAS JSON valido, sem markdown:
{{
  "tem_prazo": true/false,
  "tipo": "contestacao|replica|impugnacao|recurso|embargos|alegacoes_finais|cumprimento|manifestacao|defesa|parecer|outro",
  "dias": numero_inteiro_ou_null,
  "uteis": true_se_dias_uteis_false_se_corridos,
  "data_referencia": "YYYY-MM-DD",
  "vencimento_iso": "YYYY-MM-DD",
  "confianca": "alta|media|baixa"
}}

REGRAS:
1. Se o texto eh apenas log (ex: 'Conclusos', 'Juntada de peticao'), retorne tem_prazo=false.
2. CPC art. 219: prazos sao em dias UTEIS por padrao em civil. Trabalhista usa
   dias uteis tambem (CLT 775). So marque uteis=false se texto disser 'corridos'.
3. Se ha prazo mas dias nao explicitos (ex: 'no prazo legal'), use null em dias
   e infera vencimento conservadoramente (15 dias uteis).
4. Use a data_referencia abaixo como base para calcular vencimento_iso.
5. confianca='alta' so se prazo e tipo sao explicitos.

DATA DE REFERENCIA: {data_referencia.isoformat()}

TEXTO:
{texto[:3000]}
"""

    try:
        from flask import current_app  # noqa: PLC0415

        model = current_app.config.get("GEMINI_TRIAGEM_MODEL", "gemini-2.5-flash")
        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config={"response_mime_type": "application/json"},
        )
    except Exception:
        return None

    raw = (getattr(response, "text", None) or "").strip()
    if raw.startswith("```"):
        raw = raw.split("```", 2)[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
    if raw.endswith("```"):
        raw = raw[:-3].strip()

    try:
        import json as _json  # noqa: PLC0415

        parsed = _json.loads(raw)
    except Exception:
        return None
    if not isinstance(parsed, dict) or not parsed.get("tem_prazo"):
        return None

    venc = (parsed.get("vencimento_iso") or "").strip()
    try:
        datetime.strptime(venc, "%Y-%m-%d")
    except (ValueError, TypeError):
        return None

    return {
        "tipo": (parsed.get("tipo") or "outro").strip(),
        "dias": parsed.get("dias") if isinstance(parsed.get("dias"), int) else None,
        "uteis": bool(parsed.get("uteis", True)),
        "vencimento_iso": venc,
        "fonte": "ia_gemini",
        "data_referencia": data_referencia.isoformat(),
        "confianca": (parsed.get("confianca") or "media").strip(),
    }


# ---------------------------------------------------------------------------
# Pipeline hibrido
# ---------------------------------------------------------------------------


def detectar_prazo(texto: str, data_referencia: date | None = None) -> dict | None:
    """Pipeline principal. Tenta regex primeiro (gratis). Se nao acha,
    cai pra IA (Gemini, $0.0003) quando texto eh substancial.
    """
    resultado = detectar_prazo_regex(texto, data_referencia)
    if resultado:
        return resultado
    return detectar_prazo_ia(texto, data_referencia)


def titulo_prazo(tipo: str, numero_cnj: str | None = None) -> str:
    """Gera titulo legivel do TarefaPrazo a partir do tipo."""
    rotulos = {
        "contestacao": "Prazo: Contestação",
        "replica": "Prazo: Réplica",
        "treplica": "Prazo: Tréplica",
        "impugnacao": "Prazo: Impugnação",
        "recurso": "Prazo: Recurso",
        "embargos": "Prazo: Embargos",
        "alegacoes_finais": "Prazo: Alegações Finais",
        "cumprimento": "Prazo: Cumprimento de Sentença",
        "manifestacao": "Prazo: Manifestação",
        "defesa": "Prazo: Defesa Prévia",
        "parecer": "Prazo: Parecer",
        "outro": "Prazo processual",
    }
    base = rotulos.get(tipo, "Prazo processual")
    if numero_cnj:
        base = f"{base} — {numero_cnj}"
    return base[:250]


def prioridade_por_dias_ate_vencer(vencimento: date) -> str:
    """Prioridade do TarefaPrazo baseada em dias ate o vencimento."""
    dias = (vencimento - date.today()).days
    if dias < 0:
        return "Urgente"
    if dias <= 3:
        return "Urgente"
    if dias <= 7:
        return "Alta"
    if dias <= 15:
        return "Normal"
    return "Baixa"
