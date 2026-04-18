"""
Testes para o parser DJEN (djen_triagem.py).

Cobre:
- Texto real com número CNJ, tribunal, autores e réus
- Casos de borda: sem CNJ, múltiplos autores, nomes em caixa mista
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from djen_triagem import analisar_publicacao, normalizar_nome


class MockPub:
    """Objeto publicação mínimo para testes unitários."""

    def __init__(self, texto, numero_processo=None, sigla_tribunal=None, raw_json=None):
        self.texto = texto
        self.numero_processo = numero_processo
        self.sigla_tribunal = sigla_tribunal
        self.raw_json = raw_json or {}


# ---------------------------------------------------------------------------
# Texto real copiado da especificação (F1)
# ---------------------------------------------------------------------------
TEXTO_REAL = (
    "PODER JUDICIARIO DO ESTADO DO PARANA COMARCA DE CORNELIO PROCOPIO 2a VARA\n"
    "   CIVEL DE CORNELIO PROCOPIO - PROJUDI Avenida Santos Dumont, 903 - Vila\n"
    "   Seugling - Cornelio Procopio/PR - CEP: 86.300-000 - Fone: (43) 3572-9301 -\n"
    "   E-mail: cp-2vj-s@tjpr.jus.br Autos no. 0000472-75.2025.8.16.0075   Processo:\n"
    "   0000472-75.2025.8.16.0075 Classe Processual:   Procedimento Comum Civel\n"
    "   Assunto Principal:   Praticas Abusivas Valor da Causa:   R$150.000,00\n"
    "   Autor(s):   DIRCE DE OLIVEIRA PEDOTTI Reu(s):   Banco do Brasil S/A 1. Nao\n"
    "   obstante as alegacoes..."
)


# ---------------------------------------------------------------------------
# Testes com o texto real
# ---------------------------------------------------------------------------


def test_texto_real_numero_processo():
    resultado = analisar_publicacao(MockPub(TEXTO_REAL))
    assert (
        resultado["numero_processo"] == "0000472-75.2025.8.16.0075"
    ), f"Esperado '0000472-75.2025.8.16.0075', obtido {resultado['numero_processo']!r}"


def test_texto_real_tribunal():
    resultado = analisar_publicacao(MockPub(TEXTO_REAL))
    assert resultado["tribunal"] == "TJPR", f"Esperado 'TJPR', obtido {resultado['tribunal']!r}"


def test_texto_real_partes_autoras():
    resultado = analisar_publicacao(MockPub(TEXTO_REAL))
    autoras_norm = [normalizar_nome(p) for p in resultado["partes_autoras"]]
    assert any(
        "dirce de oliveira pedotti" in a for a in autoras_norm
    ), f"'DIRCE DE OLIVEIRA PEDOTTI' não encontrado em partes_autoras: {resultado['partes_autoras']}"


def test_texto_real_partes_reus():
    resultado = analisar_publicacao(MockPub(TEXTO_REAL))
    reus_norm = [normalizar_nome(r) for r in resultado["partes_reus"]]
    assert any(
        "banco do brasil" in r for r in reus_norm
    ), f"'Banco do Brasil S/A' não encontrado em partes_reus: {resultado['partes_reus']}"


def test_texto_real_confianca_minima():
    """Com CNJ + partes + tribunal extraídos, confiança deve ser >= 0.7."""
    resultado = analisar_publicacao(MockPub(TEXTO_REAL))
    assert resultado["confianca"] >= 0.7, (
        f"Confiança esperada >= 0.7, obtida {resultado['confianca']} "
        f"(numero={resultado['numero_processo']}, "
        f"autoras={resultado['partes_autoras']}, "
        f"reus={resultado['partes_reus']}, "
        f"tribunal={resultado['tribunal']})"
    )


# ---------------------------------------------------------------------------
# Casos de borda
# ---------------------------------------------------------------------------


def test_sem_numero_processo_confianca_baixa():
    """Publicação sem CNJ deve ter confiança < 0.5."""
    texto = "Publicacao sem numero de processo. Apenas texto generico sem partes."
    resultado = analisar_publicacao(MockPub(texto))
    assert resultado["numero_processo"] is None
    assert (
        resultado["confianca"] < 0.5
    ), f"Sem CNJ, confiança deveria ser < 0.5, obtida {resultado['confianca']}"


def test_multiplos_autores():
    """Autor(s) com lista separada por vírgula deve ser capturado."""
    texto = (
        "Processo: 0001234-56.2025.8.16.0001\n"
        "Autor(s): Joao Silva, Maria Souza\n"
        "Reu(s): Empresa XYZ Ltda"
    )
    resultado = analisar_publicacao(MockPub(texto))
    assert resultado["partes_autoras"], "partes_autoras não deveria estar vazia"
    autoras_concat = " ".join(resultado["partes_autoras"]).lower()
    assert (
        "joao silva" in autoras_concat or "maria souza" in autoras_concat
    ), f"Nenhum dos autores encontrado em: {resultado['partes_autoras']}"
    assert resultado["partes_reus"], "partes_reus não deveria estar vazia"


def test_normalizar_nome_caixa_mista():
    """normalizar_nome deve igualar 'Dirce De Oliveira Pedotti' e 'DIRCE DE OLIVEIRA PEDOTTI'."""
    nome_db = "DIRCE DE OLIVEIRA PEDOTTI"
    nome_extrato = "Dirce De Oliveira Pedotti"
    assert normalizar_nome(nome_db) == normalizar_nome(
        nome_extrato
    ), f"{normalizar_nome(nome_db)!r} != {normalizar_nome(nome_extrato)!r}"


def test_normalizar_nome_remove_acentos():
    """normalizar_nome deve remover acentos para comparação."""
    assert normalizar_nome("João da Silva") == normalizar_nome("Joao da Silva")
    assert normalizar_nome("Fernão") == normalizar_nome("Fernao")
    assert normalizar_nome("AÇÃO") == normalizar_nome("ACAO")
