"""Testes para validar rate limiting em rotas publicas de autenticacao."""

import pytest

from app import create_app
from config_test import ConfigTest
from extensions import db as _db
from extensions import limiter


class ConfigTestRateLimit(ConfigTest):
    """Config de teste com rate limiting ativo apenas neste modulo."""

    RATELIMIT_ENABLED = True
    RATELIMIT_STORAGE_URI = "memory://"


@pytest.fixture()
def rl_app():
    """Cria uma app isolada para os testes de rate limit sem derrubar tabelas globais."""
    flask_app = create_app(ConfigTestRateLimit)
    ctx = flask_app.app_context()
    ctx.push()
    _db.create_all()

    if hasattr(limiter, "reset"):
        limiter.reset()
    if hasattr(limiter, "enabled"):
        limiter.enabled = True

    yield flask_app

    if hasattr(limiter, "reset"):
        limiter.reset()
    if hasattr(limiter, "enabled"):
        limiter.enabled = False
    _db.session.remove()
    ctx.pop()


@pytest.fixture()
def rl_client(rl_app):
    """Client com rate limiting ativo."""
    return rl_app.test_client()


class TestRateLimitLogin:
    """Testes de rate limiting para POST /login."""

    def test_login_6_tentativas_no_mesmo_minuto_retorna_429(self, rl_client):
        url = "/api/v1/auth/login"
        payload = {"username_or_email": "inexistente@test.com", "password": "errada"}

        for attempt in range(1, 6):
            resp = rl_client.post(url, json=payload)
            assert (
                resp.status_code == 401
            ), f"Tentativa {attempt}: esperado 401, got {resp.status_code}"

        resp = rl_client.post(url, json=payload)
        assert resp.status_code == 429, f"6a tentativa: esperado 429, got {resp.status_code}"
        payload_resp = resp.get_json()
        assert "Muitas tentativas" in payload_resp["message"]


class TestRateLimitRegister:
    """Testes de rate limiting para POST /register."""

    def test_register_4_tentativas_na_hora_retorna_429(self, rl_client):
        url = "/api/v1/auth/register"

        def make_payload(username, email):
            return {
                "username": username,
                "email": email,
                "password": "Senha123456!",
                "role": "admin",
                "aceite_termos": True,
                "aceite_lgpd": True,
                "versao_termos": "v1.0",
                "versao_lgpd": "v1.0",
            }

        for attempt in range(1, 4):
            payload = make_payload(f"user{attempt}", f"user{attempt}@test.com")
            resp = rl_client.post(url, json=payload)
            assert (
                resp.status_code == 201
            ), f"Tentativa {attempt}: esperado 201, got {resp.status_code}"

        payload = make_payload("user4", "user4@test.com")
        resp = rl_client.post(url, json=payload)
        assert resp.status_code == 429, f"4a tentativa: esperado 429, got {resp.status_code}"
        payload_resp = resp.get_json()
        assert "Muitas tentativas" in payload_resp["message"]


class TestRateLimitRegisterInvite:
    """Testes de rate limiting para POST /register-invite."""

    def test_register_invite_11_tentativas_na_hora_retorna_429(self, rl_client):
        url = "/api/v1/auth/register-invite"

        def make_payload(seq):
            return {
                "invite_token": f"invalid_token_{seq}",
                "username": f"invited_user_{seq}",
                "password": "Senha123456!",
            }

        for attempt in range(1, 11):
            resp = rl_client.post(url, json=make_payload(attempt))
            assert (
                resp.status_code == 400
            ), f"Tentativa {attempt}: esperado 400, got {resp.status_code}"

        resp = rl_client.post(url, json=make_payload(11))
        assert resp.status_code == 429, f"11a tentativa: esperado 429, got {resp.status_code}"
        payload_resp = resp.get_json()
        assert "Muitas tentativas" in payload_resp["message"]
