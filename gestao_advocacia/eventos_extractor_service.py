"""Extracao de eventos juridicos (audiencias, prazos) de PDFs via Gemini.

Usado pelo endpoint POST /api/v1/casos/extrair-eventos-ia. Lê um PDF/imagem
de intimacao ou autos completos e extrai todas as datas relevantes:
audiencias, prazo de contestacao, prazo de impugnacao, embargos, recursos,
audiencias virtuais com link, etc.

Retorna lista estruturada que o frontend exibe com checkboxes — usuario
seleciona quais quer criar como evento na agenda.
"""

import json
import os
import tempfile
from pathlib import Path

from flask import current_app

from gemini_service import get_gemini_client, is_enabled

PROMPT_EXTRACAO = """Você é um analista jurídico brasileiro especializado em identificar prazos
processuais e audiências em documentos jurídicos (intimações, mandados, decisões,
sentenças, despachos, autos completos).

Analise o documento enviado e retorne APENAS JSON válido (sem markdown, sem texto extra)
com TODOS os eventos juridicamente relevantes que detectar, no formato:

{
  "eventos": [
    {
      "tipo": "audiencia | prazo_contestacao | prazo_impugnacao | prazo_replica | prazo_treplica | prazo_recurso | prazo_embargos | prazo_alegacoes_finais | prazo_cumprimento | pericia | sustentacao_oral | outro",
      "titulo": "string curta legível em português (ex: 'Audiência de Instrução', 'Prazo para Contestação')",
      "data": "YYYY-MM-DD (ABSOLUTA — calcule se vier prazo relativo como '15 dias úteis')",
      "hora": "HH:MM (vazio se for só prazo, sem horário específico)",
      "local": "string (ex: 'Vara do Trabalho de Cornélio Procópio - Sala 02', vazio se virtual ou prazo)",
      "modalidade": "presencial | virtual | hibrida | prazo_so",
      "link": "URL completa da videoconferência se citada (Zoom, Teams, link do tribunal). Vazio caso contrário.",
      "base_legal": "string com artigo de lei se citado (ex: 'CPC art. 335', 'CLT art. 847'). Vazio se não houver.",
      "observacao": "string com detalhes complementares: forma de acesso, recomendações específicas, ID da reunião, senha, telefone de suporte, etc.",
      "confianca": "alta | media | baixa"
    }
  ]
}

REGRAS:
1. **PRAZOS**: documentos brasileiros usam "dias úteis" (CPC art. 219) — quando vir
   "X dias" sem especificar, assuma "dias úteis". Calcule a DATA ABSOLUTA do final do
   prazo a partir da data de intimação/publicação informada no documento.
2. **AUDIÊNCIAS VIRTUAIS**: identifique links (Zoom, Teams, Google Meet, link próprio
   do tribunal como pje.tjpr.jus.br/sala/X). Inclua ID/senha em "observacao".
3. **NOMENCLATURA POR ÁREA**:
   - Trabalhista: audiência una, conciliação, instrução, julgamento, prazo defesa CLT (5 dias úteis)
   - Cível: contestação (15 dias úteis), réplica (15 dias úteis), audiência conciliação (CPC 334)
   - Penal: oferecimento defesa, instrução, alegações finais
4. **MULTIPLOS EVENTOS**: um documento pode ter audiência E prazos. Liste TODOS.
5. **CONFIANÇA**:
   - alta: data e tipo explícitos no documento
   - media: você inferiu o tipo a partir do contexto
   - baixa: parcialmente legível ou ambíguo
6. Se não detectar nenhum evento, retorne `{"eventos": []}`.

CONTEXTO ADICIONAL DO CASO (preencha campos vazios usando essas referências quando útil):
- Data de distribuição: {data_distribuicao}
- Tipo de ação: {tipo_acao}
- Vara/Juízo: {vara_juizo}
"""


def extrair_eventos(file_storage, contexto: dict | None = None) -> dict:
    """Recebe um FileStorage do Flask, manda pro Gemini, retorna dict
    com chave 'eventos' (lista) ou erro estruturado.

    Args:
        file_storage: arquivo do request.files (FileStorage)
        contexto: dict com data_distribuicao, tipo_acao, vara_juizo (opcional)

    Returns:
        {"ok": True, "eventos": [...]} em sucesso
        {"ok": False, "error": "...", "code": "..."} em falha
    """
    if not is_enabled():
        return {
            "ok": False,
            "error": "Servico de IA (Gemini) nao configurado. Verifique GEMINI_API_KEY.",
            "code": "ai_disabled",
        }

    client = get_gemini_client()
    if client is None:
        return {"ok": False, "error": "Cliente Gemini indisponivel.", "code": "ai_unavailable"}

    if not file_storage or not getattr(file_storage, "filename", ""):
        return {"ok": False, "error": "Nenhum arquivo enviado.", "code": "no_file"}

    contexto = contexto or {}
    prompt = PROMPT_EXTRACAO.format(
        data_distribuicao=contexto.get("data_distribuicao") or "(nao informada)",
        tipo_acao=contexto.get("tipo_acao") or "(nao informado)",
        vara_juizo=contexto.get("vara_juizo") or "(nao informado)",
    )

    # Salva arquivo temporariamente para upload ao Gemini
    suffix = Path(file_storage.filename).suffix or ".pdf"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        file_storage.stream.seek(0)
        tmp.write(file_storage.stream.read())
        tmp_path = tmp.name

    try:
        uploaded_file = client.files.upload(file=tmp_path)
        model = current_app.config.get("GEMINI_PROCURACAO_MODEL", "gemini-2.5-flash")
        try:
            response = client.models.generate_content(
                model=model,
                contents=[uploaded_file, prompt],
            )
        except Exception as exc:
            msg = str(exc)
            if "429" in msg or "RESOURCE_EXHAUSTED" in msg or "quota" in msg.lower():
                return {
                    "ok": False,
                    "error": "Cota da IA do Google esgotada. Habilite billing em console.cloud.google.com/billing.",
                    "code": "rate_limit",
                }
            if "503" in msg or "UNAVAILABLE" in msg or "overloaded" in msg.lower():
                return {
                    "ok": False,
                    "error": "Servico de IA sobrecarregado. Tente novamente em alguns minutos.",
                    "code": "ai_overloaded",
                }
            current_app.logger.error("Erro Gemini extraindo eventos: %s", msg, exc_info=True)
            return {"ok": False, "error": "Falha ao chamar IA.", "code": "ai_error"}

        raw = (getattr(response, "text", None) or "").strip()
        # Remove markdown fences se a IA insistir
        if raw.startswith("```"):
            raw = raw.split("```", 2)[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
        if raw.endswith("```"):
            raw = raw[:-3].strip()

        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            current_app.logger.warning("IA retornou JSON invalido em eventos: %r", raw[:500])
            return {
                "ok": False,
                "error": "IA retornou resposta nao-JSON. Tente novamente.",
                "code": "parse_error",
            }

        eventos = parsed.get("eventos") if isinstance(parsed, dict) else None
        if not isinstance(eventos, list):
            return {"ok": True, "eventos": []}

        # Sanitiza/normaliza cada evento
        eventos_validos = []
        for ev in eventos:
            if not isinstance(ev, dict):
                continue
            eventos_validos.append(
                {
                    "tipo": (ev.get("tipo") or "outro").strip()[:50],
                    "titulo": (ev.get("titulo") or "Evento sem titulo").strip()[:200],
                    "data": (ev.get("data") or "").strip()[:10],  # YYYY-MM-DD
                    "hora": (ev.get("hora") or "").strip()[:5],  # HH:MM
                    "local": (ev.get("local") or "").strip()[:300],
                    "modalidade": (ev.get("modalidade") or "").strip()[:20],
                    "link": (ev.get("link") or "").strip()[:500],
                    "base_legal": (ev.get("base_legal") or "").strip()[:100],
                    "observacao": (ev.get("observacao") or "").strip()[:1000],
                    "confianca": (ev.get("confianca") or "media").strip()[:10],
                }
            )

        return {"ok": True, "eventos": eventos_validos}
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
