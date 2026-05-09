"""Testes para utils/cpf_cnpj.py — funcoes consolidadas de CPF."""

import pytest

from utils.cpf_cnpj import extract_digits, format_cpf, validate_cpf


# ---------------------------------------------------------------------------
# extract_digits
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "entrada,esperado",
    [
        ("123.456.789-09", "12345678909"),
        ("12345678909", "12345678909"),
        ("abc 123 def", "123"),
        ("", ""),
        (None, ""),
        ("  529.982.247-25  ", "52998224725"),
    ],
)
def test_extract_digits(entrada, esperado):
    assert extract_digits(entrada) == esperado


# ---------------------------------------------------------------------------
# validate_cpf
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "cpf",
    [
        "529.982.247-25",
        "52998224725",
        "111.444.777-35",
        "11144477735",
    ],
)
def test_validate_cpf_valido(cpf):
    assert validate_cpf(cpf) is True


@pytest.mark.parametrize(
    "cpf",
    [
        "111.111.111-11",  # sequencia repetida
        "00000000000",
        "123.456.789-00",  # DV invalido
        "12345678900",
        "529.982.247-26",  # ultimo digito errado
        "1234567890",  # menos de 11 digitos
        "123456789012",  # mais de 11 digitos
        "",
        None,
        "abcdefghijk",
    ],
)
def test_validate_cpf_invalido(cpf):
    assert validate_cpf(cpf) is False


# ---------------------------------------------------------------------------
# format_cpf
# ---------------------------------------------------------------------------
def test_format_cpf_aplica_mascara():
    assert format_cpf("52998224725") == "529.982.247-25"


def test_format_cpf_preserva_mascara_existente():
    assert format_cpf("529.982.247-25") == "529.982.247-25"


def test_format_cpf_remove_lixo_e_aplica_mascara():
    assert format_cpf("  529.982.247-25  ") == "529.982.247-25"


@pytest.mark.parametrize("cpf", ["123", "1234567890", "123456789012", "", None])
def test_format_cpf_retorna_none_para_tamanho_invalido(cpf):
    assert format_cpf(cpf) is None
