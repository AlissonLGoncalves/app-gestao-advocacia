"""Testes da Etapa 5 (NFS-e infra com MockGateway).

Cobre config-nfse (GET/PUT), emissao on-demand, listagem e detalhe,
mais isolamento multi-tenant.
"""

import json
from datetime import date


def _criar_cliente(auth_client):
    resp = auth_client.post(
        "/api/v1/clientes",
        json={
            "nome_razao_social": "Cliente NFSe",
            "cpf_cnpj": "123.456.789-00",
            "tipo_pessoa": "PF",
        },
    )
    assert resp.status_code == 201, resp.data
    return json.loads(resp.data)["id"]


def _criar_recebimento_pago(auth_client, cliente_id=None, valor=1000.00):
    payload = {
        "descricao": "Honorario advocaticio",
        "valor": valor,
        "data_vencimento": date.today().isoformat(),
        "data_pagamento": date.today().isoformat(),
        "status": "Pago",
        "categoria": "Honorarios Advocaticios",
    }
    if cliente_id:
        payload["cliente_id"] = cliente_id
    resp = auth_client.post("/api/v1/recebimentos", json=payload)
    assert resp.status_code == 201, resp.data
    return json.loads(resp.data)["id"]


def _configurar_nfse(auth_client, **overrides):
    payload = {
        "cnpj_emissor": "12.345.678/0001-90",
        "inscricao_municipal": "123456",
        "razao_social": "Escritorio Teste LTDA",
        "municipio": "Sao Paulo",
        "uf": "SP",
        "codigo_servico": "17.06",
        "regime_tributario": "Simples Nacional",
        "aliquota_iss": 5.0,
        "ambiente": "sandbox",
        "gateway_tipo": "mock",
    }
    payload.update(overrides)
    resp = auth_client.put("/api/v1/nfse/config", json=payload)
    assert resp.status_code == 200, resp.data
    return json.loads(resp.data)


# ===================== Config NFS-e =====================


def test_get_config_vazia_devolve_esqueleto(auth_client, db):
    resp = auth_client.get("/api/v1/nfse/config")
    assert resp.status_code == 200
    data = json.loads(resp.data)
    assert data["id"] is None
    assert data["configurado"] is False
    assert data["ambiente"] == "sandbox"
    assert data["gateway_tipo"] == "mock"


def test_put_config_cria_quando_nao_existe(auth_client, db):
    data = _configurar_nfse(auth_client)
    # Etapa 5.6.5: documento e normalizado para digitos puros no backend
    assert data["documento_emissor"] == "12345678000190"
    assert data["cnpj_emissor"] == "12345678000190"  # alias sincronizado
    assert data["tipo_pessoa_emissor"] == "PJ"
    assert data["codigo_servico"] == "17.06"
    assert data["uf"] == "SP"
    assert data["configurado"] is True


def test_put_config_atualiza_existente(auth_client, db):
    _configurar_nfse(auth_client, codigo_servico="17.06")
    # 2a chamada com codigo diferente
    data = _configurar_nfse(auth_client, codigo_servico="17.14")
    assert data["codigo_servico"] == "17.14"
    # Garante que nao criou nova linha
    resp = auth_client.get("/api/v1/nfse/config")
    assert json.loads(resp.data)["codigo_servico"] == "17.14"


def test_put_config_uf_normaliza_uppercase(auth_client, db):
    data = _configurar_nfse(auth_client, uf="sp")
    assert data["uf"] == "SP"


def test_put_config_uf_invalida_retorna_400(auth_client, db):
    resp = auth_client.put(
        "/api/v1/nfse/config",
        json={"uf": "ABC"},
    )
    assert resp.status_code == 400


def test_put_config_aliquota_fora_intervalo_retorna_400(auth_client, db):
    resp = auth_client.put(
        "/api/v1/nfse/config",
        json={"aliquota_iss": 150},
    )
    assert resp.status_code == 400


def test_put_config_gateway_invalido_retorna_400(auth_client, db):
    resp = auth_client.put(
        "/api/v1/nfse/config",
        json={"gateway_tipo": "inexistente"},
    )
    assert resp.status_code == 400


def test_put_config_ambiente_invalido_retorna_400(auth_client, db):
    resp = auth_client.put(
        "/api/v1/nfse/config",
        json={"ambiente": "playground"},
    )
    assert resp.status_code == 400


# ===================== Emissao =====================


def test_emitir_recebimento_pago_com_config_autoriza(auth_client, db):
    _configurar_nfse(auth_client)
    cliente_id = _criar_cliente(auth_client)
    rec_id = _criar_recebimento_pago(auth_client, cliente_id=cliente_id)

    resp = auth_client.post(f"/api/v1/nfse/emitir/{rec_id}")
    assert resp.status_code == 201, resp.data
    data = json.loads(resp.data)
    assert data["status"] == "Autorizada"
    assert data["gateway_id"].startswith("mock-")
    assert data["numero_nfse"]
    assert data["pdf_url"]
    assert data["recebimento_id"] == rec_id
    assert data["tentativas"] == 1


def test_emitir_sem_config_retorna_rejeitada(auth_client, db):
    rec_id = _criar_recebimento_pago(auth_client)
    resp = auth_client.post(f"/api/v1/nfse/emitir/{rec_id}")
    # 200 pq a emissao foi salva (com status=Rejeitada), nao deu erro HTTP.
    assert resp.status_code == 200
    data = json.loads(resp.data)
    assert data["status"] == "Rejeitada"
    assert "obrigatorios" in (data["mensagem_erro"] or "").lower()


def test_emitir_recebimento_pendente_retorna_400(auth_client, db):
    resp = auth_client.post(
        "/api/v1/recebimentos",
        json={
            "descricao": "Pendente",
            "valor": 100,
            "data_vencimento": date.today().isoformat(),
            "status": "Pendente",
        },
    )
    rec_id = json.loads(resp.data)["id"]

    resp = auth_client.post(f"/api/v1/nfse/emitir/{rec_id}")
    assert resp.status_code == 400
    assert b"Pago" in resp.data


def test_emitir_recebimento_inexistente_retorna_404(auth_client, db):
    resp = auth_client.post("/api/v1/nfse/emitir/99999")
    assert resp.status_code == 404


def test_emitir_mock_falha_quando_falta_codigo_servico(auth_client, db):
    _configurar_nfse(auth_client, codigo_servico=None)
    rec_id = _criar_recebimento_pago(auth_client)
    resp = auth_client.post(f"/api/v1/nfse/emitir/{rec_id}")
    data = json.loads(resp.data)
    assert data["status"] == "Rejeitada"


# ===================== Listagem e detalhe =====================


def test_lista_emissoes_apos_emitir(auth_client, db):
    _configurar_nfse(auth_client)
    rec_id = _criar_recebimento_pago(auth_client)
    auth_client.post(f"/api/v1/nfse/emitir/{rec_id}")
    auth_client.post(f"/api/v1/nfse/emitir/{rec_id}")  # reemissao

    resp = auth_client.get("/api/v1/nfse/emissoes")
    assert resp.status_code == 200
    data = json.loads(resp.data)
    assert len(data) == 2
    assert all(e["recebimento_id"] == rec_id for e in data)


def test_lista_emissoes_filtra_por_recebimento_id(auth_client, db):
    _configurar_nfse(auth_client)
    r1 = _criar_recebimento_pago(auth_client, valor=100)
    r2 = _criar_recebimento_pago(auth_client, valor=200)
    auth_client.post(f"/api/v1/nfse/emitir/{r1}")
    auth_client.post(f"/api/v1/nfse/emitir/{r2}")

    resp = auth_client.get(f"/api/v1/nfse/emissoes?recebimento_id={r1}")
    data = json.loads(resp.data)
    assert len(data) == 1
    assert data[0]["recebimento_id"] == r1


def test_detalhe_emissao_individual(auth_client, db):
    _configurar_nfse(auth_client)
    rec_id = _criar_recebimento_pago(auth_client)
    resp = auth_client.post(f"/api/v1/nfse/emitir/{rec_id}")
    emissao_id = json.loads(resp.data)["id"]

    resp = auth_client.get(f"/api/v1/nfse/emissoes/{emissao_id}")
    assert resp.status_code == 200
    data = json.loads(resp.data)
    assert data["id"] == emissao_id
    assert data["status"] == "Autorizada"


# ===================== Multi-tenant =====================


def test_emissoes_nao_vazam_entre_tenants(client, db, two_tenants):
    from decimal import Decimal

    from models import ConfigNFSe, EmissaoNFSe, Recebimento

    # Recebimento + emissao no tenant B (direto no banco)
    rec_b = Recebimento(
        descricao="Pago B",
        valor=Decimal("500.00"),
        status="Pago",
        data_vencimento=date(2026, 5, 1),
        data_pagamento=date(2026, 5, 1),
        user_id=two_tenants.admin_b.id,
        tenant_id=two_tenants.tenant_b.id,
    )
    rec_b.sync_legacy_fields()
    db.session.add(rec_b)
    db.session.flush()

    config_b = ConfigNFSe(
        tenant_id=two_tenants.tenant_b.id,
        cnpj_emissor="99.888.777/0001-66",
        codigo_servico="17.06",
    )
    db.session.add(config_b)

    emissao_b = EmissaoNFSe(
        tenant_id=two_tenants.tenant_b.id,
        user_id=two_tenants.admin_b.id,
        recebimento_id=rec_b.id,
        status="Autorizada",
        gateway_id="mock-b",
        gateway_tipo="mock",
    )
    db.session.add(emissao_b)
    db.session.commit()

    # Login como tenant A
    login = client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "admin_a", "password": two_tenants.admin_password},
    )
    token_a = json.loads(login.data)["access_token"]

    # Lista emissoes — A nao deve ver nada do B
    resp = client.get(
        "/api/v1/nfse/emissoes",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert resp.status_code == 200
    assert json.loads(resp.data) == []

    # GET de config — A pega esqueleto vazio, nao o do B
    resp = client.get(
        "/api/v1/nfse/config",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    data = json.loads(resp.data)
    assert data["cnpj_emissor"] is None
