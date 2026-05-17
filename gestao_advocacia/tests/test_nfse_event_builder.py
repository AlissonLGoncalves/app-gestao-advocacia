"""Tests da Etapa 5.6.6.3 — event_builder + cancelamento real.

Valida montagem do XML conforme schema oficial v1.01 (Anexo I do
manual NFS-e Nacional). Inclui tests E2E do gateway.cancelar() e
.cancelar_por_substituicao() com HTTP mockado.
"""

from datetime import datetime, timedelta, timezone
from xml.etree import ElementTree as ET

import pytest
import responses
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID

from models import ConfigNFSe
from nfse.portal_nacional.dps_builder import DPS_NS
from nfse.portal_nacional.event_builder import (
    COD_MOTIVO_CANC_VALIDOS,
    VERSAO_SCHEMA,
    gerar_id_ped_reg_evt,
    montar_pedido_cancelamento,
    montar_pedido_cancelamento_por_substituicao,
)


# ===================== gerar_id_ped_reg_evt =====================


def test_id_ped_reg_evt_formato():
    chave = "1" * 50
    id_ = gerar_id_ped_reg_evt(chave_nfse=chave, tipo_evento=101101, n_ped_reg=1)
    # PRE + chave(50) + tipo(6) + nPed(3) = 3+50+6+3 = 62
    assert len(id_) == 62
    assert id_.startswith("PRE")
    assert id_[3:53] == chave
    assert id_[53:59] == "101101"
    assert id_[59:62] == "001"


def test_id_ped_reg_evt_chave_curta_rejeita():
    with pytest.raises(ValueError, match="50 digitos"):
        gerar_id_ped_reg_evt(chave_nfse="123", tipo_evento=101101, n_ped_reg=1)


def test_id_ped_reg_evt_n_ped_invalido():
    chave = "1" * 50
    with pytest.raises(ValueError, match="1-999"):
        gerar_id_ped_reg_evt(chave_nfse=chave, tipo_evento=101101, n_ped_reg=0)
    with pytest.raises(ValueError, match="1-999"):
        gerar_id_ped_reg_evt(chave_nfse=chave, tipo_evento=101101, n_ped_reg=1000)


# ===================== montar_pedido_cancelamento (e101101) =====================


def test_cancelamento_xml_estrutura_basica():
    """XML montado tem todos os elementos exigidos pelo XSD."""
    chave = "3" * 50
    xml = montar_pedido_cancelamento(
        chave_nfse=chave,
        cod_motivo=1,
        motivo_texto="Erro de digitacao no valor cobrado.",
        documento_autor="12345678000190",
        ambiente="sandbox",
        n_ped_reg=1,
    )
    root = ET.fromstring(xml)
    assert root.tag == f"{{{DPS_NS}}}pedRegEvento"
    assert root.get("versao") == VERSAO_SCHEMA

    inf = root.find(f"{{{DPS_NS}}}infPedReg")
    assert inf is not None
    assert inf.get("Id").startswith("PRE")
    assert inf.findtext(f"{{{DPS_NS}}}tpAmb") == "2"  # sandbox
    assert inf.findtext(f"{{{DPS_NS}}}verAplic") == VERSAO_SCHEMA
    assert inf.find(f"{{{DPS_NS}}}dhEvento").text  # tem TZ -03:00 ou similar
    assert inf.findtext(f"{{{DPS_NS}}}CNPJAutor") == "12345678000190"
    assert inf.findtext(f"{{{DPS_NS}}}chNFSe") == chave

    e = inf.find(f"{{{DPS_NS}}}e101101")
    assert e is not None
    assert e.findtext(f"{{{DPS_NS}}}xDesc") == "Cancelamento de NFS-e"
    assert e.findtext(f"{{{DPS_NS}}}cMotivo") == "1"
    assert "Erro de digitacao" in e.findtext(f"{{{DPS_NS}}}xMotivo")


def test_cancelamento_autor_pf_usa_cpf():
    chave = "9" * 50
    xml = montar_pedido_cancelamento(
        chave_nfse=chave,
        cod_motivo=2,
        motivo_texto="Servico definitivamente nao foi prestado.",
        documento_autor="11122233344",  # CPF (11 digitos)
        ambiente="producao",
        n_ped_reg=5,
    )
    root = ET.fromstring(xml)
    inf = root.find(f"{{{DPS_NS}}}infPedReg")
    assert inf.findtext(f"{{{DPS_NS}}}CPFAutor") == "11122233344"
    assert inf.find(f"{{{DPS_NS}}}CNPJAutor") is None
    assert inf.findtext(f"{{{DPS_NS}}}tpAmb") == "1"  # producao


def test_cancelamento_cod_motivo_invalido_levanta():
    chave = "5" * 50
    with pytest.raises(ValueError, match="cod_motivo"):
        montar_pedido_cancelamento(
            chave_nfse=chave,
            cod_motivo=42,  # invalido
            motivo_texto="Motivo qualquer com mais de 15 caracteres.",
            documento_autor="12345678000190",
            ambiente="sandbox",
            n_ped_reg=1,
        )


def test_cancelamento_motivo_curto_levanta():
    chave = "5" * 50
    with pytest.raises(ValueError, match="15 caracteres"):
        montar_pedido_cancelamento(
            chave_nfse=chave,
            cod_motivo=1,
            motivo_texto="curto",
            documento_autor="12345678000190",
            ambiente="sandbox",
            n_ped_reg=1,
        )


def test_cancelamento_documento_invalido_levanta():
    chave = "5" * 50
    with pytest.raises(ValueError, match="11.*14"):
        montar_pedido_cancelamento(
            chave_nfse=chave,
            cod_motivo=9,
            motivo_texto="Motivo qualquer com mais de 15 caracteres.",
            documento_autor="12345",  # 5 digitos
            ambiente="sandbox",
            n_ped_reg=1,
        )


def test_todos_codigos_motivo_canc_aceitos():
    chave = "5" * 50
    for codigo in COD_MOTIVO_CANC_VALIDOS:
        xml = montar_pedido_cancelamento(
            chave_nfse=chave,
            cod_motivo=codigo,
            motivo_texto="Motivo qualquer suficientemente longo.",
            documento_autor="12345678000190",
            ambiente="sandbox",
            n_ped_reg=1,
        )
        root = ET.fromstring(xml)
        e = root.find(f"{{{DPS_NS}}}infPedReg/{{{DPS_NS}}}e101101")
        assert e.findtext(f"{{{DPS_NS}}}cMotivo") == str(codigo)


# ===================== Cancelamento por Substituicao (e105102) =====================


def test_substituicao_xml_contem_ch_substituta():
    chave = "3" * 50
    subst = "7" * 50
    xml = montar_pedido_cancelamento_por_substituicao(
        chave_nfse=chave,
        chave_substituta=subst,
        cod_motivo=1,
        motivo_texto="Desenquadramento do Simples Nacional este mes.",
        documento_autor="12345678000190",
        ambiente="sandbox",
        n_ped_reg=2,
    )
    root = ET.fromstring(xml)
    e = root.find(f"{{{DPS_NS}}}infPedReg/{{{DPS_NS}}}e105102")
    assert e is not None
    assert "Substituição" in e.findtext(f"{{{DPS_NS}}}xDesc")
    assert e.findtext(f"{{{DPS_NS}}}cMotivo") == "1"
    assert e.findtext(f"{{{DPS_NS}}}chSubstituta") == subst


def test_substituicao_xmotivo_opcional():
    """xMotivo e minOccurs=0 no XSD pra e105102 — omitir deve funcionar."""
    chave = "3" * 50
    subst = "7" * 50
    xml = montar_pedido_cancelamento_por_substituicao(
        chave_nfse=chave,
        chave_substituta=subst,
        cod_motivo=99,
        motivo_texto=None,
        documento_autor="12345678000190",
        ambiente="sandbox",
        n_ped_reg=1,
    )
    root = ET.fromstring(xml)
    e = root.find(f"{{{DPS_NS}}}infPedReg/{{{DPS_NS}}}e105102")
    assert e.find(f"{{{DPS_NS}}}xMotivo") is None
    assert e.findtext(f"{{{DPS_NS}}}chSubstituta") == subst


def test_substituicao_cod_motivo_fora_dominio_levanta():
    with pytest.raises(ValueError, match="cod_motivo"):
        montar_pedido_cancelamento_por_substituicao(
            chave_nfse="1" * 50,
            chave_substituta="2" * 50,
            cod_motivo=50,  # fora de {1,2,3,4,5,99}
            motivo_texto=None,
            documento_autor="12345678000190",
            ambiente="sandbox",
            n_ped_reg=1,
        )


def test_substituicao_chave_substituta_invalida_levanta():
    with pytest.raises(ValueError, match="50 digitos"):
        montar_pedido_cancelamento_por_substituicao(
            chave_nfse="1" * 50,
            chave_substituta="curta",
            cod_motivo=1,
            motivo_texto=None,
            documento_autor="12345678000190",
            ambiente="sandbox",
            n_ped_reg=1,
        )


# ===================== Helpers pros E2E =====================


def _config_com_cert(**overrides):
    """ConfigNFSe completa com cert auto-assinado encriptado."""
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
        "nfse_num_evento_atual": 0,
        "nfse_base_url_homologacao": "https://portal.example.com/api",
        "tem_certificado": True,
        "certificado_pfx_encrypted": criptografar(pfx),
        "certificado_senha_encrypted": criptografar(senha.encode()),
    }
    base.update(overrides)
    return ConfigNFSe(**base)


# ===================== E2E: cancelar() com body correto =====================


def test_cancelar_e2e_envia_pedido_registro_evento_b64(db):
    """Verifica que o body do request tem `pedidoRegistroEventoXmlGZipB64`
    (nao o JSON antigo {tipoEvento, motivo})."""
    from nfse.portal_nacional.gateway import PortalNacionalGateway

    config = _config_com_cert()
    chave = "1" * 50

    body_capturado = {}

    def capturar(request):
        import json

        body_capturado.update(json.loads(request.body))
        return (200, {}, '{"eventoXmlGZipB64": "..."}')

    with responses.RequestsMock() as rsp:
        rsp.add_callback(
            responses.POST,
            f"https://portal.example.com/api/nfse/{chave}/eventos",
            callback=capturar,
            content_type="application/json",
        )
        g = PortalNacionalGateway(config=config)
        res = g.cancelar(
            chave,
            motivo="Erro de digitacao no valor cobrado pelo servico.",
            cod_motivo=1,
        )

    assert res.status == "Cancelada"
    # Body correto: campo do Swagger oficial
    assert "pedidoRegistroEventoXmlGZipB64" in body_capturado
    assert body_capturado["pedidoRegistroEventoXmlGZipB64"]  # nao vazio
    # NAO tem mais o JSON antigo
    assert "tipoEvento" not in body_capturado
    assert "motivo" not in body_capturado


def test_cancelar_e2e_incrementa_contador_de_evento(db):
    """Apos sucesso, nfse_num_evento_atual incrementa em 1."""
    from nfse.portal_nacional.gateway import PortalNacionalGateway

    config = _config_com_cert(nfse_num_evento_atual=5)
    chave = "1" * 50
    with responses.RequestsMock() as rsp:
        rsp.add(
            responses.POST,
            f"https://portal.example.com/api/nfse/{chave}/eventos",
            json={"eventoXmlGZipB64": "..."},
            status=201,
        )
        g = PortalNacionalGateway(config=config)
        g.cancelar(chave, motivo="Motivo qualquer com mais de 15 chars.")

    assert config.nfse_num_evento_atual == 6


def test_cancelar_e2e_400_com_erro_estruturado(db):
    """Portal rejeita com MensagemProcessamento — gateway expoe mensagem."""
    from nfse.portal_nacional.gateway import PortalNacionalGateway

    config = _config_com_cert()
    chave = "1" * 50
    with responses.RequestsMock() as rsp:
        rsp.add(
            responses.POST,
            f"https://portal.example.com/api/nfse/{chave}/eventos",
            status=400,
            json={
                "tipoAmbiente": 2,
                "versaoAplicativo": "1.0",
                "dataHoraProcessamento": "2026-05-17T18:00:00-03:00",
                "erro": {
                    "codigo": "E422",
                    "descricao": "NFS-e fora da janela de cancelamento (24h).",
                    "complemento": "",
                },
            },
        )
        g = PortalNacionalGateway(config=config)
        res = g.cancelar(chave, motivo="Motivo qualquer com mais de 15 chars.")
    assert res.status == "Rejeitada"
    # contador NAO incrementa em caso de falha
    assert config.nfse_num_evento_atual == 0


def test_cancelar_sem_documento_emissor_rejeita(db):
    from nfse.portal_nacional.gateway import PortalNacionalGateway

    config = _config_com_cert(
        documento_emissor=None,
        cnpj_emissor=None,
    )
    g = PortalNacionalGateway(config=config)
    res = g.cancelar(
        "1" * 50, motivo="Motivo qualquer com mais de 15 caracteres."
    )
    assert res.status == "Rejeitada"
    assert "emissor" in res.mensagem_erro.lower()


# ===================== E2E: cancelar_por_substituicao =====================


def test_cancelar_por_substituicao_e2e_sucesso(db):
    from nfse.portal_nacional.gateway import PortalNacionalGateway

    config = _config_com_cert()
    chave = "2" * 50
    subst = "8" * 50

    body_capturado = {}

    def capturar(request):
        import json

        body_capturado.update(json.loads(request.body))
        return (201, {}, '{"eventoXmlGZipB64": "..."}')

    with responses.RequestsMock() as rsp:
        rsp.add_callback(
            responses.POST,
            f"https://portal.example.com/api/nfse/{chave}/eventos",
            callback=capturar,
            content_type="application/json",
        )
        g = PortalNacionalGateway(config=config)
        res = g.cancelar_por_substituicao(
            chave,
            chave_substituta=subst,
            cod_motivo=1,  # Desenquadramento Simples
            motivo_texto="Desenquadramento do Simples Nacional retroativo.",
        )

    assert res.status == "Cancelada"
    assert res.gateway_id == chave
    assert "pedidoRegistroEventoXmlGZipB64" in body_capturado


def test_cancelar_por_substituicao_chave_substituta_invalida_rejeita(db):
    from nfse.portal_nacional.gateway import PortalNacionalGateway

    config = _config_com_cert()
    g = PortalNacionalGateway(config=config)
    res = g.cancelar_por_substituicao(
        "1" * 50,
        chave_substituta="curta",
        cod_motivo=1,
        motivo_texto=None,
    )
    assert res.status == "Rejeitada"
    assert "substituta" in res.mensagem_erro.lower()
