# Testes do GET /api/v1/casos/{id}/timeline (linha do tempo do caso).

import json
from datetime import date, datetime, timedelta


def _criar_cliente(auth_client, nome="Cliente Teste", cpf="00011122233"):
    res = auth_client.post(
        "/api/v1/clientes",
        json={"nome_razao_social": nome, "cpf_cnpj": cpf, "tipo_pessoa": "PF"},
    )
    assert res.status_code == 201, res.data
    return json.loads(res.data)


def _criar_caso(auth_client, cliente_id, titulo="Caso Teste"):
    res = auth_client.post(
        "/api/v1/casos",
        json={"titulo": titulo, "cliente_id": cliente_id},
    )
    assert res.status_code == 201, res.data
    return json.loads(res.data)


def _bootstrap_caso(auth_client):
    cliente = _criar_cliente(auth_client)
    return _criar_caso(auth_client, cliente["id"])


def test_timeline_caso_inexistente_retorna_404(auth_client, db):
    res = auth_client.get("/api/v1/casos/99999/timeline")
    assert res.status_code == 404


def test_timeline_caso_vazio_retorna_lista_vazia(auth_client, db):
    caso = _bootstrap_caso(auth_client)
    res = auth_client.get(f"/api/v1/casos/{caso['id']}/timeline")
    assert res.status_code == 200
    data = json.loads(res.data)
    assert data["caso_id"] == caso["id"]
    assert data["items"] == []


def test_timeline_agrega_documento_e_tarefa_ordenado_desc(auth_client, db):
    caso = _bootstrap_caso(auth_client)

    # Tarefa com vencimento futuro (mais nova).
    futuro = (date.today() + timedelta(days=10)).isoformat()
    res_tarefa = auth_client.post(
        "/api/v1/tarefas",
        json={
            "titulo": "Peticionar resposta",
            "data_vencimento": futuro,
            "caso_id": caso["id"],
        },
    )
    assert res_tarefa.status_code == 201

    # Documento (data_upload = utcnow, anterior ao vencimento futuro).
    from extensions import db as _db
    from models import Documento

    doc = Documento(
        nome_arquivo="contrato.pdf",
        path_arquivo="/tmp/contrato.pdf",
        caso_id=caso["id"],
        tenant_id=auth_client.user.get("tenant_id") if isinstance(auth_client.user, dict) else None,
        user_id=auth_client.user.get("id", 1) if isinstance(auth_client.user, dict) else 1,
    )
    # Caminho mais robusto: ler tenant via /tenant/.
    res_tenant = auth_client.get("/api/v1/tenant/")
    tenant_id = json.loads(res_tenant.data)["id"]
    doc.tenant_id = tenant_id
    res_me = auth_client.get("/api/v1/auth/me")
    user_id = json.loads(res_me.data)["id"]
    doc.user_id = user_id

    _db.session.add(doc)
    _db.session.commit()

    res = auth_client.get(f"/api/v1/casos/{caso['id']}/timeline")
    assert res.status_code == 200
    items = json.loads(res.data)["items"]
    assert len(items) == 2
    tipos = [i["tipo"] for i in items]
    assert "tarefa" in tipos and "documento" in tipos
    # Ordem desc por data: vencimento futuro vem antes do data_upload (utcnow).
    assert items[0]["tipo"] == "tarefa"


def test_timeline_inclui_movimentacao_cnj_e_publicacao_djen(auth_client, db):
    from extensions import db as _db
    from models import MovimentacaoCNJ, PublicacaoDJEN

    caso = _bootstrap_caso(auth_client)

    res_tenant = auth_client.get("/api/v1/tenant/")
    tenant_id = json.loads(res_tenant.data)["id"]
    res_me = auth_client.get("/api/v1/auth/me")
    user_id = json.loads(res_me.data)["id"]

    mov = MovimentacaoCNJ(
        caso_id=caso["id"],
        data_movimentacao=datetime(2026, 1, 10, 9, 0, 0),
        descricao="Despacho proferido",
    )
    pub = PublicacaoDJEN(
        tenant_id=tenant_id,
        user_id=user_id,
        caso_id=caso["id"],
        data_disponibilizacao=date(2026, 1, 15),
        tipo_comunicacao="Intimação",
        texto="Intimar para manifestação em 15 dias.",
        sigla_tribunal="TJPR",
    )
    _db.session.add_all([mov, pub])
    _db.session.commit()

    res = auth_client.get(f"/api/v1/casos/{caso['id']}/timeline")
    assert res.status_code == 200
    items = json.loads(res.data)["items"]
    tipos = [i["tipo"] for i in items]
    assert "movimentacao_cnj" in tipos
    assert "publicacao_djen" in tipos


def test_timeline_isolamento_cross_tenant(client, auth_client, db):
    """Caso de outro tenant nao deve ser acessivel via /timeline."""
    # Tenant 1 (auth_client) cria caso e timeline funciona.
    caso = _bootstrap_caso(auth_client)
    assert auth_client.get(f"/api/v1/casos/{caso['id']}/timeline").status_code == 200

    # Cria tenant 2 via novo registro.
    reg = client.post(
        "/api/v1/auth/register",
        json={
            "username": "outro_timeline",
            "email": "outro_timeline@teste.com",
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
        json={"username_or_email": "outro_timeline", "password": "Senha1234!"},
    )
    token_outro = json.loads(login.data)["access_token"]
    headers_outro = {"Authorization": f"Bearer {token_outro}"}

    # Tenant 2 tenta acessar timeline do caso do tenant 1 -> 404 (sem vazar existencia).
    res = client.get(f"/api/v1/casos/{caso['id']}/timeline", headers=headers_outro)
    assert res.status_code == 404


def test_timeline_nao_inclui_recursos_de_outros_casos_do_mesmo_tenant(auth_client, db):
    """Um caso do mesmo tenant nao deve trazer documentos/tarefas de outro caso."""
    cliente = _criar_cliente(auth_client)
    caso_a = _criar_caso(auth_client, cliente["id"], titulo="Caso A")
    caso_b = _criar_caso(auth_client, cliente["id"], titulo="Caso B")

    # Tarefa vinculada apenas ao caso_b.
    auth_client.post(
        "/api/v1/tarefas",
        json={
            "titulo": "Tarefa do caso B",
            "data_vencimento": (date.today() + timedelta(days=5)).isoformat(),
            "caso_id": caso_b["id"],
        },
    )

    items_a = json.loads(auth_client.get(f"/api/v1/casos/{caso_a['id']}/timeline").data)["items"]
    items_b = json.loads(auth_client.get(f"/api/v1/casos/{caso_b['id']}/timeline").data)["items"]

    assert len(items_a) == 0
    assert len(items_b) == 1
    assert items_b[0]["titulo"] == "Tarefa do caso B"
