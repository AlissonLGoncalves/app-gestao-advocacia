"""Detecta o tribunal a partir do numero CNJ (Epic #12 / #186).

CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO
- J: segmento da Justica (1=STF, 4=TRF, 5=Trabalho, 6=Eleitoral, 7=Militar Estadual,
     8=Estadual, 9=Militar)
- TR: identificador do tribunal dentro do segmento (ex: 8.16 = TJPR, 8.26 = TJSP).

Esta funcao e o ponto de entrada do orquestrador de busca on-demand:
recebe CNJ e devolve info que permite escolher o adapter certo.
"""

from __future__ import annotations

import re

CNJ_REGEX_DIGITS = re.compile(r"^\d{20}$")


def somente_digitos(numero):
    return "".join(ch for ch in str(numero or "") if ch.isdigit())


# Mapeamento J -> nome do segmento da Justica
SEGMENTO_NOMES = {
    "1": "STF",
    "2": "CNJ",
    "3": "STJ",
    "4": "Justiça Federal",
    "5": "Justiça do Trabalho",
    "6": "Justiça Eleitoral",
    "7": "Justiça Militar da União",
    "8": "Justiça Estadual",
    "9": "Justiça Militar Estadual",
}


# Mapa de tribunais conhecidos (J.TR -> nome).
# Cobre os principais TJs estaduais e TRFs/TRTs de uso comum.
# Lista compatível com DataJud/CNJ (que cobre praticamente todos).
TRIBUNAL_NOMES = {
    # Justica Federal (4.XX)
    "4.01": "TRF1",
    "4.02": "TRF2",
    "4.03": "TRF3",
    "4.04": "TRF4",
    "4.05": "TRF5",
    "4.06": "TRF6",
    # Justica do Trabalho (5.XX) - 24 TRTs
    **{f"5.{i:02d}": f"TRT{i}" for i in range(1, 25)},
    # Justica Estadual (8.XX) - principais
    "8.01": "TJAC",
    "8.02": "TJAL",
    "8.03": "TJAP",
    "8.04": "TJAM",
    "8.05": "TJBA",
    "8.06": "TJCE",
    "8.07": "TJDFT",
    "8.08": "TJES",
    "8.09": "TJGO",
    "8.10": "TJMA",
    "8.11": "TJMT",
    "8.12": "TJMS",
    "8.13": "TJMG",
    "8.14": "TJPA",
    "8.15": "TJPB",
    "8.16": "TJPR",
    "8.17": "TJPE",
    "8.18": "TJPI",
    "8.19": "TJRJ",
    "8.20": "TJRN",
    "8.21": "TJRS",
    "8.22": "TJRO",
    "8.23": "TJRR",
    "8.24": "TJSC",
    "8.25": "TJSE",
    "8.26": "TJSP",
    "8.27": "TJTO",
}


def detectar_tribunal_do_cnj(cnj):
    """Recebe CNJ formatado ou em digitos e retorna info do tribunal.

    Returns:
        dict com:
            - cnj_normalizado: string canonica "NNNNNNN-DD.AAAA.J.TR.OOOO" ou None
            - segmento: int (1-9) ou None
            - segmento_nome: nome legivel ou None
            - tribunal_codigo: "J.TR" (ex "8.16") ou None
            - tribunal_nome: nome legivel (ex "TJPR") ou None
            - suportado: bool — True quando temos adapter para esse tribunal
            - ano: int (4 digitos) ou None
            - origem: int (4 digitos do final, identifica vara/comarca) ou None
            - erro: motivo se nao foi possivel decodar
    """
    digits = somente_digitos(cnj)
    if not CNJ_REGEX_DIGITS.match(digits):
        return {
            "cnj_normalizado": None,
            "segmento": None,
            "segmento_nome": None,
            "tribunal_codigo": None,
            "tribunal_nome": None,
            "suportado": False,
            "erro": "cnj_formato_invalido",
        }

    # NNNNNNNDDAAAAJTROOOO (positions 0-6 N, 7-8 D, 9-12 A, 13 J, 14-15 TR, 16-19 OO)
    canonico = f"{digits[0:7]}-{digits[7:9]}.{digits[9:13]}.{digits[13:14]}.{digits[14:16]}.{digits[16:20]}"
    segmento_str = digits[13:14]
    tr_str = digits[14:16]
    codigo_tribunal = f"{segmento_str}.{tr_str}"

    return {
        "cnj_normalizado": canonico,
        "segmento": int(segmento_str),
        "segmento_nome": SEGMENTO_NOMES.get(segmento_str),
        "tribunal_codigo": codigo_tribunal,
        "tribunal_nome": TRIBUNAL_NOMES.get(codigo_tribunal),
        "suportado": codigo_tribunal in TRIBUNAL_NOMES,
        "ano": int(digits[9:13]),
        "origem": int(digits[16:20]),
        "erro": None,
    }
