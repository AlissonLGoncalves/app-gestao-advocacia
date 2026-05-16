# Testes dos endpoints de graficos do dashboard.

import json
from datetime import date

_contador = {"n": 0}


def _criar_cliente_e_caso(auth_client, status="Em andamento", area="Trabalhista"):
    _contador["n"] += 1
    suffix = f"{_contador['n']:03d}"
    cli = auth_client.post(
        "/api/v1/clientes",
        json={
            "nome_razao_social": f"Cli {suffix}",
            "cpf_cnpj": f"000111222{suffix}",
            "tipo_pessoa": "PF",
        },
    )
    assert cli.status_code == 201, cli.data
    caso = auth_client.post(
        "/api/v1/casos",
        json={
            "titulo": f"Caso {suffix}",
            "cliente_id": json.loads(cli.data)["id"],
            "status": status,
            "area_direito": area,
        },
    )
    assert caso.status_code == 201, caso.data
    return json.loads(caso.data)


def test_charts_casos_por_status_agrupa(auth_client, db):
    _criar_cliente_e_caso(auth_client, status="Em andamento")
    _criar_cliente_e_caso(auth_client, status="Em andamento")
    _criar_cliente_e_caso(auth_client, status="Concluido")

    res = auth_client.get("/api/v1/dashboard/charts/casos-por-status")
    assert res.status_code == 200
    items = json.loads(res.data)["items"]
    porstatus = {it["label"]: it["value"] for it in items}
    assert porstatus["Em andamento"] == 2
    assert porstatus["Concluido"] == 1


def test_charts_casos_por_area_inclui_sem_area(auth_client, db):
    _criar_cliente_e_caso(auth_client, area="Trabalhista")
    _criar_cliente_e_caso(auth_client, area=None)

    res = auth_client.get("/api/v1/dashboard/charts/casos-por-area")
    assert res.status_code == 200
    items = json.loads(res.data)["items"]
    labels = {it["label"] for it in items}
    assert "Trabalhista" in labels
    assert "Nao informada" in labels


def test_charts_financeiro_mensal_retorna_12_meses(auth_client, db):
    res = auth_client.get("/api/v1/dashboard/charts/financeiro-mensal")
    assert res.status_code == 200
    items = json.loads(res.data)["items"]
    assert len(items) == 12
    assert all(set(it.keys()) == {"mes", "receita", "despesa"} for it in items)
    # Sequencia ordenada por mes asc
    meses = [it["mes"] for it in items]
    assert meses == sorted(meses)


def test_charts_financeiro_mensal_agrega_recebimento_e_despesa(auth_client, db):
    from extensions import db as _db
    from models import Despesa, Recebimento

    res_tenant = auth_client.get("/api/v1/tenant/")
    tenant_id = json.loads(res_tenant.data)["id"]
    res_me = auth_client.get("/api/v1/auth/me")
    user_id = json.loads(res_me.data)["id"]

    hoje = date.today()
    rec = Recebimento(
        tenant_id=tenant_id,
        user_id=user_id,
        descricao="Honorarios",
        valor=1500,
        data_vencimento=hoje,
        data_pagamento=hoje,
        status="Pago",
        # Campos legados sincronizados (Fase 1 do Recebimento Robusto).
        data_recebimento=hoje,
        recebido=True,
    )
    desp = Despesa(
        tenant_id=tenant_id,
        user_id=user_id,
        descricao="Custas",
        valor=200,
        data_despesa=hoje,
        pago=True,
    )
    _db.session.add_all([rec, desp])
    _db.session.commit()

    items = json.loads(auth_client.get("/api/v1/dashboard/charts/financeiro-mensal").data)["items"]
    chave_atual = hoje.strftime("%Y-%m")
    bucket = next(b for b in items if b["mes"] == chave_atual)
    assert bucket["receita"] == 1500.0
    assert bucket["despesa"] == 200.0


def test_charts_publicacoes_por_dia_retorna_30_dias(auth_client, db):
    res = auth_client.get("/api/v1/dashboard/charts/publicacoes-por-dia")
    assert res.status_code == 200
    items = json.loads(res.data)["items"]
    assert len(items) == 30
    # Ordenado asc por data
    datas = [it["data"] for it in items]
    assert datas == sorted(datas)
    # Por padrao zerado
    assert all(it["quantidade"] == 0 for it in items)


def test_charts_publicacoes_por_dia_conta_publicacao(auth_client, db):
    from extensions import db as _db
    from models import PublicacaoDJEN

    res_tenant = auth_client.get("/api/v1/tenant/")
    tenant_id = json.loads(res_tenant.data)["id"]
    res_me = auth_client.get("/api/v1/auth/me")
    user_id = json.loads(res_me.data)["id"]

    hoje = date.today()
    pub = PublicacaoDJEN(
        tenant_id=tenant_id,
        user_id=user_id,
        data_disponibilizacao=hoje,
        tipo_comunicacao="Intimacao",
    )
    _db.session.add(pub)
    _db.session.commit()

    items = json.loads(auth_client.get("/api/v1/dashboard/charts/publicacoes-por-dia").data)[
        "items"
    ]
    bucket_hoje = next(it for it in items if it["data"] == hoje.isoformat())
    assert bucket_hoje["quantidade"] == 1


def test_charts_isolamento_cross_tenant(client, auth_client, db):
    """Caso/recebimento/publicacao de outro tenant nao aparece na agregacao do meu."""
    _criar_cliente_e_caso(auth_client, status="Em andamento")

    reg = client.post(
        "/api/v1/auth/register",
        json={
            "username": "outro_dash",
            "email": "outro_dash@teste.com",
            "password": "Senha1234!",
            "role": "admin",
            "aceite_termos": True,
            "aceite_lgpd": True,
            "versao_termos": "v1.0",
            "versao_lgpd": "v1.0",
        },
    )
    assert reg.status_code == 201
    login = client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "outro_dash", "password": "Senha1234!"},
    )
    token_outro = json.loads(login.data)["access_token"]
    headers_outro = {"Authorization": f"Bearer {token_outro}"}

    # Tenant 2 cria caso com status diferente.
    cli2 = client.post(
        "/api/v1/clientes",
        json={"nome_razao_social": "Cli2", "cpf_cnpj": "99988877766", "tipo_pessoa": "PF"},
        headers=headers_outro,
    )
    assert cli2.status_code == 201
    client.post(
        "/api/v1/casos",
        json={
            "titulo": "Caso tenant 2",
            "cliente_id": json.loads(cli2.data)["id"],
            "status": "ConcluidoOutro",
        },
        headers=headers_outro,
    )

    # Endpoint do tenant 1 nao traz status do tenant 2.
    items = json.loads(auth_client.get("/api/v1/dashboard/charts/casos-por-status").data)["items"]
    labels = {it["label"] for it in items}
    assert "ConcluidoOutro" not in labels
