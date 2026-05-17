"""Testes da Etapa 6: campos ano_previsao e tipo_recebimento no Recebimento.

Pedido do Emerson via WhatsApp: form de Adicionar Recebimento deve ter
'Ano de previsao' (util pra precatorio/RPV) e 'Tipo de recebimento'
(Precatorio, RPV, Diretamente do cliente, Deposito judicial,
Acordo extrajudicial, Outros).
"""

import json
from datetime import date


def test_post_recebimento_aceita_ano_previsao_e_tipo(auth_client, db):
    resp = auth_client.post(
        "/api/v1/recebimentos",
        json={
            "descricao": "Precatorio aposentadoria",
            "valor": 50000,
            "ano_previsao": 2028,
            "tipo_recebimento": "Precatorio",
            "status": "Pendente",
        },
    )
    assert resp.status_code == 201, resp.data
    data = json.loads(resp.data)
    assert data["ano_previsao"] == 2028
    assert data["tipo_recebimento"] == "Precatorio"


def test_post_recebimento_sem_ano_e_tipo_continua_valido(auth_client, db):
    """Campos novos sao opcionais — recebimentos antigos seguem funcionando."""
    resp = auth_client.post(
        "/api/v1/recebimentos",
        json={
            "descricao": "PIX",
            "valor": 100,
            "data_vencimento": date.today().isoformat(),
        },
    )
    assert resp.status_code == 201, resp.data
    data = json.loads(resp.data)
    assert data["ano_previsao"] is None
    assert data["tipo_recebimento"] is None


def test_put_recebimento_atualiza_ano_e_tipo(auth_client, db):
    res = auth_client.post(
        "/api/v1/recebimentos",
        json={
            "descricao": "Honorarios",
            "valor": 1000,
            "data_vencimento": date.today().isoformat(),
        },
    )
    rid = json.loads(res.data)["id"]

    res = auth_client.put(
        f"/api/v1/recebimentos/{rid}",
        json={
            "descricao": "Honorarios",
            "valor": 1000,
            "ano_previsao": 2027,
            "tipo_recebimento": "RPV",
        },
    )
    assert res.status_code == 200, res.data
    data = json.loads(res.data)
    assert data["ano_previsao"] == 2027
    assert data["tipo_recebimento"] == "RPV"


def test_put_recebimento_limpa_ano_e_tipo_com_null(auth_client, db):
    res = auth_client.post(
        "/api/v1/recebimentos",
        json={
            "descricao": "Inicial",
            "valor": 500,
            "ano_previsao": 2027,
            "tipo_recebimento": "Precatorio",
        },
    )
    rid = json.loads(res.data)["id"]

    res = auth_client.put(
        f"/api/v1/recebimentos/{rid}",
        json={
            "descricao": "Inicial",
            "valor": 500,
            "ano_previsao": None,
            "tipo_recebimento": None,
        },
    )
    assert res.status_code == 200
    data = json.loads(res.data)
    assert data["ano_previsao"] is None
    assert data["tipo_recebimento"] is None


def test_tipo_recebimento_invalido_retorna_400(auth_client, db):
    resp = auth_client.post(
        "/api/v1/recebimentos",
        json={
            "descricao": "Tipo errado",
            "valor": 100,
            "tipo_recebimento": "Sacolinha",
        },
    )
    assert resp.status_code == 400


def test_ano_previsao_nao_numerico_retorna_400(auth_client, db):
    resp = auth_client.post(
        "/api/v1/recebimentos",
        json={
            "descricao": "Ano errado",
            "valor": 100,
            "ano_previsao": "dois mil e vinte e oito",
        },
    )
    assert resp.status_code == 400


def test_ano_previsao_fora_intervalo_retorna_400(auth_client, db):
    resp = auth_client.post(
        "/api/v1/recebimentos",
        json={
            "descricao": "Ano absurdo",
            "valor": 100,
            "ano_previsao": 1800,
        },
    )
    assert resp.status_code == 400

    resp = auth_client.post(
        "/api/v1/recebimentos",
        json={
            "descricao": "Ano absurdo",
            "valor": 100,
            "ano_previsao": 3000,
        },
    )
    assert resp.status_code == 400


def test_todos_os_tipos_validos_sao_aceitos(auth_client, db):
    """Sanidade: cada um dos 6 tipos do dropdown e aceito."""
    tipos = [
        "Diretamente do cliente",
        "Precatorio",
        "RPV",
        "Deposito judicial",
        "Acordo extrajudicial",
        "Outros",
    ]
    for tipo in tipos:
        resp = auth_client.post(
            "/api/v1/recebimentos",
            json={
                "descricao": f"Teste {tipo}",
                "valor": 100,
                "tipo_recebimento": tipo,
            },
        )
        assert resp.status_code == 201, f"{tipo} rejeitado: {resp.data}"
        assert json.loads(resp.data)["tipo_recebimento"] == tipo
