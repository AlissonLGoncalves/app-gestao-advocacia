# Tarefas para agentes de IA

Este diretório contém tarefas estruturadas para agentes de IA (GitHub Copilot, Claude Code, Devin, Codex) executarem no projeto.

> ## ⚠️ Regras invioláveis
>
> 1. **🥇 Uma tarefa por PR.** Não misturar tarefas.
> 2. **🚫 Commits sem `Co-Authored-By`.** Quebra o deploy no Vercel Hobby (repo privado).
> 3. **📦 Respeitar dependências.** Não começar uma tarefa antes de suas dependências estarem mergeadas na `main`.
> 4. **🧪 Antes do push:** rodar style + testes localmente:
>    - Backend: `cd gestao_advocacia && ruff check . --fix && black . && pytest`
>    - Frontend: `cd gestao_advocacia_vite && npm run lint && npx prettier --check . && npm test`

## Roadmap atual

**[📘 ROADMAP-2026-Q2.md](ROADMAP-2026-Q2.md)** — compliance LGPD, cadastro completo do advogado e automação de procuração.

### Tracks

- **🅰️ Track A — Compliance LGPD**
  - [A1 — Persistir aceite de Termos/LGPD](A1-consentimento-lgpd.md) 🔴 crítica
  - [A2 — Versionar Termos em markdown hasheado](A2-versionar-termos.md) 🔴 crítica
  - [A3 — Auditoria persistente de login](A3-login-audit.md) 🔴 crítica

- **🅱️ Track B — Cadastro completo**
  - [B1 — `nome_completo`, CPF, OAB + tela de perfil](B1-user-completo.md) 🔴 crítica

- **🆎 Track C — Automação de procuração**
  - [C0 — Gemini API key (manual)](C0-gemini-api-key.md) 🟠 pré-requisito
  - [C1 — Backend extrator](C1-backend-extrator-procuracao.md) 🟠 alta
  - [C2 — Frontend upload + pré-preenchimento](C2-frontend-upload-procuracao.md) 🟠 alta
  - [C3 — Integração com modal DJEN (F2)](C3-integracao-djen-procuracao.md) 🟡 média

- **🆓 Track D — Qualidade de vida**
  - [D1 — Reset de senha por email](D1-reset-senha.md) 🟡 média
  - [D2 — Re-aceite quando Termos mudarem](D2-reaceite-termos.md) 🟡 média
  - [D3 — Direito ao esquecimento (LGPD art. 18)](D3-direito-esquecimento.md) 🟡 média

## Ordem de execução

```
A1 → A2 → B1 → A3 → (C0 manual) → C1 → C2 → C3 → D1 → D2 → D3
```

## Stack

- **Backend**: Flask 3 + SQLAlchemy + Alembic + JWT (`gestao_advocacia/`)
- **Frontend**: React 19 + Vite 6 + Bootstrap 5 (`gestao_advocacia_vite/`)
- **Deploy**: Fly.io (backend, região gru) + Vercel (frontend)
- **Multi-tenant**: cada registro tem `tenant_id`; isolamento crítico (ver `docs/tenant-isolation.md`)

## Histórico

Ciclo anterior (v1.2.0, abril 2026) concluiu as tarefas C1-C4, N1-N5, T1-T5 — isolamento multi-tenant, CI/CD, refatoração de `app.py`, testes de frontend, versionamento de API `/v1`, observabilidade, pinning de dependências, README, docs. Esses arquivos foram limpos da pasta após merge. Ver `CHANGELOG.md`.
