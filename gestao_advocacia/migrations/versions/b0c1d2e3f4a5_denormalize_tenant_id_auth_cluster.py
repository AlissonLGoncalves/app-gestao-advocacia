"""denormalize tenant_id em consentimento_usuario e login_audit (Onda 3.1 Fase 4 Batch 4, pre-RLS)

Decisao final do Batch 4 (cluster auth):
- consentimento_usuario: opcao C da NOTA da decisao #2 — denormaliza tenant_id
  via JOIN com user, NOT NULL. Policy final por tenant_id (consistente com
  resto do schema). Compliance LGPD continua na camada de aplicacao
  (filter por user_id no endpoint /me/consentimentos).
- login_audit: ADD COLUMN tenant_id NULLABLE. Para tentativas falhas em
  email inexistente, tenant_id fica NULL e o registro nao e visivel para
  app_user (policy 'tenant_id = current_setting' exclui NULLs naturalmente).
  Esses registros sao acessiveis apenas via admin_session (superadmin).

Steps:
1. consentimento_usuario:
   - ADD COLUMN tenant_id (nullable temporario)
   - Backfill via UPDATE...FROM user WHERE consentimento_usuario.user_id = user.id
   - Validar zero NULLs (defensivo)
   - ALTER NOT NULL + FK + indice (tenant_id, user_id)
2. login_audit:
   - ADD COLUMN tenant_id (nullable definitivo)
   - Backfill via UPDATE...FROM user WHERE login_audit.user_id = user.id AND user_id IS NOT NULL
   - NAO marcar NOT NULL (registros de email inexistente continuam com NULL)
   - Indice (tenant_id, criado_em)

Idempotente em re-runs parciais. Skip-friendly em SQLite via inspector
checks (Risco 7.6 do plano).

Revision ID: b0c1d2e3f4a5
Revises: a9b0c1d2e3f4
Create Date: 2026-05-01 02:00:00.000000
"""

import sqlalchemy as sa
from alembic import op

revision = "b0c1d2e3f4a5"
down_revision = "a9b0c1d2e3f4"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    is_postgres = bind.dialect.name == "postgresql"

    # ===== consentimento_usuario =====
    cu_cols = {c["name"] for c in inspector.get_columns("consentimento_usuario")}
    if "tenant_id" not in cu_cols:
        op.add_column(
            "consentimento_usuario", sa.Column("tenant_id", sa.Integer(), nullable=True)
        )

    if is_postgres:
        op.execute(
            """
            UPDATE consentimento_usuario AS cu
               SET tenant_id = u.tenant_id
              FROM "user" AS u
             WHERE cu.user_id = u.id
               AND cu.tenant_id IS NULL
            """
        )
    else:
        op.execute(
            """
            UPDATE consentimento_usuario
               SET tenant_id = (
                   SELECT tenant_id FROM "user" WHERE "user".id = consentimento_usuario.user_id
               )
             WHERE tenant_id IS NULL
            """
        )

    orfas = bind.execute(
        sa.text("SELECT COUNT(*) FROM consentimento_usuario WHERE tenant_id IS NULL")
    ).scalar()
    if orfas:
        # Em prod isso so acontece se algum user tiver tenant_id NULL (superadmin sem
        # tenant) — mas superadmin nao da consentimento normal, entao esperado e 0.
        # Se aparecer, ler manualmente antes de prosseguir.
        raise RuntimeError(
            f"Backfill incompleto: {orfas} consentimentos sem tenant_id resolvido. "
            "Investigar user_id orfaos ou usuarios sem tenant antes de prosseguir."
        )

    with op.batch_alter_table("consentimento_usuario") as batch:
        batch.alter_column("tenant_id", nullable=False)

    cu_fks = {fk["name"] for fk in inspector.get_foreign_keys("consentimento_usuario")}
    if "fk_consentimento_tenant_id" not in cu_fks:
        with op.batch_alter_table("consentimento_usuario") as batch:
            batch.create_foreign_key(
                "fk_consentimento_tenant_id", "tenant", ["tenant_id"], ["id"]
            )

    cu_indexes = {ix["name"] for ix in inspector.get_indexes("consentimento_usuario")}
    if "ix_consentimento_tenant_user" not in cu_indexes:
        op.create_index(
            "ix_consentimento_tenant_user",
            "consentimento_usuario",
            ["tenant_id", "user_id"],
        )

    # ===== login_audit =====
    la_cols = {c["name"] for c in inspector.get_columns("login_audit")}
    if "tenant_id" not in la_cols:
        op.add_column("login_audit", sa.Column("tenant_id", sa.Integer(), nullable=True))

    if is_postgres:
        op.execute(
            """
            UPDATE login_audit AS la
               SET tenant_id = u.tenant_id
              FROM "user" AS u
             WHERE la.user_id = u.id
               AND la.user_id IS NOT NULL
               AND la.tenant_id IS NULL
            """
        )
    else:
        op.execute(
            """
            UPDATE login_audit
               SET tenant_id = (
                   SELECT tenant_id FROM "user" WHERE "user".id = login_audit.user_id
               )
             WHERE user_id IS NOT NULL AND tenant_id IS NULL
            """
        )

    # NAO checar zero NULLs aqui — login_audit pode ter registros legitimos
    # com tenant_id NULL (tentativas falhas em email inexistente).

    la_fks = {fk["name"] for fk in inspector.get_foreign_keys("login_audit")}
    if "fk_login_audit_tenant_id" not in la_fks:
        with op.batch_alter_table("login_audit") as batch:
            batch.create_foreign_key(
                "fk_login_audit_tenant_id", "tenant", ["tenant_id"], ["id"]
            )

    la_indexes = {ix["name"] for ix in inspector.get_indexes("login_audit")}
    if "ix_login_audit_tenant_criado" not in la_indexes:
        op.create_index(
            "ix_login_audit_tenant_criado",
            "login_audit",
            ["tenant_id", "criado_em"],
        )


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # login_audit
    la_indexes = {ix["name"] for ix in inspector.get_indexes("login_audit")}
    if "ix_login_audit_tenant_criado" in la_indexes:
        op.drop_index("ix_login_audit_tenant_criado", table_name="login_audit")
    la_fks = {fk["name"] for fk in inspector.get_foreign_keys("login_audit")}
    if "fk_login_audit_tenant_id" in la_fks:
        with op.batch_alter_table("login_audit") as batch:
            batch.drop_constraint("fk_login_audit_tenant_id", type_="foreignkey")
    la_cols = {c["name"] for c in inspector.get_columns("login_audit")}
    if "tenant_id" in la_cols:
        op.drop_column("login_audit", "tenant_id")

    # consentimento_usuario
    cu_indexes = {ix["name"] for ix in inspector.get_indexes("consentimento_usuario")}
    if "ix_consentimento_tenant_user" in cu_indexes:
        op.drop_index("ix_consentimento_tenant_user", table_name="consentimento_usuario")
    cu_fks = {fk["name"] for fk in inspector.get_foreign_keys("consentimento_usuario")}
    if "fk_consentimento_tenant_id" in cu_fks:
        with op.batch_alter_table("consentimento_usuario") as batch:
            batch.drop_constraint("fk_consentimento_tenant_id", type_="foreignkey")
    cu_cols = {c["name"] for c in inspector.get_columns("consentimento_usuario")}
    if "tenant_id" in cu_cols:
        op.drop_column("consentimento_usuario", "tenant_id")
