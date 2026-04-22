# Patronus — Gestão para Advocacia

![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python)
![Flask](https://img.shields.io/badge/Flask-3.1-000000?style=for-the-badge&logo=flask)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql)
![Fly.io](https://img.shields.io/badge/Fly.io-gru-7B3FE4?style=for-the-badge)
![Vercel](https://img.shields.io/badge/Vercel-Hobby-000000?style=for-the-badge&logo=vercel)

SaaS multi-tenant para gestão de escritórios de advocacia — clientes, casos, documentos, financeiro, agenda, monitoramento automatizado de publicações no DJEN e sincronização CNJ. API REST em Flask 3 (Python 3.11) e frontend React 19 (Vite 6).

- **Produção:** https://app-gestao-advocacia.fly.dev
- **Frontend:** https://app-gestao-advocacia.vercel.app
- **API base:** `/api/v1`

---

## Versionamento

Para padronizar atualizações de versão, use o guia oficial:
**[GUIA_VERSIONAMENTO.md](GUIA_VERSIONAMENTO.md)**

Versão atual: **v1.4.0**.

---

## Funcionalidades

- **Multi-tenant**: isolamento por `tenant_id` em todas as entidades. Cada escritório é um tenant.
- **Autenticação JWT**: registro, login, convite de membros por e-mail, `/me`.
- **Consentimentos LGPD**: registro de aceite de Termos de Uso e Política de Privacidade com versão, IP, user-agent e hash do documento ([A1](.github/tasks/A1-consentimento-lgpd.md)).
- **Gestão de clientes e casos**: CRUD completo, vínculo cliente-caso, tipos PF/PJ.
- **Documentos**: upload com volume persistente no Fly (`/data/uploads`), OCR para PDFs escaneados.
- **Financeiro**: despesas, recebimentos, contratos de honorários.
- **Agenda/prazos**: eventos de agenda e tarefas-prazo com alertas automáticos por e-mail.
- **DJEN (Comunicações)**: sincronização diária com a ComunicaAPI do CNJ, monitoramento por OAB, parser multi-tribunal, triagem automática, vínculo com decisões.
- **DATAJUD/CNJ**: consulta de movimentações via API pública (respeitando [Termo de Uso v1.2](docs/compliance/datajud-termo-uso-v1.2.md) e rate-limit de 120 req/min).
- **API documentada**: Swagger UI em `/api/v1/docs` (disponível fora de produção).
- **Observabilidade**: logs estruturados JSON, events específicos para login, alertas e DJEN.
- **Camada de API centralizada** (frontend): todo `fetch` passa por
  `src/api/client.js` com autenticação JWT automática, headers LGPD/Termos
  obrigatórios e handler global de `401`. Ver
  [`docs/sessao-2026-04-21-s8-e-fixes-producao.md`](docs/sessao-2026-04-21-s8-e-fixes-producao.md).

---

## Stack

### Backend — `gestao_advocacia/`
- **Python 3.11**
- **Flask 3.1** + **flask-restx 1.3** (API + Swagger)
- **Flask-SQLAlchemy 3.1** / **SQLAlchemy 2.0**
- **Flask-Migrate 4** (Alembic) — schema versionado, migrations em `migrations/versions/`
- **Flask-JWT-Extended 4.7** — autenticação JWT
- **Flask-APScheduler** — jobs diários (DJEN, CNJ, alertas de prazos)
- **Flask-CORS 5** — CORS configurado pro domínio Vercel
- **Psycopg2** — driver PostgreSQL
- **Tesseract OCR** (via Dockerfile) — OCR para documentos escaneados

### Frontend — `gestao_advocacia_vite/`
- **React 19** + **Vite 6**
- **React Router DOM** — SPA
- **Bootstrap 5** — UI
- **Vitest** + **@testing-library/react** — testes

### Infra
- **Fly.io** (região `gru`) — backend + Postgres, volume `/data` (1GB) pra uploads.
- **Vercel Hobby** — frontend estático.
- **GitHub Actions** — CI: ruff + black + pip-audit + pytest (backend); npm audit + lint + prettier + vitest + build (frontend).

---

## Instalação e execução local

### Pré-requisitos
- Python 3.11+
- Node.js 20+
- PostgreSQL 14+ (ou SQLite para desenvolvimento rápido via `ConfigTest`)
- Git

### 1. Backend

```bash
git clone https://github.com/AlissonLGoncalves/app-gestao-advocacia.git
cd app-gestao-advocacia/gestao_advocacia

python -m venv .venv
source .venv/bin/activate           # Windows: .venv\Scripts\activate

pip install -r requirements.txt

# Crie um .env na raiz de gestao_advocacia/ com pelo menos:
#   SECRET_KEY=<chave-forte>
#   JWT_SECRET_KEY=<chave-forte>
#   DATABASE_URL=postgresql://usuario:senha@localhost:5432/advocacia
#   FLASK_APP=app.py
#   UPLOAD_FOLDER=./uploads
# Opcionais:
#   GEMINI_API_KEY=...               (para features futuras de extração automática)
#   DJEN_ENABLED_TENANTS=1,2
#   CNJ_API_KEY=...

flask db upgrade
flask run
```

Swagger UI: `http://127.0.0.1:5000/api/v1/docs`

### 2. Frontend

```bash
cd ../gestao_advocacia_vite
npm ci
npm run dev
```

Crie um `.env.local` apontando para o backend:

```
VITE_API_URL=http://127.0.0.1:5000/api/v1
```

App React: `http://127.0.0.1:5173`

---

## Testes e qualidade

### Backend
```bash
cd gestao_advocacia
ruff check .
black --check .
pytest tests -v
pytest tests --cov=. --cov-report=term-missing --cov-fail-under=50
```

### Frontend
```bash
cd gestao_advocacia_vite
npm run lint
npm run prettier:check
npm test -- --run
npm run test:coverage
npm run build
```

Toda PR contra `main` roda essas mesmas verificações em `.github/workflows/ci.yml`.

---

## Deploy

### Backend — Fly.io
O backend é deployado manualmente via `fly deploy`. A imagem usa o `Dockerfile` na raiz e o `fly.toml` já inclui `release_command = "flask db upgrade"`, então migrations Alembic rodam automaticamente em cada deploy antes da promoção da nova máquina.

```bash
fly deploy                                    # build remoto + release_command + rollout
fly logs -a app-gestao-advocacia              # acompanhar logs
fly secrets list -a app-gestao-advocacia      # listar secrets (sem valores)
```

Secrets obrigatórios em produção: `SECRET_KEY`, `JWT_SECRET_KEY`, `DATABASE_URL`. Outros conforme feature (DJEN, CNJ, Gemini, e-mail).

### Frontend — Vercel
Deploy automático a cada push em `main`. Plano Hobby não aceita `Co-Authored-By` em commits de repositórios privados — **nunca** adicione essa linha. Ver `memory/feedback_commits.md`.

> **Nota sobre o Render.com**: existiu um deploy em `app-gestao-advocacia.onrender.com` que hoje está zumbi. A plataforma oficial é exclusivamente o Fly.io. As menções a `onrender.com` em [`docs/roteiro-fly-producao.md`](docs/roteiro-fly-producao.md) são históricas (registro da migração).

---

## Arquitetura resumida

```
app-gestao-advocacia/
├── gestao_advocacia/                 # Backend Flask
│   ├── app.py                        # Factory + registro de blueprints
│   ├── config.py / config_test.py    # Configurações por ambiente
│   ├── extensions.py                 # Instâncias db/jwt/migrate/cors
│   ├── models/                       # Modelos SQLAlchemy
│   ├── routes/                       # Namespaces flask-restx (auth, clientes, casos, ...)
│   ├── migrations/versions/          # Migrations Alembic
│   ├── djen_service.py, djen_*.py    # Integração ComunicaAPI/DJEN
│   ├── cnj_service.py                # Integração DATAJUD/CNJ
│   ├── ocr_service.py                # OCR de documentos
│   ├── mail_service.py               # Envio de e-mails
│   └── tests/                        # pytest (144+ testes)
├── gestao_advocacia_vite/            # Frontend React
│   ├── src/
│   │   ├── pages/                    # Rotas principais
│   │   ├── components/               # Componentes reutilizáveis
│   │   ├── constants/legal.js        # Versão de Termos/LGPD
│   │   └── utils/
│   └── ...
├── docs/compliance/                  # DATAJUD v1.2, MTD v1.2, políticas
├── .github/
│   ├── workflows/ci.yml              # Pipeline backend + frontend
│   └── tasks/                        # Roadmap 2026 Q2 (A1-A3, B1, C0-C3, D1-D3)
├── Dockerfile                        # Imagem de produção (Fly)
└── fly.toml                          # Config Fly.io (gru, release_command)
```

---

## Roadmap (2026 Q2)

Em andamento:

| ID | Tarefa | Status |
|----|--------|--------|
| A1 | Persistir aceite de Termos/LGPD | ✅ Merged (PR #41) |
| A2 | Versionar termos e política | Pendente |
| B1 | User completo (OAB, nome, CPF, tipo_pessoa) | Pendente |
| A3 | Audit log de login | Pendente |
| C0 | Configurar Gemini API key | Pendente |
| C1 | Upload + extração de procuração (Gemini) | Pendente |
| C2 | UI de revisão e criação de cliente | Pendente |
| C3 | Vinculação automática de processo | Pendente |
| D1 | Página de perfil do usuário | Pendente |
| D2 | Reset de senha por e-mail | Pendente |
| D3 | Direito ao esquecimento (LGPD art. 18) | Pendente |

Detalhes em `.github/tasks/ROADMAP-2026-Q2.md` (quando PR #37 for mergeada).

---

## Documentação complementar

- [`CHANGELOG.md`](CHANGELOG.md) — histórico de releases.
- [`GUIA_VERSIONAMENTO.md`](GUIA_VERSIONAMENTO.md) — como bumpar versão.
- [`docs/sessao-2026-04-21-s8-e-fixes-producao.md`](docs/sessao-2026-04-21-s8-e-fixes-producao.md) — sessão v1.4.0 (refatoração S8 + fixes de produção).
- [`docs/roteiro-fly-producao.md`](docs/roteiro-fly-producao.md) — roteiro operacional do Fly.io.
- [`docs/logging.md`](docs/logging.md) — logs estruturados JSON + request IDs.
- [`docs/tenant-isolation.md`](docs/tenant-isolation.md) — invariantes multi-tenant.
- [`docs/compliance/`](docs/compliance/) — DATAJUD v1.2, CNJ MTD v1.2.
- [`.github/tasks/S8-handoff-rebase.md`](.github/tasks/S8-handoff-rebase.md) — procedimento de rebase da refatoração S8.

---

## Compliance

- **LGPD**: consentimentos de Termos/LGPD persistidos com versão, IP, user-agent e hash (art. 7º, 8º §1º).
- **CNJ DATAJUD**: respeita Termo de Uso da API v1.2 e limite de 120 req/min ([docs/compliance/datajud-termo-uso-v1.2.md](docs/compliance/datajud-termo-uso-v1.2.md)).
- **CNJ MTD v1.2**: mapeamento de campos sensíveis (racaCor, tipoPrioridade) documentado em [docs/compliance/cnj-mtd-v1.2.md](docs/compliance/cnj-mtd-v1.2.md).

---

## Licença

MIT. Veja `LICENSE`.

---
---

# Patronus — Law Practice Management (English)

Multi-tenant SaaS for law firm management — clients, cases, documents, billing, calendar, automated DJEN publication monitoring and CNJ case sync. REST API built in Flask 3 (Python 3.11) and React 19 (Vite 6) frontend.

- **Production:** https://app-gestao-advocacia.fly.dev
- **Frontend:** https://app-gestao-advocacia.vercel.app
- **API base:** `/api/v1`

## Core Features

- Multi-tenant isolation via `tenant_id` on every record.
- JWT authentication, team invites by e-mail, `/me` endpoint.
- LGPD consent tracking (Terms + Privacy) with version, IP, user-agent and document hash.
- Full CRUD for clients, cases, documents, expenses, receipts, honorary contracts, agenda events, deadlines.
- Document upload to persistent Fly volume, Tesseract OCR for scanned PDFs.
- DJEN integration (Brazilian official e-journal) with daily sync and per-OAB monitoring.
- CNJ DATAJUD integration for case movement lookups (rate-limited to 120 req/min).
- Swagger UI at `/api/v1/docs` (disabled in production).
- Structured JSON logging.

## Stack

**Backend:** Python 3.11, Flask 3.1, flask-restx, Flask-SQLAlchemy 3.1, Flask-Migrate 4 (Alembic), Flask-JWT-Extended, Flask-APScheduler, Tesseract OCR, PostgreSQL.

**Frontend:** React 19, Vite 6, React Router DOM, Bootstrap 5, Vitest.

**Infra:** Fly.io (gru region), Vercel Hobby, GitHub Actions CI (ruff + black + pip-audit + pytest; npm audit + lint + prettier + vitest + build).

## Local development

### Backend
```bash
cd gestao_advocacia
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# create .env with SECRET_KEY, JWT_SECRET_KEY, DATABASE_URL, FLASK_APP=app.py, UPLOAD_FOLDER=./uploads
flask db upgrade
flask run
```

Swagger: `http://127.0.0.1:5000/api/v1/docs`

### Frontend
```bash
cd gestao_advocacia_vite
npm ci
# .env.local with VITE_API_URL=http://127.0.0.1:5000/api/v1
npm run dev
```

## Tests

```bash
# backend
cd gestao_advocacia && ruff check . && black --check . && pytest tests -v

# frontend
cd gestao_advocacia_vite && npm run lint && npm run prettier:check && npm test -- --run && npm run build
```

## Deployment

Backend is deployed manually with `fly deploy`. The `fly.toml` includes `release_command = "flask db upgrade"`, so Alembic migrations run automatically on every deploy.

Frontend auto-deploys from `main` on Vercel. **Never** add `Co-Authored-By` lines to commits — Vercel Hobby (private repos) blocks them.

## License

MIT. See `LICENSE`.
