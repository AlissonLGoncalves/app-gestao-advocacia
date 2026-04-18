import os
import re
import uuid

from flask import g, jsonify, request
from werkzeug.exceptions import HTTPException

from extensions import scheduler
from tasks import job_verificar_processos_cnj


def configure_cors_origins():
    allowed_origins = [
        os.environ.get("FRONTEND_URL", "http://localhost:5173"),
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "https://app-gestao-advocacia.vercel.app",
        re.compile(r"https://.*\.vercel\.app$"),
    ]
    extra_origins = os.environ.get("CORS_ALLOWED_ORIGINS", "")
    if extra_origins:
        allowed_origins.extend([o.strip() for o in extra_origins.split(",") if o.strip()])
    return allowed_origins


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
        if isinstance(error, HTTPException) and error.code < 500:
            return error

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
            return error
        return jsonify({"message": "Erro interno do servidor."}), 500


def configure_scheduler(app):
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
