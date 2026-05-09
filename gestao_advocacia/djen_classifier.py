"""Classificador IA de publicacoes DJEN — Epic #2 (#176).

Marca cada publicacao como "importante" (decisao, intimacao, sentenca,
despacho de cumprimento) vs "rotina" (juntada de peticao, conclusos,
expedicao de oficio, vista a parte) usando Gemini 2.5-flash.

Estrategia em camadas (gratis → caro):

1. **Short-circuit por tipo_comunicacao**: a ComunicaAPI ja entrega o tipo
   ("Intimacao", "Sentenca", "Despacho", "Lista de distribuicao"). Tipos
   conhecidos como rotina (lista de distribuicao, juntada) viram importante=False
   sem chamar IA. Tipos conhecidos como importantes (Intimacao, Sentenca)
   ainda passam por IA pra confirmar via texto — pq o tipo e' grosseiro.

2. **Short-circuit por keywords**: se o texto NAO tem nenhuma palavra-gatilho
   de movimento relevante (prazo, intimad, sentenc, decid, julg, condenad),
   NAO chama IA — retorna importante=False.

3. **Gemini fallback**: para o resto, manda prompt curto pedindo classificacao
   com motivo. JSON estruturado.

Resultado:
- importante (bool): True quando relevante, False caso contrario
- classificado_em (datetime utcnow): sempre setado quando classifier roda
- classificacao_motivo (str): texto curto explicando (mostrado em tooltip)

Custo: o short-circuit pega ~60% das pubs (estimativa baseada na distribuicao
do tenant 2 — predominam "Lista de distribuicao" e juntadas). Restante vai
pra Gemini flash a R$ 0,0003 por chamada.
"""

import json as _json
import re
from datetime import datetime

# Tipos de comunicacao que sao quase sempre rotina (movimentos administrativos
# sem prazo nem decisao). Marca importante=False sem chamar IA.
TIPOS_ROTINA = {
    "lista de distribuicao",
    "lista de distribuição",
    "juntada de peticao",
    "juntada de petição",
    "expedicao de oficio",
    "expedição de ofício",
    "expedicao",
    "expedição",
    "conclusos",
    "conclusao",
    "conclusão",
    "vista",
    "ato ordinatorio",
    "ato ordinatório",
    "certidao",
    "certidão",
}

# Tipos de comunicacao que sao quase sempre importantes (mas a IA confirma
# pelo texto pra evitar falso positivo de uma "intimacao para juntada").
TIPOS_IMPORTANTES_PROVAVEIS = {
    "intimacao",
    "intimação",
    "sentenca",
    "sentença",
    "decisao",
    "decisão",
    "despacho",
    "acordao",
    "acórdão",
    "audiencia",
    "audiência",
}

# Palavras-gatilho — texto SEM nenhuma destas tipicamente nao gera prazo nem
# decisao. Sem qualquer match, vira rotina sem chamar IA.
KEYWORDS_RELEVANTES = (
    "prazo",
    "intim",
    "ciencia",
    "ciência",
    "manifest",
    "contestac",
    "contestaç",
    "recurso",
    "embargo",
    "alegac",
    "alegaç",
    "sentenc",
    "decid",
    "julg",
    "condenad",
    "indefer",
    "defer",
    "homolog",
    "extincao",
    "extinção",
    "cumprimento",
    "executiv",
    "imped",
    "suspens",
    "designad",
    "audiencia",
    "audiência",
)


def _normalizar(texto):
    return (texto or "").strip().lower()


def _short_circuit_por_tipo(tipo_comunicacao):
    """Retorna (importante, motivo) ou None se precisa ir adiante."""
    tipo = _normalizar(tipo_comunicacao)
    if not tipo:
        return None
    if any(rotina in tipo for rotina in TIPOS_ROTINA):
        return (False, f"Tipo '{tipo_comunicacao}' classificado como rotina por padrao.")
    return None


def _short_circuit_por_keywords(texto):
    """Retorna (importante, motivo) ou None se precisa ir adiante."""
    texto_lower = _normalizar(texto)
    if not texto_lower or len(texto_lower) < 80:
        # Texto vazio/curto demais — provavelmente rotina (ex.: "Conclusos.")
        return (False, "Texto curto sem palavras-gatilho de movimento processual.")
    if not any(kw in texto_lower for kw in KEYWORDS_RELEVANTES):
        return (False, "Texto sem palavras-gatilho (prazo/intimacao/decisao/etc).")
    return None


def _classificar_via_ia(tipo_comunicacao, texto, gemini_client, modelo):
    """Chama Gemini com prompt estruturado. Retorna (importante, motivo) ou
    (None, None) em caso de erro (mantem coluna NULL pra retry)."""
    # Limita texto pra economizar tokens — primeiras 2500 chars cobrem 99%
    # das pubs DJEN; intimacoes longas com tabela tem mais mas a parte
    # decisoria fica no inicio.
    texto_corte = (texto or "")[:2500]
    tipo = tipo_comunicacao or "(sem tipo)"

    prompt = f"""Voce eh um analista juridico brasileiro. Classifique a publicacao
DJEN abaixo como IMPORTANTE (exige acao do advogado: prazo, decisao,
intimacao com cumprimento, sentenca, audiencia designada) ou ROTINA (sem
acao imediata: juntada de peticao, conclusos, vista, expedicao, lista de
distribuicao, ato ordinatorio).

Retorne APENAS JSON valido sem markdown:
{{
  "importante": true/false,
  "motivo": "frase curta (max 80 chars) explicando a classificacao"
}}

REGRAS:
1. "Intimacao para juntada" / "Intimacao para vista" => ROTINA.
2. "Intimacao para contestar/recorrer/manifestar" => IMPORTANTE.
3. Sentenca/Decisao com merito => IMPORTANTE. Decisao saneadora tambem.
4. "Lista de distribuicao" => ROTINA, mesmo se o orgao for relevante.
5. "Audiencia designada" => IMPORTANTE.
6. Em duvida razoavel => IMPORTANTE (preferimos falso-positivo a perder prazo).

TIPO_COMUNICACAO: {tipo}

TEXTO:
{texto_corte}
"""
    try:
        resp = gemini_client.models.generate_content(
            model=modelo,
            contents=prompt,
            config={"response_mime_type": "application/json"},
        )
        raw = (getattr(resp, "text", None) or "").strip()
        if raw.startswith("```"):
            # Defensivo: alguns modos retornam com fence apesar do mime_type.
            raw = re.sub(r"^```(json)?", "", raw).strip()
            if raw.endswith("```"):
                raw = raw[:-3].strip()
        parsed = _json.loads(raw)
        importante = bool(parsed.get("importante", False))
        motivo = str(parsed.get("motivo") or "Classificado por IA.")[:200]
        return (importante, motivo)
    except Exception:
        return (None, None)


def classificar_publicacao(pub, gemini_client=None, modelo="gemini-2.5-flash"):
    """Classifica uma PublicacaoDJEN.

    Args:
        pub: instancia de PublicacaoDJEN com .tipo_comunicacao e .texto
        gemini_client: cliente do gemini_service.get_gemini_client(); se None
            ou se short-circuit decidir antes, IA nao eh chamada
        modelo: GEMINI_TRIAGEM_MODEL (default flash — barato e rapido aqui)

    Retorna dict com keys: importante (bool|None), motivo (str), classificado_em
    (datetime). importante=None significa que a classificacao falhou e a coluna
    deve ficar NULL pra retry posterior.
    """
    # Camada 1: tipo conhecido como rotina
    sc_tipo = _short_circuit_por_tipo(pub.tipo_comunicacao)
    if sc_tipo is not None:
        importante, motivo = sc_tipo
        return {
            "importante": importante,
            "motivo": motivo,
            "classificado_em": datetime.utcnow(),
        }

    # Camada 2: keywords no texto
    sc_kw = _short_circuit_por_keywords(pub.texto)
    if sc_kw is not None:
        importante, motivo = sc_kw
        return {
            "importante": importante,
            "motivo": motivo,
            "classificado_em": datetime.utcnow(),
        }

    # Camada 3: Gemini
    if gemini_client is None:
        # Sem cliente: nao consegue classificar — deixa NULL pra retry
        return {"importante": None, "motivo": None, "classificado_em": None}

    importante, motivo = _classificar_via_ia(pub.tipo_comunicacao, pub.texto, gemini_client, modelo)
    if importante is None:
        return {"importante": None, "motivo": None, "classificado_em": None}

    return {
        "importante": importante,
        "motivo": motivo,
        "classificado_em": datetime.utcnow(),
    }
