"""CLI de jobs pontuais — usado pelos Cloud Run Jobs (Google Cloud).

No Fly havia dois processos sempre ligados: `scheduler` (APScheduler) e
`djen-worker` (loop infinito). No Cloud Run isso custaria uma instancia
permanente cada. Em vez disso, o Cloud Scheduler dispara um Cloud Run Job
que executa UMA rodada e encerra:

    python jobs_cli.py migrate        # flask db upgrade como app_admin (no deploy)
    python jobs_cli.py cnj            # job_verificar_processos_cnj (a cada 12h)
    python jobs_cli.py alertas        # job_verificar_prazos (06:00 BRT)
    python jobs_cli.py notificacoes   # job_verificar_vencimentos (07:00 BRT)
    python jobs_cli.py djen           # job_monitorar_djen cross-tenant (04:00 BRT)
    python jobs_cli.py djen-worker    # drena a fila djen_sync_job e sai (a cada 5 min)

Exit code != 0 quando o job falha, para o Cloud Run marcar a execucao como
falha e o Cloud Scheduler/alertas enxergarem.

Roles de banco:
- `migrate` e `djen-worker` usam DATABASE_URL_ADMIN (app_admin), como no Fly
  (release_command e djen_worker.py).
- os demais rodam como app_user, igual ao processo `scheduler` do Fly — os
  jobs iteram por tenant e setam g._rls_tenant_id antes de cada bloco.
"""

import logging
import os
import subprocess
import sys

COMANDOS = ("migrate", "cnj", "alertas", "notificacoes", "djen", "djen-worker")


def _setup_logger():
    logging.basicConfig(
        level=os.environ.get("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s jobs_cli %(message)s",
    )
    return logging.getLogger("jobs_cli")


def _run_migrate(logger):
    os.environ["USE_DATABASE_URL_ADMIN"] = "true"
    os.environ.setdefault("FLASK_APP", "app.py")
    logger.info("flask db upgrade (app_admin)")
    subprocess.run([sys.executable, "-m", "flask", "db", "upgrade"], check=True)


def _run_djen_worker(logger):
    # Precisa setar antes de importar app (djen_worker faz o mesmo).
    os.environ["USE_DATABASE_URL_ADMIN"] = "true"
    import djen_worker

    processados = djen_worker.run_once()
    logger.info("djen-worker: %s job(s) processado(s)", processados)


def _run_job_app(nome, logger):
    # Nao subir APScheduler dentro do job: create_app so o inicia quando
    # FLY_PROCESS_GROUP=scheduler (ver app_runtime.configure_scheduler).
    os.environ.pop("FLY_PROCESS_GROUP", None)

    from app import create_app

    app = create_app()

    if nome == "cnj":
        from tasks import job_verificar_processos_cnj

        with app.app_context():
            job_verificar_processos_cnj()
    elif nome == "alertas":
        from alertas_tasks import job_verificar_prazos

        job_verificar_prazos(app)
    elif nome == "notificacoes":
        from notificacoes_tasks import job_verificar_vencimentos

        job_verificar_vencimentos(app)
    elif nome == "djen":
        from djen_tasks import job_monitorar_djen

        # force=True: o flag DJEN_JOB_ENABLED existia para pausar o APScheduler;
        # aqui quem decide se roda e o Cloud Scheduler (pausar o job la).
        resultado = job_monitorar_djen(app, force=True)
        logger.info("djen: %s", resultado)
    else:  # pragma: no cover - protegido pelo main()
        raise ValueError(nome)


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    logger = _setup_logger()

    if len(argv) != 1 or argv[0] not in COMANDOS:
        print(f"uso: python jobs_cli.py <{'|'.join(COMANDOS)}>", file=sys.stderr)
        return 2

    nome = argv[0]
    logger.info("inicio job=%s", nome)
    try:
        if nome == "migrate":
            _run_migrate(logger)
        elif nome == "djen-worker":
            _run_djen_worker(logger)
        else:
            _run_job_app(nome, logger)
    except Exception as e:  # noqa: BLE001
        logger.error("job=%s falhou: %s", nome, e, exc_info=True)
        return 1

    logger.info("fim job=%s ok", nome)
    return 0


if __name__ == "__main__":
    sys.exit(main())
