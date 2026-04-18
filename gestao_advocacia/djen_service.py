# ==============================================================================
# ARQUIVO: gestao_advocacia/djen_service.py
# Cliente HTTP para a ComunicaAPI do CNJ (DJEN - Diário de Justiça Eletrônico Nacional).
#
# Base: https://comunicaapi.pje.jus.br (Swagger 1.0.4, OpenAPI 3.0)
#
# Endpoints públicos cobertos:
#   GET /api/v1/comunicacao             — lista publicações com filtros
#   GET /api/v1/comunicacao/{hash}/certidao — certidão de uma publicação
#   GET /api/v1/comunicacao/tribunal    — lista tribunais disponíveis
#
# Regras do Swagger aplicadas por este módulo:
#   - itensPorPagina aceita apenas 5 ou 100.
#   - meio: "D" (Diário) ou "E" (Edital).
#   - Sem filtros obrigatórios → limita automaticamente a itensPorPagina = 5.
#   - Em HTTP 429, a doc orienta aguardar 1 minuto.
# ==============================================================================
import logging

import requests
from flask import current_app

DJEN_BASE_URL = "https://comunicaapi.pje.jus.br"

ENDPOINT_COMUNICACAO = "/api/v1/comunicacao"
ENDPOINT_CERTIDAO = "/api/v1/comunicacao/{hash}/certidao"
ENDPOINT_TRIBUNAL = "/api/v1/comunicacao/tribunal"

VALID_ITENS_POR_PAGINA = {5, 100}
VALID_MEIO = {"D", "E"}


class DjenAPIError(Exception):
    def __init__(self, message, status_code=None):
        super().__init__(message)
        self.status_code = status_code


class DjenRateLimitError(DjenAPIError):
    """HTTP 429 — rate limit por IP excedido."""


def _get_logger():
    try:
        return current_app.logger
    except Exception:
        return logging.getLogger(__name__)


def _build_session():
    session = requests.Session()
    try:
        version = current_app.config.get("APP_VERSION", "1.0.0")
    except Exception:
        version = "1.0.0"
    session.headers.update(
        {
            "User-Agent": f"AppGestaoAdvocacia/{version} (+DJEN-integration)",
            "Accept": "application/json",
        }
    )
    return session


def _format_date(value):
    if value is None:
        return None
    if hasattr(value, "strftime"):
        return value.strftime("%Y-%m-%d")
    return str(value)


def _request(method, path, *, params=None, timeout=30):
    try:
        base = current_app.config.get("DJEN_API_BASE_URL", DJEN_BASE_URL)
    except Exception:
        base = DJEN_BASE_URL

    url = f"{base}{path}"
    logger = _get_logger()
    session = _build_session()

    try:
        response = session.request(method, url, params=params, timeout=timeout)
    except requests.exceptions.Timeout as e:
        raise DjenAPIError(f"Timeout ao acessar DJEN: {url}") from e
    except requests.exceptions.ConnectionError as e:
        raise DjenAPIError(f"Erro de conexão ao acessar DJEN: {url}") from e
    except requests.exceptions.RequestException as e:
        raise DjenAPIError(f"Erro de requisição DJEN: {e}") from e

    remaining = response.headers.get("x-ratelimit-remaining")
    limit = response.headers.get("x-ratelimit-limit")
    if remaining is not None:
        logger.debug(f"DJEN rate-limit: remaining={remaining} limit={limit}")
        try:
            if int(remaining) <= 2:
                logger.warning(
                    f"DJEN rate-limit quase esgotado (remaining={remaining}). "
                    "Espaçando próximas requisições."
                )
        except ValueError:
            pass

    if response.status_code == 429:
        logger.warning("DJEN retornou HTTP 429 (rate limit). Aguardar 1 minuto.")
        raise DjenRateLimitError("DJEN rate limit excedido (HTTP 429)", status_code=429)

    if response.status_code >= 400:
        text = ""
        try:
            text = (response.text or "")[:500]
        except Exception:
            pass
        raise DjenAPIError(
            f"DJEN retornou HTTP {response.status_code}: {text}",
            status_code=response.status_code,
        )

    return response


def consultar_comunicacoes(
    *,
    numero_processo=None,
    numero_oab=None,
    sigla_tribunal=None,
    nome_advogado=None,
    nome_parte=None,
    texto=None,
    data_inicio=None,
    data_fim=None,
    meio="D",
    pagina=1,
    itens_por_pagina=100,
):
    """Consulta GET /api/v1/comunicacao.

    Se nenhum filtro for informado, itens_por_pagina é forçado para 5
    conforme regra declarada pelo Swagger.
    """
    if itens_por_pagina not in VALID_ITENS_POR_PAGINA:
        itens_por_pagina = 100
    if meio not in VALID_MEIO:
        meio = "D"

    filtros = [numero_processo, numero_oab, sigla_tribunal, nome_advogado, nome_parte, texto]
    if not any(filtros):
        itens_por_pagina = 5

    params = {
        "pagina": pagina,
        "itensPorPagina": itens_por_pagina,
        "meio": meio,
    }
    if numero_processo:
        params["numeroProcesso"] = numero_processo
    if numero_oab:
        params["numeroOab"] = numero_oab
    if sigla_tribunal:
        params["siglaTribunal"] = sigla_tribunal
    if nome_advogado:
        params["nomeAdvogado"] = nome_advogado
    if nome_parte:
        params["nomeParte"] = nome_parte
    if texto:
        params["texto"] = texto
    if data_inicio:
        params["dataDisponibilizacaoInicio"] = _format_date(data_inicio)
    if data_fim:
        params["dataDisponibilizacaoFim"] = _format_date(data_fim)

    response = _request("GET", ENDPOINT_COMUNICACAO, params=params)
    return response.json()


def obter_certidao(hash_comunicacao):
    """Consulta GET /api/v1/comunicacao/{hash}/certidao."""
    path = ENDPOINT_CERTIDAO.format(hash=hash_comunicacao)
    response = _request("GET", path)
    content_type = response.headers.get("content-type", "application/pdf")
    return response.content, content_type


def listar_tribunais():
    """Consulta GET /api/v1/comunicacao/tribunal."""
    response = _request("GET", ENDPOINT_TRIBUNAL)
    return response.json()
