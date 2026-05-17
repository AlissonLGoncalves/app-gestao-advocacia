"""Cliente HTTP mTLS para o Portal Nacional NFS-e (Etapa 5.6.3).

Encapsula a complexidade de autenticar com cert ICP-Brasil + tratar
respostas do portal. Usa `requests` lib com par cert/key em arquivos
temporarios (deletados ao fim) porque a API do `requests` exige paths.

URLs default vem da pesquisa em https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/apis-prod-restrita-e-producao
e do consenso de blogs de integradores (NotaGateway, TecnoSpeed, NDD).
"""

from __future__ import annotations

import logging
import os
import tempfile
import time

import requests

logger = logging.getLogger(__name__)


# URLs base oficiais do Portal Nacional NFS-e.
# SEFIN: emissao + eventos + consulta (este modulo).
# ADN: DANFSe + Parametros Municipais (servicos separados).
# Fontes: Swagger oficial + https://www.gov.br/nfse/.../apis-prod-restrita-e-producao
URL_BASE_HOMOLOGACAO = "https://sefin.producaorestrita.nfse.gov.br/SefinNacional"
URL_BASE_PRODUCAO = "https://sefin.nfse.gov.br/SefinNacional"

# ADN (Ambiente de Dados Nacional) — onde ficam DANFSe e Parametros Municipais.
URL_ADN_HOMOLOGACAO = "https://adn.producaorestrita.nfse.gov.br"
URL_ADN_PRODUCAO = "https://adn.nfse.gov.br"

# Timeouts (segundos). Anexo do manual recomenda 30s pra emissao.
TIMEOUT_PADRAO = 30

# Retry: tentativas pro erro temporario (5xx, timeout). Backoff
# exponencial com jitter pequeno.
MAX_TENTATIVAS = 3
BACKOFF_BASE = 0.5  # segundos


def resolver_adn_url(config) -> str:
    """Base URL do ADN (DANFSe + Parametros Municipais). Diferente da
    SEFIN porque sao servicos separados (host diferente, sem mTLS no
    DANFSe). Override via env var NFSE_ADN_URL_PRODUCAO/HOMOLOGACAO."""
    ambiente = (getattr(config, "ambiente", None) or "sandbox").lower()
    if ambiente == "producao":
        return os.environ.get("NFSE_ADN_URL_PRODUCAO", "").rstrip("/") or URL_ADN_PRODUCAO
    return os.environ.get("NFSE_ADN_URL_HOMOLOGACAO", "").rstrip("/") or URL_ADN_HOMOLOGACAO


def resolver_base_url(config) -> str:
    """Resolve URL base a partir da config + env vars + defaults."""
    ambiente = (config.ambiente or "sandbox").lower()
    if ambiente == "producao":
        return (
            (config.nfse_base_url_producao or "").rstrip("/")
            or os.environ.get("NFSE_BASE_URL_PRODUCAO", "").rstrip("/")
            or URL_BASE_PRODUCAO
        )
    return (
        (config.nfse_base_url_homologacao or "").rstrip("/")
        or os.environ.get("NFSE_BASE_URL_HOMOLOGACAO", "").rstrip("/")
        or URL_BASE_HOMOLOGACAO
    )


class PortalNacionalHTTPError(Exception):
    """Resposta HTTP do Portal com status != 2xx."""

    def __init__(self, status_code: int, body: str):
        super().__init__(f"Portal Nacional respondeu {status_code}: {body[:500]}")
        self.status_code = status_code
        self.body = body


def _temp_pem_files(cert_pem: bytes, key_pem: bytes) -> tuple[str, str]:
    """Escreve cert+key em arquivos temporarios pra requests usar.

    Returns (cert_path, key_path). Caller deve deletar.
    """
    cert_fd, cert_path = tempfile.mkstemp(suffix=".pem", prefix="nfse-cert-")
    key_fd, key_path = tempfile.mkstemp(suffix=".pem", prefix="nfse-key-")
    try:
        os.write(cert_fd, cert_pem)
        os.write(key_fd, key_pem)
    finally:
        os.close(cert_fd)
        os.close(key_fd)
    # Restringir permissoes em sistemas POSIX (no Windows e best-effort).
    try:
        os.chmod(cert_path, 0o600)
        os.chmod(key_path, 0o600)
    except OSError:
        pass
    return cert_path, key_path


def _limpar_temp_files(*paths: str) -> None:
    for p in paths:
        try:
            os.unlink(p)
        except OSError:
            pass


def _eh_erro_retryavel(status_code: int) -> bool:
    """5xx e 429 — vale tentar de novo com backoff."""
    return status_code == 429 or 500 <= status_code < 600


def request_com_mtls(
    method: str,
    url: str,
    *,
    cert_pem: bytes,
    key_pem: bytes,
    json_body: dict | None = None,
    headers: dict | None = None,
    timeout: int = TIMEOUT_PADRAO,
) -> requests.Response:
    """Faz request HTTP com autenticacao mTLS via cert ICP-Brasil A1.

    Args:
        method: GET, POST, etc.
        url: URL completa do endpoint.
        cert_pem: bytes do certificado PEM (publico).
        key_pem: bytes da chave privada PEM (sem senha).
        json_body: corpo JSON (opcional).
        headers: headers adicionais (Content-Type/Accept ja sao adicionados).
        timeout: timeout em segundos.

    Returns:
        Response do requests.

    Raises:
        PortalNacionalHTTPError: status >= 400 apos retries esgotados.
        requests.RequestException: erro de rede irrecuperavel.
    """
    cert_path, key_path = _temp_pem_files(cert_pem, key_pem)
    try:
        headers_final = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if headers:
            headers_final.update(headers)

        ultima_excecao: Exception | None = None
        for tentativa in range(1, MAX_TENTATIVAS + 1):
            try:
                resp = requests.request(
                    method,
                    url,
                    json=json_body,
                    headers=headers_final,
                    cert=(cert_path, key_path),
                    timeout=timeout,
                )
                if 200 <= resp.status_code < 300:
                    return resp
                if not _eh_erro_retryavel(resp.status_code):
                    raise PortalNacionalHTTPError(resp.status_code, resp.text)
                # Retryavel: log e continua pra proxima tentativa.
                logger.warning(
                    "NFS-e portal %s %s -> %d (tentativa %d/%d). Retry com backoff.",
                    method,
                    url,
                    resp.status_code,
                    tentativa,
                    MAX_TENTATIVAS,
                )
                ultima_excecao = PortalNacionalHTTPError(resp.status_code, resp.text)
            except (requests.Timeout, requests.ConnectionError) as exc:
                logger.warning(
                    "NFS-e portal %s %s timeout/connection (tentativa %d/%d): %s",
                    method,
                    url,
                    tentativa,
                    MAX_TENTATIVAS,
                    exc,
                )
                ultima_excecao = exc

            # Backoff exponencial: 0.5s, 1s, 2s...
            if tentativa < MAX_TENTATIVAS:
                time.sleep(BACKOFF_BASE * (2 ** (tentativa - 1)))

        # Retries esgotados — propaga a ultima.
        if isinstance(ultima_excecao, Exception):
            raise ultima_excecao
        raise RuntimeError("request_com_mtls: falha sem excecao registrada")
    finally:
        _limpar_temp_files(cert_path, key_path)
