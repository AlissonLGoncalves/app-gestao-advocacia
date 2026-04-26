-- ============================================================================
-- transfer_rls_ownership.sql
--
-- Transfere ownership das 17 tabelas categoria A para o role `app_admin`,
-- pre-requisito para que o release_command consiga rodar migrations que
-- fazem ENABLE ROW LEVEL SECURITY ou CREATE/DROP/ALTER POLICY.
--
-- Quando rodar:
--   - Em qualquer ambiente onde as tabelas pre-existem ao role app_admin
--     (criadas pelo postgres superuser antes da Fase 1).
--   - Antes do primeiro deploy que aplique migration de Fase 2+ do RLS.
--   - NAO precisa rodar em ambientes criados do zero apos a Fase 1
--     (CREATE TABLE como app_admin ja deixa app_admin como owner).
--
-- Como rodar (em prod no Fly, via peer auth no container Postgres):
--
--   flyctl ssh console -a patronus-db --pty=false \
--     -C "su postgres -c 'psql -h /var/run/postgresql -p 5433 -d postgres'" \
--     < docs/ops/transfer_rls_ownership.sql
--
-- Ou copia o conteudo e cola dentro de:
--   flyctl ssh console -a patronus-db
--   su postgres
--   psql -h /var/run/postgresql -p 5433 -d postgres
--   <COLA O SQL>
--
-- Idempotente: ALTER TABLE OWNER TO X num owner que ja e X e no-op.
--
-- Refs:
--   docs/onda-3.1-rls-plano.md Risco 7.8
--   issue #102
-- ============================================================================

BEGIN;

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

-- Verificacao: lista os owners das 17 tabelas. Espera-se que todos
-- aparecam como app_admin. Se algum aparecer como postgres, o BEGIN
-- acima nao commitou ainda — ainda dentro da transacao.
SELECT
    schemaname,
    tablename,
    tableowner
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
      'user', 'cliente', 'caso', 'movimentacao_cnj', 'evento_agenda',
      'documento', 'procuracao_analise', 'contrato_honorario', 'despesa',
      'recebimento', 'tarefa_prazo', 'djen_oab_monitoramento',
      'publicacao_djen', 'djen_vinculo_decisao', 'audit_log',
      'login_audit', 'consentimento_usuario'
  )
ORDER BY tablename;

COMMIT;
