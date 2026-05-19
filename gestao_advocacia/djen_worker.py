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
# Reduzido de 24h para 30min (incidente 2026-05-19): redeploys no Fly derrubavam
# o worker no meio de um job, deixando running travado por ate 24h e bloqueando
# todos os syncs do tenant via de-dup no enqueue. Sync DJEN tipico leva <2min;
# 30min e margem confortavel pra rate-limit e respostas lentas da ComunicaAPI.
MAX_RUNNING_MINUTES = int(os.environ.get("DJEN_WORKER_MAX_RUNNING_MINUTES", "30"))
# Pending sem worker: se enqueue acontece com worker down, job fica pending pra
# sempre. Maximo razoavel: 10min (5s de poll * margem). Apos isso, marca failed
# pra que o tenant possa reenfileirar.
MAX_PENDING_MINUTES = int(os.environ.get("DJEN_WORKER_MAX_PENDING_MINUTES", "10"))
# Cleanup roda a cada N ciclos. 12 * 5s = 1min. Cheap o suficiente pra rodar
# frequente sem martelar o DB.
CLEANUP_EVERY_N_CYCLES = int(os.environ.get("DJEN_WORKER_CLEANUP_CYCLES", "12"))


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
    """Reaper de jobs travados — running ou pending orfaos.

    - `running` > MAX_RUNNING_MINUTES: worker crashou no meio (ou redeploy).
      Sem isso, a linha fica running pra sempre e a de-duplicacao do endpoint
      bloqueia novos syncs do tenant.
    - `pending` > MAX_PENDING_MINUTES: ninguem pegou (worker estava down quando
      foi enfileirado). Sync DJEN tipico processa em <2min; pending > 10min
      indica orfao.

    Em ambos os casos: marca failed pra liberar o tenant pra reenfileirar.
    """
    from datetime import timedelta

    from models import DjenSyncJob

    agora = datetime.utcnow()
    running_cutoff = agora - timedelta(minutes=MAX_RUNNING_MINUTES)
    pending_cutoff = agora - timedelta(minutes=MAX_PENDING_MINUTES)

    stuck_running = (
        session.query(DjenSyncJob)
        .filter(DjenSyncJob.status == "running", DjenSyncJob.iniciado_em < running_cutoff)
        .all()
    )
    for j in stuck_running:
        logger.warning(
            f"reaping_stuck_running id={j.id} tenant_id={j.tenant_id} "
            f"iniciado_em={j.iniciado_em} running_for={(agora - j.iniciado_em)}"
        )
        j.status = "failed"
        j.erro = f"Worker reaped: stuck running > {MAX_RUNNING_MINUTES}min"
        j.concluido_em = agora

    stuck_pending = (
        session.query(DjenSyncJob)
        .filter(DjenSyncJob.status == "pending", DjenSyncJob.criado_em < pending_cutoff)
        .all()
    )
    for j in stuck_pending:
        logger.warning(
            f"reaping_stuck_pending id={j.id} tenant_id={j.tenant_id} "
            f"criado_em={j.criado_em} pending_for={(agora - j.criado_em)}"
        )
        j.status = "failed"
        j.erro = f"Worker reaped: stuck pending > {MAX_PENDING_MINUTES}min (worker indisponivel?)"
        j.concluido_em = agora

    if stuck_running or stuck_pending:
        session.commit()
        logger.info(
            f"reaper_summary running_reaped={len(stuck_running)} "
            f"pending_reaped={len(stuck_pending)}"
        )


def main():
    logger = _setup_logger()
    logger.info(
        f"starting djen_worker poll_interval={POLL_INTERVAL_SECONDS}s "
        f"max_running={MAX_RUNNING_MINUTES}min max_pending={MAX_PENDING_MINUTES}min"
    )

    app = create_app()

    # Cleanup imediato no startup. Cobre o caso de redeploy/restart enquanto
    # havia job em execucao — a maquina antiga morreu sem fechar a linha do DB,
    # entao a primeira coisa que a nova maquina faz e marcar esses jobs como
    # failed pra liberar a fila do tenant.
    with app.app_context():
        try:
            _cleanup_stuck_jobs(db.session, logger)
        except Exception as e:  # noqa: BLE001
            logger.error(f"startup_cleanup_error: {e}", exc_info=True)

    cleanup_counter = 0

    while True:
        try:
            with app.app_context():
                cleanup_counter += 1
                if cleanup_counter >= CLEANUP_EVERY_N_CYCLES:
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
