import json
import re
from typing import Any

from flask import current_app
from flask_jwt_extended import get_jwt_identity

from extensions import db
from gemini_service import get_gemini_client
from models import User

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
        collected = []
        for part in parts:
            part_text = getattr(part, "text", None)
            if part_text:
                collected.append(part_text)
        if collected:
            return "\n".join(collected)
    return ""


def _candidate_models() -> list[str]:
    preferred_model = (current_app.config.get("GEMINI_PROCURACAO_MODEL") or "").strip()
    models: list[str] = [preferred_model] if preferred_model else []
    for model in _DEFAULT_GEMINI_MODELS:
        if model not in models:
            models.append(model)
    return models


def _is_model_not_found_error(exc: Exception) -> bool:
    message = str(exc)
    lowered = message.lower()
    return "not_found" in lowered or ("not found" in lowered and "models/" in lowered)


def _only_digits(value: str | None) -> str:
    return re.sub(r"\D", "", value or "")


def _is_valid_cpf(value: str | None) -> bool:
    digits = _only_digits(value)
    if len(digits) != 11 or digits == digits[0] * 11:
        return False

    total = sum(int(digits[index]) * (10 - index) for index in range(9))
    mod = (total * 10) % 11
    first = 0 if mod == 10 else mod
    if first != int(digits[9]):
        return False

    total = sum(int(digits[index]) * (11 - index) for index in range(10))
    mod = (total * 10) % 11
    second = 0 if mod == 10 else mod
    return second == int(digits[10])


def _is_valid_cnpj(value: str | None) -> bool:
    digits = _only_digits(value)
    if len(digits) != 14 or digits == digits[0] * 14:
        return False

    def calc(base: str, pesos: list[int]) -> int:
        total = sum(int(num) * peso for num, peso in zip(base, pesos))
        resto = total % 11
        return 0 if resto < 2 else 11 - resto

    first = calc(digits[:12], [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
    second = calc(digits[:12] + str(first), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
    return digits[-2:] == f"{first}{second}"


def _is_valid_cnj(value: str | None) -> bool:
    return bool(re.fullmatch(r"\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}", value or ""))


def _is_valid_cep(value: str | None) -> bool:
    return bool(re.fullmatch(r"\d{5}-?\d{3}", value or ""))


def _advogado_contexto() -> dict[str, str | None]:
    user_id = get_jwt_identity()
    if not user_id:
        return {"nome": None, "oab": None, "uf_oab": None}

    user = db.session.get(User, user_id)
    if not user:
        return {"nome": None, "oab": None, "uf_oab": None}

    return {
        "nome": getattr(user, "nome_completo", None) or user.username,
        "oab": getattr(user, "numero_oab", None),
        "uf_oab": getattr(user, "sigla_oab_tribunal", None),
    }


def extrair_dados_procuracao(file_path, mime_type) -> dict:
    del mime_type

    client = get_gemini_client()
    if client is None:
        raise RuntimeError("Gemini não configurado")

    uploaded_file = client.files.upload(file=file_path)
    advogado = _advogado_contexto()
    prompt = f"""
Você é um extrator jurídico brasileiro de procurações.
Analise o arquivo enviado e retorne APENAS JSON válido, sem markdown, sem comentários e sem texto extra.

Use exatamente esta estrutura:
{{
  "outorgante": {{
    "nome_completo": "",
    "cpf_cnpj": "",
    "tipo_pessoa": "PF|PJ",
    "nacionalidade": "",
    "estado_civil": "",
    "profissao": "",
    "rg": "",
    "endereco": {{
      "logradouro": "",
      "numero": "",
      "complemento": "",
      "bairro": "",
      "cidade": "",
      "uf": "",
      "cep": ""
    }},
    "telefone": "",
    "email": "",
    "representante_legal": {{
      "nome": "",
      "cpf": "",
      "cargo": ""
    }}
  }},
  "outorgado": {{
    "nome": "",
    "oab": "",
    "uf_oab": ""
  }},
  "processo": {{
    "numero_cnj": "",
    "tribunal": "",
    "vara": ""
  }},
  "objeto_procuracao": ""
}}

Se algum campo não estiver presente, retorne string vazia.

REGRAS ESPECÍFICAS PARA PESSOA JURÍDICA (PJ):
- Quando outorgante é PJ, "representante_legal" deve conter dados da pessoa
  física que assina em nome da empresa (geralmente sócio, administrador,
  diretor, presidente). Procure por frases como "neste ato representada por",
  "por seu administrador/sócio/diretor", etc.
- "cargo" pode ser: "Sócio Administrador", "Diretor Presidente",
  "Procurador", "Representante Legal", etc.

Contexto do advogado responsável no sistema:
- nome: {advogado.get("nome") or ""}
- oab: {advogado.get("oab") or ""}
- uf_oab: {advogado.get("uf_oab") or ""}
"""

    response = None
    last_error = None
    for model_name in _candidate_models():
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=[uploaded_file, prompt],
            )
            break
        except Exception as exc:
            last_error = exc
            if _is_model_not_found_error(exc):
                current_app.logger.warning(
                    "procuracao_model_not_found",
                    extra={
                        "event": "procuracao_model_not_found",
                        "model": model_name,
                    },
                )
                continue
            raise

    if response is None:
        raise RuntimeError(
            "Nenhum modelo Gemini disponível para análise de procuração. "
            f"Último erro: {last_error}"
        )

    raw_text = _strip_json_fences(_response_text(response))

    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise ValueError("Gemini retornou JSON inválido") from exc

    outorgado = data.setdefault("outorgado", {})
    if not outorgado.get("nome") and advogado.get("nome"):
        outorgado["nome"] = advogado["nome"]
    if not outorgado.get("oab") and advogado.get("oab"):
        outorgado["oab"] = advogado["oab"]
    if not outorgado.get("uf_oab") and advogado.get("uf_oab"):
        outorgado["uf_oab"] = advogado["uf_oab"]

    return data


def validar_extracao(dados: dict) -> tuple[bool, list[str]]:
    avisos = []
    outorgante = dados.get("outorgante") or {}
    processo = dados.get("processo") or {}
    endereco = outorgante.get("endereco") or {}

    cpf_cnpj = outorgante.get("cpf_cnpj")
    tipo_pessoa = (outorgante.get("tipo_pessoa") or "").upper()

    if cpf_cnpj:
        if tipo_pessoa == "PF" and not _is_valid_cpf(cpf_cnpj):
            avisos.append("CPF do outorgante inválido.")
        elif tipo_pessoa == "PJ" and not _is_valid_cnpj(cpf_cnpj):
            avisos.append("CNPJ do outorgante inválido.")
        elif tipo_pessoa not in {"PF", "PJ"}:
            avisos.append("Tipo de pessoa do outorgante ausente ou inválido.")

    numero_cnj = processo.get("numero_cnj")
    if numero_cnj and not _is_valid_cnj(numero_cnj):
        avisos.append("Número do processo fora do padrão CNJ.")

    cep = endereco.get("cep")
    if cep and not _is_valid_cep(cep):
        avisos.append("CEP do outorgante inválido.")

    email = outorgante.get("email")
    if email and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        avisos.append("Email do outorgante inválido.")

    telefone = _only_digits(outorgante.get("telefone"))
    if telefone and len(telefone) not in {10, 11}:
        avisos.append("Telefone do outorgante inválido.")

    # Validacoes de representante legal (apenas para PJ)
    if tipo_pessoa == "PJ":
        representante = outorgante.get("representante_legal") or {}
        rep_cpf = representante.get("cpf")
        if rep_cpf and not _is_valid_cpf(rep_cpf):
            avisos.append("CPF do representante legal inválido.")

    return len(avisos) == 0, avisos
