"""Testes da Fase 1 do "Recebimento Robusto".

Cobre: campos novos (status, data_vencimento, data_pagamento, cliente_id,
categoria, forma_pagamento, notas), endpoint /serie (parcelado e recorrente),
sync com campos legados, e dashboard counters por status.
"""

import json
from datetime import date, timedelta

import pytest

from app import Recebimento


def _criar_cliente(auth_client, sufixo="rb"):
    resp = auth_client.post(
        "/api/v1/clientes",
        json={
            "nome_razao_social": f"Cliente Robusto {sufixo}",
            "cpf_cnpj": f"100.200.300-{sufixo[-2:]}",
            "tipo_pessoa": "PF",
        },
    )
    assert resp.status_code == 201, resp.data
    return json.loads(resp.data)["id"]


def _criar_caso(auth_client, cliente_id, sufixo="rb"):
    resp = auth_client.post(
        "/api/v1/casos",
        json={
            "cliente_id": cliente_id,
            "titulo": f"Caso Robusto {sufixo}",
            "status": "Ativo",
        },
    )
    assert resp.status_code == 201, resp.data
    return json.loads(resp.data)["id"]


# ===================== Campos novos =====================


def test_recebimento_aceita_status_e_devolve_status(auth_client, db):
    cliente_id = _criar_cliente(auth_client, "01")
    resp = auth_client.post(
        "/api/v1/recebimentos",
        json={
            "descricao": "Honorarios PIX",
            "valor": 500.00,
            "data_vencimento": date.today().isoformat(),
            "status": "Pago",
            "cliente_id": cliente_id,
            "categoria": "Honorarios Advocaticios",
        },
    )
    assert resp.status_code == 201, resp.data
    data = json.loads(resp.data)
    assert data["status"] == "Pago"
    assert data["cliente_id"] == cliente_id
    assert data["categoria"] == "Honorarios Advocaticios"
    # Legacy sync
    assert data["recebido"] is True


def test_recebimento_sem_cliente_e_sem_caso(auth_client, db):
    """Permite recebimento solto (ex: PIX recebido sem origem definida)."""
    resp = auth_client.post(
        "/api/v1/recebimentos",
        json={
            "descricao": "PIX avulso",
            "valor": 100.00,
            "data_vencimento": date.today().isoformat(),
            "status": "Pago",
        },
    )
    assert resp.status_code == 201, resp.data
    data = json.loads(resp.data)
    assert data["cliente_id"] is None
    assert data["caso_id"] is None


def test_recebimento_status_pago_preenche_data_pagamento_automatica(auth_client, db):
    cliente_id = _criar_cliente(auth_client, "02")
    resp = auth_client.post(
        "/api/v1/recebimentos",
        json={
            "descricao": "Sem data_pagamento explicita",
            "valor": 200,
            "data_vencimento": date.today().isoformat(),
            "status": "Pago",
            "cliente_id": cliente_id,
        },
    )
    assert resp.status_code == 201, resp.data
    data = json.loads(resp.data)
    assert data["data_pagamento"] == date.today().isoformat()


def test_recebimento_mudar_status_para_pendente_limpa_data_pagamento(auth_client, db):
    cliente_id = _criar_cliente(auth_client, "03")
    res = auth_client.post(
        "/api/v1/recebimentos",
        json={
            "descricao": "Inicialmente pago",
            "valor": 100,
            "data_vencimento": date.today().isoformat(),
            "status": "Pago",
            "cliente_id": cliente_id,
        },
    )
    rid = json.loads(res.data)["id"]
    res = auth_client.put(
        f"/api/v1/recebimentos/{rid}",
        json={
            "descricao": "Voltou a pendente",
            "valor": 100,
            "status": "Pendente",
            "cliente_id": cliente_id,
        },
    )
    assert res.status_code == 200, res.data
    data = json.loads(res.data)
    assert data["status"] == "Pendente"
    assert data["data_pagamento"] is None


def test_recebimento_cliente_id_deduz_do_caso_quando_omitido(auth_client, db):
    cliente_id = _criar_cliente(auth_client, "04")
    caso_id = _criar_caso(auth_client, cliente_id, "04")
    res = auth_client.post(
        "/api/v1/recebimentos",
        json={
            "descricao": "So caso, sem cliente_id",
            "valor": 300,
            "data_vencimento": date.today().isoformat(),
            "caso_id": caso_id,
        },
    )
    assert res.status_code == 201, res.data
    data = json.loads(res.data)
    assert data["cliente_id"] == cliente_id


def test_recebimento_aceita_legacy_recebido_true(auth_client, db):
    """Compat retroativa: clients antigos que mandam `recebido=True` ainda funcionam."""
    cliente_id = _criar_cliente(auth_client, "05")
    res = auth_client.post(
        "/api/v1/recebimentos",
        json={
            "descricao": "Legacy",
            "valor": 100,
            "data_recebimento": date.today().isoformat(),
            "recebido": True,
            "cliente_id": cliente_id,
        },
    )
    assert res.status_code == 201, res.data
    data = json.loads(res.data)
    assert data["status"] == "Pago"
    assert data["recebido"] is True


def test_recebimento_status_invalido_retorna_400(auth_client, db):
    cliente_id = _criar_cliente(auth_client, "06")
    res = auth_client.post(
        "/api/v1/recebimentos",
        json={
            "descricao": "Status quebrado",
            "valor": 100,
            "data_vencimento": date.today().isoformat(),
            "status": "QUITADO",  # nao existe
            "cliente_id": cliente_id,
        },
    )
    assert res.status_code == 400


# ===================== Endpoint /serie =====================


def test_serie_parcelada_gera_n_recebimentos(auth_client, db):
    cliente_id = _criar_cliente(auth_client, "07")
    res = auth_client.post(
        "/api/v1/recebimentos/serie",
        json={
            "tipo": "PARCELADO",
            "frequencia": "MENSAL",
            "valor_parcela": 1000.00,
            "total_parcelas": 12,
            "data_inicio": "2026-06-01",
            "descricao": "Acordo R$ 12.000 em 12x",
            "categoria": "Acordo Judicial",
            "cliente_id": cliente_id,
        },
    )
    assert res.status_code == 201, res.data
    data = json.loads(res.data)
    assert data["tipo"] == "PARCELADO"
    assert data["total_geradas"] == 12
    assert len(data["parcelas"]) == 12

    parcelas = data["parcelas"]
    # Numero da parcela 1..12, vencimentos mensais a partir de jun/2026.
    numeros = [p["numero_parcela"] for p in parcelas]
    assert numeros == list(range(1, 13))
    vencimentos = [p["data_vencimento"] for p in parcelas]
    assert vencimentos[0] == "2026-06-01"
    assert vencimentos[1] == "2026-07-01"
    assert vencimentos[-1] == "2027-05-01"
    # Todas pendentes
    assert all(p["status"] == "Pendente" for p in parcelas)
    # Todas vinculadas a mesma recorrencia
    assert len({p["recorrencia_id"] for p in parcelas}) == 1


def test_serie_recorrente_default_12_parcelas(auth_client, db):
    res = auth_client.post(
        "/api/v1/recebimentos/serie",
        json={
            "tipo": "RECORRENTE",
            "frequencia": "MENSAL",
            "valor_parcela": 1500.00,
            "data_inicio": date.today().isoformat(),
            "descricao": "Honorario mensal",
        },
    )
    assert res.status_code == 201, res.data
    data = json.loads(res.data)
    assert data["total_geradas"] == 12


def test_serie_parcelado_sem_total_parcelas_da_400(auth_client, db):
    res = auth_client.post(
        "/api/v1/recebimentos/serie",
        json={
            "tipo": "PARCELADO",
            "valor_parcela": 100,
            "data_inicio": date.today().isoformat(),
            "descricao": "Falta total",
        },
    )
    assert res.status_code == 400


def test_serie_excede_limite_retorna_400(auth_client, db):
    res = auth_client.post(
        "/api/v1/recebimentos/serie",
        json={
            "tipo": "PARCELADO",
            "valor_parcela": 1,
            "total_parcelas": 200,
            "data_inicio": date.today().isoformat(),
            "descricao": "Muitas demais",
        },
    )
    assert res.status_code == 400


# ===================== Dashboard counters =====================


def test_dashboard_separa_pendentes_a_receber_e_atrasados(auth_client, db):
    cliente_id = _criar_cliente(auth_client, "08")

    # 1 pago (nao deve contar em pendentes)
    auth_client.post(
        "/api/v1/recebimentos",
        json={
            "descricao": "Pago",
            "valor": 500,
            "data_vencimento": date.today().isoformat(),
            "status": "Pago",
            "cliente_id": cliente_id,
        },
    )
    # 1 a receber (futuro)
    auth_client.post(
        "/api/v1/recebimentos",
        json={
            "descricao": "Futuro",
            "valor": 300,
            "data_vencimento": (date.today() + timedelta(days=15)).isoformat(),
            "status": "Pendente",
            "cliente_id": cliente_id,
        },
    )
    # 1 atrasado (passado)
    auth_client.post(
        "/api/v1/recebimentos",
        json={
            "descricao": "Atrasado",
            "valor": 200,
            "data_vencimento": (date.today() - timedelta(days=10)).isoformat(),
            "status": "Pendente",
            "cliente_id": cliente_id,
        },
    )

    res = auth_client.get("/api/v1/dashboard/stats")
    assert res.status_code == 200
    stats = json.loads(res.data)

    # Pendentes = futuro + atrasado (nao inclui pago)
    assert stats["recebimentos_pendentes"]["quantidade"] == 2
    assert stats["recebimentos_pendentes"]["valor_total"] == 500.0  # 300 + 200
    assert stats["recebimentos_a_receber"]["quantidade"] == 1
    assert stats["recebimentos_a_receber"]["valor_total"] == 300.0
    assert stats["recebimentos_atrasados"]["quantidade"] == 1
    assert stats["recebimentos_atrasados"]["valor_total"] == 200.0


def test_dashboard_cancelados_nao_contam_em_pendentes(auth_client, db):
    cliente_id = _criar_cliente(auth_client, "09")
    auth_client.post(
        "/api/v1/recebimentos",
        json={
            "descricao": "Cancelado",
            "valor": 100,
            "data_vencimento": date.today().isoformat(),
            "status": "Cancelado",
            "cliente_id": cliente_id,
        },
    )
    res = auth_client.get("/api/v1/dashboard/stats")
    stats = json.loads(res.data)
    assert stats["recebimentos_pendentes"]["quantidade"] == 0
