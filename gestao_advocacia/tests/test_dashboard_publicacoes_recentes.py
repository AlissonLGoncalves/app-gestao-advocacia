"""Tests for dashboard publicacoes-recentes endpoint (F3)."""

import pytest
from datetime import datetime, timedelta
from models import PublicacaoDJEN, Caso, Cliente, User
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


def test_publicacoes_recentes_com_caso_e_cliente_retorna_nome_correto(auth_client, db):
    user_id = auth_client.user.get("id")
    assert user_id is not None
    user = db.session.get(User, user_id)
    assert user is not None
    tenant_id = user.tenant_id

    cliente = Cliente(
        user_id=user_id,
        tenant_id=tenant_id,
        nome_razao_social="Edimilson Francisco Da Costa",
        cpf_cnpj="123.456.789-00",
        tipo_pessoa="PF",
    )
    db.session.add(cliente)
    db.session.flush()

    caso = Caso(
        user_id=user_id,
        tenant_id=tenant_id,
        cliente_id=cliente.id,
        titulo="Caso Teste Dashboard",
        numero_processo="0000001-00.2026.8.16.0001",
        status="Ativo",
    )
    db.session.add(caso)
    db.session.flush()

    pub = PublicacaoDJEN(
        user_id=user_id,
        tenant_id=tenant_id,
        caso_id=caso.id,
        numero_processo=caso.numero_processo,
        data_disponibilizacao=datetime.utcnow().date(),
        texto="Publicação de teste para dashboard",
        ativo=True,
        triagem_ignorada=False,
        status_origem="revisado_manual",
        lida=False,
    )
    db.session.add(pub)
    db.session.commit()

    response = auth_client.get("/api/v1/dashboard/publicacoes-recentes?dias=7")
    assert response.status_code == 200

    data = response.get_json()
    encontrados = [
        item
        for grupo in data.get("grupos", [])
        for item in grupo.get("publicacoes", [])
        if item.get("id") == pub.id
    ]
    assert len(encontrados) == 1
    assert encontrados[0]["cliente_nome"] == "Edimilson Francisco Da Costa"



