"""Testes do fluxo async de DJEN sync (B1 2026-05-01).

POST /djen/sync deve retornar 202 + job_id em vez de processar sincrono.
GET /djen/sync/<id> retorna status do job. Outro tenant nao consegue
ver job alheio.
"""


def _criar_user_e_login(client, db, email="user_djen_async@x.com", username="user_djen_async"):
    from extensions import db as _db
    from models import Tenant, User

    tenant = Tenant(nome_escritorio=f"Tenant {username}")
    _db.session.add(tenant)
    _db.session.flush()

    user = User(
        username=username,
        email=email,
        role="admin",
        tenant_id=tenant.id,
    )
    user.set_password("Senha1234!")
    _db.session.add(user)
    _db.session.commit()

    res = client.post(
        "/api/v1/auth/login",
        json={"username_or_email": username, "password": "Senha1234!"},
    )
    assert res.status_code == 200, res.data
    return res.get_json()["access_token"], tenant.id, user.id


def test_post_sync_retorna_202_com_job_id(client, db):
    token, tenant_id, _ = _criar_user_e_login(client, db)
    res = client.post(
        "/api/v1/djen/sync",
        headers={"Authorization": f"Bearer {token}"},
        json={"dias": 7},
    )
    assert res.status_code == 202
    payload = res.get_json()
    assert "job_id" in payload
    assert payload["status"] == "pending"


def test_post_sync_dedupe_reusa_job_pending(client, db):
    token, _, _ = _criar_user_e_login(client, db)
    headers = {"Authorization": f"Bearer {token}"}

    res1 = client.post("/api/v1/djen/sync", headers=headers, json={"dias": 30})
    assert res1.status_code == 202
    job_id_1 = res1.get_json()["job_id"]

    res2 = client.post("/api/v1/djen/sync", headers=headers, json={"dias": 30})
    assert res2.status_code == 202
    payload2 = res2.get_json()
    assert payload2["job_id"] == job_id_1
    assert payload2.get("reused") is True


def test_get_sync_status_retorna_job(client, db):
    token, _, _ = _criar_user_e_login(client, db)
    headers = {"Authorization": f"Bearer {token}"}

    enq = client.post("/api/v1/djen/sync", headers=headers, json={"dias": 5})
    job_id = enq.get_json()["job_id"]

    res = client.get(f"/api/v1/djen/sync/{job_id}", headers=headers)
    assert res.status_code == 200
    payload = res.get_json()
    assert payload["id"] == job_id
    assert payload["status"] == "pending"
    assert payload["lookback_days"] == 5


def test_get_sync_status_outro_tenant_retorna_404(client, db):
    """Job de tenant A nao deve ser visivel para user de tenant B."""
    token_a, _, _ = _criar_user_e_login(client, db, "ua@x.com", "user_a_djen_async")
    res_a = client.post(
        "/api/v1/djen/sync",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"dias": 3},
    )
    job_id_a = res_a.get_json()["job_id"]

    token_b, _, _ = _criar_user_e_login(client, db, "ub@x.com", "user_b_djen_async")
    res_b = client.get(
        f"/api/v1/djen/sync/{job_id_a}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert res_b.status_code == 404


def test_get_sync_status_job_inexistente_retorna_404(client, db):
    token, _, _ = _criar_user_e_login(client, db)
    res = client.get(
        "/api/v1/djen/sync/99999",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 404
