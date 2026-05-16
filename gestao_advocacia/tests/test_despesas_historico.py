"""Testes do endpoint GET /despesas/historico.

Espelha test_recebimentos_historico.py. Usado na Etapa 4 (Entrada x Saida)
da feature Pagamentos Recebidos pra compor o saldo do periodo.
"""

import json
from datetime import date
from decimal import Decimal

from models import Despesa


def _criar_paga(auth_client, *, valor, data_pagamento, descricao="Aluguel", categoria=None):
    payload = {
        "descricao": descricao,
        "valor": valor,
        "data_vencimento": data_pagamento.isoformat(),
        "data_pagamento": data_pagamento.isoformat(),
        "status": "Pago",
    }
    if categoria is not None:
        payload["categoria"] = categoria
    resp = auth_client.post("/api/v1/despesas", json=payload)
    assert resp.status_code == 201, resp.data
    return json.loads(resp.data)


def test_historico_despesas_default_usa_ano_corrente(auth_client, db):
    hoje = date.today()
    _criar_paga(auth_client, valor=100.00, data_pagamento=hoje)

    resp = auth_client.get("/api/v1/despesas/historico")
    assert resp.status_code == 200, resp.data
    data = json.loads(resp.data)
    assert data["ano"] == hoje.year
    assert data["qtd_ano"] == 1
    assert Decimal(data["total_ano"]) == Decimal("100.00")
    assert data["total_mes"] is None
    assert data["qtd_mes"] is None


def test_historico_despesas_filtro_ano_e_mes(auth_client, db):
    _criar_paga(auth_client, valor=300.00, data_pagamento=date(2025, 3, 5))
    _criar_paga(auth_client, valor=400.00, data_pagamento=date(2025, 3, 20))
    _criar_paga(auth_client, valor=150.00, data_pagamento=date(2025, 7, 1))

    resp = auth_client.get("/api/v1/despesas/historico?ano=2025&mes=3")
    assert resp.status_code == 200
    data = json.loads(resp.data)
    assert len(data["itens"]) == 2
    assert data["qtd_mes"] == 2
    assert Decimal(data["total_mes"]) == Decimal("700.00")
    assert data["qtd_ano"] == 3
    assert Decimal(data["total_ano"]) == Decimal("850.00")


def test_historico_despesas_ignora_status_diferente_de_pago(auth_client, db):
    _criar_paga(auth_client, valor=500.00, data_pagamento=date(2025, 5, 1))
    for status in ("Pendente", "Cancelado", "Em Negociacao"):
        resp = auth_client.post(
            "/api/v1/despesas",
            json={
                "descricao": f"Nao paga {status}",
                "valor": 999.00,
                "data_vencimento": "2025-05-10",
                "status": status,
            },
        )
        assert resp.status_code == 201

    resp = auth_client.get("/api/v1/despesas/historico?ano=2025")
    assert resp.status_code == 200
    data = json.loads(resp.data)
    assert data["qtd_ano"] == 1
    assert Decimal(data["total_ano"]) == Decimal("500.00")


def test_historico_despesas_por_mes_12_buckets(auth_client, db):
    _criar_paga(auth_client, valor=100.00, data_pagamento=date(2025, 4, 10))
    _criar_paga(auth_client, valor=200.00, data_pagamento=date(2025, 11, 5))

    resp = auth_client.get("/api/v1/despesas/historico?ano=2025")
    data = json.loads(resp.data)
    assert len(data["por_mes"]) == 12
    assert Decimal(data["por_mes"][3]["total"]) == Decimal("100.00")  # abril
    assert Decimal(data["por_mes"][10]["total"]) == Decimal("200.00")  # novembro
    assert Decimal(data["por_mes"][0]["total"]) == Decimal("0")  # janeiro vazio


def test_historico_despesas_ano_invalido_retorna_400(auth_client, db):
    resp = auth_client.get("/api/v1/despesas/historico?ano=abc")
    assert resp.status_code == 400
    resp = auth_client.get("/api/v1/despesas/historico?ano=2025&mes=13")
    assert resp.status_code == 400


def test_historico_despesas_nao_vaza_entre_tenants(client, db, two_tenants):
    import json as _json

    desp_b = Despesa(
        descricao="Paga do B",
        valor=Decimal("777.00"),
        status="Pago",
        data_vencimento=date(2025, 5, 1),
        data_pagamento=date(2025, 5, 15),
        user_id=two_tenants.admin_b.id,
        tenant_id=two_tenants.tenant_b.id,
    )
    desp_b.sync_legacy_fields()
    db.session.add(desp_b)
    db.session.commit()

    login = client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "admin_a", "password": two_tenants.admin_password},
    )
    token_a = _json.loads(login.data)["access_token"]

    resp = client.get(
        "/api/v1/despesas/historico?ano=2025",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert resp.status_code == 200
    data = _json.loads(resp.data)
    assert data["qtd_ano"] == 0
    assert Decimal(data["total_ano"]) == Decimal("0")
