# ==============================================================================
# ARQUIVO: gestao_advocacia/config.py
# Modificado para incluir configurações do APScheduler e do Job CNJ.
# ==============================================================================
import logging
import os

from dotenv import load_dotenv


def _normalize_sqlalchemy_db_url(db_url: str) -> str:
    if db_url.startswith("postgres://"):
        return db_url.replace("postgres://", "postgresql://", 1)
    return db_url


def is_production() -> bool:
    """Indica se estamos em producao.

    Prefere APP_ENV (var dedicada, nova). Cai em FLASK_ENV por compat
    (deprecado pelo Flask). Sem var setada, assume DESENVOLVIMENTO — preserva
    o comportamento historico pre-existente. As protecoes criticas (Swagger,
    SECRET_KEY) tem suas proprias vars dedicadas (SWAGGER_ENABLED, exigencia
    explicita em prod), entao nao precisamos fail-closed aqui.
    """
    app_env = (os.environ.get("APP_ENV") or "").strip().lower()
    if app_env:
        return app_env == "production"
    return (os.environ.get("FLASK_ENV") or "").strip().lower() == "production"


# Determina o diretório base do projeto (um nível acima de 'gestao_advocacia')
# Isso garante que o .env seja encontrado corretamente, mesmo que config.py esteja em uma subpasta.
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
dotenv_path = os.path.join(BASE_DIR, ".env")

if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)
else:
    # Fallback se o .env não estiver na raiz, mas isso geralmente não é o ideal.
    env_local_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_local_path):
        load_dotenv(env_local_path)


class Config:
    """Configurações base da aplicação."""

    SECRET_KEY = os.environ.get("SECRET_KEY")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY")

    # In production both keys MUST be set via environment variables.
    # A missing key will cause a clear startup error instead of silently
    # falling back to an insecure default.
    if not SECRET_KEY:
        import warnings

        if is_production():
            raise RuntimeError(
                "CRITICAL: SECRET_KEY environment variable is not set. "
                "Refusing to start in production without a strong secret key."
            )
        SECRET_KEY = "dev-only-secret-key-do-not-use-in-production"
        warnings.warn(
            "Using insecure default SECRET_KEY — set SECRET_KEY env var for production.",
            stacklevel=2,
        )

    if not JWT_SECRET_KEY:
        import warnings

        if is_production():
            raise RuntimeError(
                "CRITICAL: JWT_SECRET_KEY environment variable is not set. "
                "Refusing to start in production without a strong JWT secret key."
            )
        JWT_SECRET_KEY = "dev-only-jwt-key-do-not-use-in-production"
        warnings.warn(
            "Using insecure default JWT_SECRET_KEY — set JWT_SECRET_KEY env var for production.",
            stacklevel=2,
        )

    _runtime_db_url = os.environ.get("DATABASE_URL") or "sqlite:///" + os.path.join(
        os.path.abspath(os.path.dirname(__file__)), "app.db"
    )
    _admin_db_url = os.environ.get("DATABASE_URL_ADMIN") or _runtime_db_url
    USE_DATABASE_URL_ADMIN = os.environ.get("USE_DATABASE_URL_ADMIN", "false").lower() == "true"

    SQLALCHEMY_DATABASE_URI_RUNTIME = _normalize_sqlalchemy_db_url(_runtime_db_url)
    SQLALCHEMY_DATABASE_URI_ADMIN = _normalize_sqlalchemy_db_url(_admin_db_url)
    SQLALCHEMY_DATABASE_URI = (
        SQLALCHEMY_DATABASE_URI_ADMIN if USE_DATABASE_URL_ADMIN else SQLALCHEMY_DATABASE_URI_RUNTIME
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO = False  # Mude para True para logar queries SQL em desenvolvimento, se útil
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,  # testa conexão antes de usar (evita SSL closed após sleep)
        "pool_recycle": 280,  # recicla antes do timeout server-side (~5 min)
    }

    # UPLOAD_FOLDER: em produção usa volume persistente do Fly (/data/uploads)
    UPLOAD_FOLDER = os.environ.get("UPLOAD_FOLDER") or os.path.join(
        os.path.abspath(os.path.dirname(__file__)), "uploads"
    )
    # Limite global do Flask: alinhado ao maior endpoint legitimo (POST /projudi/pecas
    # = 50 MB). Endpoints de documento comum continuam validando 10 MB no
    # upload_validator (camada de aplicacao). Sem este alinhamento, o Flask
    # carregava ate 100 MB em memoria antes de qualquer validacao — vetor de DoS.
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50 MB

    CNJ_API_KEY = os.environ.get("CNJ_API_KEY", "")
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
    GEMINI_PROCURACAO_MODEL = os.environ.get("GEMINI_PROCURACAO_MODEL", "gemini-2.5-flash")
    # Triagem precisa extracao precisa (CPF associado a parte, advogados separados,
    # valor causa, parte contraria). 'gemini-2.5-pro' eh ~5x melhor para isso. Custo
    # cresce mas o volume eh baixo (so quando usuario clica num grupo).
    GEMINI_TRIAGEM_MODEL = os.environ.get("GEMINI_TRIAGEM_MODEL", "gemini-2.5-pro")
    APP_VERSION = os.environ.get("APP_VERSION") or "1.9.0"

    LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()

    # --- Configurações do APScheduler e do Job CNJ ---
    CNJ_JOB_ENABLED = os.environ.get("CNJ_JOB_ENABLED", "True").lower() == "true"
    CNJ_JOB_INTERVAL_HOURS = int(os.environ.get("CNJ_JOB_INTERVAL_HOURS", 12))
    CNJ_JOB_INTERVAL_MINUTES = int(os.environ.get("CNJ_JOB_INTERVAL_MINUTES", 0))
    CNJ_JOB_REQUEST_DELAY_SECONDS = int(os.environ.get("CNJ_JOB_REQUEST_DELAY_SECONDS", 5))
    CNJ_JOB_MAX_CASES_PER_RUN = int(os.environ.get("CNJ_JOB_MAX_CASES_PER_RUN", 10))

    # Configurações do APScheduler
    SCHEDULER_API_ENABLED = False  # Disabled — exposes unauthenticated job management endpoints
    SCHEDULER_TIMEZONE = os.environ.get("SCHEDULER_TIMEZONE", "America/Sao_Paulo")

    # --- Configurações do DJEN (ComunicaAPI/CNJ) ---
    DJEN_API_BASE_URL = os.environ.get("DJEN_API_BASE_URL", "https://comunicaapi.pje.jus.br")
    DJEN_JOB_ENABLED = os.environ.get("DJEN_JOB_ENABLED", "False").lower() == "true"
    DJEN_JOB_HOUR = int(os.environ.get("DJEN_JOB_HOUR", 4))
    DJEN_JOB_MINUTE = int(os.environ.get("DJEN_JOB_MINUTE", 0))
    DJEN_LOOKBACK_DAYS = int(os.environ.get("DJEN_LOOKBACK_DAYS", 30))
    DJEN_ITENS_POR_PAGINA = int(os.environ.get("DJEN_ITENS_POR_PAGINA", 100))
    # Máximo de páginas a percorrer por tentativa (cap de segurança). Como a
    # ComunicaAPI limita itensPorPagina a 100, 50 páginas = até 5.000 itens por
    # sigla/OAB/processo. Ajuste para cima se necessário em escritórios grandes.
    DJEN_MAX_PAGINAS_POR_CONSULTA = int(os.environ.get("DJEN_MAX_PAGINAS_POR_CONSULTA", 50))
    DJEN_REQUEST_DELAY_SECONDS = float(os.environ.get("DJEN_REQUEST_DELAY_SECONDS", 1.5))
    DJEN_BUSCAR_TODOS_TRIBUNAIS = (
        os.environ.get("DJEN_BUSCAR_TODOS_TRIBUNAIS", "True").lower() == "true"
    )
    DJEN_ENABLED_TENANTS = os.environ.get("DJEN_ENABLED_TENANTS", "")  # CSV: 1,2,3
    DJEN_ROLLOUT_PERCENT = int(os.environ.get("DJEN_ROLLOUT_PERCENT", 100))  # 10, 50, 100

    # Token de convite: padrão 48h. Ajuste com INVITE_TOKEN_HOURS env var.
    INVITE_TOKEN_HOURS = int(os.environ.get("INVITE_TOKEN_HOURS", "48"))

    # Modo de cadastro (issue #112):
    # - "closed" (padrao): /register retorna 403; apenas /register-invite com token
    #   valido funciona. Use enquanto nao houver gate de pagamento integrado.
    # - "open": permite self-signup direto. So habilitar quando Stripe/cobranca
    #   estiver bloqueando acesso pos-trial — sem gate de pagamento, "open" deixa
    #   qualquer um criar tenant gratuito sem limite.
    REGISTRATION_MODE = os.environ.get("REGISTRATION_MODE", "closed").lower()

    if os.environ.get("FLASK_ENV") == "production" and not GEMINI_API_KEY:
        logging.getLogger(__name__).warning(
            "GEMINI_API_KEY não configurada em produção. Recursos Gemini ficarão desabilitados."
        )
