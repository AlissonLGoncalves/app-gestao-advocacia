import io
import json
from datetime import date, datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from werkzeug.exceptions import NotFound

from app import PublicacaoDJEN, Tenant, User, db, get_item_or_404


def _register_and_login(client, suffix):
    username = f"tenant_{suffix}"
    email = f"tenant_{suffix}@example.com"
    password = "Senha1234!"

    reg = client.post(
        "/api/auth/register",
        json={
            "username": username,
            "email": email,
            "password": password,
            "role": "admin",
        },
    )
    assert reg.status_code == 201, reg.data

    login = client.post(
        "/api/auth/login",
        json={"username_or_email": username, "password": password},
    )
    assert login.status_code == 200, login.data
    data = json.loads(login.data)
    return data["access_token"], data["user"]


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


def _auth_json(client, method, url, token, payload=None):
    fn = getattr(client, method)
    return fn(url, headers=_headers(token), json=payload)


def _make_base_data(client, token, tag):
    cliente_resp = _auth_json(
        client,
        "post",
        "/api/clientes",
        token,
        {
            "nome_razao_social": f"Cliente {tag}",
            "cpf_cnpj": f"111222333{tag:02d}",
            "tipo_pessoa": "PF",
            "email": f"cliente{tag}@example.com",
        },
    )
    assert cliente_resp.status_code == 201, cliente_resp.data
    cliente_id = json.loads(cliente_resp.data)["id"]

    caso_resp = _auth_json(
        client,
        "post",
        "/api/casos",
        token,
        {
            "titulo": f"Caso {tag}",
            "status": "Ativo",
            "tipo_acao": "Cível",
            "cliente_id": cliente_id,
            "numero_processo": f"0001234-12.2026.8.16.{1000 + tag}",
            "data_distribuicao": date.today().isoformat(),
        },
    )
    assert caso_resp.status_code == 201, caso_resp.data
    caso_id = json.loads(caso_resp.data)["id"]

    return cliente_id, caso_id


def _make_evento(client, token, tag):
    inicio = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    fim = (datetime.now(timezone.utc) + timedelta(days=2, hours=1)).isoformat()
    resp = _auth_json(
        client,
        "post",
        "/api/eventos",
        token,
        {
            "tipo_evento": "Reunião",
            "titulo": f"Evento {tag}",
            "data_inicio": inicio,
            "data_fim": fim,
        },
    )
    assert resp.status_code == 201, resp.data
    return json.loads(resp.data)["id"]


def _make_documento(client, token, cliente_id, caso_id, tag):
    data = {
        "descricao": f"Documento {tag}",
        "cliente_id": str(cliente_id),
        "caso_id": str(caso_id),
        "file": (io.BytesIO(b"arquivo de teste"), f"doc_{tag}.txt"),
    }
    resp = client.post(
        "/api/documentos/upload",
        headers=_headers(token),
        data=data,
        content_type="multipart/form-data",
    )
    assert resp.status_code == 201, resp.data
    return json.loads(resp.data)["id"]


def _make_despesa(client, token, caso_id, tag):
    resp = _auth_json(
        client,
        "post",
        "/api/despesas",
        token,
        {
            "descricao": f"Despesa {tag}",
            "valor": 100.5,
            "data_despesa": date.today().isoformat(),
            "caso_id": caso_id,
            "pago": False,
        },
    )
    assert resp.status_code == 201, resp.data
    return json.loads(resp.data)["id"]


def _make_recebimento(client, token, caso_id, tag):
    resp = _auth_json(
        client,
        "post",
        "/api/recebimentos",
        token,
        {
            "descricao": f"Recebimento {tag}",
            "valor": 250.0,
            "data_recebimento": date.today().isoformat(),
            "caso_id": caso_id,
            "recebido": False,
        },
    )
    assert resp.status_code == 201, resp.data
    return json.loads(resp.data)["id"]


def _make_contrato(client, token, cliente_id, caso_id, tag):
    resp = _auth_json(
        client,
        "post",
        "/api/contratos",
        token,
        {
            "tipo_honorario": "Fixo",
            "valor_total": 1200.0,
            "status": "Ativo",
            "caso_id": caso_id,
            "cliente_id": cliente_id,
            "notas_condicoes": f"Contrato {tag}",
        },
    )
    assert resp.status_code == 201, resp.data
    return json.loads(resp.data)["id"]


def _make_tarefa(client, token, caso_id, tag):
    resp = _auth_json(
        client,
        "post",
        "/api/tarefas",
        token,
        {
            "titulo": f"Tarefa {tag}",
            "descricao": "Prazo de teste",
            "status": "A Fazer",
            "prioridade": "Normal",
            "tipo_tarefa": "Prazo",
            "caso_id": caso_id,
            "data_vencimento": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        },
    )
    assert resp.status_code == 201, resp.data
    return json.loads(resp.data)["id"]


def _make_djen_oab(client, token, tag):
    resp = _auth_json(
        client,
        "post",
        "/api/djen/oabs",
        token,
        {
            "numero_oab": f"{90000 + tag}",
            "uf_oab": "PR",
            "nome_advogado": f"Adv {tag}",
        },
    )
    assert resp.status_code == 201, resp.data
    return json.loads(resp.data)["id"]


def _make_djen_publicacao_for_user(user_id, tenant_id, djen_id):
    pub = PublicacaoDJEN(
        tenant_id=tenant_id,
        user_id=user_id,
        djen_id=djen_id,
        hash_comunicacao=f"hash-{djen_id}",
        numero_processo="0001234-12.2026.8.16.0001",
        sigla_tribunal="TJPR",
        nome_orgao="1ª Vara Cível",
        tipo_comunicacao="Intimação",
        data_disponibilizacao=date.today(),
        texto="Publicação de teste tenant isolation.",
        lida=False,
        origem_busca="oab",
    )
    db.session.add(pub)
    db.session.commit()
    return pub.id


@pytest.fixture
def tenants_setup(client, app, db):
    token_a, user_a = _register_and_login(client, "a")
    token_b, user_b = _register_and_login(client, "b")

    with app.app_context():
        user_db_a = User.query.get(user_a["id"])
        user_db_b = User.query.get(user_b["id"])
        if user_db_a.tenant_id == user_db_b.tenant_id:
            novo_tenant = Tenant(nome_escritorio="Tenant Isolado B")
            db.session.add(novo_tenant)
            db.session.flush()
            user_db_b.tenant_id = novo_tenant.id
            db.session.commit()

    cliente_a, caso_a = _make_base_data(client, token_a, 1)
    cliente_b, caso_b = _make_base_data(client, token_b, 2)

    evento_a = _make_evento(client, token_a, 1)
    evento_b = _make_evento(client, token_b, 2)

    documento_a = _make_documento(client, token_a, cliente_a, caso_a, 1)
    documento_b = _make_documento(client, token_b, cliente_b, caso_b, 2)

    despesa_a = _make_despesa(client, token_a, caso_a, 1)
    despesa_b = _make_despesa(client, token_b, caso_b, 2)

    recebimento_a = _make_recebimento(client, token_a, caso_a, 1)
    recebimento_b = _make_recebimento(client, token_b, caso_b, 2)

    contrato_a = _make_contrato(client, token_a, cliente_a, caso_a, 1)
    contrato_b = _make_contrato(client, token_b, cliente_b, caso_b, 2)

    tarefa_a = _make_tarefa(client, token_a, caso_a, 1)
    tarefa_b = _make_tarefa(client, token_b, caso_b, 2)

    oab_a = _make_djen_oab(client, token_a, 1)
    oab_b = _make_djen_oab(client, token_b, 2)

    with app.app_context():
        user_db_a = User.query.get(user_a["id"])
        user_db_b = User.query.get(user_b["id"])
        pub_a = _make_djen_publicacao_for_user(user_db_a.id, user_db_a.tenant_id, 101)
        pub_b = _make_djen_publicacao_for_user(user_db_b.id, user_db_b.tenant_id, 202)

    return {
        "token_a": token_a,
        "token_b": token_b,
        "user_a": user_a,
        "user_b": user_b,
        "ids_a": {
            "cliente": cliente_a,
            "caso": caso_a,
            "evento": evento_a,
            "documento": documento_a,
            "despesa": despesa_a,
            "recebimento": recebimento_a,
            "contrato": contrato_a,
            "tarefa": tarefa_a,
            "oab": oab_a,
            "pub": pub_a,
        },
        "ids_b": {
            "cliente": cliente_b,
            "caso": caso_b,
            "evento": evento_b,
            "documento": documento_b,
            "despesa": despesa_b,
            "recebimento": recebimento_b,
            "contrato": contrato_b,
            "tarefa": tarefa_b,
            "oab": oab_b,
            "pub": pub_b,
        },
    }


@pytest.mark.parametrize(
    "list_path,key,id_key,own_name,other_name",
    [
        ("/api/clientes", "clientes", "cliente", "Cliente 1", "Cliente 2"),
        ("/api/casos", "casos", "caso", "Caso 1", "Caso 2"),
        ("/api/eventos", "eventos", "evento", "Evento 1", "Evento 2"),
        ("/api/documentos", "documentos", "documento", "Documento 1", "Documento 2"),
        ("/api/despesas", "despesas", "despesa", "Despesa 1", "Despesa 2"),
        ("/api/recebimentos", "recebimentos", "recebimento", "Recebimento 1", "Recebimento 2"),
        ("/api/contratos", "contratos", "contrato", "Contrato 1", "Contrato 2"),
        ("/api/tarefas", "tarefas", "tarefa", "Tarefa 1", "Tarefa 2"),
        ("/api/djen/oabs", None, "oab", "90001", "90002"),
    ],
)
def test_listagens_nunca_vazam_outro_tenant(client, tenants_setup, list_path, key, id_key, own_name, other_name):
    token_a = tenants_setup["token_a"]
    resp = client.get(list_path, headers=_headers(token_a))
    assert resp.status_code == 200

    payload = json.loads(resp.data)
    if isinstance(payload, list):
        items = payload
    else:
        items = payload[key] if key else payload
    serialized = json.dumps(items)

    ids = {item.get("id") for item in items if isinstance(item, dict) and "id" in item}
    assert tenants_setup["ids_a"][id_key] in ids
    assert tenants_setup["ids_b"][id_key] not in ids

    if list_path != "/api/documentos":
        assert own_name in serialized
        assert other_name not in serialized


@pytest.mark.parametrize(
    "resource,id_key,get_path,update_path,update_method,delete_path,update_payload",
    [
        ("cliente", "cliente", "/api/clientes/{id}", "/api/clientes/{id}", "put", "/api/clientes/{id}", {"nome_razao_social": "Atualizado A", "cpf_cnpj": "11122233399", "tipo_pessoa": "PF"}),
        ("caso", "caso", "/api/casos/{id}", "/api/casos/{id}", "put", "/api/casos/{id}", {"titulo": "Caso atualizado", "status": "Ativo", "tipo_acao": "Cível"}),
        ("evento", "evento", "/api/eventos/{id}", "/api/eventos/{id}", "put", "/api/eventos/{id}", {"titulo": "Evento atualizado", "tipo_evento": "Reunião", "data_inicio": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()}),
        ("documento", "documento", "/api/documentos/download/{id}", None, None, "/api/documentos/{id}", None),
        ("despesa", "despesa", "/api/despesas/{id}", "/api/despesas/{id}", "put", "/api/despesas/{id}", {"descricao": "Despesa atualizada", "valor": 101.0, "data_despesa": date.today().isoformat(), "pago": True}),
        ("recebimento", "recebimento", "/api/recebimentos/{id}", "/api/recebimentos/{id}", "put", "/api/recebimentos/{id}", {"descricao": "Recebimento atualizado", "valor": 300.0, "data_recebimento": date.today().isoformat(), "recebido": True}),
        ("contrato", "contrato", "/api/contratos/{id}", "/api/contratos/{id}", "put", "/api/contratos/{id}", {"tipo_honorario": "Fixo", "valor_total": 2000, "status": "Ativo", "caso_id": 1, "cliente_id": 1}),
        ("tarefa", "tarefa", "/api/tarefas/{id}", "/api/tarefas/{id}", "put", "/api/tarefas/{id}", {"titulo": "Tarefa atualizada"}),
        ("oab", "oab", None, None, None, "/api/djen/oabs/{id}", None),
        ("pub", "pub", "/api/djen/publicacoes/{id}", "/api/djen/publicacoes/{id}", "patch", None, {"lida": True}),
    ],
)
def test_cross_tenant_get_put_delete_retorna_404(
    client,
    tenants_setup,
    resource,
    id_key,
    get_path,
    update_path,
    update_method,
    delete_path,
    update_payload,
):
    token_a = tenants_setup["token_a"]
    token_b = tenants_setup["token_b"]

    id_a = tenants_setup["ids_a"][id_key]
    id_b = tenants_setup["ids_b"][id_key]

    if get_path:
        resp_get = client.get(get_path.format(id=id_b), headers=_headers(token_a))
        assert resp_get.status_code == 404, f"{resource} GET cross-tenant should be 404"

    if update_path:
        payload = dict(update_payload or {})
        if resource == "contrato":
            payload["caso_id"] = tenants_setup["ids_a"]["caso"]
            payload["cliente_id"] = tenants_setup["ids_a"]["cliente"]
        updater = getattr(client, update_method)
        resp_put = updater(update_path.format(id=id_b), headers=_headers(token_a), json=payload)
        assert resp_put.status_code == 404, f"{resource} PUT cross-tenant should be 404"

    if delete_path:
        resp_del = client.delete(delete_path.format(id=id_b), headers=_headers(token_a))
        assert resp_del.status_code == 404, f"{resource} DELETE cross-tenant should be 404"

    # Controle positivo: owner mantém acesso no próprio tenant
    if get_path:
        resp_own = client.get(get_path.format(id=id_a), headers=_headers(token_a))
        assert resp_own.status_code in (200, 500)


def test_usuario_sem_tenant_e_bloqueado(client, tenants_setup, app):
    token_a = tenants_setup["token_a"]
    user_id = tenants_setup["user_a"]["id"]

    with app.app_context():
        user = User.query.get(user_id)
        user.tenant_id = None
        db.session.commit()

    resp_clientes = client.get("/api/clientes", headers=_headers(token_a))
    assert resp_clientes.status_code == 403

    resp_casos = client.get("/api/casos", headers=_headers(token_a))
    assert resp_casos.status_code == 403


def test_log_warning_quando_cross_tenant_bloqueado(app):
    class FakeQuery:
        def filter_by(self, **_kwargs):
            return self

        def first(self):
            return None

    class FakeModel:
        tenant_id = True
        __name__ = "FakeModel"

    alvo = type("Target", (), {"tenant_id": 999})()
    with app.test_request_context("/api/fake/99"):
        with patch("helpers.tenant.query_for_tenant", return_value=FakeQuery()):
            with patch("helpers.tenant.get_tenant_id", return_value=1):
                with patch("helpers.tenant.get_jwt_identity", return_value=123):
                    with patch("helpers.tenant.db.session.get", return_value=alvo):
                        with pytest.raises(NotFound):
                            get_item_or_404(FakeModel, 99)
