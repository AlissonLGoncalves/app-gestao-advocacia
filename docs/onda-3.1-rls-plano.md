# Onda 3.1 — RLS no Postgres (plano de implementação)

> Este documento é **só plano**. Nenhum código, migration, model ou
> teste é alterado por este PR. A implementação acontece em PRs
> separados, um por fase.

## 1. Diagnóstico atual

### 1.1 Estratégia de isolamento vigente

O Patronus hoje implementa isolamento multi-tenant **100% na camada de
aplicação** (descrito em [`docs/tenant-isolation.md`](tenant-isolation.md)):

- Todo modelo "tenant-aware" carrega `tenant_id` (FK para `tenant.id`).
- Toda rota CRUD usa o decorator `@tenant_scoped` e os helpers
  `query_for_tenant(Model)` / `get_item_or_404(Model, id)` em
  [`gestao_advocacia/helpers/tenant.py`](../gestao_advocacia/helpers/tenant.py).
- Não há filtragem session-level: a busca por `before_compile`,
  `do_orm_execute`, `with_loader_criteria` ou listeners de evento
  retornou **zero** ocorrências no código.

**Implicação**: o isolamento é tão forte quanto o desenvolvedor mais
distraído. Uma `Model.query.filter_by(...)` fora de `query_for_tenant`
vaza dados cross-tenant. Esse é o gap que RLS fecha como defesa em
profundidade.

### 1.2 Cobertura por modelo (auditoria)

Levantamento dos modelos em
[`gestao_advocacia/models/__init__.py`](../gestao_advocacia/models/__init__.py).

| Modelo | Categoria | `tenant_id` direto? | Observação |
|---|---|---|---|
| `Tenant` | C (global) | N/A | Tabela mãe — RLS não se aplica. |
| `User` | A | Sim, `nullable=True` | Usuários com `tenant_id` nulo (superadmin) precisam de tratamento especial. |
| `Cliente` | A | Sim | OK. |
| `Caso` | A | Sim | OK. |
| `MovimentacaoCNJ` | **B** | **Não** — só `caso_id` | **Categoria B**: tenant é resolvido via FK `caso_id → Caso.tenant_id`. Adicionar `tenant_id` direto simplificaria RLS. |
| `EventoAgenda` | A | Sim | OK. |
| `Documento` | A | Sim | OK. |
| `ProcuracaoAnalise` | A | Sim | OK. |
| `ContratoHonorario` | A | Sim | OK. |
| `Despesa` | A | Sim | OK. |
| `Recebimento` | A | Sim | OK. |
| `TarefaPrazo` | A | Sim | OK. |
| `DjenOabMonitoramento` | A | Sim | OK. |
| `PublicacaoDJEN` | A | Sim | OK. |
| `DjenVinculoDecisao` | A | Sim | OK. |
| `AuditLog` | A | Sim | OK. |
| `LoginAudit` | A | Sim, mas FK | Tem `tenant_id` (linhas ~427 do model). |
| `ConsentimentoUsuario` | A | Sim (verificar — não 100% confirmado na auditoria) | Aparenta ter `tenant_id` indireto via `user_id`. Confirmar antes da Fase 2. |
| `PasswordResetToken` | C? | Sem | Token associado a `user_id` que tem tenant. **Achado de auditoria**: ler completo o modelo (linhas 890-915) para classificar. |
| `TenantAnotacao` | A | Sim | Anotação interna do super-admin sobre um tenant. RLS não se aplica do mesmo jeito (super-admin = BYPASSRLS). |
| `AdminAuditLog` | **especial** | `target_tenant_id` (não `tenant_id`) | Cross-tenant por design (auditoria do super-admin). **Não receberá RLS**: super-admin opera com BYPASSRLS. |

**Categoria D (descobertas)**: nenhuma confirmada na auditoria, mas
duas atenções:

1. `MovimentacaoCNJ` (categoria B) — recomenda-se denormalizar e
   adicionar `tenant_id` direto antes de aplicar policy, ou usar
   subquery na policy (`USING (caso_id IN (SELECT id FROM caso WHERE
   tenant_id = current_setting...))`). A primeira opção é mais
   performante.
2. `PasswordResetToken` precisa de leitura completa do model antes da
   Fase 2; se for categoria D, adicionar `tenant_id` em PR próprio
   (Fase 1 ou pré-Fase 2).

### 1.3 Pgbouncer

`fly.toml` não menciona pgbouncer. A conexão atual é direta ao
Postgres do Fly. Não foi confirmado se o `DATABASE_URL` aponta para um
endpoint pgbouncer interno do Fly. **Antes da Fase 1, validar via**
`flyctl postgres connect -a <db-app>` **e inspecionar a URL.**

**Importância**: pgbouncer em modo *transaction* perde variáveis de
sessão entre statements (`SET LOCAL` só vive na transação atual).
Em modo *session*, o `SET` persiste pela conexão. Patronus precisa
escolher entre:

- **`SET LOCAL` em toda transação** (compatível com qualquer modo de
  pgbouncer; padrão recomendado).
- **`SET` na conexão** (só funciona em modo session ou sem pgbouncer).

A decisão final está na seção 3.

### 1.4 Jobs e scripts fora do request context

Esses **não passam** pelo hook `before_request` — precisam injetar
tenant manualmente OU usar role BYPASSRLS:

- **APScheduler** ([`scheduler_runner.py`](../gestao_advocacia/scheduler_runner.py))
  roda como process separado no Fly (`[processes].scheduler =
  "python -m scheduler_runner"`). Tasks principais:
  - `job_monitorar_djen` ([djen_tasks.py:643](../gestao_advocacia/djen_tasks.py#L643)) — itera por OAB/caso de cada tenant, já passando `tenant_id` explícito.
  - Job CNJ (`VerificarProcessosCNJJob`).
- **Scripts** em
  [`scripts/maintenance/`](../gestao_advocacia/scripts/maintenance/):
  - `reprocessar_triagem_djen.py` — itera por tenant.
- **Release command** no `fly.toml`: `flask db upgrade` (Alembic).
  **Precisa de BYPASSRLS** para DDL e backfill em qualquer tabela.

### 1.5 Migrations

[`migrations/env.py`](../gestao_advocacia/migrations/env.py) usa o
**mesmo engine/URL do Flask** (`current_app.extensions["migrate"].db.engine`),
ou seja, o **mesmo role**. Isso significa que após RLS:

- Esse role precisa ser BYPASSRLS, OU
- Migration precisa rodar com role separado (`flyctl secrets set
  DATABASE_URL=postgres://app_admin:...` no release_command).

Decisão preferida: role separado para migrations (`app_admin`), e o
role do runtime (`app_user`) tem RLS habilitado.

---

## 2. Modelo proposto

### 2.1 Roles Postgres

| Role | Permissões | Uso |
|---|---|---|
| `app_admin` | `BYPASSRLS`, owner das tabelas, pode `CREATE/ALTER/DROP` | Migrations (`flask db upgrade`), jobs administrativos que precisam ler cross-tenant (super-admin actions, scripts de manutenção) |
| `app_user` | Sem `BYPASSRLS`, só DML nas tabelas de runtime | Conexão padrão do gunicorn (request handlers) |
| `app_scheduler` | Sem `BYPASSRLS`, mas com flag de "precisa setar tenant" | Conexão do scheduler — mesma policy de RLS, mas o código setá `app.current_tenant_id` por iteração |

**Decisão**: `app_user` e `app_scheduler` podem ser o mesmo role na
prática se ambos seguirem o protocolo `SET LOCAL`. Manter separados
facilita revogar privilégios cirurgicamente.

### 2.2 Variável de sessão

```sql
-- Postgres não exige criar a variável; basta usá-la com SET LOCAL.
-- Convenção do nome: prefix custom para evitar colisão com extensões.
SET LOCAL app.current_tenant_id = '42';
```

A variável é lida na policy via:

```sql
USING (tenant_id = current_setting('app.current_tenant_id')::int)
```

### 2.3 Helper Flask + hook `before_request`

Em pseudocódigo (a ser implementado na Fase 1):

```python
@app.before_request
def _set_tenant_in_session():
    if not request.endpoint or request.endpoint == 'static':
        return
    tenant_id = _resolve_tenant_from_jwt()  # None se rota pública
    if tenant_id is not None:
        db.session.execute(text("SET LOCAL app.current_tenant_id = :tid"), {"tid": str(tenant_id)})
```

**Detalhes da Fase 1**:

- Lifecycle: `SET LOCAL` exige estar dentro de transação. Precisa
  forçar abertura via `db.session.begin()` ou usar `text("SET ...")`
  no momento certo.
- Rotas públicas (login, register, /, /termos): não setam — RLS
  bloqueia tudo, mas essas rotas não tocam tabelas tenant-aware ou
  tocam apenas `User`/`Tenant` em modos especiais.
- Erro defensivo: se `tenant_id` é `None` mas a rota tenta query em
  tabela com policy, RLS vai retornar lista vazia. Isso é seguro mas
  pode mascarar bugs — adicionar log WARNING quando hook detecta rota
  autenticada sem tenant resolvido.

### 2.4 Helper para jobs/scripts

```python
@contextmanager
def tenant_session(tenant_id: int):
    """Use dentro de iterações de jobs ou scripts."""
    db.session.execute(text("SET LOCAL app.current_tenant_id = :tid"),
                       {"tid": str(tenant_id)})
    try:
        yield
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
```

DJEN sync:

```python
for oab in DjenOabMonitoramento.query.all():  # roda como app_admin (BYPASSRLS)
    with tenant_session(oab.tenant_id):       # passa para app_user-like
        processar_publicacoes(oab)             # queries respeitam RLS
```

---

## 3. Decisão pgbouncer

**Decisão**: usar `SET LOCAL` em todas as injeções de tenant,
**independentemente** de pgbouncer estar presente ou não.

**Por quê**:

- `SET LOCAL` é seguro em qualquer modo de pgbouncer (transaction ou
  session) porque vive só na transação atual, que pgbouncer respeita.
- Se Patronus migrar pra pgbouncer transaction-mode no futuro
  (necessário com 50+ machines/connections concorrentes), nada muda no
  código.
- Custo: cada request paga 1 statement extra (`SET LOCAL`). Em
  Postgres-on-Fly com latência <1ms, custo desprezível.

**Validação na Fase 1**: rodar load test em staging com `SET LOCAL`
ativo e medir overhead p99. Se for >5%, reavaliar.

---

## 4. Plano em 5 fases

Cada fase é um PR separado. Nenhuma fase mergeia em main sem revisão.

### Fase 1 — Infraestrutura (sem ativar policy)

**Escopo**:

- Migration que cria `app_admin` e `app_user` no Postgres com `GRANT`
  apropriado nas tabelas existentes.
- `app_admin` é BYPASSRLS; `app_user` não.
- Helper `tenant_session()` (context manager).
- Hook `before_request` que faz `SET LOCAL app.current_tenant_id`.
- Configuração: `DATABASE_URL` do gunicorn aponta para `app_user`,
  `DATABASE_URL_ADMIN` (nova var) para `app_admin` — usado em
  release_command e em scheduler.
- Test harness `tests/conftest.py` com fixture `two_tenants` (tenant
  A e B com dados próprios) — habilitada mas ainda sem assertions
  RLS-específicas.
- **Nada de RLS habilitado em nenhuma tabela ainda.**

**Critério de pronto**: app continua funcionando 100% como hoje;
`SELECT current_setting('app.current_tenant_id')` retorna o tenant
correto durante request; suite pytest existente passa sem mudança.

### Fase 2 — Policies permissivas em todas as tabelas multi-tenant

**Escopo**:

- Migration que `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` em todas
  as tabelas categoria A.
- Policy `USING (true)` em cada uma — não restringe nada, mas RLS
  está formalmente habilitado.
- Smoke em staging por **mínimo 24h** antes de mergear.
- Métricas a observar: erros 500 por minuto, p99 de latência, query
  errors no log.

**Por quê esta fase intermediária**: validar que ENABLE RLS sozinho
não quebra nada (jobs, scripts, releases, queries com role errado),
sem o risco adicional de policy restritiva.

**Critério de pronto**: zero regressão em métricas durante 24h em
staging.

### Fase 3 — Policy restritiva em 1 cluster pequeno

**Escopo**: trocar `USING (true)` por `USING (tenant_id =
current_setting('app.current_tenant_id')::int)` em **3 tabelas**:
`TarefaPrazo`, `EventoAgenda`, `Documento`.

**Por quê estas 3**: cobertas por testes pytest extensos, baixo risco
operacional (não interrompem ingestão DJEN nem cobrança), e exercitam
3 padrões diferentes de query (CRUD simples, filtragem por data,
upload de arquivo).

**Critério de pronto**:

- Suite `tests/test_rls_isolation.py` passa (cross-tenant retorna
  vazio, mesmo tenant retorna dados corretos).
- 48h em staging sem regressão.
- DJEN job continua processando (não toca essas tabelas).

### Fase 4 — Restante das tabelas, em batches

**Escopo**: aplicar policy restritiva nas demais tabelas categoria A,
em PRs de 3-5 tabelas por vez. Ordem sugerida:

- **Batch 1**: `Cliente`, `Caso`, `MovimentacaoCNJ` (precisa policy
  com subquery via `caso_id` ou denormalização — decidir antes do PR).
- **Batch 2**: `Despesa`, `Recebimento`, `ContratoHonorario`.
- **Batch 3**: `User`, `LoginAudit`, `AuditLog`, `ConsentimentoUsuario`,
  `PasswordResetToken` (cuidado com fluxos de auth — login não tem
  tenant ainda resolvido).
- **Batch 4**: `DjenOabMonitoramento`, `PublicacaoDJEN`,
  `DjenVinculoDecisao`, `ProcuracaoAnalise`.

**Critério de pronto por batch**: 24h em staging + suite
`test_rls_isolation` cobrindo as tabelas do batch.

### Fase 5 — Hardening e CI

**Escopo**:

- Adicionar `pytest -k rls_isolation` como step obrigatório no CI
  (`.github/workflows/ci.yml`).
- Documentar no `tenant-isolation.md` que RLS é a defesa primária e os
  filtros app-level são defesa em profundidade.
- **Manter** os filtros app-level (`query_for_tenant`,
  `tenant_scoped`). Removê-los reduz redundância mas perde defesa em
  profundidade — recomendação: manter.
- Criar dashboard de monitoramento: contar erros do tipo "row-level
  security policy denied access" no log do Fly (alerta se > 0).

---

## 5. Rollback plan

### 5.1 Feature flag por tabela

Implementação proposta:

- Nova env var `RLS_DISABLED_TABLES` (CSV) lida no boot do app.
- Para cada tabela em `RLS_DISABLED_TABLES`, a Fase 2 deixa a policy
  em `USING (true)` (efetivamente desabilitada) **mesmo após Fase 3+**.
- Toggle por tabela em vez de flag global, porque o risco é
  tabela-específico (ex: bug só em `PublicacaoDJEN`, sem precisar
  desativar RLS de `TarefaPrazo`).

### 5.2 Mecânica de rollback

**Cenário A — bug em uma tabela**: setar `RLS_DISABLED_TABLES=publicacao_djen`
no Fly e fazer redeploy. App detecta a flag e roda
`ALTER POLICY ... USING (true)` na tabela listada (idempotente).

**Cenário B — bug crítico em todas**: `RLS_DISABLED_TABLES=*` desabilita
todas as policies (volta a `USING (true)`). RLS continua habilitado
mas sem efeito. Ainda dá pra observar logs e ajustar.

**Cenário C — catastrofe**: migration de revert que faz `ALTER TABLE
... DISABLE ROW LEVEL SECURITY` em todas. PR de hotfix preparado e
testado em staging.

**Não usar**: `flyctl postgres restore` — perde dados pós-deploy.

---

## 6. Plano de testes

### 6.1 Fixtures novas (Fase 1)

Em `tests/conftest.py`:

```python
@pytest.fixture
def two_tenants(db):
    """Cria 2 tenants A e B, 1 usuário admin em cada, e 1 caso em cada.
    Retorna (tenant_a, user_a, caso_a, tenant_b, user_b, caso_b).
    """
    ...

@pytest.fixture
def tenant_session_a(client, two_tenants):
    """Cliente HTTP autenticado como user_a do tenant A."""
    ...
```

### 6.2 Suite `tests/test_rls_isolation.py` (Fase 3+)

Casos mínimos por tabela:

1. **Listagem**: user A faz GET `/casos` → recebe só casos do tenant A.
2. **Detalhe direto**: user A faz GET `/casos/<id_do_tenant_b>` →
   404 (não 200, não 403).
3. **Update**: user A faz PUT `/casos/<id_do_tenant_b>` → 404.
4. **Delete**: user A faz DELETE `/casos/<id_do_tenant_b>` → 404.
5. **Listagem direta no DB** (bypass aplicação): com session conectado
   como `app_user` e `SET LOCAL app.current_tenant_id = '<a>'`,
   `Caso.query.all()` retorna só casos de A.
6. **Bypass via app_admin**: `Caso.query.all()` com role admin retorna
   tudo (validar que jobs continuam funcionando).

### 6.3 Métrica de sucesso

> "Ao final da Fase 4, **24+ testes** de cross-tenant passando, cobrindo
> as ~16 tabelas categoria A e 1 categoria B."

---

## 7. Riscos

### 7.1 Falsos negativos (usuário legítimo recebe vazio)

**Causa**: hook `before_request` não rodou ou `tenant_id` ficou nulo
(rota pública, JWT inválido).

**Mitigação**:

- Fase 1 inclui log WARNING quando hook detecta rota autenticada sem
  tenant resolvido.
- Em rotas públicas, garantir que NENHUMA query atinge tabela
  tenant-aware.

### 7.2 Tabelas categoria D descobertas tarde

**Causa**: auditoria pode não ter pegado todas (especialmente
`PasswordResetToken`, `ConsentimentoUsuario`).

**Mitigação**:

- Antes da Fase 2, ler todos os ~25 modelos completos uma vez.
- Adicionar checklist no PR template: "todas as tabelas novas
  precisam declarar categoria (A/B/C/D)".

### 7.3 Performance: índices em `tenant_id` necessários

**Causa**: policy `USING (tenant_id = X)` exige seq scan se não houver
índice.

**Mitigação**:

- Pré-Fase 3, auditar `pg_indexes` e garantir que toda tabela
  categoria A tem índice em `tenant_id` (geralmente já tem por causa
  da FK; alguns índices compostos `(tenant_id, ...)` já existem).

### 7.4 Migrations precisam de BYPASSRLS

**Causa**: Alembic faz DDL que tabelas com RLS bloqueiam para roles
não-owner.

**Mitigação**: release_command no fly.toml passa a usar role
`app_admin`. Antes da Fase 2, criar `DATABASE_URL_ADMIN` secret e
ajustar entrypoint do Alembic.

### 7.5 APScheduler/scripts fora do request context

**Causa**: hook `before_request` não roda em jobs.

**Mitigação**:

- Helper `tenant_session()` (seção 2.4) usado em loops de tenant.
- Jobs administrativos cross-tenant (DJEN sync, CNJ sync) rodam como
  `app_admin` (BYPASSRLS) — auditoria de acessos via `pg_stat_activity`.

### 7.6 SQLite em dev sem RLS

**Causa**: Postgres-only feature.

**Mitigação**:

- Migration RLS é guardada por `if op.get_bind().dialect.name ==
  'postgresql'` — no-op em SQLite.
- Suite RLS-specific marcada com
  `@pytest.mark.skipif(dialect != 'postgresql', ...)`.
- Recomendação separada (não bloqueia 3.1): migrar dev para Postgres
  via Docker — issue própria.

---

## 8. Checklist de pronto por fase

- **Fase 1**: roles criados; `SET LOCAL` setado em todo request
  autenticado; suite pytest atual continua passando; release_command
  usa `app_admin`.
- **Fase 2**: RLS habilitado em todas as tabelas categoria A com
  `USING (true)`; 24h em staging sem regressão.
- **Fase 3**: policy restritiva em `TarefaPrazo`, `EventoAgenda`,
  `Documento`; suite `test_rls_isolation` cobrindo essas 3 (≥6 testes
  por tabela); 48h em staging sem regressão.
- **Fase 4** (por batch): policy restritiva nas tabelas do batch;
  suite expandida; 24h em staging sem regressão.
- **Fase 5**: `pytest -k rls_isolation` no CI obrigatório; doc
  atualizada; dashboard de violations no log.

---

## 9. Estimativa de esforço

Em sprints de 2 semanas, assumindo 1 dev part-time:

| Fase | Sprints | Comentário |
|---|---|---|
| 1 — infra | 1 | Roles + helper + hook + harness de teste. |
| 2 — RLS permissivo | 0,5 | Migration simples; observação em staging consome o resto. |
| 3 — 3 tabelas restritivas | 1 | Inclui escrever a primeira versão de `test_rls_isolation.py`. |
| 4 — restante (4 batches) | 2 | Cada batch ~½ sprint, em série. |
| 5 — hardening + CI | 0,5 | Documentação e dashboards. |

**Total: ~5 sprints (10 semanas)** com janela de observação em
staging entre fases. Pode ser comprimido para ~3 sprints se a Fase 4
roda em paralelo (múltiplos batches abertos), mas perde-se janela de
observação por batch — não recomendado.

---

## 10. Decisões pendentes (a resolver antes da Fase 1)

1. **`MovimentacaoCNJ`**: denormalizar com `tenant_id` direto (PR
   próprio, simples) ou usar policy com subquery? Recomendação:
   denormalizar.
2. **`PasswordResetToken`** e **`ConsentimentoUsuario`**: classificar
   definitivamente (A/C/D) lendo o model completo.
3. **Pgbouncer**: confirmar via `flyctl postgres connect` se a
   `DATABASE_URL` atual atravessa pgbouncer ou conecta direto.
4. **Role separado para scheduler**: `app_user` ou `app_scheduler`
   distinto? Recomendação: começar com `app_user` único (simples),
   separar se houver necessidade auditável.
5. **Janela de staging entre fases**: 24h é suficiente para detectar
   bugs operacionais? Ou esticar para 1 semana?

Estas decisões viram itens do PR de Fase 1.
