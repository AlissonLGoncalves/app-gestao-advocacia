"""Tests da Etapa 5.6.5 — suporte a emissor PF ou PJ.

Cobre:
- ConfigNFSe aceita tipo_pessoa_emissor + documento_emissor
- Validacao de formato (CPF=11, CNPJ=14)
- DPS XML usa <CPF> ou <CNPJ> conforme tipo
- Upload de cert valida tipo/documento contra cadastro
- Extracao de tipo+documento do CN do certificado
"""

import io
import json
from datetime import datetime, timedelta, timezone
from xml.etree import ElementTree as ET

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID

from models import ConfigNFSe
from nfse.gateway import EmissaoPayload
from nfse.portal_nacional.dps_builder import DPS_NS, montar_dps_xml
from nfse.portal_nacional.signer import _extrair_documento_do_cn, extrair_metadata_pfx


def _pfx(*, cn="ESCRITORIO XYZ:12345678000190", senha="s3nh4"):
    """Gera .pfx auto-assinado com CN custom."""
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, cn)])
    agora = datetime.now(timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(subject)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(agora - timedelta(days=1))
        .not_valid_after(agora + timedelta(days=180))
        .sign(key, hashes.SHA256())
    )
    return pkcs12.serialize_key_and_certificates(
        name=b"t",
        key=key,
        cert=cert,
        cas=None,
        encryption_algorithm=serialization.BestAvailableEncryption(senha.encode()),
    )


# ===================== Extracao do CN =====================


def test_extrair_documento_pj():
    tipo, doc = _extrair_documento_do_cn("ESCRITORIO ABC LTDA:12345678000190")
    assert tipo == "PJ"
    assert doc == "12345678000190"


def test_extrair_documento_pf():
    tipo, doc = _extrair_documento_do_cn("MARIA DA SILVA ADVOGADA:11122233344")
    assert tipo == "PF"
    assert doc == "11122233344"


def test_extrair_documento_cn_sem_colon_devolve_none():
    tipo, doc = _extrair_documento_do_cn("Algum CN qualquer")
    assert tipo is None
    assert doc is None


def test_extrair_documento_cn_com_pontuacao():
    tipo, doc = _extrair_documento_do_cn("Joao:111.222.333-44")
    assert tipo == "PF"
    assert doc == "11122233344"


# ===================== DPS XML emissor PF/PJ =====================


def _payload():
    return EmissaoPayload(
        recebimento_id=1,
        descricao_servico="Honorarios",
        valor=1000,
        cnpj_emissor="anything",
        inscricao_municipal="12345",
        razao_social="X",
        municipio="SP",
        uf="SP",
        codigo_servico="17.06",
        regime_tributario=None,
        aliquota_iss=5,
        ambiente="sandbox",
    )


def _config_pf(documento="11122233344"):
    return ConfigNFSe(
        tipo_pessoa_emissor="PF",
        documento_emissor=documento,
        codigo_servico="17.06",
        codigo_municipio_ibge="3550308",
        ambiente="sandbox",
        nfse_serie_atual=1,
        nfse_numero_atual=0,
    )


def _config_pj(documento="12345678000190"):
    return ConfigNFSe(
        tipo_pessoa_emissor="PJ",
        documento_emissor=documento,
        codigo_servico="17.06",
        codigo_municipio_ibge="3550308",
        ambiente="sandbox",
        nfse_serie_atual=1,
        nfse_numero_atual=0,
    )


def test_dps_xml_emissor_pf_usa_tag_cpf():
    xml = montar_dps_xml(_payload(), _config_pf(), serie=1, numero=1)
    root = ET.fromstring(xml)
    prest = root.find(f"{{{DPS_NS}}}infDPS/{{{DPS_NS}}}prest")
    assert prest.findtext(f"{{{DPS_NS}}}CPF") == "11122233344"
    assert prest.find(f"{{{DPS_NS}}}CNPJ") is None


def test_dps_xml_emissor_pj_usa_tag_cnpj():
    xml = montar_dps_xml(_payload(), _config_pj(), serie=1, numero=1)
    root = ET.fromstring(xml)
    prest = root.find(f"{{{DPS_NS}}}infDPS/{{{DPS_NS}}}prest")
    assert prest.findtext(f"{{{DPS_NS}}}CNPJ") == "12345678000190"
    assert prest.find(f"{{{DPS_NS}}}CPF") is None


def test_dps_id_dps_aceita_cpf_zero_padded():
    """CPF tem 11 digitos; id_dps deve zero-pad pra 14."""
    xml = montar_dps_xml(_payload(), _config_pf(), serie=1, numero=1)
    root = ET.fromstring(xml)
    inf_id = root.find(f"{{{DPS_NS}}}infDPS").get("Id")
    assert inf_id.startswith("DPS")
    # 14 chars de documento (CPF de 11 + 3 zeros a esquerda)
    assert inf_id[3:17] == "00011122233344"


# ===================== extrair_metadata_pfx com PF/PJ =====================


def test_extrair_metadata_pfx_pessoa_juridica():
    pfx_bytes = _pfx(cn="ESCRITORIO ABC LTDA:12345678000190")
    meta = extrair_metadata_pfx(pfx_bytes, "s3nh4")
    assert meta["tipo_pessoa"] == "PJ"
    assert meta["documento"] == "12345678000190"


def test_extrair_metadata_pfx_pessoa_fisica():
    pfx_bytes = _pfx(cn="MARIA ADVOGADA:11122233344")
    meta = extrair_metadata_pfx(pfx_bytes, "s3nh4")
    assert meta["tipo_pessoa"] == "PF"
    assert meta["documento"] == "11122233344"


def test_extrair_metadata_pfx_cn_sem_documento():
    """Cert nao-ICP com CN sem documento — campos viram None."""
    pfx_bytes = _pfx(cn="Algum Cert Generico")
    meta = extrair_metadata_pfx(pfx_bytes, "s3nh4")
    assert meta["tipo_pessoa"] is None
    assert meta["documento"] is None


# ===================== Endpoint PUT /nfse/config =====================


def test_config_aceita_pf_com_cpf_valido(auth_client, db):
    resp = auth_client.put(
        "/api/v1/nfse/config",
        json={
            "tipo_pessoa_emissor": "PF",
            "documento_emissor": "111.222.333-44",
            "codigo_servico": "17.06",
            "ambiente": "sandbox",
            "gateway_tipo": "mock",
        },
    )
    assert resp.status_code == 200, resp.data
    data = json.loads(resp.data)
    assert data["tipo_pessoa_emissor"] == "PF"
    assert data["documento_emissor"] == "11122233344"
    assert data["cnpj_emissor"] is None  # alias so populado pra PJ


def test_config_aceita_pj_com_cnpj_valido(auth_client, db):
    resp = auth_client.put(
        "/api/v1/nfse/config",
        json={
            "tipo_pessoa_emissor": "PJ",
            "documento_emissor": "12.345.678/0001-90",
            "codigo_servico": "17.06",
            "ambiente": "sandbox",
            "gateway_tipo": "mock",
        },
    )
    assert resp.status_code == 200
    data = json.loads(resp.data)
    assert data["tipo_pessoa_emissor"] == "PJ"
    assert data["documento_emissor"] == "12345678000190"
    assert data["cnpj_emissor"] == "12345678000190"  # alias sincronizado


def test_config_pf_com_cnpj_retorna_400(auth_client, db):
    """PF nao pode mandar 14 digitos."""
    resp = auth_client.put(
        "/api/v1/nfse/config",
        json={
            "tipo_pessoa_emissor": "PF",
            "documento_emissor": "12345678000190",  # 14 digitos
            "codigo_servico": "17.06",
            "ambiente": "sandbox",
            "gateway_tipo": "mock",
        },
    )
    assert resp.status_code == 400
    assert b"CPF" in resp.data


def test_config_pj_com_cpf_retorna_400(auth_client, db):
    resp = auth_client.put(
        "/api/v1/nfse/config",
        json={
            "tipo_pessoa_emissor": "PJ",
            "documento_emissor": "11122233344",  # 11 digitos
            "codigo_servico": "17.06",
            "ambiente": "sandbox",
            "gateway_tipo": "mock",
        },
    )
    assert resp.status_code == 400
    assert b"CNPJ" in resp.data


def test_config_tipo_pessoa_invalido_retorna_400(auth_client, db):
    resp = auth_client.put(
        "/api/v1/nfse/config",
        json={"tipo_pessoa_emissor": "XX"},
    )
    assert resp.status_code == 400


# ===================== Upload de cert com validacao estrita =====================


def test_upload_cert_pj_para_cadastro_pj_aceita(auth_client, db):
    # Configura como PJ com CNPJ X
    auth_client.put(
        "/api/v1/nfse/config",
        json={
            "tipo_pessoa_emissor": "PJ",
            "documento_emissor": "12345678000190",
            "codigo_servico": "17.06",
        },
    )
    # Upload de e-CNPJ com mesmo CNPJ
    pfx_bytes = _pfx(cn="ESCRITORIO X:12345678000190")
    resp = auth_client.post(
        "/api/v1/nfse/certificado",
        data={
            "arquivo": (io.BytesIO(pfx_bytes), "cert.pfx"),
            "senha": "s3nh4",
        },
        content_type="multipart/form-data",
    )
    assert resp.status_code == 201, resp.data
    body = json.loads(resp.data)
    assert body["tem_certificado"] is True


def test_upload_cert_pf_para_cadastro_pj_rejeita(auth_client, db):
    """PJ cadastrado mas advogado tenta subir e-CPF — bloqueia."""
    auth_client.put(
        "/api/v1/nfse/config",
        json={
            "tipo_pessoa_emissor": "PJ",
            "documento_emissor": "12345678000190",
            "codigo_servico": "17.06",
        },
    )
    pfx_bytes = _pfx(cn="MARIA:11122233344")
    resp = auth_client.post(
        "/api/v1/nfse/certificado",
        data={
            "arquivo": (io.BytesIO(pfx_bytes), "cert.pfx"),
            "senha": "s3nh4",
        },
        content_type="multipart/form-data",
    )
    assert resp.status_code == 400
    assert b"nao bate" in resp.data or b"PF" in resp.data


def test_upload_cert_documento_diferente_rejeita(auth_client, db):
    """Tipo bate mas CNPJ do cert nao bate com cadastro."""
    auth_client.put(
        "/api/v1/nfse/config",
        json={
            "tipo_pessoa_emissor": "PJ",
            "documento_emissor": "12345678000190",
            "codigo_servico": "17.06",
        },
    )
    pfx_bytes = _pfx(cn="OUTRO ESCRITORIO:99888777000166")
    resp = auth_client.post(
        "/api/v1/nfse/certificado",
        data={
            "arquivo": (io.BytesIO(pfx_bytes), "cert.pfx"),
            "senha": "s3nh4",
        },
        content_type="multipart/form-data",
    )
    assert resp.status_code == 400
    assert b"nao bate" in resp.data or b"99888777000166" in resp.data
