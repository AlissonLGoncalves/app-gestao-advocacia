# tests/test_prazo_detector.py
# Issue #302 — prazo_detector.py estava sem NENHUM teste e errar aqui
# significa o advogado perder prazo de cliente. Cobre a camada regex
# (determinística), o cálculo de dias úteis e os helpers de título/
# prioridade. A camada IA (Gemini) não é exercitada — sem API key ela
# retorna None e o pipeline devolve o resultado da regex.

from datetime import date, timedelta

from prazo_detector import (
    _calcular_vencimento,
    detectar_prazo,
    detectar_prazo_regex,
    prioridade_por_dias_ate_vencer,
    titulo_prazo,
)

# Quarta-feira fixa pra tornar os cálculos de dias úteis determinísticos
QUARTA = date(2026, 6, 10)
SEXTA = date(2026, 6, 12)


class TestCalcularVencimento:
    def test_dias_corridos_soma_direto(self):
        assert _calcular_vencimento(QUARTA, 10, uteis=False) == QUARTA + timedelta(days=10)

    def test_dia_util_pula_fim_de_semana(self):
        # Sexta + 1 dia útil = segunda-feira
        assert _calcular_vencimento(SEXTA, 1, uteis=True) == date(2026, 6, 15)

    def test_15_dias_uteis_equivalem_a_3_semanas(self):
        # 15 úteis a partir de quarta = quarta 3 semanas depois
        assert _calcular_vencimento(QUARTA, 15, uteis=True) == date(2026, 7, 1)


class TestDetectarPrazoRegex:
    def test_contestacao_15_dias_uteis(self):
        r = detectar_prazo_regex(
            "Fica o réu INTIMADO para apresentar contestação no prazo de 15 dias úteis.",
            data_referencia=QUARTA,
        )
        assert r is not None
        assert r["tipo"] == "contestacao"
        assert r["dias"] == 15
        assert r["uteis"] is True
        assert r["fonte"] == "regex"
        assert r["vencimento_iso"] == "2026-07-01"

    def test_dias_corridos_explicitos(self):
        r = detectar_prazo_regex(
            "Intime-se a parte para manifestação em 10 dias corridos.",
            data_referencia=QUARTA,
        )
        assert r is not None
        assert r["uteis"] is False
        assert r["vencimento_iso"] == (QUARTA + timedelta(days=10)).isoformat()

    def test_default_e_dias_uteis_cpc(self):
        # Sem qualificador: assume dias úteis (CPC art. 219)
        r = detectar_prazo_regex(
            "Fica intimado para recurso no prazo de 5 dias.",
            data_referencia=QUARTA,
        )
        assert r is not None
        assert r["uteis"] is True
        assert r["tipo"] == "recurso"

    def test_sem_gatilho_nao_supoe_prazo(self):
        # "15 dias" sem intimação/prazo/citação por perto = não é prazo
        assert detectar_prazo_regex("A obra ficará pronta em 15 dias.") is None

    def test_sem_numero_de_dias_retorna_none(self):
        assert detectar_prazo_regex("Fica o réu intimado a comparecer à audiência.") is None

    def test_dias_fora_do_intervalo_retorna_none(self):
        assert detectar_prazo_regex("Intimado no prazo de 999 dias.") is None

    def test_texto_vazio_retorna_none(self):
        assert detectar_prazo_regex("") is None
        assert detectar_prazo_regex(None) is None

    def test_tipos_detectados(self):
        casos = [
            ("Cite-se para apresentar contestação em 15 dias", "contestacao"),
            ("Intimado para réplica no prazo de 15 dias", "replica"),
            ("Intima-se para embargos de declaração em 5 dias", "embargos"),
            ("Intimado a manifestação em 5 dias sobre os documentos", "manifestacao"),
            ("Intima-se para alegações finais no prazo de 15 dias", "alegacoes_finais"),
        ]
        for texto, tipo in casos:
            r = detectar_prazo_regex(texto, data_referencia=QUARTA)
            assert r is not None, texto
            assert r["tipo"] == tipo, texto

    def test_pipeline_usa_regex_primeiro(self):
        # detectar_prazo deve devolver a camada regex sem precisar de IA
        r = detectar_prazo(
            "Intime-se para contestar no prazo de 15 dias úteis.",
            data_referencia=QUARTA,
        )
        assert r is not None
        assert r["fonte"] == "regex"


class TestHelpers:
    def test_titulo_com_e_sem_cnj(self):
        assert titulo_prazo("contestacao") == "Prazo: Contestação"
        assert (
            titulo_prazo("recurso", "0001234-56.2026.8.16.0001")
            == "Prazo: Recurso — 0001234-56.2026.8.16.0001"
        )
        assert titulo_prazo("tipo_desconhecido") == "Prazo processual"

    def test_titulo_trunca_em_250(self):
        assert len(titulo_prazo("outro", "9" * 300)) == 250

    def test_prioridade_por_dias(self):
        hoje = date.today()
        assert prioridade_por_dias_ate_vencer(hoje - timedelta(days=1)) == "Urgente"
        assert prioridade_por_dias_ate_vencer(hoje + timedelta(days=2)) == "Urgente"
        assert prioridade_por_dias_ate_vencer(hoje + timedelta(days=5)) == "Alta"
        assert prioridade_por_dias_ate_vencer(hoje + timedelta(days=12)) == "Normal"
        assert prioridade_por_dias_ate_vencer(hoje + timedelta(days=30)) == "Baixa"
