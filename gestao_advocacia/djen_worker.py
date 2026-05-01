"""DJEN sync worker (B1 do roteiro 2026-05-01).

Processo dedicado no Fly via [processes].djen-worker. Poll a cada 5s,
pega DjenSyncJob FOR UPDATE SKIP LOCKED com status=pending,
marca running, executa job_monitorar_djen, marca done/failed.

Conecta ao DB via DATABASE_URL_ADMIN (BYPASSRLS) — todas as queries do
worker sao cross-tenant; tenant_id da linha do job e usado para passar
ao job_monitorar_djen, nao como filtro RLS.

Uso esperado em fly.toml:
    [processes]
      djen-worker = "python djen_worker.py"
"""

import logging
import os
import sys
import time
from datetime import datetime

# DATABASE_URL_ADMIN precisa estar disponivel; senao o worker nao roda.
# Em dev local pode usar o mesmo DATABASE_URL.
os.environ["USE_DATABASE_URL_ADMIN"] = "true"

# Reduz log spam do APScheduler (worker nao roda scheduler)
os.environ.setdefault("DJEN_JOB_ENABLED", "False")
os.environ.setdefault("CNJ_JOB_ENABLED", "False")

from app import create_app, db  # noqa: E402

POLL_INTERVAL_SECONDS = int(os.environ.get("DJEN_WORKER_POLL_INTERVAL", "5"))
MAX_JOB_AGE_HOURS = int(os.environ.get("DJEN_WORKER_MAX_JOB_AGE_HOURS", "24"))


def _setup_logger():
    logger = logging.getLogger("djen_worker")
    logger.setLevel(logging.INFO)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(
            logging.Formatter("%(asctime)s [%(levelname)s] djen_worker: %(message)s")
        )
        logger.addHandler(handler)
    return logger


def _claim_next_job(session, logger):
    """Pega 1 job pending mais antigo, marca running atomicamente.

    Usa FOR UPDATE SKIP LOCKED para que multiplos workers (futuro) nao
    pisem no mesmo job. Hoje rodamos 1 worker so, mas ja deixamos preparado.
    """
    from sqlalchemy import text

    from models import DjenSyncJob

    # Em uma transacao: pega + marca running.
    # Postgres-only (FOR UPDATE SKIP LOCKED). Em SQLite (testes) cai no fallback.
    if db.engine.dialect.name == "postgresql":
        result = session.execute(text("""
                SELECT id FROM djen_sync_job
                 WHERE status = 'pending'
                 ORDER BY criado_em ASC
                 LIMIT 1
                 FOR UPDATE SKIP LOCKED
                """)).first()
        if not result:
            return None
        job_id = result[0]
    else:
        job = (
            session.query(DjenSyncJob)
            .filter(DjenSyncJob.status == "pending")
            .order_by(DjenSyncJob.criado_em.asc())
            .first()
        )
        if not job:
            return None
        job_id = job.id

    job = session.query(DjenSyncJob).get(job_id)
    job.status = "running"
    job.iniciado_em = datetime.utcnow()
    session.commit()
    logger.info(
        f"job_claimed id={job.id} tenant_id={job.tenant_id} lookback_days={job.lookback_days}"
    )
    return job


def _process_job(app, job, logger):
    """Executa job_monitorar_djen para o tenant do job. Atualiza linha
    com status=done + resumo, ou status=failed + erro."""
    from djen_service import DjenAPIError
    from djen_tasks import job_monitorar_djen
    from models import DjenSyncJob

    try:
        resumo = job_monitorar_djen(
            app,
            lookback_days=job.lookback_days,
            tenant_id=job.tenant_id,
            force=True,
        )
        with app.app_context():
            db_job = db.session.query(DjenSyncJob).get(job.id)
            db_job.status = "done"
            db_job.resumo = resumo
            db_job.concluido_em = datetime.utcnow()
            db.session.commit()
        logger.info(f"job_done id={job.id} resumo_keys={list((resumo or {}).keys())}")
    except DjenAPIError as e:
        # Rate limit ou erro de API — marca failed mas com mensagem orientativa.
        logger.warning(f"job_failed id={job.id} api_error={e}")
        with app.app_context():
            db_job = db.session.query(DjenSyncJob).get(job.id)
            db_job.status = "failed"
            db_job.erro = f"API DJEN: {str(e)[:500]}"
            db_job.concluido_em = datetime.utcnow()
            db.session.commit()
    except Exception as e:  # noqa: BLE001
        logger.error(f"job_failed id={job.id} unexpected={e}", exc_info=True)
        with app.app_context():
            db_job = db.session.query(DjenSyncJob).get(job.id)
            db_job.status = "failed"
            db_job.erro = f"Erro inesperado: {str(e)[:500]}"
            db_job.concluido_em = datetime.utcnow()
            db.session.commit()


def _cleanup_stuck_jobs(session, logger):
    """Re-enfileira jobs que ficaram em status=running por mais de MAX_JOB_AGE_HOURS.

    Acontece se worker crashar no meio de um job. Sem isso, a linha
    fica running para sempre e a de-duplicacao do endpoint bloqueia
    novos syncs do tenant.
    """
    from datetime import timedelta

    from models import DjenSyncJob

    cutoff = datetime.utcnow() - timedelta(hours=MAX_JOB_AGE_HOURS)
    stuck = (
        session.query(DjenSyncJob)
        .filter(DjenSyncJob.status == "running", DjenSyncJob.iniciado_em < cutoff)
        .all()
    )
    for j in stuck:
        logger.warning(
            f"reaping_stuck_job id={j.id} iniciado_em={j.iniciado_em} "
            f"running_for={(datetime.utcnow() - j.iniciado_em)}"
        )
        j.status = "failed"
        j.erro = f"Worker reaped: stuck running > {MAX_JOB_AGE_HOURS}h"
        j.concluido_em = datetime.utcnow()
    if stuck:
        session.commit()


def main():
    logger = _setup_logger()
    logger.info(
        f"starting djen_worker poll_interval={POLL_INTERVAL_SECONDS}s "
        f"max_job_age={MAX_JOB_AGE_HOURS}h"
    )

    app = create_app()
    cleanup_counter = 0

    while True:
        try:
            with app.app_context():
                # Cleanup de jobs travados a cada ~10 min (120 ciclos de 5s)
                cleanup_counter += 1
                if cleanup_counter >= 120:
                    _cleanup_stuck_jobs(db.session, logger)
                    cleanup_counter = 0

                job = _claim_next_job(db.session, logger)

            if job is None:
                time.sleep(POLL_INTERVAL_SECONDS)
                continue

            _process_job(app, job, logger)
        except KeyboardInterrupt:
            logger.info("graceful shutdown via KeyboardInterrupt")
            break
        except Exception as e:  # noqa: BLE001
            # Worker nao deve morrer por erro de um job — log e continua.
            logger.error(f"worker_loop_error: {e}", exc_info=True)
            time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
