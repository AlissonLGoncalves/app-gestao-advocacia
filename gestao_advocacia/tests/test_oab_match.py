"""Testes do Epic #185: auto-deteccao de qual polo do processo e cliente."""

import pytest

from utils.oab_match import (
    identificar_cliente_no_processo,
    normalizar_oab,
    oab_do_tenant,
    parsear_polos_datajud,
)


# ---------------------------------------------------------------------------
# normalizar_oab
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "entrada,esperado",
    [
        ("OAB/PR 12345", ("12345", "PR")),
        ("OAB PR 12345", ("12345", "PR")),
        ("OAB-PR 12345", ("12345", "PR")),
        ("12345/PR", ("12345", "PR")),
        ("PR 12345", ("12345", "PR")),
        ("PR 12.345", ("12345", "PR")),
        ("oab/pr 12345", ("12345", "PR")),  # case-insensitive
        ("OAB/SP 098765", ("98765", "SP")),  # remove zeros a esquerda
    ],
)
def test_normalizar_oab_extrai_corretamente(entrada, esperado):
    assert normalizar_oab(entrada) == esperado


@pytest.mark.parametrize(
    "entrada",
    [
        None,
        "",
        "   ",
        "OAB 12345",  # sem UF, ambiguo
        "Apenas texto",
        "12345",
    ],
)
def test_normalizar_oab_retorna_none_em_entradas_invalidas(entrada):
    assert normalizar_oab(entrada) is None


# ---------------------------------------------------------------------------
# oab_do_tenant
# ---------------------------------------------------------------------------
def test_oab_do_tenant_objeto():
    class FakeTenant:
        numero_oab_escritorio = "12345"
        sigla_oab_escritorio = "PR"

    assert oab_do_tenant(FakeTenant()) == ("12345", "PR")


def test_oab_do_tenant_dict():
    tenant = {"numero_oab_escritorio": "12345", "sigla_oab_escritorio": "PR"}
    assert oab_do_tenant(tenant) == ("12345", "PR")


def test_oab_do_tenant_sem_oab_retorna_none():
    class FakeTenant:
        numero_oab_escritorio = None
        sigla_oab_escritorio = None

    assert oab_do_tenant(FakeTenant()) is None
    assert oab_do_tenant(None) is None
    assert oab_do_tenant({}) is None


# ---------------------------------------------------------------------------
# identificar_cliente_no_processo
# ---------------------------------------------------------------------------
PROCESSO_OAB_NO_AUTOR = {
    "polo_ativo": [
        {
            "nome": "Joao da Silva",
            "advogados": [{"nome": "Dr. Alisson", "inscricao": "OAB/PR 12345"}],
        }
    ],
    "polo_passivo": [
        {
            "nome": "Banco X",
            "advogados": [{"nome": "Dr. Outro", "inscricao": "OAB/SP 99999"}],
        }
    ],
}

PROCESSO_OAB_NO_REU = {
    "polo_ativo": [
        {
            "nome": "Empresa Y",
            "advogados": [{"nome": "Dr. Outro", "inscricao": "OAB/SP 99999"}],
        }
    ],
    "polo_passivo": [
        {
            "nome": "Maria Santos",
            "advogados": [{"nome": "Dr. Alisson", "inscricao": "OAB/PR 12345"}],
        }
    ],
}


def test_identifica_cliente_quando_oab_bate_no_autor():
    resultado = identificar_cliente_no_processo(PROCESSO_OAB_NO_AUTOR, [("12345", "PR")])
    assert resultado["polo"] == "autor"
    assert resultado["motivo"] == "oab_match_autor"
    assert resultado["parte"]["nome"] == "Joao da Silva"
    assert resultado["oab_match"] == "12345/PR"


def test_identifica_cliente_quando_oab_bate_no_reu():
    resultado = identificar_cliente_no_processo(PROCESSO_OAB_NO_REU, [("12345", "PR")])
    assert resultado["polo"] == "reu"
    assert resultado["motivo"] == "oab_match_reu"
    assert resultado["parte"]["nome"] == "Maria Santos"


def test_retorna_ambos_polos_quando_oab_bate_em_ambos():
    processo = {
        "polo_ativo": [
            {"nome": "A", "advogados": [{"inscricao": "OAB/PR 12345"}]},
        ],
        "polo_passivo": [
            {"nome": "B", "advogados": [{"inscricao": "OAB/PR 12345"}]},
        ],
    }
    resultado = identificar_cliente_no_processo(processo, [("12345", "PR")])
    assert resultado["polo"] is None
    assert resultado["motivo"] == "ambos_polos"


def test_retorna_sem_oab_escritorio_quando_oabs_vazias():
    resultado = identificar_cliente_no_processo(PROCESSO_OAB_NO_AUTOR, [])
    assert resultado["polo"] is None
    assert resultado["motivo"] == "sem_oab_escritorio"


def test_retorna_sem_oab_escritorio_quando_oabs_none():
    resultado = identificar_cliente_no_processo(PROCESSO_OAB_NO_AUTOR, [None, None])
    assert resultado["polo"] is None
    assert resultado["motivo"] == "sem_oab_escritorio"


def test_retorna_nenhuma_oab_bate_quando_escritorio_nao_aparece():
    resultado = identificar_cliente_no_processo(PROCESSO_OAB_NO_AUTOR, [("99888", "RJ")])
    assert resultado["polo"] is None
    assert resultado["motivo"] == "nenhuma_oab_bate"
    assert resultado["oab_match"] is None


def test_funciona_com_partes_sem_advogados():
    processo = {
        "polo_ativo": [{"nome": "A", "advogados": []}],
        "polo_passivo": [{"nome": "B"}],  # sem chave advogados
    }
    resultado = identificar_cliente_no_processo(processo, [("12345", "PR")])
    assert resultado["motivo"] == "nenhuma_oab_bate"


def test_aceita_diferentes_chaves_para_inscricao():
    processo = {
        "polo_ativo": [
            {"nome": "Cliente1", "advogados": [{"oab": "OAB/PR 12345"}]},
        ],
        "polo_passivo": [],
    }
    resultado = identificar_cliente_no_processo(processo, [("12345", "PR")])
    assert resultado["polo"] == "autor"


def test_aceita_oabs_em_diferentes_formatos_no_payload():
    processo = {
        "polo_ativo": [
            {
                "nome": "Cliente",
                "advogados": [
                    {"nome": "Dr X", "inscricao": "OAB-PR-12.345"},
                    {"nome": "Dr Y", "inscricao": "PR 99999"},
                ],
            }
        ],
        "polo_passivo": [],
    }
    resultado = identificar_cliente_no_processo(processo, [("12345", "PR")])
    assert resultado["polo"] == "autor"
    assert resultado["oab_match"] == "12345/PR"


# ---------------------------------------------------------------------------
# parsear_polos_datajud
# ---------------------------------------------------------------------------
def test_parser_datajud_separa_polos_ativo_e_passivo():
    polos_raw = [
        {
            "polo": "AT",
            "partes": [{"nome": "Joao", "advogados": [{"inscricao": "OAB/PR 12345"}]}],
        },
        {
            "polo": "PA",
            "partes": [{"nome": "Banco X", "advogados": []}],
        },
    ]
    resultado = parsear_polos_datajud(polos_raw)
    assert len(resultado["polo_ativo"]) == 1
    assert resultado["polo_ativo"][0]["nome"] == "Joao"
    assert len(resultado["polo_passivo"]) == 1
    assert resultado["polo_passivo"][0]["nome"] == "Banco X"


def test_parser_datajud_aceita_codigos_alternativos():
    polos_raw = [
        {"polo": "ATIVO", "partes": [{"nome": "A"}]},
        {"polo": "PASSIVO", "partes": [{"nome": "B"}]},
        {"polo": "REQUERENTE", "partes": [{"nome": "C"}]},
        {"polo": "REQUERIDO", "partes": [{"nome": "D"}]},
    ]
    resultado = parsear_polos_datajud(polos_raw)
    assert {p["nome"] for p in resultado["polo_ativo"]} == {"A", "C"}
    assert {p["nome"] for p in resultado["polo_passivo"]} == {"B", "D"}


def test_parser_datajud_lida_com_payload_vazio_ou_invalido():
    assert parsear_polos_datajud(None) == {"polo_ativo": [], "polo_passivo": []}
    assert parsear_polos_datajud([]) == {"polo_ativo": [], "polo_passivo": []}
    assert parsear_polos_datajud("string invalida") == {
        "polo_ativo": [],
        "polo_passivo": [],
    }


def test_pipeline_completa_parser_datajud_e_identificacao():
    """Integracao: payload DataJud -> parser -> identificacao por OAB."""
    polos_datajud = [
        {
            "polo": "AT",
            "partes": [
                {
                    "nome": "Maria Silva",
                    "advogados": [{"nome": "Dr X", "inscricao": "OAB/PR 12345"}],
                }
            ],
        },
        {
            "polo": "PA",
            "partes": [
                {
                    "nome": "Banco Z",
                    "advogados": [{"nome": "Dr Y", "inscricao": "OAB/SP 99999"}],
                }
            ],
        },
    ]
    parsed = parsear_polos_datajud(polos_datajud)
    resultado = identificar_cliente_no_processo(parsed, [("12345", "PR")])
    assert resultado["polo"] == "autor"
    assert resultado["parte"]["nome"] == "Maria Silva"


def test_multiplas_oabs_do_escritorio_sao_consideradas():
    """Escritorio com varios advogados pode ter varias OABs."""
    processo = {
        "polo_ativo": [
            {"nome": "X", "advogados": [{"inscricao": "OAB/PR 99999"}]},
        ],
        "polo_passivo": [],
    }
    oabs_escritorio = [("12345", "PR"), ("99999", "PR"), ("11111", "SP")]
    resultado = identificar_cliente_no_processo(processo, oabs_escritorio)
    assert resultado["polo"] == "autor"
    assert resultado["oab_match"] == "99999/PR"
