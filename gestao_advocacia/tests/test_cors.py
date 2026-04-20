"""Testes para a whitelist de CORS."""

import re

from app_runtime import configure_cors_origins


class TestCorsOriginsList:
    """Testes unitarios para configure_cors_origins."""

    def test_vercel_oficial_na_lista(self):
        origins = configure_cors_origins()
        assert "https://app-gestao-advocacia.vercel.app" in origins

    def test_localhost_dev_na_lista(self):
        origins = configure_cors_origins()
        assert "http://localhost:5173" in origins

    def test_localhost_127_na_lista(self):
        origins = configure_cors_origins()
        assert "http://127.0.0.1:5173" in origins

    def test_regex_restringe_ao_projeto(self):
        """O regex de preview deve aceitar apenas o projeto especifico, nao qualquer *.vercel.app."""
        origins = configure_cors_origins()
        regex_origins = [o for o in origins if isinstance(o, re.Pattern)]
        assert regex_origins, "Deve haver pelo menos um regex para preview URLs"

        # Aceitar preview do proprio projeto
        preview_proprio = "https://app-gestao-advocacia-abc123.vercel.app"
        assert any(
            r.match(preview_proprio) for r in regex_origins
        ), f"Preview do proprio projeto deve ser aceito: {preview_proprio}"

    def test_regex_rejeita_subdominio_aleatorio(self):
        """evil.vercel.app NAO deve ser aceito pelo regex."""
        origins = configure_cors_origins()
        regex_origins = [o for o in origins if isinstance(o, re.Pattern)]

        evil = "https://evil.vercel.app"
        assert not any(
            r.match(evil) for r in regex_origins
        ), f"Subdominio arbitrario NAO deve ser aceito: {evil}"

    def test_regex_rejeita_outro_projeto_vercel(self):
        """Outro projeto no vercel.app nao deve passar no regex."""
        origins = configure_cors_origins()
        regex_origins = [o for o in origins if isinstance(o, re.Pattern)]

        outro = "https://outro-projeto.vercel.app"
        assert not any(
            r.match(outro) for r in regex_origins
        ), f"Outro projeto nao deve ser aceito: {outro}"


class TestCorsIntegracao:
    """Testes de integracao: verifica headers CORS em respostas reais."""

    def test_cors_permite_vercel_oficial(self, client):
        resp = client.options(
            "/api/v1/auth/login",
            headers={
                "Origin": "https://app-gestao-advocacia.vercel.app",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert resp.status_code in (200, 204)
        origin_header = resp.headers.get("Access-Control-Allow-Origin", "")
        assert "app-gestao-advocacia.vercel.app" in origin_header

    def test_cors_rejeita_vercel_subdominio_aleatorio(self, client):
        resp = client.options(
            "/api/v1/auth/login",
            headers={
                "Origin": "https://evil.vercel.app",
                "Access-Control-Request-Method": "POST",
            },
        )
        origin_header = resp.headers.get("Access-Control-Allow-Origin", "")
        assert "evil.vercel.app" not in origin_header

    def test_cors_permite_localhost_dev(self, client):
        resp = client.options(
            "/api/v1/auth/login",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
            },
        )
        origin_header = resp.headers.get("Access-Control-Allow-Origin", "")
        assert "localhost" in origin_header
