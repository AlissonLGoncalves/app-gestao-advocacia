"""Tests for dashboard publicacoes-recentes endpoint (F3)."""

import pytest
from datetime import datetime, timedelta
from models import PublicacaoDJEN, Caso, Cliente
from extensions import db


def test_publicacoes_recentes_requires_auth(client):
    """Test endpoint requires JWT authentication."""
    response = client.get("/api/v1/dashboard/publicacoes-recentes?dias=7")
    assert response.status_code == 401


def test_publicacoes_recentes_default_7_dias(auth_client):
    """Test endpoint returns last 7 days by default."""
    response = auth_client.get("/api/v1/dashboard/publicacoes-recentes?dias=7")

    assert response.status_code == 200
    data = response.get_json()
    assert "dias" in data
    assert data["dias"] == 7
    assert "grupos" in data
    assert isinstance(data["grupos"], list)


def test_publicacoes_recentes_custom_dias(auth_client):
    """Test endpoint with custom dias parameter."""
    response = auth_client.get("/api/v1/dashboard/publicacoes-recentes?dias=15")

    assert response.status_code == 200
    data = response.get_json()
    assert data["dias"] == 15


def test_publicacoes_recentes_invalid_dias(auth_client):
    """Test endpoint validates dias parameter."""
    # Invalid values should default to 7
    response = auth_client.get("/api/v1/dashboard/publicacoes-recentes?dias=999")
    assert response.status_code == 200
    data = response.get_json()
    assert data["dias"] == 7

    response = auth_client.get("/api/v1/dashboard/publicacoes-recentes?dias=abc")
    assert response.status_code == 200
    data = response.get_json()
    assert data["dias"] == 7


def test_publicacoes_recentes_labels(auth_client, db):
    """Test endpoint returns groups with proper structure."""
    response = auth_client.get("/api/v1/dashboard/publicacoes-recentes?dias=7")

    assert response.status_code == 200
    data = response.get_json()

    # Check structure
    grupos = data["grupos"]
    for grupo in grupos:
        assert "data" in grupo
        assert "rotulo" in grupo
        assert "publicacoes" in grupo
        assert isinstance(grupo["publicacoes"], list)



