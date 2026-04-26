# Onda 3.1 - Fase 2: rollout pos-merge

Este runbook cobre passos operacionais para subir a Fase 2 da Onda 3.1
(RLS permissivo em 17 tabelas categoria A) em qualquer ambiente onde
as tabelas multi-tenant pre-existem ao role `app_admin`.

> Em ambiente novo criado do zero apos a Fase 1, este runbook continua
> sendo necessario para o **GRANT CREATE no schema public** (passo 1.b),
> mas o passo de ownership (1.a) e no-op porque tabelas criadas como
> app_admin ja sao owned por ele.

## Contexto

A migration de Fase 2 (`f2a1b2c3d4e5_enable_rls_permissive`) executa:

```sql
ALTER TABLE <tabela> ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_permissive_default ON <tabela> FOR ALL USING (true) WITH CHECK (true);
```

Ambas as operacoes exigem que o role executor seja **owner** da tabela.
Como o `release_command` roda como `app_admin` (via
`USE_DATABASE_URL_ADMIN=true`) mas as tabelas foram criadas
originalmente pelo `postgres` superuser (legado pre-Fase 1), a
migration falha com:

```
psycopg2.errors.InsufficientPrivilege: must be owner of table <tabela>
```

`GRANT ALL` nao cobre — ownership e privilegio binario separado.

Adicionalmente, migrations posteriores (`b4c5d6e7f8a9` e
`c5d6e7f8a9b0` que resolvem schema drifts via `batch_alter_table`)
descobriram que `app_admin` tambem precisa de **CREATE no schema
public** para criar tabelas temporarias durante operacoes de batch.
Sem isso, falha com:

```
psycopg2.errors.InsufficientPrivilege: permission denied for schema public
```

Ambos os requisitos (ownership + GRANT CREATE) sao cobertos pelo
mesmo SQL setup neste runbook.

## Pre-requisitos

- Fase 1 (PR #100) ja mergeada e aplicada (roles `app_admin` e
  `app_user` existem).
- Acesso `flyctl` autenticado e com permissao no app `patronus-db`.
- Branch com a migration de Fase 2 pronta para merge **mas ainda nao
  mergeada** (ou ja mergeada com release_command falhado, qual seja).

## Passo 1 - Setup de ownership e privilegios

Conectar como `postgres` Linux user no container do `patronus-db`
(peer authentication via socket Unix dispensa senha) e executar
[`transfer_rls_ownership.sql`](transfer_rls_ownership.sql):

```bash
flyctl ssh console -a patronus-db --pty=false \
  -C "su postgres -c 'psql -h /var/run/postgresql -p 5433 -d postgres'" \
  < docs/ops/transfer_rls_ownership.sql
```

A saida deve listar **18 tabelas** com `tableowner = app_admin` (17
categoria A + `password_reset_token`) e confirmar `app_admin.can_create
= t` no schema public. Se alguma aparecer como `postgres` ou
`can_create = f`, a transacao falhou — investigue antes de prosseguir.

> A senha do `postgres` superuser **nao** esta em nenhum Fly secret
> apos a rotacao da Fase 0. Por isso usamos peer auth via socket Unix
> dentro do container — a unica via de acesso `postgres`-as-superuser
> sem reset de senha.

## Passo 2 - Aplicar a migration de Fase 2

Se a Fase 2 ainda nao foi mergeada: faca o merge normal, o auto-deploy
do Fly vai disparar.

Se ja foi mergeada e o deploy falhou (cenario que motivou esse runbook):
faca redeploy manual, ja que ownership agora esta correta.

```bash
flyctl deploy --remote-only
```

Acompanhe a saida — `Running release_command: USE_DATABASE_URL_ADMIN=true
flask db upgrade` deve completar sem erro de `must be owner`.

## Passo 3 - Validar

```bash
flyctl ssh console -a app-gestao-advocacia -C "bash -c 'cd /app && flask db current'"
```

Espera: `f2a1b2c3d4e5 (head)`.

Validar que RLS esta habilitada:

```bash
flyctl ssh console -a app-gestao-advocacia -C "python -c \"
from sqlalchemy import create_engine, text; import os
e = create_engine(os.environ['DATABASE_URL'].replace('postgres://','postgresql://',1))
c = e.connect()
rows = c.execute(text(\\\"SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity=true ORDER BY tablename\\\")).fetchall()
[print(' -', r[0]) for r in rows]
print('Total:', c.execute(text(\\\"SELECT count(*) FROM pg_tables WHERE schemaname='public' AND rowsecurity=true\\\")).scalar())
c.close()
\""
```

Espera: 17 tabelas listadas, total 17.

Smoke:

```bash
curl -i https://app-gestao-advocacia.fly.dev/api/v1/casos/1/timeline
```

Espera: HTTP 401 (rota viva, JWT obrigatorio).

## Passo 4 - Janela de observacao

Aguardar **24h** apos a aplicacao da Fase 2 antes de iniciar a Fase 3.
Monitorar:

- Erros 500/min nos logs do Fly (`flyctl logs -a app-gestao-advocacia`)
- Queries com falha de RLS (`grep "row-level security" nos logs`)
- p99 de latencia (observacao manual via curl)

Conforme [`docs/onda-3.1-rls-plano.md`](../onda-3.1-rls-plano.md)
Decisao 5.

## Historico de execucao

| Data       | Ambiente | Notas                                                                                                                  |
|------------|----------|------------------------------------------------------------------------------------------------------------------------|
| 2026-04-26 | prod     | Ownership das 17 categoria A aplicado manualmente apos release_command da Fase 2 falhar (issue #102)                    |
| 2026-04-26 | prod     | Ownership de password_reset_token transferida pre-merge do PR #105 (drift fix issue #99)                                 |
| 2026-04-26 | prod     | GRANT CREATE ON SCHEMA public TO app_admin aplicado apos release_command do PR #105 falhar com permission denied        |
| 2026-04-26 | prod     | SQL consolidado em transfer_rls_ownership.sql para ambientes futuros — todas as 18 tabelas + GRANT CREATE em uma rodada |

## Refs

- [`docs/onda-3.1-rls-plano.md`](../onda-3.1-rls-plano.md) Risco 7.8
- [`docs/ops/transfer_rls_ownership.sql`](transfer_rls_ownership.sql)
- Issue #102 — `[ownership] ENABLE RLS exige owner das tabelas`
- Migration `f2a1b2c3d4e5_enable_rls_permissive`
