"""Testes da sub-etapa 5.6.1 — PortalNacionalGateway (esqueleto) +
dps_builder. Sem dependencia de certificado A1 ou HTTP real.
"""

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
    v_serv = base.find(f"{{{DPS_NS}}}vServPrest/{{{DPS_NS}}}vServ")
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
    """Sem flag tem_certificado, pede pro user fazer upload."""
    g = PortalNacionalGateway(config=_config(tem_certificado=False))
    res = g.emitir(_payload())
    assert res.status == "Rejeitada"
    assert "upload" in res.mensagem_erro.lower() or "certificado" in res.mensagem_erro.lower()


def test_gateway_com_flag_mas_sem_pfx_no_banco_rejeita():
    """Flag tem_certificado=True mas certificado_pfx_encrypted None — incoerente."""
    g = PortalNacionalGateway(config=_config(tem_certificado=True, certificado_pfx_encrypted=None))
    res = g.emitir(_payload())
    assert res.status == "Rejeitada"
    assert "banco" in res.mensagem_erro.lower() or "reenvie" in res.mensagem_erro.lower()


def test_gateway_valor_zero_rejeita():
    g = PortalNacionalGateway(config=_config(tem_certificado=True, certificado_pfx_encrypted=b"x"))
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


# ===================== Integracao end-to-end (cert auto-assinado + HTTP mock) =====================


def _pfx_de_teste():
    """Helper: gera .pfx auto-assinado e criptografa pra config fake."""
    from datetime import datetime, timedelta, timezone

    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.primitives.serialization import pkcs12
    from cryptography.x509.oid import NameOID

    from nfse.portal_nacional.signer import criptografar

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "TESTE:12345678000190")])
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
    return criptografar(pfx), criptografar(senha.encode())


def _nfse_xml_b64_mockada(numero="42", serie="1", cod_verif="ABC12345"):
    """Constroi um nfseXmlGZipB64 fake pro mock — XML simples que o
    extrair_dados_nfse consegue parsear."""
    from nfse.portal_nacional.dps_builder import comprimir_e_codificar

    xml = (
        f'<?xml version="1.0" encoding="utf-8"?>'
        f'<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse">'
        f"<infNFSe>"
        f"<nNFSe>{numero}</nNFSe>"
        f"<serie>{serie}</serie>"
        f"<codVerif>{cod_verif}</codVerif>"
        f"<dhEmi>2026-05-17T15:00:00-03:00</dhEmi>"
        f"</infNFSe>"
        f"</NFSe>"
    )
    return comprimir_e_codificar(xml)


def test_emitir_e2e_sucesso_com_http_mock(db):
    """Fluxo completo: monta DPS → assina → comprime → POST mockado → parseia.

    Resposta do mock segue o NFSePostResponseSucesso do Swagger oficial.
    """
    import responses

    from nfse.portal_nacional.gateway import PortalNacionalGateway

    pfx_enc, senha_enc = _pfx_de_teste()
    config = _config(
        tem_certificado=True,
        certificado_pfx_encrypted=pfx_enc,
        certificado_senha_encrypted=senha_enc,
        nfse_base_url_homologacao="https://portal.example.com/SefinNacional",
    )

    chave = "3" * 50  # 50 digitos como exige Swagger
    with responses.RequestsMock() as rsp:
        rsp.add(
            responses.POST,
            "https://portal.example.com/SefinNacional/nfse",
            json={
                "tipoAmbiente": 2,
                "versaoAplicativo": "1.0",
                "dataHoraProcessamento": "2026-05-17T15:00:00-03:00",
                "idDps": "DPS123",
                "chaveAcesso": chave,
                "nfseXmlGZipB64": _nfse_xml_b64_mockada(),
            },
            status=201,
        )

        g = PortalNacionalGateway(config=config)
        res = g.emitir(_payload())

    assert res.status == "Autorizada"
    assert res.gateway_id == chave
    # Numero/serie/codverif vem do XML embutido em nfseXmlGZipB64
    assert res.numero_nfse == "42"
    assert res.serie == "1"
    assert res.codigo_verificacao == "ABC12345"
    # pdf_url e construida apontando pro ADN
    assert res.pdf_url.startswith("https://adn.")
    assert chave in res.pdf_url


def test_emitir_e2e_com_alertas_ainda_autoriza(db):
    """Resposta de sucesso com alertas[] — gateway autoriza mas passa
    a mensagem do alerta como aviso."""
    import responses

    from nfse.portal_nacional.gateway import PortalNacionalGateway

    pfx_enc, senha_enc = _pfx_de_teste()
    config = _config(
        tem_certificado=True,
        certificado_pfx_encrypted=pfx_enc,
        certificado_senha_encrypted=senha_enc,
        nfse_base_url_homologacao="https://portal.example.com/api",
    )
    chave = "1" * 50
    with responses.RequestsMock() as rsp:
        rsp.add(
            responses.POST,
            "https://portal.example.com/api/nfse",
            json={
                "tipoAmbiente": 2,
                "versaoAplicativo": "1.0",
                "dataHoraProcessamento": "2026-05-17T15:00:00-03:00",
                "idDps": "DPS999",
                "chaveAcesso": chave,
                "nfseXmlGZipB64": _nfse_xml_b64_mockada(),
                "alertas": [
                    {
                        "codigo": "A001",
                        "descricao": "Aliquota arredondada",
                        "complemento": "",
                    }
                ],
            },
            status=201,
        )
        g = PortalNacionalGateway(config=config)
        res = g.emitir(_payload())
    assert res.status == "Autorizada"
    assert "A001" in (res.mensagem_erro or "")
    assert "Aliquota" in (res.mensagem_erro or "")


def test_emitir_e2e_portal_rejeita_400_com_mensagens(db):
    """Portal devolve 400 com erros estruturados (MensagemProcessamento)."""
    import responses

    from nfse.portal_nacional.gateway import PortalNacionalGateway

    pfx_enc, senha_enc = _pfx_de_teste()
    config = _config(
        tem_certificado=True,
        certificado_pfx_encrypted=pfx_enc,
        certificado_senha_encrypted=senha_enc,
        nfse_base_url_homologacao="https://portal.example.com/api",
    )

    with responses.RequestsMock() as rsp:
        rsp.add(
            responses.POST,
            "https://portal.example.com/api/nfse",
            status=400,
            json={
                "tipoAmbiente": 2,
                "versaoAplicativo": "1.0",
                "dataHoraProcessamento": "2026-05-17T15:00:00-03:00",
                "idDPS": "DPS-X",
                "erros": [
                    {
                        "codigo": "E0042",
                        "descricao": "Codigo de servico invalido para o municipio.",
                        "complemento": "cTribNac=17.06",
                    }
                ],
            },
        )
        g = PortalNacionalGateway(config=config)
        res = g.emitir(_payload())

    assert res.status == "Rejeitada"
    # Codigo + descricao + complemento aparecem na mensagem
    assert "E0042" in res.mensagem_erro
    assert "servico invalido" in res.mensagem_erro
    assert "17.06" in res.mensagem_erro


def test_emitir_e2e_5xx_persistente(db):
    """3 tentativas 503 -> Rejeitada com mensagem do portal."""
    import responses

    from nfse.portal_nacional import http_client
    from nfse.portal_nacional.gateway import PortalNacionalGateway

    pfx_enc, senha_enc = _pfx_de_teste()
    config = _config(
        tem_certificado=True,
        certificado_pfx_encrypted=pfx_enc,
        certificado_senha_encrypted=senha_enc,
        nfse_base_url_homologacao="https://portal.example.com/api",
    )

    # Acelera o test: sem backoff
    original_base = http_client.BACKOFF_BASE
    http_client.BACKOFF_BASE = 0
    try:
        with responses.RequestsMock(assert_all_requests_are_fired=False) as rsp:
            for _ in range(5):
                rsp.add(
                    responses.POST,
                    "https://portal.example.com/api/nfse",
                    status=503,
                    body="down",
                )
            g = PortalNacionalGateway(config=config)
            res = g.emitir(_payload())
    finally:
        http_client.BACKOFF_BASE = original_base

    assert res.status == "Rejeitada"
    assert "503" in res.mensagem_erro


def test_cancelar_motivo_curto_rejeita(db):
    from nfse.portal_nacional.gateway import PortalNacionalGateway

    pfx_enc, senha_enc = _pfx_de_teste()
    config = _config(
        tem_certificado=True,
        certificado_pfx_encrypted=pfx_enc,
        certificado_senha_encrypted=senha_enc,
    )
    g = PortalNacionalGateway(config=config)
    # Chave valida (50 digitos), motivo curto
    res = g.cancelar("5" * 50, motivo="curto")
    assert res.status == "Rejeitada"
    assert "15" in res.mensagem_erro


def test_cancelar_e2e_sucesso(db):
    import responses

    from nfse.portal_nacional.gateway import PortalNacionalGateway

    pfx_enc, senha_enc = _pfx_de_teste()
    config = _config(
        tem_certificado=True,
        certificado_pfx_encrypted=pfx_enc,
        certificado_senha_encrypted=senha_enc,
        nfse_base_url_homologacao="https://portal.example.com/api",
    )
    chave = "2" * 50
    with responses.RequestsMock() as rsp:
        rsp.add(
            responses.POST,
            f"https://portal.example.com/api/nfse/{chave}/eventos",
            json={"ok": True},
            status=200,
        )
        g = PortalNacionalGateway(config=config)
        res = g.cancelar(
            chave,
            motivo="Cancelamento solicitado pelo cliente em 17/05/2026.",
        )

    assert res.status == "Cancelada"
    assert res.gateway_id == chave


def test_consultar_status_chave_curta_rejeita(db):
    from nfse.portal_nacional.gateway import PortalNacionalGateway

    pfx_enc, senha_enc = _pfx_de_teste()
    config = _config(
        tem_certificado=True,
        certificado_pfx_encrypted=pfx_enc,
        certificado_senha_encrypted=senha_enc,
    )
    g = PortalNacionalGateway(config=config)
    res = g.consultar_status("12345")  # so 5 digitos
    assert res.status == "Rejeitada"
    assert "50" in res.mensagem_erro


def test_cancelar_chave_curta_rejeita(db):
    from nfse.portal_nacional.gateway import PortalNacionalGateway

    pfx_enc, senha_enc = _pfx_de_teste()
    config = _config(
        tem_certificado=True,
        certificado_pfx_encrypted=pfx_enc,
        certificado_senha_encrypted=senha_enc,
    )
    g = PortalNacionalGateway(config=config)
    res = g.cancelar(
        "12345",  # so 5 digitos
        motivo="Motivo qualquer com mais de 15 caracteres aqui",
    )
    assert res.status == "Rejeitada"
    assert "50" in res.mensagem_erro


def test_dps_ja_processada_retorna_true_em_200(db):
    """HEAD /dps/{id} retorna 200 -> True."""
    import responses

    from nfse.portal_nacional.gateway import PortalNacionalGateway

    pfx_enc, senha_enc = _pfx_de_teste()
    config = _config(
        tem_certificado=True,
        certificado_pfx_encrypted=pfx_enc,
        certificado_senha_encrypted=senha_enc,
        nfse_base_url_homologacao="https://portal.example.com/api",
    )
    with responses.RequestsMock() as rsp:
        rsp.add(
            responses.HEAD,
            "https://portal.example.com/api/dps/DPS-XYZ",
            status=200,
        )
        g = PortalNacionalGateway(config=config)
        assert g.dps_ja_processada("DPS-XYZ") is True


def test_dps_ja_processada_retorna_false_em_404(db):
    import responses

    from nfse.portal_nacional.gateway import PortalNacionalGateway

    pfx_enc, senha_enc = _pfx_de_teste()
    config = _config(
        tem_certificado=True,
        certificado_pfx_encrypted=pfx_enc,
        certificado_senha_encrypted=senha_enc,
        nfse_base_url_homologacao="https://portal.example.com/api",
    )
    with responses.RequestsMock() as rsp:
        rsp.add(
            responses.HEAD,
            "https://portal.example.com/api/dps/DPS-NAO-EXISTE",
            status=404,
        )
        g = PortalNacionalGateway(config=config)
        assert g.dps_ja_processada("DPS-NAO-EXISTE") is False


def test_consultar_dps_retorna_chave_acesso(db):
    """GET /dps/{id} retorna chaveAcesso -> recupera info pra retomar."""
    import responses

    from nfse.portal_nacional.gateway import PortalNacionalGateway

    pfx_enc, senha_enc = _pfx_de_teste()
    config = _config(
        tem_certificado=True,
        certificado_pfx_encrypted=pfx_enc,
        certificado_senha_encrypted=senha_enc,
        nfse_base_url_homologacao="https://portal.example.com/api",
    )
    chave = "9" * 50
    with responses.RequestsMock() as rsp:
        rsp.add(
            responses.GET,
            "https://portal.example.com/api/dps/DPS-ABC",
            json={
                "tipoAmbiente": 2,
                "versaoAplicativo": "1.0",
                "dataHoraProcessamento": "2026-05-17T15:00:00-03:00",
                "idDps": "DPS-ABC",
                "chaveAcesso": chave,
            },
            status=200,
        )
        g = PortalNacionalGateway(config=config)
        res = g.consultar_dps("DPS-ABC")
    assert res.status == "Autorizada"
    assert res.gateway_id == chave
    assert res.pdf_url and chave in res.pdf_url


def test_consultar_dps_404_devolve_rejeitada(db):
    import responses

    from nfse.portal_nacional.gateway import PortalNacionalGateway

    pfx_enc, senha_enc = _pfx_de_teste()
    config = _config(
        tem_certificado=True,
        certificado_pfx_encrypted=pfx_enc,
        certificado_senha_encrypted=senha_enc,
        nfse_base_url_homologacao="https://portal.example.com/api",
    )
    with responses.RequestsMock() as rsp:
        rsp.add(
            responses.GET,
            "https://portal.example.com/api/dps/DPS-NAO-EXISTE",
            status=404,
            json={
                "tipoAmbiente": 2,
                "versaoAplicativo": "1.0",
                "dataHoraProcessamento": "2026-05-17T15:00:00-03:00",
                "erro": {"codigo": "E404", "descricao": "DPS nao encontrada"},
            },
        )
        g = PortalNacionalGateway(config=config)
        res = g.consultar_dps("DPS-NAO-EXISTE")
    assert res.status == "Rejeitada"
    assert "nao foi enviada" in res.mensagem_erro.lower()


# ===================== extrair_dados_nfse =====================


def test_extrair_dados_nfse_parseia_xml_padrao(db):
    from nfse.portal_nacional.dps_builder import extrair_dados_nfse

    xml = (
        '<?xml version="1.0" encoding="utf-8"?>'
        '<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse">'
        "<infNFSe>"
        "<nNFSe>100</nNFSe>"
        "<serie>2</serie>"
        "<codVerif>XYZ123</codVerif>"
        "</infNFSe>"
        "</NFSe>"
    )
    dados = extrair_dados_nfse(xml)
    assert dados["numero_nfse"] == "100"
    assert dados["serie"] == "2"
    assert dados["codigo_verificacao"] == "XYZ123"


def test_extrair_dados_nfse_xml_invalido_devolve_dict_vazio(db):
    from nfse.portal_nacional.dps_builder import extrair_dados_nfse

    assert extrair_dados_nfse("nao e xml") == {}


def test_formatar_mensagens_swagger_schema():
    """Formata MensagemProcessamento (codigo+descricao+complemento)."""
    from nfse.portal_nacional.gateway import _formatar_mensagens

    txt = _formatar_mensagens(
        [
            {
                "codigo": "E001",
                "descricao": "Erro grave",
                "complemento": "campo X",
            },
            {"codigo": "W099", "descricao": "Aviso menor", "complemento": ""},
        ]
    )
    assert "[E001]" in txt
    assert "Erro grave" in txt
    assert "campo X" in txt
    assert "[W099]" in txt
    assert "Aviso menor" in txt
    # Pipe separa os 2
    assert "|" in txt


def test_formatar_mensagens_sem_codigo_so_descricao():
    from nfse.portal_nacional.gateway import _formatar_mensagens

    txt = _formatar_mensagens([{"descricao": "So texto"}])
    assert txt == "So texto"


def test_formatar_mensagens_lista_vazia():
    from nfse.portal_nacional.gateway import _formatar_mensagens

    assert _formatar_mensagens([]) == ""
