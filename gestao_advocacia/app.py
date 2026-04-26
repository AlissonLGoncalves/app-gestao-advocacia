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
    configure_jwt_error_handlers,
    configure_request_context,
    configure_scheduler,
    register_status_route,
)
from config import Config
from extensions import db, jwt, limiter, migrate
from logging_config import configure_json_logging
from openapi_docs import register_openapi_docs

# admin-fase0: namespace isolado do backoffice super-admin
from routes.admin import register_admin_routes  # noqa: E402
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
    ProcuracaoAnalise,
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
    configure_jwt_error_handlers(jwt)
    limiter.init_app(app)
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

    # admin-fase0: blueprint + Api separados para o backoffice super-admin.
    # NUNCA reusa os namespaces de /api/v1 — isolamento explicito.
    from flask_restx import Namespace as _Namespace

    admin_bp = Blueprint("admin_api", __name__, url_prefix="/admin/v1")
    admin_swagger_doc = "/admin/v1/docs" if os.environ.get("FLASK_ENV") != "production" else False
    admin_api = Api(
        admin_bp,
        version="1.0",
        title="API Backoffice (Super-Admin)",
        description="Endpoints restritos ao dono da plataforma SaaS. Role superadmin obrigatoria.",
        doc=admin_swagger_doc,
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
    admin_ns = _Namespace("admin", description="Backoffice (super-admin)", path="/")
    admin_api.add_namespace(admin_ns)

    # admin-fase0: error handlers especificos do admin_api.
    # Cobre tanto excecoes do flask_jwt_extended quanto da PyJWT subjacente
    # (token mal-formado pode escapar do wrapper em algumas versoes).
    from flask_jwt_extended.exceptions import JWTExtendedException, NoAuthorizationError
    from jwt.exceptions import PyJWTError

    @admin_api.errorhandler(NoAuthorizationError)
    def _admin_handle_no_auth(error):
        return {"message": "Acesso negado."}, 401

    @admin_api.errorhandler(JWTExtendedException)
    def _admin_handle_jwt(error):
        return {"message": "Acesso negado."}, 401

    @admin_api.errorhandler(PyJWTError)
    def _admin_handle_pyjwt(error):
        # Token mal-formado / decode error / expired — todos resultam em 401 generico.
        return {"message": "Acesso negado."}, 401

    register_admin_routes(admin_ns)
    app.register_blueprint(admin_bp)

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

    @app.errorhandler(429)
    def ratelimit_handler(e):
        return {
            "message": "Muitas tentativas. Aguarde e tente novamente.",
            "retry_after": e.description,
        }, 429

    # Flask-RESTX tem sua propria cadeia de error handlers que pode
    # interceptar 429 antes do @app.errorhandler acima.
    # Registramos tambem no objeto `api` para garantir a mensagem customizada.
    from werkzeug.exceptions import TooManyRequests

    @api.errorhandler(TooManyRequests)
    def api_ratelimit_handler(e):
        return {
            "message": "Muitas tentativas. Aguarde e tente novamente.",
            "retry_after": getattr(e, "description", None),
        }, 429

    return app


# Instancia de modulo para gunicorn (app:app). A S7 (scheduler isolado) so
# inicia o APScheduler quando FLY_PROCESS_GROUP == "scheduler" (ver
# configure_scheduler), entao e seguro criar o app aqui em ambos process groups.
app = create_app()


if __name__ == "__main__":
    app.run(
        debug=(os.environ.get("FLASK_ENV") == "development"),
        use_reloader=(
            os.environ.get("FLASK_ENV") == "development"
            and os.environ.get("WERKZEUG_RUN_MAIN") != "true"
        ),
    )
