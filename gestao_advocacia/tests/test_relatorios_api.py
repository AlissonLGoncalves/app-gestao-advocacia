# tests/test_relatorios_api.py
# Issue #302 — routes/relatorios.py (dados financeiros) estava sem testes.
# Cobre: auth obrigatória, status calculado (pago/pendente/vencido),
# totais, fluxo de caixa mensal e isolamento por usuário.

import json
from datetime import date, timedelta

from extensions import db as _db
from models import Caso, Cliente, Despesa, Recebimento, User


def _seed_financeiro(db):
    """Cria cliente+caso+recebimentos+despesas pro user do auth_client."""
    user = User.query.filter_by(username="testuser").first()
    cliente = Cliente(
        tenant_id=user.tenant_id,
        user_id=user.id,
        nome_razao_social="Cliente Relatorio",
        cpf_cnpj="52998224725",
        tipo_pessoa="PF",
    )
    db.session.add(cliente)
    db.session.flush()
    caso = Caso(
        tenant_id=user.tenant_id,
        user_id=user.id,
        cliente_id=cliente.id,
        titulo="Caso Relatorio",
        status="Ativo",
    )
    db.session.add(caso)
    db.session.flush()

    hoje = date.today()
    recs = [
        # pago — não entra no total pendente
        Recebimento(
            tenant_id=user.tenant_id,
            user_id=user.id,
            cliente_id=cliente.id,
            caso_id=caso.id,
            descricao="Honorários pagos",
            valor=1000,
            data_recebimento=hoje - timedelta(days=30),
            recebido=True,
        ),
        # vencido
        Recebimento(
            tenant_id=user.tenant_id,
            user_id=user.id,
            cliente_id=cliente.id,
            caso_id=caso.id,
            descricao="Parcela vencida",
            valor=500,
            data_recebimento=hoje - timedelta(days=5),
            recebido=False,
        ),
        # pendente futuro
        Recebimento(
            tenant_id=user.tenant_id,
            user_id=user.id,
            cliente_id=cliente.id,
            caso_id=caso.id,
            descricao="Parcela futura",
            valor=300,
            data_recebimento=hoje + timedelta(days=10),
            recebido=False,
        ),
    ]
    desps = [
        Despesa(
            tenant_id=user.tenant_id,
            user_id=user.id,
            descricao="Custas pagas",
            valor=200,
            data_despesa=hoje - timedelta(days=20),
            pago=True,
        ),
        Despesa(
            tenant_id=user.tenant_id,
            user_id=user.id,
            descricao="Custas vencidas",
            valor=150,
            data_despesa=hoje - timedelta(days=3),
            pago=False,
        ),
    ]
    db.session.add_all(recs + desps)
    db.session.commit()
    return user, cliente, caso


def test_relatorios_exigem_autenticacao(client, db):
    for rota in ("contas-a-receber", "contas-a-pagar", "fluxo-caixa", "casos-status"):
        resp = client.get(f"/api/v1/relatorios/{rota}")
        assert resp.status_code == 401, rota


def test_contas_a_receber_status_e_totais(auth_client, db):
    _seed_financeiro(db)
    resp = auth_client.get("/api/v1/relatorios/contas-a-receber")
    assert resp.status_code == 200
    data = json.loads(resp.data)

    por_desc = {i["descricao"]: i for i in data["items"]}
    assert por_desc["Honorários pagos"]["status"] == "Pago"
    assert por_desc["Parcela vencida"]["status"] == "Vencido"
    assert por_desc["Parcela futura"]["status"] == "Pendente"
    # total pendente = 500 + 300 (pago fica de fora)
    assert data["total_geral"] == 800.0
    assert data["quantidade_items"] == 2
    # nomes resolvidos via caso → cliente
    assert por_desc["Parcela vencida"]["cliente_nome"] == "Cliente Relatorio"
    assert por_desc["Parcela vencida"]["caso_titulo"] == "Caso Relatorio"


def test_contas_a_pagar_status_e_totais(auth_client, db):
    _seed_financeiro(db)
    resp = auth_client.get("/api/v1/relatorios/contas-a-pagar")
    assert resp.status_code == 200
    data = json.loads(resp.data)
    por_desc = {i["descricao"]: i for i in data["items"]}
    assert por_desc["Custas pagas"]["status"] == "Paga"
    assert por_desc["Custas vencidas"]["status"] == "Vencida"
    assert data["total_geral"] == 150.0
    assert data["quantidade_items"] == 1


def test_fluxo_caixa_agrega_por_mes(auth_client, db):
    user = User.query.filter_by(username="testuser").first()
    ano = date.today().year
    _db.session.add_all(
        [
            Recebimento(
                tenant_id=user.tenant_id,
                user_id=user.id,
                descricao="Rec Jan",
                valor=1000,
                data_recebimento=date(ano, 1, 15),
                recebido=True,
            ),
            Recebimento(
                tenant_id=user.tenant_id,
                user_id=user.id,
                descricao="Rec Mar",
                valor=500,
                data_recebimento=date(ano, 3, 10),
                recebido=False,
            ),
            Despesa(
                tenant_id=user.tenant_id,
                user_id=user.id,
                descricao="Desp Jan",
                valor=400,
                data_despesa=date(ano, 1, 20),
                pago=True,
            ),
        ]
    )
    _db.session.commit()

    resp = auth_client.get(f"/api/v1/relatorios/fluxo-caixa?ano={ano}")
    assert resp.status_code == 200
    data = json.loads(resp.data)
    assert data["ano"] == ano
    jan = data["meses"][0]
    mar = data["meses"][2]
    assert jan["receitas"] == 1000.0
    assert jan["despesas"] == 400.0
    assert jan["saldo"] == 600.0
    assert mar["receitas"] == 500.0
    # saldo acumulado carrega o de janeiro
    assert mar["saldo_acumulado"] == 1100.0
    assert data["totais"] == {"receitas": 1500.0, "despesas": 400.0, "saldo": 1100.0}


def test_fluxo_caixa_ano_invalido_cai_no_atual(auth_client, db):
    resp = auth_client.get("/api/v1/relatorios/fluxo-caixa?ano=abc")
    assert resp.status_code == 200
    assert json.loads(resp.data)["ano"] == date.today().year

    resp = auth_client.get("/api/v1/relatorios/fluxo-caixa?ano=1500")
    assert json.loads(resp.data)["ano"] == date.today().year


def test_casos_status_agrupa_e_calcula_percentual(auth_client, db):
    user, cliente, _ = _seed_financeiro(db)  # cria 1 caso Ativo
    _db.session.add(
        Caso(
            tenant_id=user.tenant_id,
            user_id=user.id,
            cliente_id=cliente.id,
            titulo="Caso Encerrado",
            status="Encerrado",
        )
    )
    _db.session.commit()

    resp = auth_client.get("/api/v1/relatorios/casos-status")
    assert resp.status_code == 200
    data = json.loads(resp.data)
    assert data["total"] == 2
    grupos = {g["status"]: g for g in data["status_groups"]}
    assert grupos["Ativo"]["count"] == 1
    assert grupos["Ativo"]["percentual"] == 50.0
    assert grupos["Encerrado"]["count"] == 1


def test_relatorios_nao_vazam_dados_de_outro_usuario(auth_client, db):
    """Dados de outro user/tenant não aparecem nos relatórios do logado."""
    _seed_financeiro(db)
    # cria um segundo tenant+user com recebimento gordo
    from models import Tenant

    outro_tenant = Tenant(nome_escritorio="Outro Escritorio")
    _db.session.add(outro_tenant)
    _db.session.flush()
    outro = User(
        tenant_id=outro_tenant.id,
        username="outro_user_rel",
        email="outro_rel@teste.com",
        password_hash="x",
        role="admin",
    )
    _db.session.add(outro)
    _db.session.flush()
    _db.session.add(
        Recebimento(
            tenant_id=outro_tenant.id,
            user_id=outro.id,
            descricao="Nao deve aparecer",
            valor=99999,
            data_recebimento=date.today(),
            recebido=False,
        )
    )
    _db.session.commit()

    resp = auth_client.get("/api/v1/relatorios/contas-a-receber")
    data = json.loads(resp.data)
    descricoes = [i["descricao"] for i in data["items"]]
    assert "Nao deve aparecer" not in descricoes
    assert data["total_geral"] == 800.0
