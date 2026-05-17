"""Carregamento de certificado A1 + assinatura XMLDSIG (Etapa 5.6.2).

Funcionalidades:
- `carregar_pfx(pfx_bytes, senha)`: extrai chave privada e certificado
  de um arquivo PKCS#12 (.pfx). Retorna PEMs ou raises ValueError.
- `extrair_metadata_pfx`: pega titular + validade pra UI mostrar.
- `criptografar` / `descriptografar`: Fernet com chave derivada do
  SECRET_KEY do Flask, pra storage em banco.
- `assinar_dps(xml, cert_pem, key_pem)`: aplica XMLDSIG enveloped
  conforme padrao xmldsig-core. signxml lib cuida do C14N + SHA + RSA.

Dependencias: cryptography (PKCS#12, Fernet) e signxml (XMLDSIG).

IMPORTANTE: a chave Fernet vem de NFSE_CERT_ENCRYPTION_KEY ou,
caindo nela, derivada do SECRET_KEY do Flask. Em producao, recomendado
definir NFSE_CERT_ENCRYPTION_KEY explicitamente (base64-encoded 32
bytes) e rotacionar quando trocar.
"""

from __future__ import annotations

import base64
import hashlib
import logging
import os
from datetime import date, datetime
from typing import Any

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.serialization import pkcs12

logger = logging.getLogger(__name__)


def _fernet_key() -> bytes:
    """Deriva chave Fernet de env var ou SECRET_KEY do Flask.

    NFSE_CERT_ENCRYPTION_KEY: base64 urlsafe de 32 bytes (chave Fernet
    direta). Quando ausente, deriva SHA-256 do SECRET_KEY como
    fallback. Em testes (sem app context), aceita SECRET_KEY do env.
    """
    chave = os.environ.get("NFSE_CERT_ENCRYPTION_KEY")
    if chave:
        return chave.encode("utf-8")

    secret = os.environ.get("SECRET_KEY")
    if not secret:
        # Em runtime Flask, pegar do current_app.config se disponivel.
        try:
            from flask import current_app  # noqa: PLC0415

            secret = current_app.config.get("SECRET_KEY")
        except Exception:
            secret = None
    if not secret:
        # Ultimo fallback: chave fixa de DEV (NUNCA usar em prod).
        # Esta chave nao protege nada de verdade — so evita crash em
        # ambientes de teste sem env var configurada.
        secret = "dev-only-insecure-secret-key-rotate-in-prod"
        logger.warning(
            "NFSE_CERT_ENCRYPTION_KEY e SECRET_KEY ausentes — usando "
            "chave de DEV. Configure NFSE_CERT_ENCRYPTION_KEY em prod."
        )

    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def criptografar(plaintext: bytes) -> bytes:
    """Criptografa bytes com Fernet."""
    f = Fernet(_fernet_key())
    return f.encrypt(plaintext)


def descriptografar(ciphertext: bytes) -> bytes:
    """Descriptografa. Raises InvalidToken se chave mudou ou dado corrompido."""
    f = Fernet(_fernet_key())
    return f.decrypt(ciphertext)


# ===================== PFX / PKCS#12 =====================


def carregar_pfx(pfx_bytes: bytes, senha: str) -> tuple[bytes, bytes]:
    """Extrai (chave_privada_pem, certificado_pem) de um .pfx.

    Args:
        pfx_bytes: conteudo binario do arquivo .pfx
        senha: senha do .pfx (string)

    Returns:
        (private_key_pem, cert_pem) — ambos bytes PEM.

    Raises:
        ValueError: pfx invalido ou senha errada.
    """
    try:
        key, cert, _additional = pkcs12.load_key_and_certificates(
            pfx_bytes, senha.encode("utf-8") if senha else None
        )
    except Exception as exc:
        raise ValueError(f"Falha ao carregar PFX (senha ou arquivo invalido): {exc!s}") from exc

    if key is None or cert is None:
        raise ValueError("PFX nao contem certificado ou chave privada.")

    key_pem = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    cert_pem = cert.public_bytes(encoding=serialization.Encoding.PEM)
    return key_pem, cert_pem


def _extrair_documento_do_cn(cn: str) -> tuple[str, str] | tuple[None, None]:
    """Tenta extrair tipo de pessoa + documento do CommonName do cert.

    Formato canonico ICP-Brasil: "NOME DA PESSOA:DOCUMENTO" onde
    DOCUMENTO eh CPF (11) ou CNPJ (14). Retorna (tipo, documento_digitos)
    ou (None, None) se nao conseguir extrair.
    """
    if not cn or ":" not in cn:
        return None, None
    parte_final = cn.rsplit(":", 1)[-1]
    digitos = "".join(c for c in parte_final if c.isdigit())
    if len(digitos) == 11:
        return "PF", digitos
    if len(digitos) == 14:
        return "PJ", digitos
    return None, None


def extrair_metadata_pfx(pfx_bytes: bytes, senha: str) -> dict[str, Any]:
    """Lê titular (CN), validade e tipo/documento do certificado.

    Etapa 5.6.5: extrai tambem tipo_pessoa (PF|PJ) e documento (CPF|CNPJ)
    a partir do CN do certificado pra validacao estrita contra o cadastro
    do tenant. Se nao conseguir parsear, retorna None nos dois campos.
    """
    try:
        _key, cert, _add = pkcs12.load_key_and_certificates(
            pfx_bytes, senha.encode("utf-8") if senha else None
        )
    except Exception as exc:
        raise ValueError(f"PFX invalido: {exc!s}") from exc
    if cert is None:
        raise ValueError("PFX sem certificado.")

    # Subject CN (Common Name) — geralmente "NOME DA EMPRESA:CNPJ"
    nome_titular = None
    for atributo in cert.subject:
        if atributo.oid._name in ("commonName", "common_name"):
            nome_titular = atributo.value
            break

    # cryptography >=42 expoe not_valid_after_utc; tentar e cair pra
    # not_valid_after (deprecado) se nao existir.
    try:
        valido_ate: datetime = cert.not_valid_after_utc
    except AttributeError:
        valido_ate = cert.not_valid_after  # type: ignore[attr-defined]

    tipo_pessoa, documento = _extrair_documento_do_cn(nome_titular or "")

    return {
        "nome_titular": (nome_titular or "")[:300],
        "valido_ate": valido_ate.date() if isinstance(valido_ate, datetime) else None,
        "tipo_pessoa": tipo_pessoa,  # "PF" | "PJ" | None
        "documento": documento,  # digitos puros ou None
    }


# ===================== XMLDSIG =====================


def assinar_dps(xml: str, cert_pem: bytes, key_pem: bytes) -> str:
    """Assina o XML da DPS conforme padrao XMLDSIG enveloped.

    O Portal Nacional exige assinatura sobre o elemento infDPS com:
    - C14N method: Exclusive XML Canonicalization 1.0
    - Digest: SHA-256
    - Signature: RSA-SHA-256

    signxml lib cuida dos detalhes. O resultado e o XML original com
    um elemento <ds:Signature> adicionado dentro de infDPS (enveloped).

    Args:
        xml: string do XML a assinar (sem assinatura).
        cert_pem: bytes PEM do certificado.
        key_pem: bytes PEM da chave privada (sem senha).

    Returns:
        XML assinado como string.
    """
    # Import tardio: signxml carrega lxml e leva uns 100ms. Nao penalizar
    # apps que nao usam NFS-e.
    from lxml import etree  # noqa: PLC0415
    from signxml import SignatureMethod, XMLSigner, methods  # noqa: PLC0415

    root = etree.fromstring(xml.encode("utf-8"))
    signer = XMLSigner(
        method=methods.enveloped,
        signature_algorithm=SignatureMethod.RSA_SHA256,
        digest_algorithm="sha256",
        c14n_algorithm="http://www.w3.org/2001/10/xml-exc-c14n#",
    )
    # Portal espera assinatura referenciando o atributo Id do elemento
    # interno. Tenta infDPS (DPS), infPedReg (Pedido de Evento) e
    # infEvento (Evento) — qual existir.
    elemento_assinavel = None
    for tag in ("infDPS", "infPedReg", "infEvento"):
        elem = root.find(f"{{*}}{tag}")
        if elem is not None and elem.get("Id"):
            elemento_assinavel = elem
            break

    if elemento_assinavel is not None:
        signed = signer.sign(
            root,
            key=key_pem,
            cert=cert_pem,
            reference_uri=f"#{elemento_assinavel.get('Id')}",
        )
    else:
        signed = signer.sign(root, key=key_pem, cert=cert_pem)
    return etree.tostring(signed, encoding="utf-8", xml_declaration=True).decode("utf-8")
