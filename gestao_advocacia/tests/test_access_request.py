"""Testes do fluxo de access_request (issue #112 v2)."""


def test_access_request_cria_com_sucesso(client, db):
    res = client.post(
        "/api/v1/auth/access-request",
        json={
            "nome": "João Silva",
            "email": "joao@advocacia.com.br",
            "oab": "123456",
            "sigla_oab": "SP",
            "telefone": "11987654321",
            "escritorio": "Silva & Associados",
            "mensagem": "Quero testar a beta.",
        },
    )
    assert res.status_code == 201
    payload = res.get_json()
    assert "Solicitacao recebida" in payload["message"]


def test_access_request_email_invalido_retorna_400(client, db):
    res = client.post(
        "/api/v1/auth/access-request",
        json={"nome": "Joao", "email": "nao-eh-email"},
    )
    assert res.status_code == 400
    assert "email" in res.get_json()["message"].lower()


def test_access_request_nome_curto_retorna_400(client, db):
    res = client.post(
        "/api/v1/auth/access-request",
        json={"nome": "Jo", "email": "joao@x.com"},
    )
    assert res.status_code == 400
    assert "nome" in res.get_json()["message"].lower()


def test_access_request_apenas_campos_obrigatorios(client, db):
    res = client.post(
        "/api/v1/auth/access-request",
        json={"nome": "Maria Solo", "email": "maria@solo.com"},
    )
    assert res.status_code == 201


def _criar_superadmin_e_login(client, db):
    from extensions import db as _db
    from models import User

    user = User(
        username="super_a",
        email="super@plataforma.local",
        role="superadmin",
        tenant_id=None,
    )
    user.set_password("Senha1234!")
    _db.session.add(user)
    _db.session.commit()

    res = client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "super_a", "password": "Senha1234!"},
    )
    assert res.status_code == 200, res.data
    return res.get_json()["access_token"]


def _criar_access_request(client, email="lead@x.com"):
    res = client.post(
        "/api/v1/auth/access-request",
        json={"nome": "Lead Teste", "email": email},
    )
    assert res.status_code == 201


def test_admin_lista_access_requests(client, db):
    _criar_access_request(client, "lead1@x.com")
    _criar_access_request(client, "lead2@x.com")

    token = _criar_superadmin_e_login(client, db)
    res = client.get(
        "/admin/v1/access-requests",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200, res.data
    payload = res.get_json()
    assert payload["total"] >= 2
    emails = {item["email"] for item in payload["items"]}
    assert "lead1@x.com" in emails
    assert "lead2@x.com" in emails


def test_admin_sem_token_retorna_401_ou_403(client, db):
    res = client.get("/admin/v1/access-requests")
    assert res.status_code in (401, 403)


def test_admin_approve_marca_status(client, db):
    _criar_access_request(client, "approve@x.com")
    token = _criar_superadmin_e_login(client, db)
    headers = {"Authorization": f"Bearer {token}"}

    list_res = client.get("/admin/v1/access-requests", headers=headers)
    request_id = next(
        item["id"] for item in list_res.get_json()["items"] if item["email"] == "approve@x.com"
    )

    res = client.post(f"/admin/v1/access-requests/{request_id}/approve", headers=headers)
    assert res.status_code == 200
    payload = res.get_json()
    assert payload["status"] == "approved"
    assert payload["processado_em"] is not None
    assert payload["processado_por_user_id"] is not None


def test_admin_approve_idempotencia(client, db):
    _criar_access_request(client, "approve2x@x.com")
    token = _criar_superadmin_e_login(client, db)
    headers = {"Authorization": f"Bearer {token}"}
    list_res = client.get("/admin/v1/access-requests", headers=headers)
    request_id = next(
        item["id"] for item in list_res.get_json()["items"] if item["email"] == "approve2x@x.com"
    )

    r1 = client.post(f"/admin/v1/access-requests/{request_id}/approve", headers=headers)
    assert r1.status_code == 200
    r2 = client.post(f"/admin/v1/access-requests/{request_id}/approve", headers=headers)
    assert r2.status_code == 400


def test_admin_reject_com_motivo(client, db):
    _criar_access_request(client, "reject@x.com")
    token = _criar_superadmin_e_login(client, db)
    headers = {"Authorization": f"Bearer {token}"}
    list_res = client.get("/admin/v1/access-requests", headers=headers)
    request_id = next(
        item["id"] for item in list_res.get_json()["items"] if item["email"] == "reject@x.com"
    )

    res = client.post(
        f"/admin/v1/access-requests/{request_id}/reject",
        headers=headers,
        json={"motivo": "Fora do escopo"},
    )
    assert res.status_code == 200
    payload = res.get_json()
    assert payload["status"] == "rejected"
    assert payload["motivo_rejeicao"] == "Fora do escopo"


def test_admin_filtro_por_status(client, db):
    _criar_access_request(client, "pending1@x.com")
    _criar_access_request(client, "pending2@x.com")
    token = _criar_superadmin_e_login(client, db)
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/admin/v1/access-requests?status=pending", headers=headers)
    assert res.status_code == 200
    payload = res.get_json()
    for item in payload["items"]:
        assert item["status"] == "pending"
