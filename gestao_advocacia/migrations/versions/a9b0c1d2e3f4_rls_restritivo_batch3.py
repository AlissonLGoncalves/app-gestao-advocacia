"""rls restritivo em djen_oab_monitoramento, publicacao_djen, djen_vinculo_decisao, procuracao_analise (Onda 3.1 Fase 4 Batch 3)

Substitui policy permissiva rls_permissive_default por restritiva
rls_tenant_isolation_default no cluster DJEN + procuracao. A partir
desta migration, queries no app_user sem set_config('app.current_tenant_id', tid)
erram ou retornam 0 rows; INSERT com tenant_id != setting viola WITH CHECK.

Todas as 4 tabelas ja tem tenant_id direto (categoria A no design original).
Sem denormalizacao previa (diferente do Batch 1 que tratou movimentacao_cnj).

app_admin (BYPASSRLS) continua acessando tudo — release_command e jobs
administrativos cross-tenant (DJEN sync iterando por OAB de cada tenant)
continuam funcionando porque rodam como app_admin.

Skip em SQLite (Risco 7.6 do plano).

Revision ID: a9b0c1d2e3f4
Revises: f8a9b0c1d2e3
Create Date: 2026-05-01 01:50:00.000000
"""

from alembic import op

revision = "a9b0c1d2e3f4"
down_revision = "f8a9b0c1d2e3"
branch_labels = None
depends_on = None


_RESTRICTIVE_TABLES = [
    "djen_oab_monitoramento",
    "publicacao_djen",
    "djen_vinculo_decisao",
    "procuracao_analise",
]
_OLD_POLICY = "rls_permissive_default"
_NEW_POLICY = "rls_tenant_isolation_default"


def upgrade():
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    for table in _RESTRICTIVE_TABLES:
        op.execute(f'DROP POLICY {_OLD_POLICY} ON "{table}"')
        op.execute(
            f'CREATE POLICY {_NEW_POLICY} ON "{table}" '
            f"FOR ALL "
            f"USING (tenant_id = current_setting('app.current_tenant_id')::int) "
            f"WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::int)"
        )


def downgrade():
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    for table in reversed(_RESTRICTIVE_TABLES):
        op.execute(f'DROP POLICY {_NEW_POLICY} ON "{table}"')
        op.execute(
            f'CREATE POLICY {_OLD_POLICY} ON "{table}" FOR ALL USING (true) WITH CHECK (true)'
        )
