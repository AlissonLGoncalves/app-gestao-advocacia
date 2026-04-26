-- ============================================================================
-- transfer_rls_ownership.sql
--
-- Setup operacional pos-Fase 1 do RLS para ambientes onde tabelas e schema
-- pre-existem ao role `app_admin` (caso do Patronus e qualquer ambiente
-- migrado de DB criado por outro superuser).
--
-- Faz:
--   1. Transfere ownership de 18 tabelas para app_admin:
--      - 17 categoria A (multi-tenant, ganham RLS na Fase 2)
--      - password_reset_token (categoria C — sem RLS, mas migrations
--        futuras tocam ela; descoberto na issue #99/PR #105)
--   2. Concede CREATE no schema public para app_admin (necessario para
--      operacoes de batch_alter_table que criam tabelas temporarias;
--      descoberto durante PR #105 / issue #106).
--
-- Quando rodar:
--   - Em qualquer ambiente onde as tabelas pre-existem ao role app_admin.
--   - Antes do primeiro deploy que aplique migration de Fase 2+ do RLS.
--   - NAO precisa rodar em ambientes criados do zero apos Fase 1
--     (CREATE TABLE como app_admin ja deixa app_admin como owner;
--     a CREATE permission ainda precisa ser concedida — incluir
--     na automacao de provisionamento de banco).
--
-- Como rodar (em prod no Fly, via peer auth no container Postgres):
--
--   flyctl ssh console -a patronus-db --pty=false \
--     -C "su postgres -c 'psql -h /var/run/postgresql -p 5433 -d postgres'" \
--     < docs/ops/transfer_rls_ownership.sql
--
-- Idempotente: ALTER TABLE OWNER TO X num owner que ja e X e no-op.
-- GRANT em role que ja tem o privilegio e no-op.
--
-- Refs:
--   docs/onda-3.1-rls-plano.md Risco 7.8
--   issues #99, #102, #106
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Ownership: tabelas que migrations de RLS (e drift fixes) tocam via DDL
-- ----------------------------------------------------------------------------

-- Categoria A (multi-tenant, ganham policies restritivas em Fase 3+)
ALTER TABLE "user" OWNER TO app_admin;
ALTER TABLE cliente OWNER TO app_admin;
ALTER TABLE caso OWNER TO app_admin;
ALTER TABLE movimentacao_cnj OWNER TO app_admin;
ALTER TABLE evento_agenda OWNER TO app_admin;
ALTER TABLE documento OWNER TO app_admin;
ALTER TABLE procuracao_analise OWNER TO app_admin;
ALTER TABLE contrato_honorario OWNER TO app_admin;
ALTER TABLE despesa OWNER TO app_admin;
ALTER TABLE recebimento OWNER TO app_admin;
ALTER TABLE tarefa_prazo OWNER TO app_admin;
ALTER TABLE djen_oab_monitoramento OWNER TO app_admin;
ALTER TABLE publicacao_djen OWNER TO app_admin;
ALTER TABLE djen_vinculo_decisao OWNER TO app_admin;
ALTER TABLE audit_log OWNER TO app_admin;
ALTER TABLE login_audit OWNER TO app_admin;
ALTER TABLE consentimento_usuario OWNER TO app_admin;

-- Categoria C mas tocada por migrations (drift fix — issue #99)
ALTER TABLE password_reset_token OWNER TO app_admin;

-- ----------------------------------------------------------------------------
-- 2. Schema-level: CREATE para operacoes de batch_alter_table
-- ----------------------------------------------------------------------------

GRANT CREATE ON SCHEMA public TO app_admin;

-- ----------------------------------------------------------------------------
-- 3. Verificacao
-- ----------------------------------------------------------------------------

-- Espera: 18 linhas, todas com tableowner = app_admin
SELECT
    tablename,
    tableowner
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
      'user', 'cliente', 'caso', 'movimentacao_cnj', 'evento_agenda',
      'documento', 'procuracao_analise', 'contrato_honorario', 'despesa',
      'recebimento', 'tarefa_prazo', 'djen_oab_monitoramento',
      'publicacao_djen', 'djen_vinculo_decisao', 'audit_log',
      'login_audit', 'consentimento_usuario', 'password_reset_token'
  )
ORDER BY tablename;

-- Espera: app_admin com can_create=t
SELECT
    r.rolname AS role,
    has_schema_privilege(r.rolname, 'public', 'CREATE') AS can_create,
    has_schema_privilege(r.rolname, 'public', 'USAGE') AS can_usage
FROM pg_roles r
WHERE r.rolname IN ('app_admin', 'app_user');

COMMIT;
