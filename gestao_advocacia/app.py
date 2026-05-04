import os
from datetime import datetime, timedelta
from functools import wraps

from dotenv import load_dotenv
from flask import (
    Blueprint,
    Flask,
    current_app,
    g,
    make_response,
    redirect,
    request,
)
from flask import abort as flask_abort
from flask_cors import CORS
from flask_jwt_extended import get_jwt, get_jwt_identity, verify_jwt_in_request
from flask_jwt_extended.exceptions import JWTExtendedException
from flask_restx import Api, abort
from sqlalchemy import event

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
from utils.log_sanitizer import mask_user_id

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


def _is_public_or_unauthenticated_path(path):
    if path == "/":
        return True
    public_prefixes = (
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/register-invite",
        "/api/v1/auth/termos-vigentes",
        "/api/v1/auth/forgot-password",
        "/api/v1/auth/reset-password",
        "/api/v1/docs",
        "/admin/v1/docs",
        "/swaggerui",
        "/static",
    )
    return path.startswith(public_prefixes)


def _register_rls_engine_events(engine):
    """Re-aplica app.current_tenant_id em cada nova transacao.

    Le `g._rls_tenant_id` que e setado em duas situacoes:
    1. Hook before_request (HTTP requests autenticadas): set apos lookup do user
    2. Jobs/scripts (app_context sem request): set explicitamente pelo caller
       antes de iniciar queries que tocam tabelas com RLS.

    `flask.g` e app-context-bound desde Flask 0.10, entao funciona em ambos
    os casos. Listener sai cedo se nao houver app_context (testes em SQLite,
    boot sem contexto, etc).
    """

    @event.listens_for(engine, "begin")
    def _reapply_tenant_on_new_transaction(conn):
        if conn.dialect.name == "sqlite":
            return
        try:
            tid = getattr(g, "_rls_tenant_id", None)
        except RuntimeError:
            # Fora de qualquer contexto Flask — boot, scripts CLI sem app_context
            return
        if tid is None:
            return
        conn.exec_driver_sql(
            "SELECT set_config('app.current_tenant_id', %s, true)",
            (str(int(tid)),),
        )


from helpers import get_item_or_404  # noqa: E402, F401
from helpers.tenant import set_current_tenant_id  # noqa: E402
from models import (  # noqa: E402, F401
    Caso,
    Cliente,
    Despesa,
    DjenOabMonitoramento,
    DjenVinculoDecisao,
    EventoAgenda,
    MovimentacaoCNJ,
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
    with app.app_context():
        _register_rls_engine_events(db.engine)
    migrate.init_app(app, db)
    jwt.init_app(app)
    configure_jwt_error_handlers(jwt)
    limiter.init_app(app)
    CORS(app, origins=configure_cors_origins())

    configure_request_context(app)
    configure_error_handlers(app)

    # Swagger UI: gateado por var dedicada SWAGGER_ENABLED (default false).
    # Confiar em FLASK_ENV != "production" e perigoso — se a var nao for setada
    # em deploy novo, swagger fica exposto. Var explicita falha fechada.
    _swagger_enabled = os.environ.get("SWAGGER_ENABLED", "false").strip().lower() == "true"

    api_bp = Blueprint("api", __name__, url_prefix="/api/v1")
    swagger_doc_path = "/api/v1/docs" if _swagger_enabled else False
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
    admin_swagger_doc = "/admin/v1/docs" if _swagger_enabled else False
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
    from flask_jwt_extended.exceptions import NoAuthorizationError
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

    @app.before_request
    def set_tenant_rls_context():
        if request.method == "OPTIONS":
            return
        if _is_public_or_unauthenticated_path(request.path):
            return

        try:
            verify_jwt_in_request(optional=True)
        except Exception as exc:
            current_app.logger.warning(
                "rls_tenant_context_invalid_jwt",
                extra={
                    "event": "rls_tenant_context_invalid_jwt",
                    "path": request.path,
                    "err": str(exc),
                },
            )
            return

        user_id = get_jwt_identity()
        if user_id is None:
            return

        # HOTFIX (incidente 2026-05-01): apos Batch 4, RLS restritivo na
        # tabela User bloqueia o lookup aqui (chicken-and-egg: ainda nao
        # setamos tenant_id na sessao, justamente porque estamos tentando
        # descobrir qual e). Solucao: lookup via admin_session (BYPASSRLS),
        # mesma estrategia do /auth/login. Sem isso, todas as requests
        # autenticadas que tocam tabelas com RLS retornam 500
        # (current_setting indefinido).
        from helpers.admin_session import admin_session

        with admin_session() as _admin:
            _user = _admin.get(User, int(user_id))
            if not _user:
                current_app.logger.warning(
                    "rls_tenant_context_user_not_found",
                    extra={
                        "event": "rls_tenant_context_user_not_found",
                        "user_id_hash": mask_user_id(user_id),
                        "path": request.path,
                    },
                )
                return
            user_tenant_id = _user.tenant_id

        if user_tenant_id is None:
            current_app.logger.warning(
                "rls_tenant_context_missing_tenant",
                extra={
                    "event": "rls_tenant_context_missing_tenant",
                    "user_id_hash": mask_user_id(user_id),
                    "path": request.path,
                },
            )
            return

        g._rls_tenant_id = user_tenant_id
        set_current_tenant_id(user_tenant_id)

    configure_scheduler(app)
    register_status_route(app)
    from routes import register_health_route

    register_health_route(app)
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
