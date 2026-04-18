# Sistema de Gestao para Advocacia

[![CI](https://github.com/AlissonLGoncalves/app-gestao-advocacia/actions/workflows/ci.yml/badge.svg)](https://github.com/AlissonLGoncalves/app-gestao-advocacia/actions/workflows/ci.yml)

Este projeto e uma plataforma web para operacao de escritorio de advocacia, com foco em produtividade e controle operacional. A aplicacao centraliza cadastro de clientes, gerenciamento de casos, agenda de prazos e organizacao de documentos, alem de recursos financeiros para acompanhamento de despesas, recebimentos e contratos.

A arquitetura e separada entre API backend e SPA frontend, com autenticacao JWT, isolamento multi-tenant e pipeline de CI para testes/auditoria de dependencias. O objetivo e manter uma base segura, rastreavel e facil de evoluir para ambiente de producao.

## Stack

### Backend
- Python 3.11+
- Flask
- Flask-RESTX
- Flask-SQLAlchemy
- Flask-Migrate (Alembic)
- Flask-JWT-Extended
- APScheduler
- PostgreSQL (prod) / SQLite (dev)

### Frontend
- React 19
- Vite 6
- React Router DOM 7
- Bootstrap 5

## Como rodar local

### Pre-requisitos
- Python 3.11+
- Node.js 20+
- PostgreSQL 13+ (opcional em dev, obrigatorio para ambiente semelhante a prod)
- Git

### 1) Clonar repositorio

```bash
git clone https://github.com/AlissonLGoncalves/app-gestao-advocacia.git
cd app-gestao-advocacia
```

### 2) Configurar banco de dados

Opcao A (dev rapido): usar SQLite com `DATABASE_URL=sqlite:///app.db`.

Opcao B (recomendado): PostgreSQL local.

```sql
CREATE DATABASE gestao_advocacia;
```

Exemplo de URL:

```text
DATABASE_URL=postgresql://usuario:senha@localhost:5432/gestao_advocacia
```

### 3) Backend

```bash
cd gestao_advocacia
python -m venv ../venv
../venv/Scripts/activate
pip install --require-hashes -r requirements.lock
cd ..
```

Copie o arquivo de exemplo de variaveis:

```bash
copy .env.example .env
```

Aplicar migracoes e subir backend:

```bash
cd gestao_advocacia
..\venv\Scripts\python.exe -m flask db upgrade
..\venv\Scripts\python.exe -m flask run
```

Backend em: `http://127.0.0.1:5000`

### 4) Frontend

Em outro terminal:

```bash
cd gestao_advocacia_vite
npm ci
copy .env.example .env
npm run dev
```

Frontend em: `http://127.0.0.1:5173`

## Variaveis de ambiente necessarias

### Backend
Use o arquivo `.env.example` na raiz do repositorio como base para `.env`.

Chaves principais:
- `SECRET_KEY`
- `JWT_SECRET_KEY`
- `DATABASE_URL`
- `LOG_LEVEL`
- `CNJ_API_KEY` (quando usar integracao)

### Frontend
Use `gestao_advocacia_vite/.env.example` como base para `gestao_advocacia_vite/.env`.

Chave principal:
- `VITE_API_URL` (ex.: `http://127.0.0.1:5000/api`)

## Como rodar testes

### Backend

```bash
cd gestao_advocacia
..\venv\Scripts\python.exe -m pytest tests -q
```

### Frontend

Atualmente o frontend nao possui script `test` no `package.json`. Validacao local recomendada:

```bash
cd gestao_advocacia_vite
npm run lint
npm run build
```

## Estrutura de pastas

```text
app-gestao-advocacia/
|- .github/
|  |- workflows/              # CI/CD
|  |- dependabot.yml          # atualizacao automatica de dependencias
|- gestao_advocacia/          # backend Flask
|  |- app.py                  # factory/configuracao principal
|  |- config.py               # configuracoes e variaveis de ambiente
|  |- requirements.txt        # dependencias pinned
|  |- requirements.lock       # lock com hashes (pip-tools)
|  |- migrations/             # migracoes Alembic
|  |- routes/                 # endpoints REST
|  |- tests/                  # testes backend
|- gestao_advocacia_vite/     # frontend React + Vite
|  |- src/                    # codigo da aplicacao
|  |- package.json
|  |- package-lock.json
|- scripts/maintenance/       # scripts operacionais
|- .env.example               # exemplo de variaveis backend/root
|- README.md
```
