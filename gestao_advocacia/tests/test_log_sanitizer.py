import hashlib
import logging

from utils.log_sanitizer import mask_email, mask_user_id


def test_mask_email_formato_valido():
    assert mask_email("alice@foo.com") == "a***@foo.com"


def test_mask_email_formato_invalido():
    assert mask_email("nao-email") == "nao***"


def test_mask_user_id_deterministico():
    expected = hashlib.sha256("123".encode()).hexdigest()[:8]
    assert mask_user_id(123) == expected
    assert mask_user_id(123) == expected


def test_login_failed_loga_email_mascarado(client, caplog):
    caplog.set_level(logging.WARNING)

    register_response = client.post(
        "/api/v1/auth/register",
        json={
            "username": "pii_user",
            "email": "pii_user@test.com",
            "password": "Senha1234!",
            "role": "admin",
            "aceite_termos": True,
            "aceite_lgpd": True,
            "versao_termos": "v1.0",
            "versao_lgpd": "v1.0",
        },
    )
    assert register_response.status_code == 201

    failed_login = client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "pii_user", "password": "senha-errada"},
    )
    assert failed_login.status_code == 401

    failed_record = next((r for r in caplog.records if r.getMessage() == "login_failed"), None)
    assert failed_record is not None
    assert getattr(failed_record, "email", None) == "pii***"
    assert "pii_user" not in getattr(failed_record, "email", "")
