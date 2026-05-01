"""Testes do gate de registro pre-comercial (issue #112)."""

import json


def test_register_aberto_quando_mode_open(client, db, app):
    """Suite default tem REGISTRATION_MODE=open — /register aceita self-signup.

    Sanity check: garante que o setup default nao bloqueia (existing tests).
    """
    assert app.config.get("REGISTRATION_MODE") == "open"
    res = client.post(
        "/api/v1/auth/register",
        json={
            "username": "user_open_mode",
            "email": "open@teste.local",
            "password": "Senha1234!",
            "role": "admin",
            "aceite_termos": True,
            "aceite_lgpd": True,
            "versao_termos": "v1.0",
            "versao_lgpd": "v1.0",
        },
    )
    # 201 = criado; 409 (ja existe) tambem indica que passou do gate
    assert res.status_code in (201, 409), res.data


def test_register_bloqueado_quando_mode_closed(client, db, app):
    """Quando REGISTRATION_MODE=closed, /register retorna 403 com code orientativo."""
    original = app.config.get("REGISTRATION_MODE")
    app.config["REGISTRATION_MODE"] = "closed"
    try:
        res = client.post(
            "/api/v1/auth/register",
            json={
                "username": "user_closed_mode",
                "email": "closed@teste.local",
                "password": "Senha1234!",
                "role": "admin",
                "aceite_termos": True,
                "aceite_lgpd": True,
                "versao_termos": "v1.0",
                "versao_lgpd": "v1.0",
            },
        )
    finally:
        app.config["REGISTRATION_MODE"] = original

    assert res.status_code == 403
    payload = json.loads(res.data)
    assert payload.get("code") == "registration_closed"
    assert "convite" in payload.get("message", "").lower()


def test_register_invite_continua_funcionando_em_mode_closed(client, db, app):
    """Mesmo com REGISTRATION_MODE=closed, /register-invite com token nao e afetado.

    Aqui so validamos que o endpoint nao bloqueia globalmente — token invalido
    da 400/401 (nao 403 do gate). Token valido seria coberto por test do invite.
    """
    original = app.config.get("REGISTRATION_MODE")
    app.config["REGISTRATION_MODE"] = "closed"
    try:
        res = client.post(
            "/api/v1/auth/register-invite",
            json={
                "token": "fake-invite-token-nao-existe",
                "username": "x",
                "password": "Senha1234!",
            },
        )
    finally:
        app.config["REGISTRATION_MODE"] = original

    # Espera-se 400/401/404 (token invalido), nunca 403 do gate de /register
    assert res.status_code != 403
    if res.status_code != 200:
        payload = json.loads(res.data) if res.data else {}
        assert payload.get("code") != "registration_closed"
