"""rls restritivo em user, audit_log, consentimento_usuario, login_audit (Onda 3.1 Fase 4 Batch 4)

Cluster auth — o ultimo e mais delicado batch. Substitui rls_permissive_default
por restritiva rls_tenant_isolation_default em 4 tabelas.

Pre-requisito: migration b0c1d2e3f4a5 ja denormalizou tenant_id em
consentimento_usuario (NOT NULL) e login_audit (NULLABLE).

Implicacoes funcionais (importantes — ler antes de mergear):

1. **user**: app_user com tenant_id setado ve apenas usuarios do proprio
   tenant. Login (que precisa lookup pre-autenticacao) sera roteado via
   admin_session() com role app_admin (BYPASSRLS) — refactor em routes/auth.py.
   Superadmin (tenant_id NULL) nao e visivel via app_user em nenhum tenant —
   intencional. Operacoes super-admin rodam via /admin/v1/* com app_admin.

2. **login_audit**: registros com tenant_id NULL (tentativas falhas em email
   inexistente) ficam INVISIVEIS para app_user. Apenas admin_session ve.
   GET /me/historico-login filtra por user_id explicitamente — combinacao
   de RLS (tenant) + filtro app (user) e correta.

3. **audit_log**: ja tinha tenant_id NOT NULL — sem mudanca de codigo.

4. **consentimento_usuario**: ja com tenant_id apos migration b0c1d2e3f4a5.
   Admin do tenant ve consentimentos de todos os users do tenant (auditoria
   de compliance). Filtragem por user individual continua na camada de app.

5. **password_reset_token**: NAO incluida — categoria C do plano (decisao #2),
   acesso somente via admin_session em /auth/forgot-password e /auth/reset-password.

Skip em SQLite (Risco 7.6).

Revision ID: c1d2e3f4a5b6
Revises: b0c1d2e3f4a5
Create Date: 2026-05-01 02:05:00.000000
"""

from alembic import op

revision = "c1d2e3f4a5b6"
down_revision = "b0c1d2e3f4a5"
branch_labels = None
depends_on = None


_RESTRICTIVE_TABLES = ["user", "audit_log", "consentimento_usuario", "login_audit"]
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
