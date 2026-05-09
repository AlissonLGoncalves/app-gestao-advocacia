"""Testes do djen_classifier — short-circuit por tipo/keyword + IA."""

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from djen_classifier import classificar_publicacao


def _pub(tipo=None, texto=""):
    """Mock minimo de PublicacaoDJEN com so os atributos usados."""
    return SimpleNamespace(tipo_comunicacao=tipo, texto=texto)


class TestShortCircuitPorTipo:
    """Tipo conhecido como rotina nao deve chamar IA."""

    @pytest.mark.parametrize(
        "tipo",
        ["Lista de distribuição", "Juntada de Petição", "Conclusos", "Vista", "Certidão"],
    )
    def test_tipos_rotina_marcam_false_sem_chamar_ia(self, tipo):
        gemini_mock = MagicMock()
        result = classificar_publicacao(_pub(tipo=tipo, texto="qualquer"), gemini_mock)
        assert result["importante"] is False
        assert result["classificado_em"] is not None
        assert "rotina" in result["motivo"].lower()
        # IA NAO deve ser chamada
        assert not gemini_mock.models.generate_content.called


class TestShortCircuitPorKeywords:
    """Texto sem palavra-gatilho de movimento processual nao chama IA."""

    def test_texto_curto_marca_false_sem_ia(self):
        gemini_mock = MagicMock()
        # < 80 chars -> short-circuit por tamanho
        result = classificar_publicacao(_pub(tipo=None, texto="Conclusos."), gemini_mock)
        assert result["importante"] is False
        assert not gemini_mock.models.generate_content.called

    def test_texto_sem_keywords_marca_false_sem_ia(self):
        gemini_mock = MagicMock()
        # Texto longo sem nenhuma palavra-gatilho relevante
        texto = (
            "Documento de identificacao do cartorio. Mero registro administrativo "
            "sem qualquer movimentacao processual relevante. Apenas controle interno."
        )
        result = classificar_publicacao(_pub(tipo=None, texto=texto), gemini_mock)
        assert result["importante"] is False
        assert not gemini_mock.models.generate_content.called


class TestClassificacaoViaIA:
    """Tipos importantes ou textos com keywords vao pro Gemini."""

    def test_intimacao_com_prazo_chama_ia_e_marca_importante(self):
        gemini_mock = MagicMock()
        # Mock da resposta do Gemini
        resp = MagicMock()
        resp.text = '{"importante": true, "motivo": "Intimacao para contestar em 15 dias."}'
        gemini_mock.models.generate_content.return_value = resp

        texto = (
            "Intimada a parte requerida para apresentar contestacao no prazo de 15 "
            "dias uteis, sob pena de revelia, nos termos do art. 335 do CPC."
        )
        result = classificar_publicacao(_pub(tipo="Intimação", texto=texto), gemini_mock)
        assert result["importante"] is True
        assert "contestar" in result["motivo"].lower()
        assert gemini_mock.models.generate_content.called

    def test_ia_classifica_como_rotina(self):
        gemini_mock = MagicMock()
        resp = MagicMock()
        resp.text = '{"importante": false, "motivo": "Intimacao para juntada de cota."}'
        gemini_mock.models.generate_content.return_value = resp

        texto = (
            "Intimada a parte para tomar ciencia da juntada de peticao das fls. 234 "
            "e manifestar o que entender de direito sobre o anexo."
        )
        result = classificar_publicacao(_pub(tipo="Intimação", texto=texto), gemini_mock)
        assert result["importante"] is False
        assert "juntada" in result["motivo"].lower()


class TestErroIA:
    """Falha do Gemini retorna None → coluna fica NULL pra retry."""

    def test_gemini_quebrado_retorna_none(self):
        gemini_mock = MagicMock()
        gemini_mock.models.generate_content.side_effect = RuntimeError("API down")
        texto = (
            "Intimada a parte para apresentar contestacao no prazo de 15 dias uteis "
            "sob pena de revelia, conforme o art. 335 do CPC, com a decisao saneadora "
            "exarada nos autos."
        )
        result = classificar_publicacao(_pub(tipo="Intimação", texto=texto), gemini_mock)
        assert result["importante"] is None
        assert result["classificado_em"] is None

    def test_gemini_retorna_json_invalido_retorna_none(self):
        gemini_mock = MagicMock()
        resp = MagicMock()
        resp.text = "isso nao eh json"
        gemini_mock.models.generate_content.return_value = resp
        texto = (
            "Intimada a parte para apresentar contestacao no prazo de 15 dias uteis "
            "sob pena de revelia, conforme o art. 335 do CPC, com a decisao saneadora "
            "exarada nos autos."
        )
        result = classificar_publicacao(_pub(tipo="Intimação", texto=texto), gemini_mock)
        assert result["importante"] is None

    def test_sem_cliente_gemini_retorna_none(self):
        # Sem cliente disponivel (Gemini desabilitado) e texto que nao da
        # pra short-circuitar -> deixa NULL pra retry posterior.
        texto = (
            "Intimada a parte para apresentar contestacao no prazo de 15 dias uteis "
            "sob pena de revelia, conforme o art. 335 do CPC, com a decisao saneadora "
            "exarada nos autos."
        )
        result = classificar_publicacao(_pub(tipo="Intimação", texto=texto), gemini_client=None)
        assert result["importante"] is None
