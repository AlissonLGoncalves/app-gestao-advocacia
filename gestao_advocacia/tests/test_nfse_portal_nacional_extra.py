"""Tests da Etapa 5.6.6.2 — novos endpoints alinhados ao Swagger:
- emitir_decisao_judicial (POST /decisao-judicial/nfse)
- consultar_evento (GET /nfse/{chave}/eventos/{tipo}/{seq})
- Tratamento explicito de 401/403/404/422
- resolver_adn_url + _danfse_url usando constantes
"""

from datetime import datetime, timedelta, timezone

import responses
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID

from models import ConfigNFSe
from nfse.portal_nacional.http_client import (
    URL_ADN_HOMOLOGACAO,
    URL_ADN_PRODUCAO,
    resolver_adn_url,
)

# ===================== resolver_adn_url =====================


class _FakeConfig:
    def __init__(self, ambiente="sandbox"):
        self.ambiente = ambiente


def test_resolver_adn_url_homologacao():
    assert resolver_adn_url(_FakeConfig("sandbox")) == URL_ADN_HOMOLOGACAO


def test_resolver_adn_url_producao():
    assert resolver_adn_url(_FakeConfig("producao")) == URL_ADN_PRODUCAO


def test_resolver_adn_url_override_env(monkeypatch):
    monkeypatch.setenv("NFSE_ADN_URL_PRODUCAO", "https://custom-adn.example.com/")
    assert (
        resolver_adn_url(_FakeConfig("producao"))
        == "https://custom-adn.example.com"
    )


# ===================== _danfse_url usa ADN agora =====================


def test_danfse_url_usa_adn_homologacao():
    from nfse.portal_nacional.gateway import _danfse_url

    cfg = _FakeConfig("sandbox")
    url = _danfse_url("12345", cfg)
    assert url == f"{URL_ADN_HOMOLOGACAO}/danfse/12345"


def test_danfse_url_usa_adn_producao():
    from nfse.portal_nacional.gateway import _danfse_url

    cfg = _FakeConfig("producao")
    url = _danfse_url("99999", cfg)
    assert url == f"{URL_ADN_PRODUCAO}/danfse/99999"


# ===================== Helpers =====================


def _config_com_cert(**overrides):
    """Gera ConfigNFSe com cert auto-assinado encriptado."""
    from nfse.portal_nacional.signer import criptografar

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = x509.Name(
        [x509.NameAttribute(NameOID.COMMON_NAME, "TESTE:12345678000190")]
    )
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
    senha = "s3nh4"
    pfx = pkcs12.serialize_key_and_certificates(
        name=b"t",
        key=key,
        cert=cert,
        cas=None,
        encryption_algorithm=serialization.BestAvailableEncryption(senha.encode()),
    )
    base = {
        "tipo_pessoa_emissor": "PJ",
        "documento_emissor": "12345678000190",
        "codigo_servico": "17.06",
        "codigo_municipio_ibge": "3550308",
        "ambiente": "sandbox",
        "gateway_tipo": "portal_nacional",
        "nfse_serie_atual": 1,
        "nfse_numero_atual": 0,
        "nfse_base_url_homologacao": "https://portal.example.com/api",
        "tem_certificado": True,
        "certificado_pfx_encrypted": criptografar(pfx),
        "certificado_senha_encrypted": criptografar(senha.encode()),
    }
    base.update(overrides)
    return ConfigNFSe(**base)


def _nfse_xml_b64(numero="100", serie="1", codverif="ABC"):
    from nfse.portal_nacional.dps_builder import comprimir_e_codificar

    xml = (
        f'<?xml version="1.0" encoding="utf-8"?>'
        f'<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse">'
        f"<infNFSe><nNFSe>{numero}</nNFSe><serie>{serie}</serie>"
        f"<codVerif>{codverif}</codVerif></infNFSe></NFSe>"
    )
    return comprimir_e_codificar(xml)


# ===================== emitir_decisao_judicial =====================


def test_decisao_judicial_sem_cert_rejeita(db):
    from nfse.portal_nacional.gateway import PortalNacionalGateway

    config = _config_com_cert(tem_certificado=False, certificado_pfx_encrypted=None)
    g = PortalNacionalGateway(config=config)
    res = g.emitir_decisao_judicial("<xml/>")
    assert res.status == "Rejeitada"
    assert "certificado" in res.mensagem_erro.lower()


def test_decisao_judicial_xml_vazio_rejeita(db):
    from nfse.portal_nacional.gateway import PortalNacionalGateway

    config = _config_com_cert()
    g = PortalNacionalGateway(config=config)
    res = g.emitir_decisao_judicial("")
    assert res.status == "Rejeitada"
    assert "vazio" in res.mensagem_erro.lower()


def test_decisao_judicial_e2e_sucesso(db):
    from nfse.portal_nacional.gateway import PortalNacionalGateway

    config = _config_com_cert()
    chave = "7" * 50
    with responses.RequestsMock() as rsp:
        rsp.add(
            responses.POST,
            "https://portal.example.com/api/decisao-judicial/nfse",
            json={
                "tipoAmbiente": 2,
                "versaoAplicativo": "1.0",
                "dataHoraProcessamento": "2026-05-17T15:00:00-03:00",
                "idDps": "DJ-001",
                "chaveAcesso": chave,
                "nfseXmlGZipB64": _nfse_xml_b64(numero="555", codverif="JUDXYZ"),
            },
            status=201,
        )
        g = PortalNacionalGateway(config=config)
        res = g.emitir_decisao_judicial(
            '<?xml version="1.0"?><NFSe><dummy/></NFSe>'
        )

    assert res.status == "Autorizada"
    assert res.gateway_id == chave
    assert res.numero_nfse == "555"
    assert res.codigo_verificacao == "JUDXYZ"
    # pdf_url aponta pro ADN (nao pro portal mockado)
    assert res.pdf_url.startswith(URL_ADN_HOMOLOGACAO)
    assert chave in res.pdf_url


def test_decisao_judicial_e2e_400_com_erros(db):
    from nfse.portal_nacional.gateway import PortalNacionalGateway

    config = _config_com_cert()
    with responses.RequestsMock() as rsp:
        rsp.add(
            responses.POST,
            "https://portal.example.com/api/decisao-judicial/nfse",
            status=400,
            json={
                "tipoAmbiente": 2,
                "versaoAplicativo": "1.0",
                "dataHoraProcessamento": "2026-05-17T15:00:00-03:00",
                "idDPS": "DJ-001",
                "erros": [
                    {
                        "codigo": "E101",
                        "descricao": "Documento NFSe nao bate com decisao judicial.",
                        "complemento": "",
                    }
                ],
            },
        )
        g = PortalNacionalGateway(config=config)
        res = g.emitir_decisao_judicial("<xml/>")

    assert res.status == "Rejeitada"
    assert "E101" in res.mensagem_erro


# ===================== consultar_evento =====================


def test_consultar_evento_chave_curta_rejeita(db):
    from nfse.portal_nacional.gateway import PortalNacionalGateway

    g = PortalNacionalGateway(config=_config_com_cert())
    res = g.consultar_evento("123", 101101, 1)
    assert res.status == "Rejeitada"
    assert "50" in res.mensagem_erro


def test_consultar_evento_tipo_invalido_rejeita(db):
    from nfse.portal_nacional.gateway import PortalNacionalGateway

    g = PortalNacionalGateway(config=_config_com_cert())
    res = g.consultar_evento("5" * 50, 999999, 1)
    assert res.status == "Rejeitada"
    assert "enum" in res.mensagem_erro.lower() or "999999" in res.mensagem_erro


def test_consultar_evento_num_seq_invalido_rejeita(db):
    from nfse.portal_nacional.gateway import PortalNacionalGateway

    g = PortalNacionalGateway(config=_config_com_cert())
    res = g.consultar_evento("5" * 50, 101101, 0)
    assert res.status == "Rejeitada"
    assert "num_seq" in res.mensagem_erro.lower()


def test_consultar_evento_e2e_sucesso(db):
    from nfse.portal_nacional.dps_builder import comprimir_e_codificar
    from nfse.portal_nacional.gateway import PortalNacionalGateway

    config = _config_com_cert()
    chave = "3" * 50
    evento_b64 = comprimir_e_codificar(
        "<?xml version='1.0'?><evento><tpEvento>101101</tpEvento></evento>"
    )
    with responses.RequestsMock() as rsp:
        rsp.add(
            responses.GET,
            f"https://portal.example.com/api/nfse/{chave}/eventos/101101/1",
            json={
                "tipoAmbiente": 2,
                "versaoAplicativo": "1.0",
                "dataHoraProcessamento": "2026-05-17T15:00:00-03:00",
                "eventoXmlGZipB64": evento_b64,
            },
            status=200,
        )
        g = PortalNacionalGateway(config=config)
        res = g.consultar_evento(chave, 101101, 1)

    assert res.status == "Autorizada"
    assert res.gateway_id == chave


def test_consultar_evento_404(db):
    from nfse.portal_nacional.gateway import PortalNacionalGateway

    config = _config_com_cert()
    chave = "4" * 50
    with responses.RequestsMock() as rsp:
        rsp.add(
            responses.GET,
            f"https://portal.example.com/api/nfse/{chave}/eventos/101101/1",
            status=404,
            json={
                "tipoAmbiente": 2,
                "versaoAplicativo": "1.0",
                "dataHoraProcessamento": "2026-05-17T15:00:00-03:00",
                "erro": {
                    "codigo": "E404",
                    "descricao": "Evento nao encontrado",
                    "complemento": "",
                },
            },
        )
        g = PortalNacionalGateway(config=config)
        res = g.consultar_evento(chave, 101101, 1)

    assert res.status == "Rejeitada"
    assert "404" in res.mensagem_erro or "encontrado" in res.mensagem_erro.lower()


# ===================== Tratamento explicito de 401/403 =====================


def test_consultar_status_401_devolve_mensagem_clara(db):
    from nfse.portal_nacional.gateway import PortalNacionalGateway

    config = _config_com_cert()
    chave = "1" * 50
    with responses.RequestsMock() as rsp:
        rsp.add(
            responses.GET,
            f"https://portal.example.com/api/nfse/{chave}",
            status=401,
            json={
                "tipoAmbiente": 2,
                "versaoAplicativo": "1.0",
                "dataHoraProcessamento": "2026-05-17T15:00:00-03:00",
                "erro": {
                    "codigo": "E401",
                    "descricao": "Certificado expirado",
                    "complemento": "",
                },
            },
        )
        g = PortalNacionalGateway(config=config)
        res = g.consultar_status(chave)

    assert res.status == "Rejeitada"
    assert "autorizado" in res.mensagem_erro.lower() or "permiss" in res.mensagem_erro.lower()
    assert "E401" in res.mensagem_erro


def test_consultar_status_403_devolve_mensagem_clara(db):
    from nfse.portal_nacional.gateway import PortalNacionalGateway

    config = _config_com_cert()
    chave = "1" * 50
    with responses.RequestsMock() as rsp:
        rsp.add(
            responses.GET,
            f"https://portal.example.com/api/nfse/{chave}",
            status=403,
            body="forbidden",
        )
        g = PortalNacionalGateway(config=config)
        res = g.consultar_status(chave)

    assert res.status == "Rejeitada"
    assert "403" in res.mensagem_erro or "negado" in res.mensagem_erro.lower()


def test_consultar_evento_422_violou_regra_negocio(db):
    from nfse.portal_nacional.gateway import PortalNacionalGateway

    config = _config_com_cert()
    chave = "1" * 50
    with responses.RequestsMock() as rsp:
        rsp.add(
            responses.GET,
            f"https://portal.example.com/api/nfse/{chave}/eventos/101101/1",
            status=422,
            json={
                "tipoAmbiente": 2,
                "versaoAplicativo": "1.0",
                "dataHoraProcessamento": "2026-05-17T15:00:00-03:00",
                "erro": {
                    "codigo": "E422",
                    "descricao": "Prazo de cancelamento expirado",
                    "complemento": "24h",
                },
            },
        )
        g = PortalNacionalGateway(config=config)
        res = g.consultar_evento(chave, 101101, 1)

    assert res.status == "Rejeitada"
    assert "regra" in res.mensagem_erro.lower() or "422" in res.mensagem_erro
    assert "Prazo" in res.mensagem_erro or "expirado" in res.mensagem_erro.lower()
