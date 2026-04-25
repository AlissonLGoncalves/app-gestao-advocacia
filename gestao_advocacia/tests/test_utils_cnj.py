"""enriquecimento-cnj: testes do utilitario unificado de CNJ."""

import pytest

from utils.cnj import (
    CNJ_REGEX_STRICT,
    CNJ_REGEX_TEXTO,
    extrair_numeros_cnj,
    extrair_primeiro_cnj_valido,
    somente_digitos_cnj,
    validar_dv_cnj,
)

# Numeros CNJ validos (DV verificado pelo proprio algoritmo via reverse).
CNJ_VALIDO_TJPR = "0000472-75.2025.8.16.0075"  # exemplo do prompt
CNJ_VALIDO_TRF4 = "5001234-80.2024.4.04.7100"
CNJ_VALIDO_TRT2 = "1234567-66.2026.5.02.0001"
CNJ_VALIDO_TJSP = "0000001-84.2020.8.26.0001"


# ---------------------------------------------------------------------------
# validar_dv_cnj
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "numero",
    [CNJ_VALIDO_TJPR, CNJ_VALIDO_TRF4, CNJ_VALIDO_TRT2, CNJ_VALIDO_TJSP],
)
def test_validar_dv_cnj_valido(numero):
    assert validar_dv_cnj(numero) is True


def test_validar_dv_cnj_aceita_so_digitos():
    # Mesmo numero TJPR, sem pontuacao
    assert validar_dv_cnj("00004727520258160075") is True


def test_validar_dv_cnj_invalido_dv_alterado():
    # Trocar o DV de 75 -> 99 invalida o numero
    assert validar_dv_cnj("0000472-99.2025.8.16.0075") is False


def test_validar_dv_cnj_invalido_qualquer_digito_alterado():
    # Trocar um digito do sequencial tambem deve invalidar
    assert validar_dv_cnj("9999472-75.2025.8.16.0075") is False


@pytest.mark.parametrize("entrada", [None, "", "123", "abc", "0000472-75.2025.8.16.007"])
def test_validar_dv_cnj_input_invalido_retorna_false(entrada):
    assert validar_dv_cnj(entrada) is False


# ---------------------------------------------------------------------------
# somente_digitos_cnj
# ---------------------------------------------------------------------------
def test_somente_digitos_cnj():
    assert somente_digitos_cnj(CNJ_VALIDO_TJPR) == "00004727520258160075"
    assert somente_digitos_cnj(None) == ""
    assert somente_digitos_cnj("") == ""
    assert somente_digitos_cnj("abc 123 def 456") == "123456"


# ---------------------------------------------------------------------------
# extrair_numeros_cnj
# ---------------------------------------------------------------------------
def test_extrair_numeros_cnj_em_texto_livre_dedup_preserva_ordem():
    texto = (
        f"Refere-se aos autos {CNJ_VALIDO_TJPR}, "
        f"em conexao com {CNJ_VALIDO_TRF4}. "
        f"Ja citado anteriormente: {CNJ_VALIDO_TJPR} (mesmo)."
    )
    encontrados = extrair_numeros_cnj(texto)
    assert encontrados == [CNJ_VALIDO_TJPR, CNJ_VALIDO_TRF4]


def test_extrair_numeros_cnj_vazio_e_none():
    assert extrair_numeros_cnj(None) == []
    assert extrair_numeros_cnj("") == []
    assert extrair_numeros_cnj("texto sem numero algum") == []


def test_slice_para_textos_grandes_nao_estoura():
    # Texto enorme com CNJ valido alem do cap de 100k chars deve ser truncado.
    padding = "A " * 60_000  # ~120k chars
    texto = padding + CNJ_VALIDO_TJPR
    # Deve nao encontrar (pois esta alem do slice)
    assert extrair_numeros_cnj(texto) == []
    # Mas se estiver antes do cap, encontra
    texto2 = CNJ_VALIDO_TJPR + " " + padding
    assert extrair_numeros_cnj(texto2) == [CNJ_VALIDO_TJPR]


# ---------------------------------------------------------------------------
# extrair_primeiro_cnj_valido
# ---------------------------------------------------------------------------
def test_extrair_primeiro_cnj_valido_pula_invalidos():
    # Primeiro numero do texto tem DV invalido; segundo e valido.
    invalido = "0000472-99.2025.8.16.0075"  # DV errado
    texto = f"Citado erroneamente {invalido}, mas o correto e {CNJ_VALIDO_TJPR}."
    assert extrair_primeiro_cnj_valido(texto) == CNJ_VALIDO_TJPR


def test_extrair_primeiro_cnj_valido_prioriza_apos_autos_no():
    # Existem 2 numeros validos; o priorizado e o que vem apos "Autos no"
    texto = (
        f"Em referencia ao processo {CNJ_VALIDO_TRF4}, "
        f"Autos no {CNJ_VALIDO_TJPR} foi distribuido."
    )
    assert extrair_primeiro_cnj_valido(texto) == CNJ_VALIDO_TJPR


def test_extrair_primeiro_cnj_valido_prioriza_apos_processo():
    texto = (
        f"O caso anterior ({CNJ_VALIDO_TRT2}) foi arquivado. "
        f"Processo: {CNJ_VALIDO_TJSP} segue ativo."
    )
    assert extrair_primeiro_cnj_valido(texto) == CNJ_VALIDO_TJSP


def test_extrair_primeiro_cnj_valido_sem_prioridade_retorna_primeiro():
    texto = f"Numeros: {CNJ_VALIDO_TJPR} e {CNJ_VALIDO_TRF4}."
    assert extrair_primeiro_cnj_valido(texto) == CNJ_VALIDO_TJPR


def test_extrair_primeiro_cnj_valido_none_quando_so_invalidos():
    texto = "Apenas 0000001-99.2020.8.26.0001 (DV errado) e 9999999-99.9999.9.99.9999."
    assert extrair_primeiro_cnj_valido(texto) is None


def test_extrair_primeiro_cnj_valido_input_vazio():
    assert extrair_primeiro_cnj_valido(None) is None
    assert extrair_primeiro_cnj_valido("") is None


# ---------------------------------------------------------------------------
# Regex compatibility (refatoracao nao-comportamental)
# ---------------------------------------------------------------------------
def test_cnj_regex_texto_aceita_formato_canonico():
    assert CNJ_REGEX_TEXTO.search(f"prefixo {CNJ_VALIDO_TJPR} sufixo") is not None


def test_cnj_regex_strict_so_aceita_string_completa():
    assert CNJ_REGEX_STRICT.match(CNJ_VALIDO_TJPR) is not None
    assert CNJ_REGEX_STRICT.match(f" {CNJ_VALIDO_TJPR} ") is None
    assert CNJ_REGEX_STRICT.match(f"prefixo{CNJ_VALIDO_TJPR}") is None
