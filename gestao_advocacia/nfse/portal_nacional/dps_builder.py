"""Montagem da DPS (Declaracao de Prestacao de Servico) para o Portal Nacional.

A DPS e o documento que o contribuinte envia ao Portal — vira NFS-e
apos autorizacao. Estrutura baseada no Anexo I do "Manual do Sistema
Nacional NFS-e - Emissor Publico (v1.2 out/2025)" do gov.br.

Esta implementacao 5.6.1 monta o XML **sem assinatura** — a assinatura
XMLDSIG sera adicionada na sub-etapa 5.6.2. Tambem nao chama HTTP
ainda (5.6.3).

IMPORTANTE: a estrutura abaixo segue o que esta documentado nos
manuais publicos e nos blogs de integradores (NotaGateway, NDD,
TecnoSpeed). Antes de submeter em producao, o XML resultante DEVE
ser validado contra o XSD oficial baixado da Biblioteca Tecnica do
Portal (LeiautesRN_DPS_NFSe-SNNFSe.xsd). Veja TODOs no codigo.
"""

from __future__ import annotations

import base64
import gzip
from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal
from xml.etree import ElementTree as ET

# Namespace oficial da DPS. TODO 5.6.2: confirmar valor exato ao
# validar contra XSD oficial.
DPS_NS = "http://www.sped.fazenda.gov.br/nfse"


def _format_decimal(valor, casas=2) -> str:
    """Formata Decimal/float com casas fixas, ponto como separador."""
    if valor is None:
        return "0.00"
    if isinstance(valor, Decimal):
        d = valor
    else:
        d = Decimal(str(valor))
    quant = Decimal("1." + "0" * casas)
    return str(d.quantize(quant, rounding=ROUND_HALF_UP))


def _format_competencia(d: date | datetime | None) -> str:
    """Competencia no formato YYYY-MM (campo dCompet)."""
    if d is None:
        d = date.today()
    if isinstance(d, datetime):
        d = d.date()
    return d.strftime("%Y-%m")


def _so_digitos(s: str | None) -> str | None:
    """Remove tudo que nao for digito (util pra CNPJ/CPF/IM)."""
    if s is None:
        return None
    return "".join(c for c in s if c.isdigit()) or None


def gerar_id_dps(*, cnpj_emissor: str, serie: int, numero: int) -> str:
    """Chave de idempotencia da DPS. Formato:
    `DPS{DOCUMENTO}{SERIE:5}{NUMERO:15}` onde DOCUMENTO e CPF (11) ou
    CNPJ (14), zero-padded a esquerda pra 14 chars.

    Nome do parametro mantido como `cnpj_emissor` por compat retroativa
    mas aceita qualquer string de digitos (CPF ou CNPJ).
    """
    digitos = _so_digitos(cnpj_emissor) or "00000000000000"
    return f"DPS{digitos:0>14}{serie:05d}{numero:015d}"


def _documento_emissor(config) -> str:
    """Retorna documento do emissor (digitos puros). Tolera config antiga
    que so tinha cnpj_emissor."""
    doc = (
        _so_digitos(getattr(config, "documento_emissor", None))
        or _so_digitos(getattr(config, "cnpj_emissor", None))
        or ""
    )
    return doc


def _tipo_pessoa_emissor(config) -> str:
    """Retorna "PF" ou "PJ". Default PJ pra retrocompat com configs antigas."""
    tipo = (getattr(config, "tipo_pessoa_emissor", None) or "").upper()
    if tipo in ("PF", "PJ"):
        return tipo
    # Deduz pelo tamanho do documento se nao especificado.
    doc = _documento_emissor(config)
    return "PF" if len(doc) == 11 else "PJ"


def montar_dps_xml(payload, config, *, serie: int, numero: int) -> str:
    """Monta o XML da DPS a partir do payload normalizado + config do tenant.

    Args:
        payload: EmissaoPayload (gateway.py)
        config: ConfigNFSe do tenant
        serie: numero da serie de DPS (controlado pelo emissor)
        numero: numero sequencial da DPS dentro da serie

    Returns:
        XML como string (UTF-8, sem assinatura ainda).

    Estrutura (simplificada — campos minimos pra um servico de advocacia):
        <DPS xmlns="...">
          <infDPS Id="...">
            <tpAmb>1|2</tpAmb>            <!-- 1=Producao, 2=Homologacao -->
            <dhEmi>2026-05-17T20:00:00-03:00</dhEmi>
            <verAplic>1.00</verAplic>
            <serie>1</serie>
            <nDPS>1</nDPS>
            <dCompet>2026-05</dCompet>
            <tpEmit>1</tpEmit>            <!-- 1=Prestador -->
            <cLocEmi>3550308</cLocEmi>    <!-- IBGE -->
            <subst>... [omitido] ...</subst>
            <prest>
              <CNPJ>...</CNPJ>
              <IM>...</IM>
            </prest>
            <toma>
              <CNPJ ou CPF>...</...>
              <xNome>...</xNome>
            </toma>
            <serv>
              <locPrest><cLocPrestacao>3550308</cLocPrestacao></locPrest>
              <cServ><cTribNac>17.06</cTribNac></cServ>
              <descServ>Honorarios advocaticios — caso XYZ</descServ>
            </serv>
            <valores>
              <vServPrest><vServ>1000.00</vServ></vServPrest>
              <trib>
                <tribMun>
                  <tribISSQN>1</tribISSQN>
                  <pAliq>5.00</pAliq>
                </tribMun>
              </trib>
            </valores>
          </infDPS>
        </DPS>

    TODO 5.6.2:
        - Validar contra XSD oficial (LeiautesRN_DPS_NFSe-SNNFSe.xsd)
        - Adicionar <Signature> XMLDSIG no fim de infDPS
        - Confirmar nome exato de cada tag (alguns manuais usam abreviacoes
          diferentes: dEmi vs dhEmi, etc).
    """
    ET.register_namespace("", DPS_NS)

    tipo_pessoa = _tipo_pessoa_emissor(config)
    documento = _documento_emissor(config)
    if not documento:
        # Fallback pra nao quebrar montagem; gateway rejeita antes de chegar aqui.
        documento = "00000000000" if tipo_pessoa == "PF" else "00000000000000"
    im = _so_digitos(config.inscricao_municipal)
    municipio_ibge = config.codigo_municipio_ibge or "0000000"

    # id_dps usa o documento do emissor (CPF=11 ou CNPJ=14 digitos).
    # Mantemos o campo do helper como "cnpj_emissor" por compat — qualquer
    # documento de digitos serve.
    id_dps = gerar_id_dps(cnpj_emissor=documento, serie=serie, numero=numero)
    tp_amb = "2" if (config.ambiente or "sandbox").lower() != "producao" else "1"

    root = ET.Element(f"{{{DPS_NS}}}DPS")
    inf = ET.SubElement(root, f"{{{DPS_NS}}}infDPS", attrib={"Id": id_dps})

    ET.SubElement(inf, f"{{{DPS_NS}}}tpAmb").text = tp_amb
    # Data/hora local do emissor com offset -03:00 (Brasilia). Anexo I
    # exige timezone explicito. NTP sync e responsabilidade do servidor.
    ET.SubElement(inf, f"{{{DPS_NS}}}dhEmi").text = (
        datetime.utcnow().replace(microsecond=0).isoformat() + "-03:00"
    )
    ET.SubElement(inf, f"{{{DPS_NS}}}verAplic").text = "1.00"
    ET.SubElement(inf, f"{{{DPS_NS}}}serie").text = str(serie)
    ET.SubElement(inf, f"{{{DPS_NS}}}nDPS").text = str(numero)
    ET.SubElement(inf, f"{{{DPS_NS}}}dCompet").text = _format_competencia(None)
    ET.SubElement(inf, f"{{{DPS_NS}}}tpEmit").text = "1"  # 1=Prestador
    ET.SubElement(inf, f"{{{DPS_NS}}}cLocEmi").text = municipio_ibge

    prest = ET.SubElement(inf, f"{{{DPS_NS}}}prest")
    # Etapa 5.6.5: bloco do prestador respeita tipo de pessoa.
    if tipo_pessoa == "PF":
        ET.SubElement(prest, f"{{{DPS_NS}}}CPF").text = documento
    else:
        ET.SubElement(prest, f"{{{DPS_NS}}}CNPJ").text = documento
    if im:
        ET.SubElement(prest, f"{{{DPS_NS}}}IM").text = im

    # Tomador: opcional no leiaute (alguns servicos avulsos nao tem CPF/CNPJ
    # do tomador identificado). Quando ausente, nao incluir o bloco.
    if payload.tomador_documento or payload.tomador_nome:
        toma = ET.SubElement(inf, f"{{{DPS_NS}}}toma")
        doc_digitos = _so_digitos(payload.tomador_documento) or ""
        if len(doc_digitos) == 14:
            ET.SubElement(toma, f"{{{DPS_NS}}}CNPJ").text = doc_digitos
        elif len(doc_digitos) == 11:
            ET.SubElement(toma, f"{{{DPS_NS}}}CPF").text = doc_digitos
        if payload.tomador_nome:
            ET.SubElement(toma, f"{{{DPS_NS}}}xNome").text = payload.tomador_nome[:300]

    serv = ET.SubElement(inf, f"{{{DPS_NS}}}serv")
    loc_prest = ET.SubElement(serv, f"{{{DPS_NS}}}locPrest")
    ET.SubElement(loc_prest, f"{{{DPS_NS}}}cLocPrestacao").text = municipio_ibge
    c_serv = ET.SubElement(serv, f"{{{DPS_NS}}}cServ")
    ET.SubElement(c_serv, f"{{{DPS_NS}}}cTribNac").text = (
        payload.codigo_servico or "17.06"
    )
    ET.SubElement(serv, f"{{{DPS_NS}}}descServ").text = (payload.descricao_servico or "")[:2000]

    valores = ET.SubElement(inf, f"{{{DPS_NS}}}valores")
    v_serv_prest = ET.SubElement(valores, f"{{{DPS_NS}}}vServPrest")
    ET.SubElement(v_serv_prest, f"{{{DPS_NS}}}vServ").text = _format_decimal(payload.valor)
    if payload.aliquota_iss is not None:
        trib = ET.SubElement(valores, f"{{{DPS_NS}}}trib")
        trib_mun = ET.SubElement(trib, f"{{{DPS_NS}}}tribMun")
        ET.SubElement(trib_mun, f"{{{DPS_NS}}}tribISSQN").text = "1"  # 1=tributacao normal
        ET.SubElement(trib_mun, f"{{{DPS_NS}}}pAliq").text = _format_decimal(payload.aliquota_iss)

    xml_bytes = ET.tostring(root, encoding="utf-8", xml_declaration=True)
    return xml_bytes.decode("utf-8")


def comprimir_e_codificar(xml: str) -> str:
    """GZip + Base64 do XML. Padrao exigido pelo Portal Nacional no body."""
    gz = gzip.compress(xml.encode("utf-8"))
    return base64.b64encode(gz).decode("ascii")


def decodificar_e_descomprimir(b64_gz: str) -> str:
    """Operacao inversa. Util pros tests e pra processar respostas."""
    gz = base64.b64decode(b64_gz.encode("ascii"))
    return gzip.decompress(gz).decode("utf-8")


# Namespaces possiveis no XML da NFS-e autorizada. O Swagger nao
# documenta o leiaute, mas pelo padrao SPED/Fazenda o namespace eh
# sped.fazenda.gov.br/nfse. Toleramos variacoes via match com
# wildcard ({*}) no findtext.
def extrair_dados_nfse(nfse_xml: str) -> dict:
    """Extrai campos da NFS-e autorizada (numero, serie, codigo de
    verificacao, etc) do XML retornado em nfseXmlGZipB64.

    O Swagger nao publica o schema da NFS-e, entao tentamos campos
    com nomes comuns (`nNFSe`, `serie`, `codVerif`, `dhEmi`) com
    fallback pra None. Retorna dict com chaves estaveis pro caller
    nao precisar fazer parsing.
    """
    from xml.etree import ElementTree as ET  # noqa: PLC0415

    try:
        root = ET.fromstring(nfse_xml)
    except ET.ParseError:
        return {}

    def t(tag):
        # Match em qualquer namespace
        elem = root.find(f".//{{*}}{tag}")
        return elem.text if elem is not None and elem.text else None

    # Tenta varios nomes possiveis pra cada campo
    return {
        "numero_nfse": t("nNFSe") or t("numeroNFSe") or t("nNFSeMun"),
        "serie": t("serie") or t("serieNFSe"),
        "codigo_verificacao": t("codVerif") or t("codigoVerificacao"),
        "data_emissao": t("dhEmi") or t("dataEmissao"),
        "chave_acesso": t("chNFSe") or t("chaveAcesso"),
    }
