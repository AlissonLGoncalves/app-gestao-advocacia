"""Auto-deteccao de qual polo do processo e cliente do escritorio (Epic #11).

Inspirado no comportamento do Astrea: ao importar um processo, o sistema cruza
a OAB do(s) advogado(s) do escritorio (configurada no Tenant) com as OABs dos
advogados que aparecem nas partes do processo (vindas do tribunal/DataJud) e
identifica automaticamente qual polo (autor/reu) e o cliente.

Escopo:
- Funcao pura: recebe payload do processo + identificacao do escritorio,
  retorna qual polo bateu e por que.
- Nao depende de DB. Quem chama e quem busca o Tenant.

Formato esperado do payload:

    processo_dados = {
        "polo_ativo": [
            {
                "nome": "Joao da Silva",
                "advogados": [
                    {"nome": "Dr. Alisson", "inscricao": "OAB/PR 12345"},
                ],
            },
        ],
        "polo_passivo": [
            {"nome": "Banco X", "advogados": [...]},
        ],
    }

A funcao tolera variantes da inscricao OAB (com ou sem mascara, com sigla UF
em prefixo ou sufixo, etc.) — extrai apenas digitos + UF.
"""

from __future__ import annotations

import re
from typing import Iterable

_UFS_BRASIL = "AC|AL|AM|AP|BA|CE|DF|ES|GO|MA|MG|MS|MT|PA|PB|PE|PI|PR|RJ|RN|RO|RR|RS|SC|SE|SP|TO"
_OAB_RE = re.compile(
    rf"OAB[\s/.\-]*(?P<uf1>{_UFS_BRASIL})[\s/.\-]*(?P<num>[\d.]{{1,12}})|"
    rf"(?P<num2>[\d.]{{1,12}})[\s/.\-]*(?P<uf2>{_UFS_BRASIL})|"
    rf"(?P<uf3>{_UFS_BRASIL})[\s/.\-]+(?P<num3>[\d.]{{1,12}})",
    re.IGNORECASE,
)


def normalizar_oab(valor: str | None) -> tuple[str, str] | None:
    """Extrai (numero, sigla_uf) de uma string contendo inscricao OAB.

    Retorna None se nao for possivel extrair com seguranca. Numero vem sem
    zeros a esquerda; UF em maiusculas.

    Exemplos aceitos:
        "OAB/PR 12345" -> ("12345", "PR")
        "OAB PR 12345" -> ("12345", "PR")
        "12345/PR"     -> ("12345", "PR")
        "PR 12.345"    -> ("12345", "PR")
        "OAB 12345"    -> None  (sem UF)
    """
    if not valor:
        return None
    texto = str(valor).upper().strip()
    m = _OAB_RE.search(texto)
    if not m:
        return None
    uf = m.group("uf1") or m.group("uf2") or m.group("uf3")
    numero = m.group("num") or m.group("num2") or m.group("num3")
    if not uf or not numero:
        return None
    # Remove pontos de separador de milhar (ex: "12.345" -> "12345")
    numero = numero.replace(".", "")
    return numero.lstrip("0") or "0", uf.upper()


def _normalizar_advogados(parte: dict) -> list[tuple[str, str]]:
    """Extrai todas as OABs normalizadas de uma parte (com seus advogados)."""
    advogados = parte.get("advogados") or []
    oabs: list[tuple[str, str]] = []
    if not isinstance(advogados, list):
        return oabs
    for adv in advogados:
        if not isinstance(adv, dict):
            continue
        # Tenta varios nomes de campo: inscricao, oab, numero_oab, registro
        for chave in ("inscricao", "oab", "numero_oab", "registro", "numeroInscricao"):
            valor = adv.get(chave)
            if valor:
                normalizada = normalizar_oab(valor)
                if normalizada:
                    oabs.append(normalizada)
                    break
    return oabs


def _polo_match(polo: list, oabs_escritorio: set[tuple[str, str]]) -> dict | None:
    """Itera as partes do polo procurando OAB do escritorio. Retorna a 1a parte que bate."""
    if not isinstance(polo, list):
        return None
    for parte in polo:
        if not isinstance(parte, dict):
            continue
        oabs_parte = _normalizar_advogados(parte)
        for oab in oabs_parte:
            if oab in oabs_escritorio:
                return {
                    "parte": parte,
                    "oab_match": f"{oab[0]}/{oab[1]}",
                }
    return None


def identificar_cliente_no_processo(
    processo_dados: dict,
    oabs_escritorio: Iterable[tuple[str, str]],
) -> dict:
    """Identifica qual polo (autor/reu) e cliente do escritorio.

    Args:
        processo_dados: dict com "polo_ativo" e "polo_passivo" (listas de partes).
            Cada parte e um dict com chave "advogados" (lista).
        oabs_escritorio: iteravel de tuplas (numero, uf) — OABs do escritorio.
            Geralmente extraida do Tenant via normalizar_oab(numero_oab + sigla).

    Returns:
        dict com:
            - polo: "autor" | "reu" | None — quando None, nao foi possivel decidir
            - parte: dict da parte que bateu (ou None)
            - motivo: "oab_match_autor" | "oab_match_reu" | "ambos_polos" |
                      "sem_oab_escritorio" | "nenhuma_oab_bate"
            - oab_match: string formatada da OAB que bateu (ou None)

    Casos especiais:
        - OAB do escritorio bate em ambos os polos: retorna polo=None, motivo="ambos_polos"
          (advogado nao deveria atuar nos dois lados; usuario precisa decidir)
        - Tenant sem OAB configurada: retorna polo=None, motivo="sem_oab_escritorio"
        - Nenhuma OAB bate: retorna polo=None, motivo="nenhuma_oab_bate"
    """
    oabs_set = {oab for oab in oabs_escritorio if oab}
    if not oabs_set:
        return {
            "polo": None,
            "parte": None,
            "motivo": "sem_oab_escritorio",
            "oab_match": None,
        }

    match_autor = _polo_match(processo_dados.get("polo_ativo") or [], oabs_set)
    match_reu = _polo_match(processo_dados.get("polo_passivo") or [], oabs_set)

    if match_autor and match_reu:
        return {
            "polo": None,
            "parte": None,
            "motivo": "ambos_polos",
            "oab_match": match_autor["oab_match"],
        }
    if match_autor:
        return {
            "polo": "autor",
            "parte": match_autor["parte"],
            "motivo": "oab_match_autor",
            "oab_match": match_autor["oab_match"],
        }
    if match_reu:
        return {
            "polo": "reu",
            "parte": match_reu["parte"],
            "motivo": "oab_match_reu",
            "oab_match": match_reu["oab_match"],
        }
    return {
        "polo": None,
        "parte": None,
        "motivo": "nenhuma_oab_bate",
        "oab_match": None,
    }


def parsear_polos_datajud(polos_raw) -> dict:
    """Converte payload "polos" do DataJud para formato {polo_ativo, polo_passivo}.

    DataJud retorna:
        "polos": [
            {"polo": "AT", "partes": [{"nome": ..., "advogados": [...]}]},
            {"polo": "PA", "partes": [...]},
        ]

    Convertemos para:
        {
            "polo_ativo": [partes do polo AT],
            "polo_passivo": [partes do polo PA],
        }

    Codigos do DataJud:
        - AT, ATIVO, AUTOR -> polo ativo
        - PA, PASSIVO, REU, REQUERIDO -> polo passivo
    """
    polo_ativo: list = []
    polo_passivo: list = []
    if not isinstance(polos_raw, list):
        return {"polo_ativo": [], "polo_passivo": []}

    for polo in polos_raw:
        if not isinstance(polo, dict):
            continue
        codigo = str(polo.get("polo", "") or polo.get("tipo", "") or "").upper()
        partes = polo.get("partes") or []
        if not isinstance(partes, list):
            continue
        if codigo in ("AT", "ATIVO", "AUTOR", "REQUERENTE"):
            polo_ativo.extend(partes)
        elif codigo in ("PA", "PASSIVO", "REU", "RÉU", "REQUERIDO"):
            polo_passivo.extend(partes)

    return {"polo_ativo": polo_ativo, "polo_passivo": polo_passivo}


def oab_do_tenant(tenant) -> tuple[str, str] | None:
    """Extrai OAB do tenant em formato (numero, uf) normalizado.

    Aceita o objeto Tenant SQLAlchemy ou um dict com as chaves
    `numero_oab_escritorio` e `sigla_oab_escritorio`.
    """
    if tenant is None:
        return None
    numero = getattr(tenant, "numero_oab_escritorio", None) or (
        tenant.get("numero_oab_escritorio") if isinstance(tenant, dict) else None
    )
    sigla = getattr(tenant, "sigla_oab_escritorio", None) or (
        tenant.get("sigla_oab_escritorio") if isinstance(tenant, dict) else None
    )
    if not numero or not sigla:
        return None
    return normalizar_oab(f"{numero}/{sigla}")
