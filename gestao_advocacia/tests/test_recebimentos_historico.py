"""Testes do endpoint GET /recebimentos/historico.

Cobre filtros (ano, ano+mes), agregados (total_mes, total_ano,
por_categoria, por_mes), validacao de params, e isolamento multi-tenant.
"""

import json
from datetime import date
from decimal import Decimal

from models import Recebimento, User


def _criar_pago(auth_client, *, valor, data_pagamento, descricao="Honor.", categoria=None):
    """Cria recebimento ja com status=Pago e data_pagamento explicita.

    Usa o endpoint normal de POST. data_vencimento = data_pagamento por
    simplicidade (o endpoint nao exige relacao entre as duas).
    """
    payload = {
        "descricao": descricao,
        "valor": valor,
        "data_vencimento": data_pagamento.isoformat(),
        "data_pagamento": data_pagamento.isoformat(),
        "status": "Pago",
    }
    if categoria is not None:
        payload["categoria"] = categoria
    resp = auth_client.post("/api/v1/recebimentos", json=payload)
    assert resp.status_code == 201, resp.data
    return json.loads(resp.data)


# ===================== Filtros =====================


def test_historico_default_usa_ano_corrente(auth_client, db):
    hoje = date.today()
    _criar_pago(auth_client, valor=100.00, data_pagamento=hoje)

    resp = auth_client.get("/api/v1/recebimentos/historico")
    assert resp.status_code == 200, resp.data
    data = json.loads(resp.data)
    assert data["ano"] == hoje.year
    assert data["mes"] is None
    assert data["qtd_ano"] == 1
    assert Decimal(data["total_ano"]) == Decimal("100.00")
    # Sem filtro de mes, total_mes/qtd_mes devem ser null.
    assert data["total_mes"] is None
    assert data["qtd_mes"] is None


def test_historico_filtro_ano_especifico(auth_client, db):
    _criar_pago(auth_client, valor=200.00, data_pagamento=date(2024, 6, 15))
    _criar_pago(auth_client, valor=999.00, data_pagamento=date(2025, 3, 10))

    resp = auth_client.get("/api/v1/recebimentos/historico?ano=2024")
    assert resp.status_code == 200
    data = json.loads(resp.data)
    assert data["ano"] == 2024
    assert data["qtd_ano"] == 1
    assert Decimal(data["total_ano"]) == Decimal("200.00")


def test_historico_filtro_ano_e_mes(auth_client, db):
    _criar_pago(auth_client, valor=300.00, data_pagamento=date(2025, 3, 5))
    _criar_pago(auth_client, valor=400.00, data_pagamento=date(2025, 3, 20))
    _criar_pago(auth_client, valor=150.00, data_pagamento=date(2025, 7, 1))

    resp = auth_client.get("/api/v1/recebimentos/historico?ano=2025&mes=3")
    assert resp.status_code == 200
    data = json.loads(resp.data)
    assert data["ano"] == 2025
    assert data["mes"] == 3
    # itens filtrados sao apenas os de marco/2025
    assert len(data["itens"]) == 2
    assert data["qtd_mes"] == 2
    assert Decimal(data["total_mes"]) == Decimal("700.00")
    # total_ano cobre o ano inteiro
    assert data["qtd_ano"] == 3
    assert Decimal(data["total_ano"]) == Decimal("850.00")


# ===================== Filtragem por status =====================


def test_historico_ignora_status_diferente_de_pago(auth_client, db):
    # 1 Pago em 2025
    _criar_pago(auth_client, valor=500.00, data_pagamento=date(2025, 5, 1))
    # Pendente, Cancelado, Em Negociacao — NAO devem aparecer
    for status in ("Pendente", "Cancelado", "Em Negociacao"):
        resp = auth_client.post(
            "/api/v1/recebimentos",
            json={
                "descricao": f"Nao pago {status}",
                "valor": 999.00,
                "data_vencimento": "2025-05-10",
                "status": status,
            },
        )
        assert resp.status_code == 201

    resp = auth_client.get("/api/v1/recebimentos/historico?ano=2025")
    assert resp.status_code == 200
    data = json.loads(resp.data)
    assert data["qtd_ano"] == 1
    assert Decimal(data["total_ano"]) == Decimal("500.00")


# ===================== Agregados =====================


def test_historico_por_categoria_ordena_por_total_desc(auth_client, db):
    _criar_pago(auth_client, valor=100.00, data_pagamento=date(2025, 1, 1), categoria="Consultoria")
    _criar_pago(auth_client, valor=900.00, data_pagamento=date(2025, 1, 2), categoria="Honorarios")
    _criar_pago(auth_client, valor=200.00, data_pagamento=date(2025, 1, 3), categoria="Honorarios")
    _criar_pago(auth_client, valor=50.00, data_pagamento=date(2025, 1, 4))  # sem categoria

    resp = auth_client.get("/api/v1/recebimentos/historico?ano=2025")
    assert resp.status_code == 200
    data = json.loads(resp.data)

    cats = data["por_categoria"]
    # Honorarios (1100) > Consultoria (100) > Sem categoria (50)
    assert [c["categoria"] for c in cats] == ["Honorarios", "Consultoria", "Sem categoria"]
    assert Decimal(cats[0]["total"]) == Decimal("1100.00")
    assert cats[0]["qtd"] == 2
    assert cats[2]["categoria"] == "Sem categoria"


def test_historico_por_mes_tem_12_buckets_e_zera_meses_vazios(auth_client, db):
    _criar_pago(auth_client, valor=100.00, data_pagamento=date(2025, 4, 10))
    _criar_pago(auth_client, valor=200.00, data_pagamento=date(2025, 4, 20))
    _criar_pago(auth_client, valor=300.00, data_pagamento=date(2025, 11, 5))

    resp = auth_client.get("/api/v1/recebimentos/historico?ano=2025")
    assert resp.status_code == 200
    data = json.loads(resp.data)

    por_mes = data["por_mes"]
    assert len(por_mes) == 12
    assert [b["mes"] for b in por_mes] == list(range(1, 13))
    # Abril (mes=4) tem 2 pagamentos somando 300
    abril = por_mes[3]
    assert abril["mes"] == 4
    assert abril["qtd"] == 2
    assert Decimal(abril["total"]) == Decimal("300.00")
    # Novembro (mes=11) tem 1 pagamento de 300
    nov = por_mes[10]
    assert nov["qtd"] == 1
    assert Decimal(nov["total"]) == Decimal("300.00")
    # Janeiro (vazio)
    jan = por_mes[0]
    assert jan["qtd"] == 0
    assert Decimal(jan["total"]) == Decimal("0")


def test_historico_pago_sem_data_pagamento_e_ignorado(auth_client, db, app):
    """Recebimento Pago mas sem data_pagamento (caso patologico) nao deve
    aparecer no historico, pois o agrupamento e por data_pagamento."""
    # Cria diretamente no banco pra forcar status=Pago + data_pagamento=None
    # (o endpoint preenche data_pagamento automaticamente).
    with app.app_context():
        user = User.query.filter_by(username="testuser").first()
        rec = Recebimento(
            descricao="Pago sem data",
            valor=Decimal("1234.00"),
            status="Pago",
            data_vencimento=date(2025, 6, 1),
            data_pagamento=None,
            user_id=user.id,
            tenant_id=user.tenant_id,
        )
        rec.sync_legacy_fields()
        db.session.add(rec)
        db.session.commit()

    resp = auth_client.get("/api/v1/recebimentos/historico?ano=2025")
    assert resp.status_code == 200
    data = json.loads(resp.data)
    assert data["qtd_ano"] == 0
    assert Decimal(data["total_ano"]) == Decimal("0")


# ===================== Validacao =====================


def test_historico_ano_invalido_retorna_400(auth_client, db):
    resp = auth_client.get("/api/v1/recebimentos/historico?ano=abc")
    assert resp.status_code == 400


def test_historico_mes_fora_do_intervalo_retorna_400(auth_client, db):
    resp = auth_client.get("/api/v1/recebimentos/historico?ano=2025&mes=13")
    assert resp.status_code == 400
    resp = auth_client.get("/api/v1/recebimentos/historico?ano=2025&mes=0")
    assert resp.status_code == 400


def test_historico_mes_nao_numerico_retorna_400(auth_client, db):
    resp = auth_client.get("/api/v1/recebimentos/historico?ano=2025&mes=abc")
    assert resp.status_code == 400


# ===================== Multi-tenant =====================


def test_historico_nao_vaza_entre_tenants(client, db, two_tenants):
    """Tenant A nao deve ver pagamentos do Tenant B."""
    import json as _json

    # Pagamento no tenant B (direto no banco pra simplicidade)
    rec_b = Recebimento(
        descricao="Pago do B",
        valor=Decimal("777.00"),
        status="Pago",
        data_vencimento=date(2025, 5, 1),
        data_pagamento=date(2025, 5, 15),
        user_id=two_tenants.admin_b.id,
        tenant_id=two_tenants.tenant_b.id,
    )
    rec_b.sync_legacy_fields()
    db.session.add(rec_b)
    db.session.commit()

    # Login como admin do tenant A
    login = client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "admin_a", "password": two_tenants.admin_password},
    )
    assert login.status_code == 200
    token_a = _json.loads(login.data)["access_token"]

    resp = client.get(
        "/api/v1/recebimentos/historico?ano=2025",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert resp.status_code == 200
    data = _json.loads(resp.data)
    # Tenant A nao tem pagamentos — nao deve enxergar o do B.
    assert data["qtd_ano"] == 0
    assert Decimal(data["total_ano"]) == Decimal("0")
