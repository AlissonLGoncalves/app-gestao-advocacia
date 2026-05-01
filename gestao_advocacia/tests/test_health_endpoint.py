"""Testes do endpoint /api/v1/health (issue #95)."""

from pathlib import Path
from unittest.mock import patch

import pytest
from sqlalchemy import text
from sqlalchemy.exc import OperationalError


@pytest.fixture()
def alembic_seeded(db):
    """Cria a tabela alembic_version e popula com um dos heads reais do codigo.

    O conftest base usa db.create_all() em vez de rodar migrations, entao
    alembic_version nao existe. Para testar o caminho verde precisamos
    inserir manualmente um head valido (qualquer um basta — o endpoint
    aceita qualquer head presente em ScriptDirectory.get_heads()).
    """
    from alembic.config import Config as AlembicConfig
    from alembic.script import ScriptDirectory

    migrations_dir = Path(__file__).resolve().parent.parent / "migrations"
    cfg = AlembicConfig()
    cfg.set_main_option("script_location", str(migrations_dir))
    head = ScriptDirectory.from_config(cfg).get_heads()[0]

    db.session.execute(
        text("CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL)")
    )
    db.session.execute(text("DELETE FROM alembic_version"))
    db.session.execute(text("INSERT INTO alembic_version (version_num) VALUES (:v)"), {"v": head})
    db.session.commit()
    yield head


def test_health_verde(client, alembic_seeded):
    """Caminho feliz: DB ok, alembic em head, namespaces registrados."""
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    payload = res.get_json()
    assert payload["status"] == "ok"
    assert payload["checks"]["db"]["ok"] is True
    assert payload["checks"]["db"]["elapsed_ms"] < 1000
    assert payload["checks"]["alembic"]["ok"] is True
    assert payload["checks"]["api"]["ok"] is True
    assert payload["checks"]["api"]["routes_under_v1"] >= 1


def test_healthz_alias(client, alembic_seeded):
    """O alias /healthz responde igual a /api/v1/health."""
    res = client.get("/healthz")
    assert res.status_code == 200
    assert res.get_json()["status"] == "ok"


def test_health_db_caido(client, db):
    """Quando o SELECT 1 falha, retorna 503 e status degraded."""
    with patch(
        "routes.health.db.session.execute",
        side_effect=OperationalError("SELECT 1", {}, Exception("connection refused")),
    ):
        res = client.get("/api/v1/health")
    assert res.status_code == 503
    payload = res.get_json()
    assert payload["status"] == "degraded"
    assert payload["checks"]["db"]["ok"] is False


def test_health_alembic_desincronizado(client, db):
    """Quando alembic_version no DB nao bate com heads do codigo, retorna 503."""

    def fake_execute(stmt, *args, **kwargs):
        sql = str(stmt).strip().upper()
        if sql == "SELECT 1":

            class _R:
                def scalar(self):
                    return 1

            return _R()
        if "ALEMBIC_VERSION" in sql.upper():

            class _R:
                def scalar(self):
                    return "head_que_nao_existe_no_codigo"

            return _R()

        class _R:
            def scalar(self):
                return None

        return _R()

    with patch("routes.health.db.session.execute", side_effect=fake_execute):
        res = client.get("/api/v1/health")
    assert res.status_code == 503
    payload = res.get_json()
    assert payload["status"] == "degraded"
    assert payload["checks"]["alembic"]["ok"] is False
    assert payload["checks"]["alembic"]["db_head"] == "head_que_nao_existe_no_codigo"
