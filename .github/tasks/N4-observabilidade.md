# [N4] Observabilidade básica (logs estruturados)

> ⚠️ **ANTES DE COMEÇAR — leia `.github/tasks/README.md`.**
> 🥇 **Regra de ouro:** TODAS as críticas (C1–C4) precisam estar MERGEADAS antes de começar tarefas normais.
> 🚫 **NÃO use `Co-Authored-By`** em commits — quebra o deploy no Vercel Hobby.

**Prioridade:** 🟡 Normal
**Depende de:** nada
**Estimativa:** 1-2 dias

## Contexto

Hoje os logs são texto plano e não têm correlação entre eventos. Debugar incidente em produção é quase impossível.

## Tarefas

1. Adicionar `python-json-logger` ao `requirements.txt`.
2. Configurar logging JSON em `gestao_advocacia/app.py` (ou novo `logging_config.py`):
   - Formato: `timestamp`, `level`, `logger`, `message`, `request_id`, `user_id`, `tenant_id`, extras.
   - Nível configurável via env var `LOG_LEVEL` (já existe — melhorar uso).
3. Adicionar **request ID**:
   - `before_request`: se header `X-Request-ID` presente, usar; senão gerar UUID4.
   - Guardar em `flask.g.request_id` e em contexto de logging.
   - `after_request`: incluir no header da resposta.
4. Logar eventos-chave:
   - **Auth sucesso/falha**: `INFO login_success user_id=X tenant_id=Y` / `WARNING login_failed email=X reason=Y`.
   - **Acesso cross-tenant bloqueado** (integração com C1): `WARNING cross_tenant_access_blocked user_id=X current_tenant=Y target_tenant=Z endpoint=W`.
   - **Erros 5xx**: stacktrace + contexto.
5. Criar `docs/logging.md` com exemplos e como consultar no ambiente de produção (Render dashboard).

## Critérios de aceite

- [ ] Logs saem em JSON válido (testar com `python -m json.tool`).
- [ ] Todo log tem `request_id`.
- [ ] Logs de auth e cross-tenant funcionando (testados).
- [ ] `docs/logging.md` criado.

## Fora de escopo

- APM (Datadog, Sentry, New Relic).
- Métricas (Prometheus).
- Tracing distribuído.
