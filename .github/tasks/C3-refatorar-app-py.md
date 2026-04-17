# [C3] Quebrar `app.py` em blueprints

> ⚠️ **ANTES DE COMEÇAR — leia `.github/tasks/README.md`.**
> 🥇 **Regra de ouro:** C1 e C2 precisam estar MERGEADAS antes de começar esta. Uma crítica por vez.
> 🚫 **NÃO use `Co-Authored-By`** em commits — quebra o deploy no Vercel Hobby.

**Prioridade:** 🔴 Crítica
**Depende de:** C1 (precisa dos testes de isolamento para garantir que refactor não quebra nada)
**Estimativa:** 1-2 semanas (múltiplos PRs)

## Contexto

`gestao_advocacia/app.py` tem ~2.500 linhas misturando modelos, rotas, helpers e regras de negócio. É inmanutível e impossível de testar isoladamente.

## Estrutura alvo

```
gestao_advocacia/
├── app.py                      # Apenas factory create_app()
├── extensions.py               # db, jwt, migrate, scheduler, mail instanciados
├── config.py                   # (já existe)
├── models/
│   ├── __init__.py             # Re-exporta todos os modelos
│   ├── tenant.py
│   ├── usuario.py
│   ├── cliente.py
│   ├── caso.py
│   ├── contrato.py
│   ├── financeiro.py
│   └── ...                     # um arquivo por agregado
├── blueprints/
│   ├── __init__.py
│   ├── auth.py
│   ├── clientes.py
│   ├── casos.py
│   ├── contratos.py
│   ├── financeiro.py
│   ├── agenda.py
│   └── dashboard.py
├── helpers/
│   ├── tenant.py               # get_tenant_id, get_list_query, etc.
│   └── ...
└── djen_routes.py              # (manter como está — já é separado)
```

## Tarefas (EXECUTAR EM PRs SEPARADOS)

**PR 3.1** — Extrair `extensions.py` e criar factory `create_app()` que ainda registra tudo do `app.py` atual.

**PR 3.2** — Extrair modelos para `models/` (um arquivo por agregado). Atualizar imports. Rodar toda a suíte de testes (incluindo os de C1).

**PR 3.3** — Extrair helpers de tenant para `helpers/tenant.py`.

**PR 3.4 até 3.N** — **Um blueprint por PR**, na ordem:
1. `auth` (login, registro, JWT)
2. `clientes`
3. `casos`
4. `contratos`
5. `financeiro`
6. `agenda`
7. `dashboard`
8. Demais endpoints restantes

## Regras invioláveis

- **Não mudar comportamento público.** Mesmos endpoints, mesmos métodos, mesmas respostas, mesmos códigos HTTP.
- **Não renomear rotas.** Se hoje é `/clientes`, continua `/clientes`.
- **Rodar testes após cada extração** — incluindo os de isolamento (C1). Se falhar, corrigir antes de abrir PR.
- **Não adicionar features.** Só mover código.
- **Não "melhorar" código enquanto move.** Reescrita fica para outra tarefa. Aqui é só recortar e colar.

## Critérios de aceite (por PR)

- [ ] PR tem escopo único (um blueprint ou uma extração).
- [ ] Todos os testes passam localmente e no CI.
- [ ] `app.py` ficou menor (comparar linhas antes/depois).
- [ ] Nenhuma rota sumiu ou mudou de comportamento.
- [ ] Título do PR: `[C3.x] Extrair <coisa> de app.py`.

## Critério de conclusão da tarefa C3

- [ ] `app.py` tem menos de 100 linhas (só factory).
- [ ] Nenhum modelo definido em `app.py`.
- [ ] Nenhuma rota definida em `app.py` (só registros de blueprint).
- [ ] Todos os testes passam.
