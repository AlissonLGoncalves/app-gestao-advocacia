import os
from datetime import datetime, timedelta
from functools import wraps

from dotenv import load_dotenv
from flask import Blueprint, Flask, make_response, redirect, request
from flask import abort as flask_abort
from flask_cors import CORS
from flask_jwt_extended import get_jwt
from flask_restx import Api, abort

from app_runtime import (
    configure_cors_origins,
    configure_error_handlers,
    configure_request_context,
    configure_scheduler,
    register_status_route,
)
from config import Config
from extensions import db, jwt, migrate
from logging_config import configure_json_logging
from openapi_docs import register_openapi_docs
from routes.api_registry import register_api_routes

load_dotenv()
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads_documentos")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def finance_access_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        claims = get_jwt()
        if claims.get("role", "") == "assistente":
            abort(403, "Acesso negado: Perfil 'assistente' nao tem acesso a dados financeiros.")
        return fn(*args, **kwargs)

    return wrapper


from helpers import get_item_or_404  # noqa: E402, F401
from models import (  # noqa: E402, F401
    Caso,
    Cliente,
    Despesa,
    DjenOabMonitoramento,
    DjenVinculoDecisao,
    PublicacaoDJEN,
    Recebimento,
    Tenant,
    User,
)


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
    app.url_map.strict_slashes = False

    configure_json_logging(app)
    app.logger.info(
        "app_startup",
        extra={
            "event": "app_startup",
            "app_version": app.config.get("APP_VERSION"),
            "log_level": app.config.get("LOG_LEVEL"),
        },
    )

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    CORS(app, origins=configure_cors_origins())

    configure_request_context(app)
    configure_error_handlers(app)

    api_bp = Blueprint("api", __name__, url_prefix="/api/v1")
    swagger_doc_path = "/api/v1/docs" if os.environ.get("FLASK_ENV") != "production" else False
    api = Api(
        api_bp,
        version="1.0",
        title="API Gestao Advocacia",
        description="API para gerenciar informacoes de um escritorio de advocacia.",
        doc=swagger_doc_path,
        authorizations={
            "jsonWebToken": {
                "type": "apiKey",
                "in": "header",
                "name": "Authorization",
                "description": "Token JWT no formato 'Bearer <token>'.",
            }
        },
        security="jsonWebToken",
    )

    register_api_routes(app, api, finance_access_required)
    app.register_blueprint(api_bp)

    # Mantem compatibilidade temporaria com clientes antigos em /api.
    legacy_api_bp = Blueprint("legacy_api", __name__, url_prefix="/api")

    @legacy_api_bp.route(
        "/<path:subpath>", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
    )
    def legacy_redirect(subpath):
        # Browsers do not allow redirects during CORS preflight.
        # Return 204 so Flask-CORS can attach the proper CORS headers.
        if request.method == "OPTIONS":
            return make_response("", 204)

        # Evita loop infinito: /api/v1/... já está no prefixo correto.
        if subpath.startswith("v1/") or subpath == "v1":
            flask_abort(404)

        target = f"/api/v1/{subpath}"
        qs = request.query_string.decode("utf-8")
        if qs:
            target += f"?{qs}"

        response = redirect(target, code=308)
        response.headers["Deprecation"] = "true"
        response.headers["Sunset"] = (datetime.utcnow() + timedelta(days=30)).strftime(
            "%a, %d %b %Y %H:%M:%S GMT"
        )
        return response

    app.register_blueprint(legacy_api_bp)

    configure_scheduler(app)
    register_status_route(app)
    register_openapi_docs(app)

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(
        debug=(os.environ.get("FLASK_ENV") == "development"),
        use_reloader=(
            os.environ.get("FLASK_ENV") == "development"
            and os.environ.get("WERKZEUG_RUN_MAIN") != "true"
        ),
    )
