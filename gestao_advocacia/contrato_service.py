"""Extrator de Contratos de Honorarios via Gemini.

Espelha o padrao de procuracao_service.py: recebe um PDF (ou DOCX), envia
ao Gemini com prompt estruturado e retorna JSON com os dados do contrato
prontos para popular ContratoHonorario.
"""

from __future__ import annotations

import json
import shutil
import tempfile
from pathlib import Path
from typing import Any

from flask import current_app

from gemini_service import get_gemini_client
from utils.cpf_cnpj import validate_cpf

_DEFAULT_GEMINI_MODELS = (
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
)


def _strip_json_fences(raw_text: str) -> str:
    text = (raw_text or "").strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


def _response_text(response: Any) -> str:
    text = getattr(response, "text", None)
    if text:
        return text
    candidates = getattr(response, "candidates", None) or []
    for candidate in candidates:
        content = getattr(candidate, "content", None)
        parts = getattr(content, "parts", None) or []
        collected = [getattr(p, "text", None) for p in parts if getattr(p, "text", None)]
        if collected:
            return "\n".join(collected)
    return ""


def _candidate_models() -> list[str]:
    preferred = (current_app.config.get("GEMINI_CONTRATO_MODEL") or "").strip()
    models: list[str] = [preferred] if preferred else []
    for m in _DEFAULT_GEMINI_MODELS:
        if m not in models:
            models.append(m)
    return models


def _is_model_not_found_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    return "not_found" in msg or ("not found" in msg and "models/" in msg)


# CPF/CNPJ validation functions moved to utils/cpf_cnpj.py
# Use: validate_cpf(), extract_digits()


PROMPT = """Voce e um extrator juridico brasileiro de CONTRATOS DE HONORARIOS ADVOCATICIOS.
Analise o arquivo enviado e retorne APENAS JSON valido, sem markdown, sem comentarios e sem texto extra.

Use exatamente esta estrutura:
{
  "contratante": {
    "nome_completo": "",
    "cpf": "",
    "rg": "",
    "nacionalidade": "",
    "estado_civil": "",
    "profissao": "",
    "endereco": {
      "logradouro": "",
      "numero": "",
      "complemento": "",
      "bairro": "",
      "cidade": "",
      "uf": "",
      "cep": ""
    }
  },
  "contratados": [
    {"nome": "", "oab": "", "uf_oab": "", "cpf": ""}
  ],
  "tipo_honorario": "exito|fixo|misto|mensal|horas",
  "valor_total": null,
  "percentual_exito": null,
  "percentual_recurso": null,
  "data_assinatura": "",
  "objeto": "",
  "vigencia_condicao": "",
  "forma_pagamento": "",
  "parcelas": [
    {"numero": 1, "vencimento": "", "valor": null, "descricao": ""}
  ],
  "sucumbencia_para_advogado": null,
  "despesas_por_conta_de": "contratante|contratado|null",
  "foro": "",
  "observacoes": "",
  "assinaturas": {
    "contratante_assinou": null,
    "contratado_assinou": null,
    "tipo_assinatura": "manuscrita|digital_govbr|digital_icp|nenhuma|incerto",
    "evidencias": ""
  }
}

REGRAS:
- valor_total e valores em parcelas: numeros decimais (ex: 1200.00). Sem R$, sem ponto de milhar.
- percentual_exito e percentual_recurso: numeros decimais (ex: 30.0, 5.0). Sem o simbolo %.
- data_assinatura e vencimento: formato ISO YYYY-MM-DD. Se contrato diz "30 dias apos assinatura" e tem data de assinatura, calcule. Se nao houver data de assinatura, deixe vazio.
- tipo_honorario:
  * "exito" = so paga em caso de sucesso (% sobre proveito)
  * "fixo" = valor fixo definido (a vista ou parcelado)
  * "misto" = valor fixo + % de exito
  * "mensal" = honorario mensal de assessoria
  * "horas" = cobranca por hora
- objeto: descricao curta do servico (ex: "Acao de repeticao de indebito", "Acompanhamento consorcio massa falida").
- vigencia_condicao: clausula de termino se diferente de "ate o transito em julgado" (ex: "ate quitacao da cota e baixa do gravame").
- Se algum campo nao estiver presente, retorne string vazia "" (ou null para numericos, [] para listas).
- Se nao houver tabela/lista de parcelas explicita, retorne parcelas: [].
- sucumbencia_para_advogado: true se o contrato diz que sucumbencia pertence ao advogado, false se ao contratante, null se omisso.

DETECCAO DE ASSINATURAS (campo "assinaturas"):
- Examine visualmente o documento procurando por:
  * Assinatura manuscrita a caneta (PDF escaneado): rabisco/firma sobre as linhas dos signatarios
  * Selo digital gov.br: caixa com texto "Documento assinado digitalmente" + nome + data + URL validar.iti.gov.br
  * Selo digital ICP-Brasil: caixa com nome do certificado, validade
- contratante_assinou: true se ha assinatura visivel no campo CONTRATANTE/CLIENTE, false se nao ha, null se incerto
- contratado_assinou: true se ha assinatura visivel no campo CONTRATADO/ADVOGADO, false se nao ha, null se incerto
- tipo_assinatura:
  * "manuscrita" se rabisco/firma a caneta sobre o papel
  * "digital_govbr" se selo gov.br
  * "digital_icp" se selo de outro certificado ICP-Brasil
  * "nenhuma" se nao ha qualquer assinatura (minuta/draft)
  * "incerto" se nao da pra afirmar
- evidencias: cite trechos exatos que comprovam (ex: "selo gov.br: ALISSON LUIZ GONCALVES, Data: 22/04/2026 14:05:10-0300", ou "rabisco a caneta sobre linha CONTRATANTE assinada como 'Carlos Eduardo Marcelino'", ou "linhas de assinatura em branco")
"""


def extrair_dados_contrato(file_path: str) -> dict:
    """Extrai dados estruturados de um PDF/DOCX de contrato de honorarios.

    Retorna dict no formato definido pelo PROMPT. Nao persiste em banco.
    Levanta RuntimeError se Gemini nao configurado ou nenhum modelo funcionar.
    Levanta ValueError se Gemini retornar JSON invalido.
    """
    client = get_gemini_client()
    if client is None:
        raise RuntimeError("Gemini nao configurado")

    # SDK do Gemini quebra com nomes contendo caracteres nao-ASCII no Windows.
    # Copia para um arquivo temporario com nome seguro antes do upload.
    src = Path(file_path)
    suffix = src.suffix or ".bin"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp_path = Path(tmp.name)
    try:
        shutil.copyfile(src, tmp_path)
        uploaded = client.files.upload(file=str(tmp_path))

        response = None
        last_error: Exception | None = None
        for model_name in _candidate_models():
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=[uploaded, PROMPT],
                )
                break
            except Exception as exc:
                last_error = exc
                if _is_model_not_found_error(exc):
                    current_app.logger.warning(
                        "contrato_model_not_found",
                        extra={"event": "contrato_model_not_found", "model": model_name},
                    )
                    continue
                raise

        if response is None:
            raise RuntimeError(
                f"Nenhum modelo Gemini disponivel para extracao de contrato. "
                f"Ultimo erro: {last_error}"
            )

        raw = _strip_json_fences(_response_text(response))
        try:
            return json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Gemini retornou JSON invalido: {raw[:200]}") from exc
    finally:
        try:
            tmp_path.unlink()
        except OSError:
            pass


def validar_extracao(dados: dict) -> tuple[bool, list[str]]:
    """Valida campos minimos. Retorna (ok, lista_de_avisos)."""
    avisos: list[str] = []
    contratante = dados.get("contratante") or {}

    if not (contratante.get("nome_completo") or "").strip():
        avisos.append("Nome do contratante ausente.")

    cpf = contratante.get("cpf")
    if cpf and not validate_cpf(cpf):
        avisos.append("CPF do contratante invalido.")

    tipo = (dados.get("tipo_honorario") or "").lower()
    if tipo not in {"exito", "fixo", "misto", "mensal", "horas", ""}:
        avisos.append(f"tipo_honorario fora do dominio: {tipo}")

    valor = dados.get("valor_total")
    pct = dados.get("percentual_exito")
    if tipo == "fixo" and not valor:
        avisos.append("Contrato fixo sem valor_total.")
    if tipo == "exito" and not pct:
        avisos.append("Contrato ad exito sem percentual_exito.")

    parcelas = dados.get("parcelas") or []
    if valor and parcelas:
        soma = sum(float(p.get("valor") or 0) for p in parcelas)
        if abs(soma - float(valor)) > 0.5:
            avisos.append(
                f"Soma das parcelas ({soma:.2f}) difere do valor_total ({float(valor):.2f})."
            )

    return len(avisos) == 0, avisos
