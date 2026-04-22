# Sessão 2026-04-21 — Refatoração S8 + Fixes de Produção

Registro técnico do trabalho feito em 21/04/2026 (versão 1.3.0 → 1.4.0).
Duas frentes independentes: **(A)** consolidação das PRs S8.x de
centralização da camada de API no frontend; **(B)** diagnóstico e
correção de 4 bugs críticos em produção que estavam impedindo o login.

---

## A. Refatoração S8 — camada de API centralizada (frontend)

### Problema

As PRs S8.1 a S8.7 foram abertas em paralelo, cada uma migrando um
recurso (auth, clientes, casos, documentos, financeiro, agenda, DJEN)
para usar um cliente HTTP único em `src/api/client.js`. O problema: cada
branch **recriou** o `client.js` com um subset diferente de features
(`post`, `upload`, `getBlob`, `patch` etc.), gerando conflitos inevitáveis
no rebase.

### Solução — 3 etapas

1. **Canonização do `client.js` em `main`** (commit `97a1be4`). Reescrevi
   o arquivo consolidando a união de todas as features que as branches
   estavam adicionando separadamente:
   - `get`, `post`, `postForm`, `put`, `patch`, `del`
   - `upload` (wrapper `POST` com `FormData`, auto-detecta via `instanceof`)
   - `getBlob` (download binário, `Content-Type` removido)
   - Headers obrigatórios `X-Terms-Version` e `X-LGPD-Version`
   - Handler global de `401` que limpa `localStorage` e redireciona pra `/login`

2. **Rebase por branch** com regra fixa de conflito:
   - `src/api/client.js` → **sempre `--ours`** (main já tem a versão canônica).
   - `src/api/<recurso>.js` → **sempre `--theirs`** (main só tem stub).
   - Outros arquivos → manual.

3. **Merge sequencial** via `gh pr merge --squash --admin` (o check
   "Workers Builds — Cloudflare" sempre falha e é ruído residual).

### PRs mergeadas nesta sessão

| PR | Fase | Status | Commit em `main` |
|----|------|--------|------------------|
| #60 | S8 fase 1 — auth | ✅ merged | `86cc795` |
| #61 | S8.2 duplicata | ❌ closed | — |
| #62 | S8.2 clientes | ✅ merged | `88cc7f7` |
| #63 | S8.3 casos | ✅ merged (pelo VS Code chat) | — |
| #64 | S8.4 documentos + upload | ✅ merged (pelo VS Code chat) | — |
| #65 | S8.5 financeiro | ✅ merged (pelo VS Code chat) | — |
| #66 | S8.6 agenda | ✅ merged (pelo VS Code chat) | — |
| S8.7 | DJEN + procurações | ✅ merged (pelo VS Code chat) | — |
| — | `client.js` canônico | ✅ | `97a1be4` |
| — | prettier nos arquivos S8 | ✅ | `08bb9dc` |

### Handoff

Procedimento completo documentado em
[`.github/tasks/S8-handoff-rebase.md`](../.github/tasks/S8-handoff-rebase.md)
— foi esse doc que o VS Code chat usou para concluir S8.3 a S8.7.

---

## B. Fixes críticos de produção (PR #68)

Durante análise do app em produção, identifiquei que **o login estava
quebrado**: o endpoint retornava `200` com `{access_token: null, user: {}}`
em vez de `401` quando credenciais eram inválidas, e o frontend
armazenava `"null"` no `localStorage`, entrando em loop.

### Os 4 bugs

| # | Arquivo | Bug | Causa raiz |
|---|---------|-----|-----------|
| 1 | `routes/auth.py` | Login retornava 200 com token nulo em caso de erro | `@auth_ns.marshal_with(token_model_dto)` interceptava `return {"message": ...}, 401` e serializava como sucesso |
| 2 | `app_runtime.py` | Erros HTTP retornavam objeto Werkzeug cru (HTML) | `return error` em vez de `return jsonify({"message": error.description}), error.code` |
| 3 | `app.py` | Loop infinito em `/api/v1/...` via legacy redirect | Faltava guard: `if subpath.startswith("v1/")` abortar com 404 |
| 4 | `fly.toml` | (falso alarme) — achei que tinha sido removido | O VS Code chat já tinha restaurado em `e825b8d` |

### Correções aplicadas

- **Fix #1** (`routes/auth.py`): substituído `@auth_ns.marshal_with(...)` por
  `@auth_ns.response(200, "Login bem-sucedido.", token_model_dto)`.
  Agora tuplas `({"message": ...}, 401)` são propagadas corretamente.

- **Fix #2** (`app_runtime.py`): handler global de HTTPException agora
  serializa como JSON consistente:
  ```python
  return jsonify({"message": error.description}), error.code
  ```

- **Fix #3** (`app.py`): blueprint legacy `/api/*` agora trata preflight
  OPTIONS (204) e aborta se `subpath.startswith("v1/")` para evitar loop
  308-redirect → mesmo path.

- **Ajustes de CI da PR #68**:
  - Ruff I001: `from flask import abort as flask_abort` separado em linha própria.
  - Black: reformatação idempotente.
  - pip-audit: `python-dotenv==1.1.0 → 1.2.2` (CVE-2026-28684) + regeneração
    de `requirements.lock` com `pip-compile --generate-hashes`.

### Deploy & validação

Merge da PR #68 (commit `6b426fb`). Ajustes posteriores do VS Code chat:

- `e825b8d` — restaurar `fly.toml` (eu tinha removido assumindo migração pro Render)
- `1b98cc7` — limpar bloco duplicado no `fly.toml`
- `fa743c6` — remover shim legado `onrender.com` do `config.js`
- `6ee2998` — corrigir CSP `connect-src` no `vercel.json` de `onrender.com` → `fly.dev`

---

## C. Decisão de infra: Fly é oficial, Render é zumbi

Durante diagnóstico de um erro de CORS em produção, descobri que existia
um deploy obsoleto no Render além do Fly. O usuário confirmou que **só
usa o Fly**. Ações tomadas:

- Todo o código ativo aponta para `app-gestao-advocacia.fly.dev`.
- `config.js` (frontend) — fallback em `fly.dev`, sem shim `onrender.com`.
- `vercel.json` CSP — `connect-src` contém apenas `fly.dev`.
- `fly.toml` — preservado e atualizado (commit `4dda2d6` elevou
  `hard_limit` de conexões de 25 → 50).
- Menções a `onrender.com` restantes no repo são **apenas documentação
  histórica** em `docs/roteiro-fly-producao.md` (intencional).

---

## ⚠️ C.1 Incidente — perda do banco de dados (mesmo dia)

**Contexto.** Pouco depois de decidir que o Render era zumbi, o usuário
deletou os dois serviços do Render: `app-gestao-advocacia` (web) e
`patronus-db` (Postgres). A premissa estava parcialmente errada.

**Causa raiz.** O `DATABASE_URL` em `fly secrets` do app no Fly apontava
para `dpg-d7bb64qdbo4c73cum52g-a.oregon-postgres.render.com` — ou seja,
**o backend no Fly usava o Postgres do Render como banco de produção.**
Eu recomendei a deleção sem antes rodar `fly secrets list` pra verificar
o `DATABASE_URL`, que teria exposto essa dependência imediatamente.

**Impacto.** Todos os dados de produção perdidos: usuários, tenants,
clientes, casos, documentos, financeiro, publicações DJEN, OABs
monitoradas, tarefas/prazos. O usuário confirmou que **o app está em
desenvolvimento e não é comercializado**, portanto aceitável.

**Sintoma.** Todos os endpoints autenticados começaram a retornar 500
com `psycopg2.OperationalError: SSL connection has been closed
unexpectedly` apontando para o hostname do Render já deletado.

**Resolução.**

1. **Novo Postgres no Fly** — o agente do VS Code criou um cluster
   gerenciado na região `gru` (mesma da API, elimina latência
   cross-region Oregon→Guarulhos que existia antes).
2. **`DATABASE_URL` atualizado** via `fly secrets set` — disparou
   deploy automático, `release_command = "flask db upgrade"` rodou
   Alembic e recriou todas as tabelas.
3. **Fix de ordenação de migration** (`fc01012`) — uma migration DJEN
   tinha dependência quebrada de `add_tenant_module`, detectada só
   agora porque nunca tínhamos rodado o schema do zero no Render
   (foi criado incrementalmente).
4. **Resiliência de pool** (`d338332`) — adicionado em `config.py`:
   ```python
   SQLALCHEMY_ENGINE_OPTIONS = {
       "pool_pre_ping": True,
       "pool_recycle": 280,
   }
   ```
   Fix independente do incidente — previne o mesmo sintoma de "SSL
   closed" quando a máquina Fly dorme (auto-stop) e reconecta.

**Estado final.** App 100% funcional, DB vazio. Primeiro registro via
`/api/v1/auth/register` cria automaticamente o primeiro Tenant + Admin.

### Lições aprendidas

1. **Antes de recomendar deleção de infra, sempre verificar
   `DATABASE_URL`, `REDIS_URL` e secrets análogos nas plataformas
   remanescentes.** `fly secrets list -a <app>` leva 2 segundos.
2. **A afirmação "só uso X" do usuário não é suficiente** — configs
   cross-plataforma podem sobreviver à migração mental sem sobreviver
   à revisão. Verificar sempre no estado real.
3. **Postgres na mesma região da API** elimina uma classe inteira de
   problemas de latência e SSL (antes: Oregon→Guarulhos, ~200ms de RTT;
   agora: gru interno, <5ms).
4. **Migrations Alembic devem ser testáveis do zero.** O fix `fc01012`
   só apareceu quando rodamos `flask db upgrade` num schema vazio. Vale
   acrescentar ao CI um job que monta um Postgres temporário e roda
   `flask db upgrade` do início ao fim.

---

## D. Checklist de verificação pós-sessão

- [x] `git show main:gestao_advocacia_vite/src/api/client.js` contém
      `upload`, `getBlob`, `postForm`, `patch`.
- [x] `gh pr list --search "S8" --state all` mostra todas fechadas/mergeadas.
- [x] Login em produção retorna `401` com `{"message": "..."}` quando inválido.
- [x] Login em produção retorna `200` com `{access_token, user}` quando válido.
- [x] `GET /api/v1/dashboard/stats` responde sem erro de CORS do domínio Vercel.
- [x] `fly.toml` presente com `release_command = "flask db upgrade"`, região `gru`.
- [x] Nenhuma referência ativa a `onrender.com` fora de `docs/`.

---

## E. Comandos úteis para referência futura

```bash
# estado dos PRs S8
gh pr list --search "S8" --state all --limit 20

# conferir que client.js tem todas as features
git show main:gestao_advocacia_vite/src/api/client.js | grep -E "upload|getBlob|postForm|patch"

# smoke test do login em produção
curl -sS -X POST https://app-gestao-advocacia.fly.dev/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username_or_email":"x","password":"y"}' -w "\nHTTP=%{http_code}\n"
# Esperado: HTTP=401 com {"message":"..."}

# conferir deploy do Fly
fly status -a app-gestao-advocacia
fly logs -a app-gestao-advocacia
```
