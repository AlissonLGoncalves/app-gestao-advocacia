"""Endpoint de health check para deploy/monitoring (issue #95).

Retorna 200 apenas quando todos os checks passam:
1. SELECT 1 no Postgres responde rapido (limite ~1s)
2. alembic_version no DB == heads do codigo (sem migration pendente)
3. Pelo menos um Namespace flask-restx esta registrado

Em qualquer falha retorna 503 com payload detalhando qual check falhou.
Nao usa flask-restx (sem auth, sem openapi) — endpoint simples para
ferramentas de orquestracao (Fly health check, GitHub Actions, uptime
monitors externos).
"""

import time
from pathlib import Path

from flask import Blueprint, current_app, jsonify
from sqlalchemy import text

from extensions import db


def register_health_route(app):
    bp = Blueprint("health", __name__)

    @bp.route("/api/v1/health", methods=["GET"])
    @bp.route("/healthz", methods=["GET"])
    def health():
        checks = {}
        ok = True

        # 1. Postgres SELECT 1
        db_started = time.monotonic()
        try:
            db.session.execute(text("SELECT 1"))
            db_elapsed_ms = int((time.monotonic() - db_started) * 1000)
            if db_elapsed_ms > 1000:
                checks["db"] = {"ok": False, "elapsed_ms": db_elapsed_ms, "error": "slow"}
                ok = False
            else:
                checks["db"] = {"ok": True, "elapsed_ms": db_elapsed_ms}
        except Exception as exc:  # noqa: BLE001 — health check loga e responde
            checks["db"] = {"ok": False, "error": str(exc)[:200]}
            ok = False

        # 2. Alembic head atual == heads do codigo
        try:
            db_head = db.session.execute(
                text("SELECT version_num FROM alembic_version")
            ).scalar()
        except Exception as exc:  # noqa: BLE001
            checks["alembic"] = {"ok": False, "error": f"db_read_failed: {str(exc)[:120]}"}
            ok = False
            db_head = None

        if db_head is not None:
            try:
                from alembic.config import Config as AlembicConfig
                from alembic.script import ScriptDirectory

                migrations_dir = Path(__file__).resolve().parent.parent / "migrations"
                alembic_cfg = AlembicConfig()
                alembic_cfg.set_main_option("script_location", str(migrations_dir))
                code_heads = set(ScriptDirectory.from_config(alembic_cfg).get_heads())
                if db_head in code_heads:
                    checks["alembic"] = {"ok": True, "head": db_head}
                else:
                    checks["alembic"] = {
                        "ok": False,
                        "db_head": db_head,
                        "code_heads": sorted(code_heads),
                        "error": "db_head_not_in_code_heads",
                    }
                    ok = False
            except Exception as exc:  # noqa: BLE001
                checks["alembic"] = {"ok": False, "error": f"script_read_failed: {str(exc)[:120]}"}
                ok = False

        # 3. Pelo menos 1 Namespace flask-restx registrado
        try:
            blueprint = current_app.blueprints.get("api")
            namespaces = []
            if blueprint is not None:
                # flask-restx anexa a Api ao blueprint; alcancavel via deferred functions
                # Estrategia mais robusta: contar regras de URL sob /api/v1/.
                namespaces = [
                    r.endpoint
                    for r in current_app.url_map.iter_rules()
                    if r.rule.startswith("/api/v1/")
                ]
            if namespaces:
                checks["api"] = {"ok": True, "routes_under_v1": len(namespaces)}
            else:
                checks["api"] = {"ok": False, "error": "no_v1_routes_registered"}
                ok = False
        except Exception as exc:  # noqa: BLE001
            checks["api"] = {"ok": False, "error": str(exc)[:200]}
            ok = False

        status_code = 200 if ok else 503
        return jsonify({"status": "ok" if ok else "degraded", "checks": checks}), status_code

    app.register_blueprint(bp)
