"""rls restritivo em despesa, recebimento, contrato_honorario (Onda 3.1 Fase 4 Batch 2)

Substitui policy permissiva rls_permissive_default por restritiva
rls_tenant_isolation_default em mais 3 tabelas. A partir desta migration,
queries no app_user sem set_config('app.current_tenant_id', tid) erram
ou retornam 0 rows; INSERT com tenant_id != setting viola WITH CHECK.

Todas as 3 tabelas ja tem tenant_id direto (categoria A no design original) —
sem necessidade de denormalizacao previa, diferente de Batch 1 com
movimentacao_cnj.

app_admin (BYPASSRLS) continua acessando tudo — release_command,
jobs administrativos cross-tenant e scripts continuam funcionando.

Skip em SQLite (Risco 7.6 do plano).

Revision ID: f8a9b0c1d2e3
Revises: e7f8a9b0c1d2
Create Date: 2026-05-01 01:40:00.000000
"""

from alembic import op

revision = "f8a9b0c1d2e3"
down_revision = "e7f8a9b0c1d2"
branch_labels = None
depends_on = None


_RESTRICTIVE_TABLES = ["despesa", "recebimento", "contrato_honorario"]
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
