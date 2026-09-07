# Backend no Google Cloud (Cloud Run + Cloud SQL)

Substitui o Fly.io (abandonado em 07/09/2026; o app e o Postgres do Fly foram
apagados sem backup — o banco novo nasce vazio, via migrations).

## Recursos

| Recurso | Nome | Observacao |
|---|---|---|
| Projeto | `patronus-app` (numero 867244985680) | faturamento "My Billing Account" |
| Regiao | `southamerica-east1` (Sao Paulo) | IP brasileiro para ComunicaAPI/DataJud |
| API | Cloud Run service `patronus-api` | escala a zero; `--min-instances 0` |
| URL da API | `https://patronus-api-867244985680.southamerica-east1.run.app` | usada em `config.js` e na CSP do `vercel.json` |
| Banco | Cloud SQL `patronus-db` (Postgres 16, db-f1-micro, HDD 10 GB, zonal) | unico item pago fixo (~R$ 50-70/mes) |
| Database | `patronus` | roles `app_admin` (migrations/worker) e `app_user` (runtime, RLS) |
| Uploads | bucket `gs://patronus-app-uploads` | montado em `/data/uploads` no Cloud Run (volume Cloud Storage), sem mudanca de codigo |
| Imagens | Artifact Registry `patronus` | `southamerica-east1-docker.pkg.dev/patronus-app/patronus/api` |
| Secrets | Secret Manager | ver tabela abaixo |
| Conta de servico | `patronus-run@patronus-app.iam.gserviceaccount.com` | cloudsql.client, secretAccessor, storage.objectAdmin |
| Deploy | GitHub Actions `deploy-cloudrun.yml` | autentica via Workload Identity Federation |

## Processos do Fly -> Cloud Run

| Fly (`fly.toml`) | Cloud Run | Disparo |
|---|---|---|
| `app` (gunicorn) | service `patronus-api` | HTTP |
| `release_command` (flask db upgrade) | job `patronus-migrate` = `python jobs_cli.py migrate` | workflow de deploy, antes de publicar a imagem nova |
| `scheduler` (APScheduler) | jobs `patronus-cnj`, `patronus-alertas`, `patronus-notificacoes`, `patronus-djen` | Cloud Scheduler: CNJ a cada 12h, alertas 06:00, notificacoes 07:00, DJEN 04:00 (America/Sao_Paulo) |
| `djen-worker` (loop infinito) | job `patronus-djen-worker` = `python jobs_cli.py djen-worker` | Cloud Scheduler a cada 5 min; drena a fila `djen_sync_job` e sai |

`configure_scheduler` (APScheduler) continua no codigo, mas so liga com
`FLY_PROCESS_GROUP=scheduler`, que nao existe no Cloud Run. Pausar um job =
pausar no Cloud Scheduler (`gcloud scheduler jobs pause`), nao mais env var.

## Secrets (Secret Manager)

| Secret | Origem |
|---|---|
| `SECRET_KEY`, `JWT_SECRET_KEY`, `NFSE_CERT_ENCRYPTION_KEY`, `ADMIN_SEED_PASSWORD` | gerados em 07/09/2026 |
| `DB_APP_USER_PASSWORD`, `DB_APP_ADMIN_PASSWORD` | gerados; senhas das roles do Postgres |
| `DATABASE_URL`, `DATABASE_URL_ADMIN` | montadas a partir das senhas + socket do Cloud SQL |
| `GEMINI_API_KEY` | copiar do `.env` local (ver comando abaixo) |
| `SMTP_SERVER`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME`, `SMTP_USE_SSL` | copiar do `.env` local |
| `CNJ_API_KEY` | opcional (DataJud publica funciona sem) |

Criar um secret a partir de um valor (nunca colar o valor no chat):

```bash
printf '%s' 'VALOR' | gcloud secrets create GEMINI_API_KEY --data-file=- --replication-policy=user-managed --locations=southamerica-east1 --project=patronus-app
```

Nova versao de um secret existente:

```bash
printf '%s' 'VALOR' | gcloud secrets versions add GEMINI_API_KEY --data-file=- --project=patronus-app
```

## Conexao com o banco

Cloud Run conecta ao Cloud SQL por socket Unix (`--add-cloudsql-instances`):

```
postgresql://app_user:<senha>@/patronus?host=/cloudsql/patronus-app:southamerica-east1:patronus-db
postgresql://app_admin:<senha>@/patronus?host=/cloudsql/patronus-app:southamerica-east1:patronus-db
```

Acesso local (psql) via Cloud SQL Auth Proxy:

```bash
gcloud sql connect patronus-db --user=postgres --database=patronus --project=patronus-app
```

## RLS e BYPASSRLS no Cloud SQL

Cloud SQL nao da SUPERUSER, e `CREATE/ALTER ROLE ... BYPASSRLS` exige superuser
no Postgres. A migration `e1f2a3b4c5d6_create_rls_roles` tolera isso: se o
ALTER falhar, `app_admin` continua enxergando tudo porque e **owner** das
tabelas (owner ignora RLS enquanto nenhuma tabela tiver
`FORCE ROW LEVEL SECURITY` — nao usamos). Por isso as roles sao criadas ANTES
da primeira migration e `migrate` roda sempre como `app_admin`.

## Deploy manual (primeira vez ou emergencia)

```bash
gcloud builds submit --project patronus-app --region southamerica-east1 --tag southamerica-east1-docker.pkg.dev/patronus-app/patronus/api:manual .
gcloud run jobs execute patronus-migrate --region southamerica-east1 --project patronus-app --wait
gcloud run deploy patronus-api --region southamerica-east1 --project patronus-app --image southamerica-east1-docker.pkg.dev/patronus-app/patronus/api:manual
```

Rollback = `gcloud run services update-traffic patronus-api --to-revisions <rev>=100`.

## Logs

```bash
gcloud run services logs read patronus-api --region southamerica-east1 --project patronus-app --limit 100
gcloud run jobs executions list --job patronus-djen-worker --region southamerica-east1 --project patronus-app
```

## Custo estimado (set/2026)

| Item | Mensal |
|---|---|
| Cloud SQL db-f1-micro + 10 GB HDD + backups | R$ 50-70 |
| Cloud Run API (escala a zero) | R$ 0-10 |
| Cloud Run Jobs + Cloud Scheduler (6 jobs) | R$ 0-5 |
| Cloud Storage + Artifact Registry | R$ 0-3 |

Conta nova tem US$ 300 de credito por 90 dias.
