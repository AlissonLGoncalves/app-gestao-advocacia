# Roteiro de Tarefas para Agentes de IA

Este diretório contém tarefas para agentes de IA (GitHub Copilot, Devin, Codex, Claude Code) executarem no projeto.

---

> ## ⚠️ LEIA ANTES DE COMEÇAR — REGRAS INVIOLÁVEIS
>
> 1. **🥇 REGRA DE OURO — UMA TAREFA POR VEZ.**
>    Só comece uma tarefa CRÍTICA (C1→C2→C3→C4) depois que a anterior estiver **mergeada na `main`**. Nunca trabalhe em duas críticas em paralelo. Tarefas normais (N) e triviais (T) só começam após TODAS as críticas estarem prontas.
>
> 2. **🚫 COMMITS SEM `Co-Authored-By`.**
>    Não adicione linha `Co-Authored-By:` em nenhum commit. Isso **quebra o deploy no Vercel Hobby** (repo privado). Use commits simples.
>
> 3. **📦 UM PR POR TAREFA.**
>    Não misture tarefas. Escopo fechado, conforme "Critérios de aceite" do arquivo.
>
> Violar qualquer uma dessas três quebra produção ou bagunça o histórico. Em caso de dúvida, **pare e pergunte** antes de commitar.

---

## Regras globais (valem para TODAS as tarefas)

1. **Uma tarefa por Pull Request.** Não misturar tarefas no mesmo PR.
2. **Respeitar a ordem** listada abaixo. Não começar uma crítica nova antes da anterior ser mergeada.
3. **Commits sem `Co-Authored-By`** — quebra deploy no Vercel Hobby (repo privado).
4. **Não adicionar features** além do escopo descrito. Se encontrar bug fora do escopo, abrir issue separada.
5. **Antes de abrir o PR**: rodar a suíte de testes (backend: `pytest` em `gestao_advocacia/`; frontend: `npm test` em `gestao_advocacia_vite/`) e garantir que passa.
6. **Branch**: `task/<id-da-tarefa>` (ex.: `task/C1-tenant-isolation`).
7. **Título do PR**: `[<ID>] <título curto>` (ex.: `[C1] Auditoria e testes de isolamento multi-tenant`).
8. **Descrição do PR**: colar o checklist de "Critérios de aceite" da tarefa e marcar o que foi feito.

## Stack do projeto

- **Backend**: Flask 3 + SQLAlchemy + Alembic + JWT + APScheduler (pasta `gestao_advocacia/`)
- **Frontend**: React 19 + Vite 6 + Bootstrap 5 (pasta `gestao_advocacia_vite/`)
- **Deploy**: Render (backend) + Vercel (frontend)
- **Multi-tenant**: cada registro tem `tenant_id`; isolamento é crítico.

## Ordem de execução

### 🔴 Críticas (fazer primeiro, em ordem)

| ID | Tarefa | Bloqueia |
|----|--------|----------|
| [C1](C1-tenant-isolation.md) | Auditoria e blindagem de isolamento multi-tenant | C3 |
| [C2](C2-ci-cd.md) | CI/CD mínimo (GitHub Actions) | — |
| [C3](C3-refatorar-app-py.md) | Quebrar `app.py` em blueprints | N1, N2, N3 |
| [C4](C4-limpar-scripts-raiz.md) | Limpar scripts de produção da raiz | — |

### 🟡 Normais (depois das críticas; podem ser paralelas)

| ID | Tarefa |
|----|--------|
| [N1](N1-testes-frontend.md) | Testes de frontend |
| [N2](N2-quebrar-componentes.md) | Quebrar componentes gigantes |
| [N3](N3-versionar-api.md) | Versionamento de API (`/api/v1`) |
| [N4](N4-observabilidade.md) | Observabilidade básica (logs estruturados) |
| [N5](N5-pinning-deps.md) | Pinning de dependências e auditoria |

### 🟢 Triviais (quando sobrar tempo)

| ID | Tarefa |
|----|--------|
| [T1](T1-readme.md) | README decente |
| [T2](T2-env-example.md) | Arquivos `.env.example` |
| [T3](T3-lint-format.md) | Padronização (ruff/black/prettier) |
| [T4](T4-limpar-arquivos.md) | Limpeza de arquivos scratch |
| [T5](T5-docs-api.md) | Documentação automática de API |

## Como o agente deve trabalhar

Ao receber a instrução "leia `.github/tasks/README.md` e execute a próxima tarefa pendente":

1. Verificar qual é a próxima tarefa não concluída (ver PRs abertos/mergeados com prefixo `[Cx]`, `[Nx]`, `[Tx]`).
2. Ler o arquivo da tarefa correspondente na íntegra.
3. Criar branch `task/<id>`.
4. Executar exatamente o que está descrito em "Tarefas".
5. Validar "Critérios de aceite" um por um.
6. Abrir PR seguindo as regras globais.
