"""rls restritivo em tarefa_prazo, evento_agenda, documento (canario fase 3)

Onda 3.1 - Fase 3. Substitui policy permissiva rls_permissive_default
por restritiva rls_tenant_isolation_default em 3 tabelas canario.
A partir desta migration, queries no app_user sem set_config
('app.current_tenant_id', tid) erram nessas tabelas; queries com
tenant_id != setting retornam 0 rows; INSERT com tenant_id != setting
viola WITH CHECK e raises.

Outras 14 tabelas categoria A continuam com USING (true) ate Fase 4.

app_admin (BYPASSRLS) continua acessando tudo - release_command,
jobs administrativos e scripts nao sao afetados.

Skip em SQLite (Risco 7.6 do plano).

Revision ID: a3b4c5d6e7f8
Revises: f2a1b2c3d4e5
Create Date: 2026-04-26 18:55:00.000000

"""

from alembic import op

revision = "a3b4c5d6e7f8"
down_revision = "f2a1b2c3d4e5"
branch_labels = None
depends_on = None


_RESTRICTIVE_TABLES = ["tarefa_prazo", "evento_agenda", "documento"]
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
