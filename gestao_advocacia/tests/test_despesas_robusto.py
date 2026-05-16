"""Testes da Fase 1 do "Despesa Robusto".

Espelha test_recebimentos_robusto.py. Cobre campos novos (status,
data_vencimento, data_pagamento, cliente_id, categoria, fornecedor,
forma_pagamento, notas), endpoint /serie, sync com legacy e dashboard.
"""

import json
from datetime import date, timedelta


def _criar_cliente(auth_client, sufixo="dr"):
    resp = auth_client.post(
        "/api/v1/clientes",
        json={
            "nome_razao_social": f"Cliente Despesa {sufixo}",
            "cpf_cnpj": f"100.200.300-{sufixo[-2:]}",
            "tipo_pessoa": "PF",
        },
    )
    assert resp.status_code == 201, resp.data
    return json.loads(resp.data)["id"]


def _criar_caso(auth_client, cliente_id, sufixo="dr"):
    resp = auth_client.post(
        "/api/v1/casos",
        json={
            "cliente_id": cliente_id,
            "titulo": f"Caso Despesa {sufixo}",
            "status": "Ativo",
        },
    )
    assert resp.status_code == 201, resp.data
    return json.loads(resp.data)["id"]


# ===== Campos novos =====


def test_despesa_aceita_status_e_devolve_status(auth_client, db):
    resp = auth_client.post(
        "/api/v1/despesas",
        json={
            "descricao": "Aluguel escritorio",
            "valor": 3000.00,
            "data_vencimento": date.today().isoformat(),
            "status": "Pago",
            "categoria": "Aluguel",
            "fornecedor": "Imobiliaria XYZ",
        },
    )
    assert resp.status_code == 201, resp.data
    data = json.loads(resp.data)
    assert data["status"] == "Pago"
    assert data["categoria"] == "Aluguel"
    assert data["fornecedor"] == "Imobiliaria XYZ"
    # Legacy sync
    assert data["pago"] is True


def test_despesa_sem_cliente_sem_caso(auth_client, db):
    """Despesa avulsa (conta de luz, material de escritorio)."""
    resp = auth_client.post(
        "/api/v1/despesas",
        json={
            "descricao": "Cafe pro escritorio",
            "valor": 50.00,
            "data_vencimento": date.today().isoformat(),
            "status": "Pago",
        },
    )
    assert resp.status_code == 201, resp.data
    data = json.loads(resp.data)
    assert data["cliente_id"] is None
    assert data["caso_id"] is None


def test_despesa_status_pago_preenche_data_pagamento(auth_client, db):
    resp = auth_client.post(
        "/api/v1/despesas",
        json={
            "descricao": "Conta agua",
            "valor": 100,
            "data_vencimento": date.today().isoformat(),
            "status": "Pago",
        },
    )
    data = json.loads(resp.data)
    assert data["data_pagamento"] == date.today().isoformat()


def test_despesa_mudar_para_pendente_limpa_data_pagamento(auth_client, db):
    res = auth_client.post(
        "/api/v1/despesas",
        json={
            "descricao": "Era paga",
            "valor": 100,
            "data_vencimento": date.today().isoformat(),
            "status": "Pago",
        },
    )
    did = json.loads(res.data)["id"]
    res = auth_client.put(
        f"/api/v1/despesas/{did}",
        json={"descricao": "Voltou pendente", "valor": 100, "status": "Pendente"},
    )
    assert res.status_code == 200, res.data
    data = json.loads(res.data)
    assert data["status"] == "Pendente"
    assert data["data_pagamento"] is None


def test_despesa_aceita_legacy_pago_true(auth_client, db):
    """Clients antigos enviando `pago=True` ainda funcionam."""
    res = auth_client.post(
        "/api/v1/despesas",
        json={
            "descricao": "Legacy",
            "valor": 100,
            "data_despesa": date.today().isoformat(),
            "pago": True,
        },
    )
    assert res.status_code == 201, res.data
    data = json.loads(res.data)
    assert data["status"] == "Pago"
    assert data["pago"] is True


def test_despesa_status_invalido_400(auth_client, db):
    res = auth_client.post(
        "/api/v1/despesas",
        json={
            "descricao": "Status quebrado",
            "valor": 100,
            "data_vencimento": date.today().isoformat(),
            "status": "QUITADO",
        },
    )
    assert res.status_code == 400


def test_despesa_cliente_id_deduz_do_caso(auth_client, db):
    cliente_id = _criar_cliente(auth_client, "01")
    caso_id = _criar_caso(auth_client, cliente_id, "01")
    res = auth_client.post(
        "/api/v1/despesas",
        json={
            "descricao": "Custas reembolsaveis",
            "valor": 300,
            "data_vencimento": date.today().isoformat(),
            "caso_id": caso_id,
        },
    )
    assert res.status_code == 201, res.data
    data = json.loads(res.data)
    assert data["cliente_id"] == cliente_id


# ===== Endpoint /serie =====


def test_serie_aluguel_recorrente_gera_12(auth_client, db):
    res = auth_client.post(
        "/api/v1/despesas/serie",
        json={
            "tipo": "RECORRENTE",
            "frequencia": "MENSAL",
            "valor_parcela": 3000.00,
            "data_inicio": "2026-06-01",
            "descricao": "Aluguel",
            "fornecedor": "Imobiliaria XYZ",
            "categoria": "Aluguel",
        },
    )
    assert res.status_code == 201, res.data
    data = json.loads(res.data)
    assert data["total_geradas"] == 12
    parcelas = data["parcelas"]
    assert all(p["status"] == "Pendente" for p in parcelas)
    assert all(p["fornecedor"] == "Imobiliaria XYZ" for p in parcelas)
    assert parcelas[0]["data_vencimento"] == "2026-06-01"
    assert parcelas[-1]["data_vencimento"] == "2027-05-01"


def test_serie_parcelado_compra_software(auth_client, db):
    res = auth_client.post(
        "/api/v1/despesas/serie",
        json={
            "tipo": "PARCELADO",
            "frequencia": "MENSAL",
            "valor_parcela": 500,
            "total_parcelas": 10,
            "data_inicio": "2026-06-15",
            "descricao": "SaaS anual",
            "fornecedor": "TechCo",
        },
    )
    assert res.status_code == 201, res.data
    data = json.loads(res.data)
    assert data["total_geradas"] == 10
    numeros = [p["numero_parcela"] for p in data["parcelas"]]
    assert numeros == list(range(1, 11))


def test_serie_parcelado_sem_total_400(auth_client, db):
    res = auth_client.post(
        "/api/v1/despesas/serie",
        json={
            "tipo": "PARCELADO",
            "valor_parcela": 100,
            "data_inicio": date.today().isoformat(),
            "descricao": "Sem total",
        },
    )
    assert res.status_code == 400


# ===== Dashboard counters =====


def test_dashboard_separa_despesas_programadas_e_atrasadas(auth_client, db):
    # 1 paga
    auth_client.post(
        "/api/v1/despesas",
        json={
            "descricao": "Paga",
            "valor": 500,
            "data_vencimento": date.today().isoformat(),
            "status": "Pago",
        },
    )
    # 1 programada (futuro)
    auth_client.post(
        "/api/v1/despesas",
        json={
            "descricao": "Futura",
            "valor": 300,
            "data_vencimento": (date.today() + timedelta(days=10)).isoformat(),
            "status": "Pendente",
        },
    )
    # 1 atrasada (passado)
    auth_client.post(
        "/api/v1/despesas",
        json={
            "descricao": "Atrasada",
            "valor": 200,
            "data_vencimento": (date.today() - timedelta(days=5)).isoformat(),
            "status": "Pendente",
        },
    )

    stats = json.loads(auth_client.get("/api/v1/dashboard/stats").data)

    # A pagar = futura + atrasada (nao inclui paga)
    assert stats["despesas_a_pagar"]["quantidade"] == 2
    assert stats["despesas_a_pagar"]["valor_total"] == 500.0
    assert stats["despesas_programadas"]["quantidade"] == 1
    assert stats["despesas_programadas"]["valor_total"] == 300.0
    assert stats["despesas_atrasadas"]["quantidade"] == 1
    assert stats["despesas_atrasadas"]["valor_total"] == 200.0


def test_dashboard_canceladas_nao_contam(auth_client, db):
    auth_client.post(
        "/api/v1/despesas",
        json={
            "descricao": "Cancelada",
            "valor": 100,
            "data_vencimento": date.today().isoformat(),
            "status": "Cancelado",
        },
    )
    stats = json.loads(auth_client.get("/api/v1/dashboard/stats").data)
    assert stats["despesas_a_pagar"]["quantidade"] == 0
