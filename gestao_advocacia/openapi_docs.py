from __future__ import annotations

from apispec import APISpec
from flask import Blueprint, current_app, jsonify, render_template_string

SWAGGER_UI_HTML = """
<!doctype html>
<html>
  <head>
    <meta charset=\"utf-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
    <title>API Docs</title>
    <link rel=\"stylesheet\" href=\"https://unpkg.com/swagger-ui-dist@5/swagger-ui.css\" />
  </head>
  <body>
    <div id=\"swagger-ui\"></div>
    <script src=\"https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js\"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '/api/v1/openapi.json',
        dom_id: '#swagger-ui',
      });
    </script>
  </body>
</html>
"""


def _normalize_flask_path(rule_path: str) -> str:
    """Converte placeholders Flask para estilo OpenAPI.

    Exemplo: /api/clientes/<int:id> -> /api/v1/clientes/{id}
    """
    path = rule_path.replace("<", "{").replace(">", "}")
    path = path.replace("{int:", "{").replace("{string:", "{").replace("{path:", "{")

    # Promove as rotas versionadas para /api/v1 sem duplicar prefixo.
    if path.startswith("/api/"):
        path = "/api/v1" + path[len("/api") :]
    elif path == "/api":
        path = "/api/v1"

    return path


def build_openapi_from_blueprints(app) -> dict:
    spec = APISpec(
        title="API Gestao Advocacia",
        version=str(app.config.get("APP_VERSION", "1.0.0")),
        openapi_version="3.0.3",
        info={"description": "OpenAPI gerado automaticamente a partir dos blueprints/rotas."},
    )

    for rule in sorted(app.url_map.iter_rules(), key=lambda r: r.rule):
        if not rule.rule.startswith("/api"):
            continue

        if rule.rule.startswith("/api/docs") or rule.rule.startswith("/api/v1/docs"):
            continue
        if rule.rule.startswith("/api/v1/openapi.json"):
            continue

        methods = sorted(m for m in (rule.methods or set()) if m not in {"HEAD", "OPTIONS"})
        if not methods:
            continue

        openapi_path = _normalize_flask_path(rule.rule)
        segments = [s for s in openapi_path.split("/") if s and not s.startswith("{")]
        tag = segments[2] if len(segments) > 2 else "root"

        operations = {}
        for method in methods:
            operations[method.lower()] = {
                "summary": f"{method} {rule.endpoint}",
                "operationId": f"{rule.endpoint}_{method.lower()}",
                "tags": [tag],
                "responses": {"200": {"description": "Sucesso"}},
            }

        spec.path(path=openapi_path, operations=operations)

    return spec.to_dict()


def register_openapi_docs(app):
    # Gateado por SWAGGER_ENABLED (mesma var que controla o swagger do
    # flask-restx). Sem isso, este blueprint paralelo expunha /api/v1/docs e
    # /api/v1/openapi.json em prod independente da flag.
    import os as _os

    if _os.environ.get("SWAGGER_ENABLED", "false").strip().lower() != "true":
        return

    docs_bp = Blueprint("openapi_docs", __name__, url_prefix="/api/v1")

    @docs_bp.get("/openapi.json")
    def openapi_json():
        return jsonify(build_openapi_from_blueprints(current_app))

    @docs_bp.get("/docs")
    @docs_bp.get("/docs/")
    def openapi_docs_ui():
        return render_template_string(SWAGGER_UI_HTML)

    app.register_blueprint(docs_bp)
