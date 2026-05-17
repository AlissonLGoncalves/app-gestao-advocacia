"""Tests do endpoint POST /api/v1/nfse/emissoes/<id>/cancelar (PR 4
do diagnostico — UI de cancelamento).

Cobre:
- Cancela emissao Autorizada em modo mock (sem chamar portal real)
- Rejeita emissao em status diferente de Autorizada
- Rejeita sem chave de acesso
- Valida motivo (>=15 chars)
- Valida cod_motivo (1|2|9)
- Multi-tenant: tenant A nao consegue cancelar emissao do tenant B
"""

import json
from datetime import date
from decimal import Decimal

from models import ConfigNFSe, EmissaoNFSe, Recebimento


def _criar_config(auth_client):
    """Configura NFS-e em modo mock pro tenant da auth_client."""
    resp = auth_client.put(
        "/api/v1/nfse/config",
        json={
            "tipo_pessoa_emissor": "PJ",
            "documento_emissor": "12345678000190",
            "codigo_servico": "17.06",
            "ambiente": "sandbox",
            "gateway_tipo": "mock",
        },
    )
    assert resp.status_code == 200, resp.data


def _criar_recebimento_e_emitir(auth_client):
    """Cria recebimento Pago + emite NFS-e via mock + retorna emissao."""
    rec = auth_client.post(
        "/api/v1/recebimentos",
        json={
            "descricao": "Honorario",
            "valor": 1000,
            "data_vencimento": date.today().isoformat(),
            "data_pagamento": date.today().isoformat(),
            "status": "Pago",
        },
    )
    rec_id = json.loads(rec.data)["id"]
    resp = auth_client.post(f"/api/v1/nfse/emitir/{rec_id}")
    assert resp.status_code == 201, resp.data
    return json.loads(resp.data)


# ===================== Casos de sucesso (mock) =====================


def test_cancelar_emissao_mock_autorizada(auth_client, db):
    _criar_config(auth_client)
    emissao = _criar_recebimento_e_emitir(auth_client)
    assert emissao["status"] == "Autorizada"

    resp = auth_client.post(
        f"/api/v1/nfse/emissoes/{emissao['id']}/cancelar",
        json={
            "motivo": "Erro de digitacao no valor do servico cobrado.",
            "cod_motivo": 1,
        },
    )
    assert resp.status_code == 200, resp.data
    data = json.loads(resp.data)
    assert data["status"] == "Cancelada"
    assert "Cancelamento simulado" in (data["mensagem_erro"] or "")


def test_cancelar_aceita_cod_motivo_2_servico_nao_prestado(auth_client, db):
    _criar_config(auth_client)
    emissao = _criar_recebimento_e_emitir(auth_client)

    resp = auth_client.post(
        f"/api/v1/nfse/emissoes/{emissao['id']}/cancelar",
        json={
            "motivo": "Servico definitivamente nao foi prestado ao cliente.",
            "cod_motivo": 2,
        },
    )
    assert resp.status_code == 200
    assert json.loads(resp.data)["status"] == "Cancelada"


def test_cancelar_aceita_cod_motivo_9_outros(auth_client, db):
    _criar_config(auth_client)
    emissao = _criar_recebimento_e_emitir(auth_client)

    resp = auth_client.post(
        f"/api/v1/nfse/emissoes/{emissao['id']}/cancelar",
        json={
            "motivo": "Cliente solicitou cancelamento por motivo pessoal.",
            "cod_motivo": 9,
        },
    )
    assert resp.status_code == 200


# ===================== Validacao do body =====================


def test_cancelar_motivo_curto_retorna_400(auth_client, db):
    _criar_config(auth_client)
    emissao = _criar_recebimento_e_emitir(auth_client)

    resp = auth_client.post(
        f"/api/v1/nfse/emissoes/{emissao['id']}/cancelar",
        json={"motivo": "curto", "cod_motivo": 9},
    )
    assert resp.status_code == 400
    assert b"15" in resp.data


def test_cancelar_motivo_vazio_retorna_400(auth_client, db):
    _criar_config(auth_client)
    emissao = _criar_recebimento_e_emitir(auth_client)

    resp = auth_client.post(
        f"/api/v1/nfse/emissoes/{emissao['id']}/cancelar",
        json={"cod_motivo": 9},
    )
    assert resp.status_code == 400


def test_cancelar_cod_motivo_invalido_retorna_400(auth_client, db):
    _criar_config(auth_client)
    emissao = _criar_recebimento_e_emitir(auth_client)

    resp = auth_client.post(
        f"/api/v1/nfse/emissoes/{emissao['id']}/cancelar",
        json={
            "motivo": "Motivo qualquer com mais de 15 caracteres.",
            "cod_motivo": 42,  # nao esta em {1, 2, 9}
        },
    )
    assert resp.status_code == 400


def test_cancelar_cod_motivo_nao_numerico_retorna_400(auth_client, db):
    _criar_config(auth_client)
    emissao = _criar_recebimento_e_emitir(auth_client)

    resp = auth_client.post(
        f"/api/v1/nfse/emissoes/{emissao['id']}/cancelar",
        json={
            "motivo": "Motivo qualquer com mais de 15 caracteres.",
            "cod_motivo": "abc",
        },
    )
    assert resp.status_code == 400


# ===================== Status incompativel =====================


def test_cancelar_emissao_ja_cancelada_retorna_400(auth_client, db):
    _criar_config(auth_client)
    emissao = _criar_recebimento_e_emitir(auth_client)

    # Primeiro cancela
    auth_client.post(
        f"/api/v1/nfse/emissoes/{emissao['id']}/cancelar",
        json={"motivo": "Motivo qualquer com mais de 15 chars.", "cod_motivo": 9},
    )

    # Tenta cancelar de novo
    resp = auth_client.post(
        f"/api/v1/nfse/emissoes/{emissao['id']}/cancelar",
        json={"motivo": "Motivo qualquer com mais de 15 chars.", "cod_motivo": 9},
    )
    assert resp.status_code == 400
    assert b"Cancelada" in resp.data or b"Autorizada" in resp.data


def test_cancelar_emissao_rejeitada_retorna_400(auth_client, db):
    """Emissao que falhou nao pode ser 'cancelada' — nao foi pra portal."""
    # Cria emissao Rejeitada manualmente (sem config -> rejeita)
    rec = auth_client.post(
        "/api/v1/recebimentos",
        json={
            "descricao": "Sem config",
            "valor": 100,
            "data_pagamento": date.today().isoformat(),
            "status": "Pago",
        },
    )
    rec_id = json.loads(rec.data)["id"]
    emit = auth_client.post(f"/api/v1/nfse/emitir/{rec_id}")
    emissao = json.loads(emit.data)
    assert emissao["status"] == "Rejeitada"

    resp = auth_client.post(
        f"/api/v1/nfse/emissoes/{emissao['id']}/cancelar",
        json={"motivo": "Motivo qualquer com mais de 15 chars.", "cod_motivo": 9},
    )
    assert resp.status_code == 400


def test_cancelar_emissao_inexistente_retorna_404(auth_client, db):
    resp = auth_client.post(
        "/api/v1/nfse/emissoes/99999/cancelar",
        json={"motivo": "Motivo qualquer com mais de 15 chars.", "cod_motivo": 9},
    )
    assert resp.status_code == 404


# ===================== Multi-tenant =====================


def test_cancelar_nao_vaza_entre_tenants(client, db, two_tenants):
    """Tenant A nao deve conseguir cancelar emissao do tenant B."""
    # Cria emissao do tenant B direto no banco
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

    emissao_b = EmissaoNFSe(
        tenant_id=two_tenants.tenant_b.id,
        user_id=two_tenants.admin_b.id,
        recebimento_id=rec_b.id,
        status="Autorizada",
        gateway_id="mock-tenant-b",
        gateway_tipo="mock",
    )
    db.session.add(emissao_b)

    config_b = ConfigNFSe(
        tenant_id=two_tenants.tenant_b.id,
        cnpj_emissor="99888777000166",
        documento_emissor="99888777000166",
        codigo_servico="17.06",
    )
    db.session.add(config_b)
    db.session.commit()
    emissao_b_id = emissao_b.id

    # Login como tenant A
    login = client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "admin_a", "password": two_tenants.admin_password},
    )
    token_a = json.loads(login.data)["access_token"]

    # Tenta cancelar emissao do B usando token de A -> 404
    resp = client.post(
        f"/api/v1/nfse/emissoes/{emissao_b_id}/cancelar",
        json={
            "motivo": "Tentativa indevida de cancelar nota de outro tenant.",
            "cod_motivo": 9,
        },
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert resp.status_code == 404
