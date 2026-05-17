"""Tests do signer (XMLDSIG + carregar pfx + criptografia).

Usa certificado auto-assinado gerado no proprio test pra exercitar a
logica sem precisar de A1 real ICP-Brasil.
"""

from datetime import datetime, timedelta, timezone

import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID

from nfse.portal_nacional.signer import (
    assinar_dps,
    carregar_pfx,
    criptografar,
    descriptografar,
    extrair_metadata_pfx,
)


@pytest.fixture
def pfx_autoassinado():
    """Gera .pfx auto-assinado pra testes. Retorna (pfx_bytes, senha)."""
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = issuer = x509.Name(
        [
            x509.NameAttribute(NameOID.COMMON_NAME, "ESCRITORIO TESTE LTDA:12345678000190"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Escritorio Teste"),
            x509.NameAttribute(NameOID.COUNTRY_NAME, "BR"),
        ]
    )
    agora = datetime.now(timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(agora - timedelta(days=1))
        .not_valid_after(agora + timedelta(days=365))
        .sign(key, hashes.SHA256())
    )
    senha = "senha-teste-123"
    pfx_bytes = pkcs12.serialize_key_and_certificates(
        name=b"teste",
        key=key,
        cert=cert,
        cas=None,
        encryption_algorithm=serialization.BestAvailableEncryption(senha.encode("utf-8")),
    )
    return pfx_bytes, senha


# ===================== Criptografia Fernet =====================


def test_criptografar_descriptografar_roundtrip():
    plaintext = b"dado super secreto do certificado"
    cipher = criptografar(plaintext)
    assert cipher != plaintext
    assert descriptografar(cipher) == plaintext


def test_criptografar_strings_unicode():
    plaintext = "senha com acentuação: çãáé".encode("utf-8")
    cipher = criptografar(plaintext)
    assert descriptografar(cipher).decode("utf-8") == "senha com acentuação: çãáé"


# ===================== PFX =====================


def test_carregar_pfx_extrai_key_e_cert(pfx_autoassinado):
    pfx_bytes, senha = pfx_autoassinado
    key_pem, cert_pem = carregar_pfx(pfx_bytes, senha)
    assert b"BEGIN PRIVATE KEY" in key_pem or b"BEGIN RSA PRIVATE KEY" in key_pem
    assert b"BEGIN CERTIFICATE" in cert_pem


def test_carregar_pfx_senha_errada_levanta(pfx_autoassinado):
    pfx_bytes, _senha = pfx_autoassinado
    with pytest.raises(ValueError):
        carregar_pfx(pfx_bytes, "senha-errada")


def test_carregar_pfx_arquivo_invalido_levanta():
    with pytest.raises(ValueError):
        carregar_pfx(b"isso nao e um pfx valido", "qualquer")


def test_extrair_metadata_pega_titular_e_validade(pfx_autoassinado):
    pfx_bytes, senha = pfx_autoassinado
    meta = extrair_metadata_pfx(pfx_bytes, senha)
    assert "ESCRITORIO TESTE" in meta["nome_titular"]
    assert "12345678000190" in meta["nome_titular"]  # CNPJ no CN
    assert meta["valido_ate"] is not None


# ===================== XMLDSIG =====================


def test_assinar_dps_adiciona_signature(pfx_autoassinado):
    """XML assinado deve conter elemento Signature do namespace XMLDSIG."""
    pfx_bytes, senha = pfx_autoassinado
    key_pem, cert_pem = carregar_pfx(pfx_bytes, senha)

    xml = (
        '<?xml version="1.0" encoding="utf-8"?>'
        '<DPS xmlns="http://www.sped.fazenda.gov.br/nfse">'
        '<infDPS Id="DPS123">'
        "<tpAmb>2</tpAmb>"
        "<serie>1</serie>"
        "<nDPS>1</nDPS>"
        "</infDPS>"
        "</DPS>"
    )
    assinado = assinar_dps(xml, cert_pem=cert_pem, key_pem=key_pem)
    assert "Signature" in assinado
    assert "SignatureValue" in assinado
    # Reference ao Id
    assert "DPS123" in assinado


def test_assinar_dps_xml_invalido_levanta(pfx_autoassinado):
    pfx_bytes, senha = pfx_autoassinado
    key_pem, cert_pem = carregar_pfx(pfx_bytes, senha)
    with pytest.raises(Exception):
        assinar_dps("nao e xml valido", cert_pem=cert_pem, key_pem=key_pem)
