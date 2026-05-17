"""Tests do http_client (mTLS, retry, parsing).

Usa `responses` lib pra mockar o Portal Nacional. Cobre sucesso,
retries em 5xx/timeout, erro permanente, e validacao de URLs.
"""

import requests
import responses
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509 import CertificateBuilder, Name, NameAttribute
from cryptography.x509.oid import NameOID
from datetime import datetime, timedelta, timezone

import pytest

from nfse.portal_nacional.http_client import (
    PortalNacionalHTTPError,
    URL_BASE_HOMOLOGACAO,
    URL_BASE_PRODUCAO,
    request_com_mtls,
    resolver_base_url,
)


@pytest.fixture
def cert_e_key_pem():
    """Gera par cert+key auto-assinado pra usar nos requests."""
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = Name([NameAttribute(NameOID.COMMON_NAME, "test")])
    agora = datetime.now(timezone.utc)
    cert = (
        CertificateBuilder()
        .subject_name(subject)
        .issuer_name(subject)
        .public_key(key.public_key())
        .serial_number(1)
        .not_valid_before(agora - timedelta(days=1))
        .not_valid_after(agora + timedelta(days=30))
        .sign(key, hashes.SHA256())
    )
    cert_pem = cert.public_bytes(serialization.Encoding.PEM)
    key_pem = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    return cert_pem, key_pem


class _FakeConfig:
    def __init__(self, ambiente="sandbox", homol=None, prod=None):
        self.ambiente = ambiente
        self.nfse_base_url_homologacao = homol
        self.nfse_base_url_producao = prod


# ===================== resolver_base_url =====================


def test_resolver_url_sandbox_default():
    assert resolver_base_url(_FakeConfig("sandbox")) == URL_BASE_HOMOLOGACAO


def test_resolver_url_producao_default():
    assert resolver_base_url(_FakeConfig("producao")) == URL_BASE_PRODUCAO


def test_resolver_url_sandbox_override_da_config():
    cfg = _FakeConfig("sandbox", homol="https://custom.example.com/api/")
    assert resolver_base_url(cfg) == "https://custom.example.com/api"


def test_resolver_url_strip_trailing_slash():
    cfg = _FakeConfig("producao", prod="https://x.gov.br///")
    # Deve remover so as barras finais
    assert resolver_base_url(cfg).endswith("gov.br")


# ===================== request_com_mtls =====================


@responses.activate
def test_request_sucesso_200(cert_e_key_pem):
    cert, key = cert_e_key_pem
    responses.add(
        responses.POST,
        "https://portal.example.com/nfse",
        json={"chaveAcesso": "abc123"},
        status=200,
    )
    resp = request_com_mtls(
        "POST",
        "https://portal.example.com/nfse",
        cert_pem=cert,
        key_pem=key,
        json_body={"a": 1},
    )
    assert resp.status_code == 200
    assert resp.json()["chaveAcesso"] == "abc123"


@responses.activate
def test_request_retry_em_500_ate_sucesso(cert_e_key_pem):
    cert, key = cert_e_key_pem
    # Primeira tentativa 500, segunda 200
    responses.add(responses.POST, "https://x.example/nfse", status=500, body="boom")
    responses.add(responses.POST, "https://x.example/nfse", json={"ok": True}, status=200)

    resp = request_com_mtls(
        "POST", "https://x.example/nfse", cert_pem=cert, key_pem=key, json_body={}
    )
    assert resp.status_code == 200
    assert len(responses.calls) == 2


@responses.activate
def test_request_4xx_nao_retry_levanta(cert_e_key_pem):
    cert, key = cert_e_key_pem
    responses.add(
        responses.POST,
        "https://x.example/nfse",
        status=400,
        body='{"erro": "DPS invalida"}',
    )
    with pytest.raises(PortalNacionalHTTPError) as exc:
        request_com_mtls(
            "POST", "https://x.example/nfse", cert_pem=cert, key_pem=key, json_body={}
        )
    assert exc.value.status_code == 400
    assert "DPS invalida" in exc.value.body
    # 4xx nao retentou
    assert len(responses.calls) == 1


@responses.activate
def test_request_429_retry(cert_e_key_pem):
    cert, key = cert_e_key_pem
    responses.add(responses.GET, "https://x.example/y", status=429)
    responses.add(responses.GET, "https://x.example/y", status=429)
    responses.add(responses.GET, "https://x.example/y", status=200, json={"ok": 1})

    resp = request_com_mtls("GET", "https://x.example/y", cert_pem=cert, key_pem=key)
    assert resp.status_code == 200
    assert len(responses.calls) == 3


@responses.activate
def test_request_5xx_persistente_levanta(cert_e_key_pem):
    cert, key = cert_e_key_pem
    for _ in range(5):
        responses.add(responses.POST, "https://x.example/n", status=503, body="down")

    with pytest.raises(PortalNacionalHTTPError) as exc:
        request_com_mtls(
            "POST", "https://x.example/n", cert_pem=cert, key_pem=key, json_body={}
        )
    assert exc.value.status_code == 503
    # 3 tentativas
    assert len(responses.calls) == 3


@responses.activate
def test_request_connection_error_retry(cert_e_key_pem):
    cert, key = cert_e_key_pem
    responses.add(
        responses.POST,
        "https://x.example/n",
        body=requests.ConnectionError("timeout"),
    )
    responses.add(responses.POST, "https://x.example/n", json={"ok": 1}, status=200)
    resp = request_com_mtls(
        "POST", "https://x.example/n", cert_pem=cert, key_pem=key, json_body={}
    )
    assert resp.status_code == 200
    assert len(responses.calls) == 2
