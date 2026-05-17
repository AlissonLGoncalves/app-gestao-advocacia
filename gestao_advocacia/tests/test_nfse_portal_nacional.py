"""Testes da sub-etapa 5.6.1 — PortalNacionalGateway (esqueleto) +
dps_builder. Sem dependencia de certificado A1 ou HTTP real.
"""

from decimal import Decimal
from xml.etree import ElementTree as ET

from models import ConfigNFSe
from nfse.gateway import EmissaoPayload
from nfse.portal_nacional.dps_builder import (
    DPS_NS,
    comprimir_e_codificar,
    decodificar_e_descomprimir,
    gerar_id_dps,
    montar_dps_xml,
)
from nfse.portal_nacional.gateway import PortalNacionalGateway


# ===================== dps_builder =====================


def _payload(**overrides):
    base = {
        "recebimento_id": 1,
        "descricao_servico": "Honorarios advocaticios",
        "valor": 1000.00,
        "cnpj_emissor": "12.345.678/0001-90",
        "inscricao_municipal": "12345",
        "razao_social": "Escritorio Teste",
        "municipio": "Sao Paulo",
        "uf": "SP",
        "codigo_servico": "17.06",
        "regime_tributario": "Simples Nacional",
        "aliquota_iss": 5.00,
        "ambiente": "sandbox",
        "tomador_nome": "Joao da Silva",
        "tomador_documento": "111.222.333-44",
    }
    base.update(overrides)
    return EmissaoPayload(**base)


def _config(**overrides):
    base = {
        "cnpj_emissor": "12345678000190",
        "inscricao_municipal": "12345",
        "codigo_servico": "17.06",
        "codigo_municipio_ibge": "3550308",  # Sao Paulo
        "ambiente": "sandbox",
        "nfse_serie_atual": 1,
        "nfse_numero_atual": 0,
        "tem_certificado": False,
    }
    base.update(overrides)
    return ConfigNFSe(**base)


def test_gerar_id_dps_formato_canonico():
    """id_dps tem prefixo DPS + CNPJ (14) + serie (5) + numero (15)."""
    id_dps = gerar_id_dps(cnpj_emissor="12.345.678/0001-90", serie=1, numero=42)
    assert id_dps == "DPS12345678000190" + "00001" + "000000000000042"
    assert len(id_dps) == 3 + 14 + 5 + 15


def test_gerar_id_dps_cnpj_sem_digitos_usa_zeros():
    id_dps = gerar_id_dps(cnpj_emissor=None, serie=1, numero=1)
    assert id_dps.startswith("DPS00000000000000")


def test_montar_dps_xml_estrutura_minima():
    """XML resultante deve ter os campos minimos do leiaute."""
    payload = _payload()
    config = _config()
    xml = montar_dps_xml(payload, config, serie=1, numero=1)

    # E XML valido e parseavel
    root = ET.fromstring(xml)
    assert root.tag == f"{{{DPS_NS}}}DPS"

    inf = root.find(f"{{{DPS_NS}}}infDPS")
    assert inf is not None
    assert inf.get("Id") == "DPS12345678000190" + "00001" + "000000000000001"

    # Campos obrigatorios presentes
    def t(tag):
        return inf.findtext(f"{{{DPS_NS}}}{tag}")

    assert t("tpAmb") == "2"  # sandbox = homologacao
    assert t("serie") == "1"
    assert t("nDPS") == "1"
    assert t("tpEmit") == "1"
    assert t("cLocEmi") == "3550308"

    prest = inf.find(f"{{{DPS_NS}}}prest")
    assert prest.findtext(f"{{{DPS_NS}}}CNPJ") == "12345678000190"
    assert prest.findtext(f"{{{DPS_NS}}}IM") == "12345"


def test_montar_dps_xml_ambiente_producao():
    config = _config(ambiente="producao")
    xml = montar_dps_xml(_payload(), config, serie=1, numero=1)
    root = ET.fromstring(xml)
    assert root.find(f"{{{DPS_NS}}}infDPS/{{{DPS_NS}}}tpAmb").text == "1"


def test_montar_dps_xml_tomador_pf_e_pj():
    """Documento de 11 digitos vira CPF; de 14, CNPJ."""
    xml_pf = montar_dps_xml(
        _payload(tomador_documento="111.222.333-44"), _config(), serie=1, numero=1
    )
    root = ET.fromstring(xml_pf)
    toma = root.find(f"{{{DPS_NS}}}infDPS/{{{DPS_NS}}}toma")
    assert toma.findtext(f"{{{DPS_NS}}}CPF") == "11122233344"
    assert toma.find(f"{{{DPS_NS}}}CNPJ") is None

    xml_pj = montar_dps_xml(
        _payload(tomador_documento="98.765.432/0001-10"), _config(), serie=1, numero=1
    )
    root = ET.fromstring(xml_pj)
    toma = root.find(f"{{{DPS_NS}}}infDPS/{{{DPS_NS}}}toma")
    assert toma.findtext(f"{{{DPS_NS}}}CNPJ") == "98765432000110"


def test_montar_dps_xml_sem_tomador_omite_bloco():
    """Servico avulso sem tomador identificado nao inclui <toma>."""
    payload = _payload(tomador_nome=None, tomador_documento=None)
    xml = montar_dps_xml(payload, _config(), serie=1, numero=1)
    root = ET.fromstring(xml)
    assert root.find(f"{{{DPS_NS}}}infDPS/{{{DPS_NS}}}toma") is None


def test_montar_dps_xml_valor_e_aliquota_formatados():
    payload = _payload(valor=1234.567, aliquota_iss=5)
    xml = montar_dps_xml(payload, _config(), serie=1, numero=1)
    root = ET.fromstring(xml)
    base = root.find(f"{{{DPS_NS}}}infDPS/{{{DPS_NS}}}valores")
    v_serv = base.find(
        f"{{{DPS_NS}}}vServPrest/{{{DPS_NS}}}vServ"
    )
    assert v_serv.text == "1234.57"  # 2 casas, arredondamento half-up
    p_aliq = base.find(f"{{{DPS_NS}}}trib/{{{DPS_NS}}}tribMun/{{{DPS_NS}}}pAliq")
    assert p_aliq.text == "5.00"


def test_montar_dps_xml_descricao_truncada_em_2000_chars():
    payload = _payload(descricao_servico="A" * 5000)
    xml = montar_dps_xml(payload, _config(), serie=1, numero=1)
    root = ET.fromstring(xml)
    desc = root.find(f"{{{DPS_NS}}}infDPS/{{{DPS_NS}}}serv/{{{DPS_NS}}}descServ")
    assert len(desc.text) == 2000


def test_comprimir_descomprimir_roundtrip():
    """GZip+Base64 deve voltar igual no decode."""
    xml = montar_dps_xml(_payload(), _config(), serie=1, numero=1)
    b64 = comprimir_e_codificar(xml)
    assert isinstance(b64, str)
    # Base64 nao tem caracteres fora do alfabeto
    assert all(c.isalnum() or c in "+/=" for c in b64)
    xml_volta = decodificar_e_descomprimir(b64)
    assert xml_volta == xml


# ===================== PortalNacionalGateway =====================


def test_gateway_falta_cnpj_rejeita():
    g = PortalNacionalGateway(config=_config(cnpj_emissor=None))
    res = g.emitir(_payload(cnpj_emissor=None))
    assert res.status == "Rejeitada"
    assert "CNPJ" in res.mensagem_erro


def test_gateway_falta_codigo_servico_rejeita():
    g = PortalNacionalGateway(config=_config())
    res = g.emitir(_payload(codigo_servico=None))
    assert res.status == "Rejeitada"
    assert "servico" in res.mensagem_erro.lower()


def test_gateway_falta_codigo_municipio_rejeita():
    g = PortalNacionalGateway(config=_config(codigo_municipio_ibge=None))
    res = g.emitir(_payload())
    assert res.status == "Rejeitada"
    assert "IBGE" in res.mensagem_erro


def test_gateway_sem_certificado_rejeita_com_mensagem_clara():
    """Mesmo com tudo configurado, sem cert ainda nao emite (5.6.2 pendente)."""
    g = PortalNacionalGateway(config=_config(tem_certificado=False))
    res = g.emitir(_payload())
    assert res.status == "Rejeitada"
    assert "5.6.2" in res.mensagem_erro or "certificado" in res.mensagem_erro.lower()


def test_gateway_com_cert_falso_monta_dps_mas_ainda_rejeita():
    """Com tem_certificado=True, passa da validacao mas falha em 5.6.3."""
    g = PortalNacionalGateway(config=_config(tem_certificado=True))
    res = g.emitir(_payload())
    # Por enquanto rejeita citando 5.6.2/5.6.3
    assert res.status == "Rejeitada"
    assert "5.6" in res.mensagem_erro


def test_gateway_valor_zero_rejeita():
    g = PortalNacionalGateway(config=_config(tem_certificado=True))
    res = g.emitir(_payload(valor=0))
    assert res.status == "Rejeitada"
    assert "positivo" in res.mensagem_erro.lower()


def test_factory_get_gateway_retorna_portal_nacional():
    from nfse.gateway import get_gateway

    g = get_gateway("portal_nacional", config=_config())
    assert isinstance(g, PortalNacionalGateway)


def test_factory_get_gateway_mock_continua_funcionando():
    """Regressao — adicionar Portal Nacional nao quebrou o mock."""
    from nfse.gateway import MockGateway, get_gateway

    g = get_gateway("mock")
    assert isinstance(g, MockGateway)
