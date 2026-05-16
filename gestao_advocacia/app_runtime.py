import os
import uuid

from flask import g, jsonify, request
from flask_jwt_extended.exceptions import JWTExtendedException, NoAuthorizationError
from jwt.exceptions import (
    ExpiredSignatureError as PyJWTExpiredSignatureError,
)
from jwt.exceptions import (
    InvalidTokenError as PyJWTInvalidTokenError,
)
from werkzeug.exceptions import HTTPException

from extensions import scheduler
from tasks import job_verificar_processos_cnj

# Origins explicitamente permitidos — nao usar regex aberto (*.vercel.app aceita qualquer dominio)
ALLOWED_ORIGINS = [
    "https://app-gestao-advocacia.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


def configure_cors_origins():
    origins = list(ALLOWED_ORIGINS)
    # Preview URLs do Vercel para o projeto especifico (PRs de deploy)
    # Formato: https://app-gestao-advocacia-<hash>.vercel.app
    import re

    origins.append(re.compile(r"https://app-gestao-advocacia-[\w-]+\.vercel\.app$"))
    # Origens extras via env var (CSV) — staging, dominios customizados, etc.
    # Validamos cada entrada: precisa ser http(s)://host[:porta] absoluto, sem
    # wildcards, sem path. Uma origem mal-formada (ex.: "*", " ", URL com path)
    # eh ignorada com aviso, NAO injetada na lista. Sem essa validacao um
    # CORS_ALLOWED_ORIGINS=* via deploy errado abria CORS pra qualquer origem.
    valid_origin = re.compile(r"^https?://[A-Za-z0-9._-]+(?::\d+)?$")
    extra_origins = os.environ.get("CORS_ALLOWED_ORIGINS", "")
    if extra_origins:
        for raw in extra_origins.split(","):
            o = raw.strip()
            if not o:
                continue
            if not valid_origin.match(o):
                # Print direto pq ainda nao temos app.logger configurado aqui.
                print(f"[CORS] ignorando origem invalida em CORS_ALLOWED_ORIGINS: {o!r}")
                continue
            origins.append(o)
    return origins


def configure_request_context(app):
    @app.before_request
    def set_request_context():
        incoming_request_id = request.headers.get("X-Request-ID")
        g.request_id = incoming_request_id if incoming_request_id else str(uuid.uuid4())

    @app.after_request
    def add_request_id_header(response):
        response.headers["X-Request-ID"] = getattr(g, "request_id", "-")
        return response


def configure_error_handlers(app):
    @app.errorhandler(Exception)
    def handle_unhandled_exception(error):
        if isinstance(error, NoAuthorizationError):
            return jsonify({"message": str(error)}), 401

        # PyJWT exceptions (vem de jwt.exceptions, NAO de flask_jwt_extended).
        # ExpiredSignatureError e InvalidTokenError vazam de _decode_jwt antes
        # de virarem flask_jwt_extended.exceptions, entao o handler abaixo
        # nao pegava — caia em "Erro interno (500)" no dashboard ao expirar
        # JWT, em vez de 401 -> redirect login. Tratado explicitamente aqui.
        if isinstance(error, PyJWTExpiredSignatureError):
            return jsonify({"message": "Token expirado."}), 401

        if isinstance(error, PyJWTInvalidTokenError):
            return jsonify({"message": "Token invalido."}), 401

        if isinstance(error, JWTExtendedException):
            return jsonify({"message": str(error)}), 422

        if isinstance(error, HTTPException) and error.code < 500:
            return jsonify({"message": error.description}), error.code

        status_code = error.code if isinstance(error, HTTPException) else 500
        app.logger.exception(
            "server_error",
            extra={
                "event": "server_error",
                "endpoint": request.path,
                "method": request.method,
                "status_code": status_code,
            },
        )

        if isinstance(error, HTTPException):
            return jsonify({"message": error.description}), error.code
        return jsonify({"message": "Erro interno do servidor."}), 500


def configure_jwt_error_handlers(jwt):
    @jwt.unauthorized_loader
    def handle_missing_token(reason):
        return jsonify({"message": reason}), 401

    @jwt.invalid_token_loader
    def handle_invalid_token(reason):
        return jsonify({"message": reason}), 422

    @jwt.expired_token_loader
    def handle_expired_token(jwt_header, jwt_payload):
        return jsonify({"message": "Token expirado."}), 401

    @jwt.needs_fresh_token_loader
    def handle_fresh_token_required(jwt_header, jwt_payload):
        return jsonify({"message": "Token recente obrigatorio."}), 401

    @jwt.revoked_token_loader
    def handle_revoked_token(jwt_header, jwt_payload):
        return jsonify({"message": "Token revogado."}), 401


def configure_scheduler(app):
    process_group = os.environ.get("FLY_PROCESS_GROUP", "")
    if process_group != "scheduler":
        app.logger.info(
            "APScheduler nao iniciado (FLY_PROCESS_GROUP != scheduler).",
        )
        return

    # Idempotencia: se o scheduler ja foi inicializado nesta mesma maquina
    # (create_app() em app.py chama configure_scheduler, e o scheduler_runner.py
    # chama de novo apos bootstrap), uma segunda init_app() em scheduler ja
    # rodando levanta SchedulerAlreadyRunningError. Pula reinit silenciosamente.
    if scheduler.running:
        app.logger.info("APScheduler ja em execucao — skip reconfiguracao.")
        return

    if app.config.get("CNJ_JOB_ENABLED", False):
        if not app.config.get("TESTING", False):
            scheduler.init_app(app)
            if not app.debug or os.environ.get("WERKZEUG_RUN_MAIN") == "true":
                job_id = "VerificarProcessosCNJJob"
                if not scheduler.get_job(job_id):
                    try:
                        interval_hours = app.config.get("CNJ_JOB_INTERVAL_HOURS", 12)
                        interval_minutes = app.config.get("CNJ_JOB_INTERVAL_MINUTES", 0)
                        scheduler.add_job(
                            id=job_id,
                            func=job_verificar_processos_cnj,
                            trigger="interval",
                            hours=interval_hours,
                            minutes=interval_minutes,
                            replace_existing=True,
                        )
                        app.logger.info(
                            f"Job '{job_id}' agendado: {interval_hours}h{interval_minutes}m."
                        )

                        job_alertas_id = "VerificarAlertasPrazosJob"
                        if not scheduler.get_job(job_alertas_id):
                            from alertas_tasks import job_verificar_prazos

                            scheduler.add_job(
                                id=job_alertas_id,
                                func=job_verificar_prazos,
                                args=[app],
                                trigger="cron",
                                hour=6,
                                minute=0,
                                replace_existing=True,
                            )
                            app.logger.info(
                                f"Job '{job_alertas_id}' agendado para rodar diariamente as 06:00."
                            )

                        # Cron de notificacoes de vencimento (recebimentos +
                        # despesas) — roda diariamente as 07:00.
                        notif_job_id = "VerificarVencimentosJob"
                        if not scheduler.get_job(notif_job_id):
                            from notificacoes_tasks import job_verificar_vencimentos

                            scheduler.add_job(
                                id=notif_job_id,
                                func=job_verificar_vencimentos,
                                args=[app],
                                trigger="cron",
                                hour=7,
                                minute=0,
                                replace_existing=True,
                            )
                            app.logger.info(f"Job '{notif_job_id}' agendado diariamente as 07:00.")

                        if app.config.get("DJEN_JOB_ENABLED", False):
                            djen_job_id = "SincronizarDJENJob"
                            if not scheduler.get_job(djen_job_id):
                                from djen_tasks import job_monitorar_djen

                                djen_hour = app.config.get("DJEN_JOB_HOUR", 4)
                                djen_minute = app.config.get("DJEN_JOB_MINUTE", 0)
                                scheduler.add_job(
                                    id=djen_job_id,
                                    func=job_monitorar_djen,
                                    args=[app],
                                    trigger="cron",
                                    hour=djen_hour,
                                    minute=djen_minute,
                                    replace_existing=True,
                                )
                                app.logger.info(
                                    f"Job '{djen_job_id}' agendado as {djen_hour:02d}:{djen_minute:02d}."
                                )
                    except Exception as e_add_job:
                        app.logger.error(f"Falha ao adicionar job '{job_id}': {str(e_add_job)}")
                if not scheduler.running:
                    try:
                        scheduler.start(paused=False)
                        app.logger.info("APScheduler iniciado com sucesso.")
                    except Exception as e_start_scheduler:
                        app.logger.error(f"Falha ao iniciar APScheduler: {str(e_start_scheduler)}")
                else:
                    app.logger.info("APScheduler ja esta em execucao.")
            else:
                app.logger.info("APScheduler nao iniciado (Werkzeug reloader ou debug).")
        else:
            app.logger.info("APScheduler nao iniciado (TESTING=True).")
    else:
        app.logger.info("Job CNJ (CNJ_JOB_ENABLED) esta DESABILITADO.")


def register_status_route(app):
    @app.route("/")
    def serve_api_status():
        return (
            jsonify(
                {
                    "status": "online",
                    "message": "API Patronus (Servidor Backend) operando com sucesso. Utilize o Front-end Vercel para acessar a Interface.",
                }
            ),
            200,
        )
