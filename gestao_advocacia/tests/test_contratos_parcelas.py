# tests/test_contratos_parcelas.py
# Fase 1 (auditoria UX): cria contrato via API e gera parcelas — cobre o
# bug em que as parcelas nasciam SEM tenant_id/cliente_id (com RLS no
# Postgres elas sumiam das listagens do tenant).

import json
from datetime import date, timedelta

from models import Cliente, Recebimento, User


def _montar_cliente_caso(auth_client, db):
    user = User.query.filter_by(username="testuser").first()
    cliente = Cliente(
        tenant_id=user.tenant_id,
        user_id=user.id,
        nome_razao_social="Cliente Contrato",
        cpf_cnpj="15350946056",
        tipo_pessoa="PF",
    )
    db.session.add(cliente)
    db.session.commit()
    resp = auth_client.post(
        "/api/v1/casos/",
        json={"titulo": "Caso Contrato", "cliente_id": cliente.id, "status": "Ativo"},
    )
    assert resp.status_code == 201, resp.data
    return cliente, json.loads(resp.data)


def test_criar_contrato_e_gerar_parcelas_com_tenant(auth_client, db):
    cliente, caso = _montar_cliente_caso(auth_client, db)
    user = User.query.filter_by(username="testuser").first()

    resp = auth_client.post(
        "/api/v1/contratos/",
        json={
            "caso_id": caso["id"],
            "cliente_id": cliente.id,
            "tipo_honorario": "Fixo",
            "valor_total": 3000,
            "status": "Ativo",
        },
    )
    assert resp.status_code == 201, resp.data
    contrato = json.loads(resp.data)

    primeiro = (date.today() + timedelta(days=10)).isoformat()
    resp = auth_client.post(
        f"/api/v1/contratos/{contrato['id']}/gerar-parcelas",
        json={"quantidade_parcelas": 3, "primeiro_vencimento": primeiro},
    )
    assert resp.status_code == 201, resp.data

    parcelas = Recebimento.query.filter_by(contrato_id=contrato["id"]).all()
    assert len(parcelas) == 3
    for p in parcelas:
        assert float(p.valor) == 1000.0
        assert p.caso_id == caso["id"]
        # o bug: estes dois vinham None
        assert p.tenant_id == user.tenant_id
        assert p.cliente_id == cliente.id
    # vencimentos mensais a partir do primeiro
    assert parcelas[0].data_recebimento.isoformat() == primeiro


def test_gerar_parcelas_sem_valor_retorna_400(auth_client, db):
    cliente, caso = _montar_cliente_caso(auth_client, db)
    resp = auth_client.post(
        "/api/v1/contratos/",
        json={
            "caso_id": caso["id"],
            "cliente_id": cliente.id,
            "tipo_honorario": "Êxito",
            "percentual_exito": 20,
        },
    )
    contrato = json.loads(resp.data)
    resp = auth_client.post(
        f"/api/v1/contratos/{contrato['id']}/gerar-parcelas",
        json={"quantidade_parcelas": 2},
    )
    assert resp.status_code == 400
