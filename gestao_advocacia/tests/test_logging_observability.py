import io
import json
import logging
import uuid

from app import create_app
from config_test import ConfigTest
from logging_config import PatronusJsonFormatter


def test_request_id_roundtrip_header(client):
    custom_request_id = "req-id-custom-123"
    response = client.get("/", headers={"X-Request-ID": custom_request_id})

    assert response.status_code == 200
    assert response.headers.get("X-Request-ID") == custom_request_id


def test_request_id_is_generated_when_missing(client):
    response = client.get("/")

    assert response.status_code == 200
    response_request_id = response.headers.get("X-Request-ID")
    assert response_request_id
    uuid.UUID(response_request_id)


def test_json_formatter_produces_valid_json():
    formatter = PatronusJsonFormatter()

    logger = logging.getLogger("test_json_formatter")
    logger.handlers = []
    logger.setLevel(logging.INFO)
    logger.propagate = False

    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(formatter)
    logger.addHandler(handler)

    logger.info(
        "login_success",
        extra={
            "event": "login_success",
            "request_id": "req-1",
            "user_id": 1,
            "tenant_id": 10,
        },
    )

    payload = json.loads(stream.getvalue().strip())
    assert payload["message"] == "login_success"
    assert payload["event"] == "login_success"
    assert payload["request_id"] == "req-1"
    assert payload["user_id"] == 1
    assert payload["tenant_id"] == 10
    assert "timestamp" in payload
    assert payload["level"] == "INFO"
    assert payload["logger"] == "test_json_formatter"


def test_auth_login_logs_success_and_failure(client, caplog):
    caplog.set_level(logging.INFO)

    register_response = client.post(
        "/api/auth/register",
        json={
            "username": "obs_user",
            "email": "obs_user@test.com",
            "password": "Senha1234!",
            "role": "admin",
        },
    )
    assert register_response.status_code == 201

    success_login = client.post(
        "/api/auth/login",
        json={"username_or_email": "obs_user", "password": "Senha1234!"},
    )
    assert success_login.status_code == 200

    failed_login = client.post(
        "/api/auth/login",
        json={"username_or_email": "obs_user", "password": "senha-errada"},
    )
    assert failed_login.status_code == 401

    success_record = next((r for r in caplog.records if r.getMessage() == "login_success"), None)
    failed_record = next((r for r in caplog.records if r.getMessage() == "login_failed"), None)

    assert success_record is not None
    assert getattr(success_record, "event", None) == "login_success"
    assert getattr(success_record, "user_id", None) is not None
    assert hasattr(success_record, "tenant_id")

    assert failed_record is not None
    assert getattr(failed_record, "event", None) == "login_failed"
    assert getattr(failed_record, "email", None) == "obs_user"
    assert getattr(failed_record, "reason", None) == "invalid_credentials"


def test_5xx_logs_stacktrace_with_context(caplog):
    caplog.set_level(logging.ERROR)
    app = create_app(ConfigTest)

    @app.route("/__test-500")
    def _raise_error():
        raise RuntimeError("erro-forcado")

    with app.test_client() as local_client:
        response = local_client.get("/__test-500", headers={"X-Request-ID": "req-500"})
        assert response.status_code == 500

    error_record = next((r for r in caplog.records if r.getMessage() == "server_error"), None)
    assert error_record is not None
    assert getattr(error_record, "event", None) == "server_error"
    assert getattr(error_record, "endpoint", None) == "/__test-500"
    assert getattr(error_record, "method", None) == "GET"
