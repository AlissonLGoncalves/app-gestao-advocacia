"""Construcao do XML de Pedido de Registro de Evento da NFS-e Nacional.

Schema oficial: pedRegEvento_v1.01.xsd + tiposEventos_v1.01.xsd
(Portal Nacional NFS-e v1.01, baixados em 2026-02-09).

Estrutura do XML gerado:
    <pedRegEvento xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01">
      <infPedReg Id="PRE{chave50}{tipoEvento6}{nPedRegEvento3}">
        <tpAmb>1|2</tpAmb>
        <verAplic>1.01</verAplic>
        <dhEvento>2026-05-17T18:00:00-03:00</dhEvento>
        <CNPJAutor>...</CNPJAutor>   <!-- ou CPFAutor -->
        <chNFSe>{50 digitos}</chNFSe>
        <e101101>                     <!-- ou e105102 -->
          <xDesc>Cancelamento de NFS-e</xDesc>
          <cMotivo>1</cMotivo>
          <xMotivo>...</xMotivo>
        </e101101>
      </infPedReg>
      <!-- ds:Signature adicionada por signer.assinar_dps após este builder -->
    </pedRegEvento>

Tipos de evento implementados (caso de uso do contribuinte/advogado):
- e101101: Cancelamento simples (cMotivo=1|2|9, xMotivo >=15 chars)
- e105102: Cancelamento por Substituicao (cMotivo do dominio TSCodJustSubst,
  chSubstituta = chave da nova NFS-e que substitui)

Eventos de manifestacao (202201, 202205, 203202...) ficam pra PR futuro
quando houver caso de uso definido.
"""

from __future__ import annotations

from datetime import datetime, timezone
from xml.etree import ElementTree as ET

from .dps_builder import DPS_NS, _so_digitos

# Versao do schema XSD oficial em uso. Bumpar se rotacionar XSDs em
# `schemas/`. O Portal valida este atributo no body.
VERSAO_SCHEMA = "1.01"

# Codigos validos pra evento de Cancelamento simples (e101101).
# Do XSD TSCodJustCanc: 1, 2, 9.
COD_MOTIVO_CANC_VALIDOS = {1, 2, 9}

# Codigos pra Cancelamento por Substituicao (e105102), de TSCodJustSubst:
# 01-Desenquadramento Simples, 02-Enquadramento Simples, 03-Inclusao
# Imunidade, 04-Exclusao Imunidade, 05-Rejeicao Tomador/Intermediario, 99-Outros.
COD_MOTIVO_SUBST_VALIDOS = {1, 2, 3, 4, 5, 99}


def _now_iso_utc_brasilia() -> str:
    """Data/hora atual em ISO 8601 com TZ -03:00 (Brasilia). O schema
    aceita -02:00 (FN), -03:00 (BSB), -04:00 (Manaus) e versoes do
    horario de verao."""
    # Forca -03:00 (assumimos servidor configurado pra Brasilia).
    # Em prod, melhor confiar no NTP do servidor e usar TZ local.
    agora = datetime.now(timezone.utc).astimezone()
    # ElementTree precisa do offset com `:` — astimezone retorna
    # com `±HHMM`, ajustamos pra `±HH:MM`.
    iso = agora.replace(microsecond=0).isoformat()
    if len(iso) >= 5 and (iso[-5] == "+" or iso[-5] == "-") and ":" not in iso[-5:]:
        iso = f"{iso[:-2]}:{iso[-2:]}"
    return iso


def gerar_id_ped_reg_evt(*, chave_nfse: str, tipo_evento: int, n_ped_reg: int) -> str:
    """TSIdPedRegEvt = "PRE" + chave(50) + tipoEvento(6) + nPedRegEvento(3).

    Sera o atributo Id do elemento <infPedReg>. Caller assina XMLDSIG
    referenciando este Id via reference_uri="#PRE...".
    """
    chave_dig = _so_digitos(chave_nfse) or ""
    if len(chave_dig) != 50:
        raise ValueError(
            f"chave_nfse deve ter 50 digitos, recebido {len(chave_dig)}"
        )
    if not isinstance(tipo_evento, int) or tipo_evento <= 0:
        raise ValueError("tipo_evento deve ser inteiro positivo")
    if not isinstance(n_ped_reg, int) or n_ped_reg < 1 or n_ped_reg > 999:
        raise ValueError("n_ped_reg deve ser inteiro 1-999")
    return f"PRE{chave_dig}{tipo_evento:06d}{n_ped_reg:03d}"


def _validar_documento_autor(doc: str | None) -> tuple[str, str]:
    """Retorna (tipo, digitos) — tipo eh "CNPJ" ou "CPF". Raises ValueError."""
    digitos = _so_digitos(doc) or ""
    if len(digitos) == 11:
        return "CPF", digitos
    if len(digitos) == 14:
        return "CNPJ", digitos
    raise ValueError(
        f"documento do autor deve ter 11 (CPF) ou 14 (CNPJ) digitos, "
        f"recebido {len(digitos)}"
    )


def _validar_motivo_texto(x_motivo: str) -> str:
    """TSMotivo: minLength=15 (do XSD)."""
    if not x_motivo:
        raise ValueError("xMotivo obrigatorio")
    texto = x_motivo.strip()
    if len(texto) < 15:
        raise ValueError(
            f"xMotivo deve ter pelo menos 15 caracteres (recebido: {len(texto)})"
        )
    return texto[:1000]  # limite folgado pra evitar abuse


def _base_infPedReg(
    *,
    chave_nfse: str,
    tipo_evento: int,
    n_ped_reg: int,
    documento_autor: str,
    ambiente: str,
) -> tuple[ET.Element, ET.Element]:
    """Cria <pedRegEvento><infPedReg> com header comum a todos os eventos
    e retorna (root, infPedReg). Caller adiciona o <eXXXXX> filho."""
    ET.register_namespace("", DPS_NS)
    root = ET.Element(f"{{{DPS_NS}}}pedRegEvento", attrib={"versao": VERSAO_SCHEMA})

    id_ped = gerar_id_ped_reg_evt(
        chave_nfse=chave_nfse, tipo_evento=tipo_evento, n_ped_reg=n_ped_reg
    )
    inf = ET.SubElement(root, f"{{{DPS_NS}}}infPedReg", attrib={"Id": id_ped})

    tp_amb = "2" if (ambiente or "sandbox").lower() != "producao" else "1"
    ET.SubElement(inf, f"{{{DPS_NS}}}tpAmb").text = tp_amb
    ET.SubElement(inf, f"{{{DPS_NS}}}verAplic").text = VERSAO_SCHEMA
    ET.SubElement(inf, f"{{{DPS_NS}}}dhEvento").text = _now_iso_utc_brasilia()

    tipo_doc, digitos = _validar_documento_autor(documento_autor)
    ET.SubElement(inf, f"{{{DPS_NS}}}{tipo_doc}Autor").text = digitos

    chave_dig = _so_digitos(chave_nfse) or ""
    ET.SubElement(inf, f"{{{DPS_NS}}}chNFSe").text = chave_dig

    return root, inf


def montar_pedido_cancelamento(
    *,
    chave_nfse: str,
    cod_motivo: int,
    motivo_texto: str,
    documento_autor: str,
    ambiente: str,
    n_ped_reg: int,
) -> str:
    """Monta XML de pedRegEvento para evento e101101 (cancelamento simples).

    Args:
        chave_nfse: 50 digitos.
        cod_motivo: 1=Erro emissao, 2=Servico nao prestado, 9=Outros.
        motivo_texto: descricao livre (TSMotivo, min 15 chars).
        documento_autor: CPF (11) ou CNPJ (14) do prestador.
        ambiente: "sandbox" -> tpAmb=2, "producao" -> tpAmb=1.
        n_ped_reg: contador do tenant (1-999), pra unicidade do Id.

    Returns:
        XML como string UTF-8, sem declaracao XML (signxml adiciona).
        Caller deve assinar com XMLDSIG (signer.assinar_dps) e depois
        comprimir (comprimir_e_codificar) antes de enviar.

    Raises:
        ValueError: se algum campo nao bater com o schema.
    """
    if cod_motivo not in COD_MOTIVO_CANC_VALIDOS:
        raise ValueError(
            f"cod_motivo deve ser 1, 2 ou 9 (Erro emissao | Servico nao "
            f"prestado | Outros). Recebido: {cod_motivo}"
        )
    texto = _validar_motivo_texto(motivo_texto)

    root, inf = _base_infPedReg(
        chave_nfse=chave_nfse,
        tipo_evento=101101,
        n_ped_reg=n_ped_reg,
        documento_autor=documento_autor,
        ambiente=ambiente,
    )

    e = ET.SubElement(inf, f"{{{DPS_NS}}}e101101")
    ET.SubElement(e, f"{{{DPS_NS}}}xDesc").text = "Cancelamento de NFS-e"
    ET.SubElement(e, f"{{{DPS_NS}}}cMotivo").text = str(cod_motivo)
    ET.SubElement(e, f"{{{DPS_NS}}}xMotivo").text = texto

    return ET.tostring(root, encoding="utf-8", xml_declaration=True).decode("utf-8")


def montar_pedido_cancelamento_por_substituicao(
    *,
    chave_nfse: str,
    chave_substituta: str,
    cod_motivo: int,
    motivo_texto: str | None,
    documento_autor: str,
    ambiente: str,
    n_ped_reg: int,
) -> str:
    """Monta XML de pedRegEvento para evento e105102 (cancelamento por
    substituicao). Usado quando a NFS-e original e substituida por outra
    ja emitida.

    Args:
        chave_nfse: chave da NFS-e a ser cancelada (50 digitos).
        chave_substituta: chave da NFS-e que substitui (50 digitos).
        cod_motivo: TSCodJustSubst — 1-5 ou 99 (Outros).
        motivo_texto: opcional (minOccurs=0 no XSD), min 15 chars se enviado.
        documento_autor: CPF ou CNPJ do prestador.
        ambiente: "sandbox"|"producao".
        n_ped_reg: contador do tenant.

    Returns:
        XML como string UTF-8.
    """
    if cod_motivo not in COD_MOTIVO_SUBST_VALIDOS:
        raise ValueError(
            f"cod_motivo deve estar em {sorted(COD_MOTIVO_SUBST_VALIDOS)}. "
            f"Recebido: {cod_motivo}"
        )
    chave_subst_dig = _so_digitos(chave_substituta) or ""
    if len(chave_subst_dig) != 50:
        raise ValueError("chave_substituta deve ter 50 digitos")

    root, inf = _base_infPedReg(
        chave_nfse=chave_nfse,
        tipo_evento=105102,
        n_ped_reg=n_ped_reg,
        documento_autor=documento_autor,
        ambiente=ambiente,
    )

    e = ET.SubElement(inf, f"{{{DPS_NS}}}e105102")
    ET.SubElement(e, f"{{{DPS_NS}}}xDesc").text = "Cancelamento de NFS-e por Substituição"
    ET.SubElement(e, f"{{{DPS_NS}}}cMotivo").text = str(cod_motivo)
    if motivo_texto:
        ET.SubElement(e, f"{{{DPS_NS}}}xMotivo").text = _validar_motivo_texto(motivo_texto)
    ET.SubElement(e, f"{{{DPS_NS}}}chSubstituta").text = chave_subst_dig

    return ET.tostring(root, encoding="utf-8", xml_declaration=True).decode("utf-8")
