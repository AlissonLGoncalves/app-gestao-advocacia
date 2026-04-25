"""admin_fase0_backoffice — tenant.status + admin_audit_log + tenant_anotacao

Revision ID: ad05c0fea001
Revises: f2a3b4c5d6e7
Create Date: 2026-04-24 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "ad05c0fea001"
down_revision = "f2a3b4c5d6e7"
branch_labels = None
depends_on = None


def _table_exists(conn, name):
    return sa.inspect(conn).has_table(name)


def _column_exists(conn, table, column):
    cols = {c["name"] for c in sa.inspect(conn).get_columns(table)}
    return column in cols


def upgrade():
    conn = op.get_bind()

    # 1) tenant.status — adicionar coluna se nao existir, com default server-side 'ativo'
    if not _column_exists(conn, "tenant", "status"):
        with op.batch_alter_table("tenant", schema=None) as batch_op:
            batch_op.add_column(
                sa.Column(
                    "status",
                    sa.String(length=20),
                    nullable=False,
                    server_default="ativo",
                )
            )

    # 2) admin_audit_log — criar so se nao existir
    if not _table_exists(conn, "admin_audit_log"):
        op.create_table(
            "admin_audit_log",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("admin_user_id", sa.Integer(), nullable=False),
            sa.Column("action", sa.String(length=60), nullable=False),
            sa.Column("target_type", sa.String(length=40), nullable=False),
            sa.Column("target_id", sa.Integer(), nullable=True),
            sa.Column("target_tenant_id", sa.Integer(), nullable=True),
            sa.Column("before_json", sa.Text(), nullable=True),
            sa.Column("after_json", sa.Text(), nullable=True),
            sa.Column("ip", sa.String(length=45), nullable=True),
            sa.Column("user_agent", sa.String(length=500), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(
                ["admin_user_id"], ["user.id"], name="fk_admin_audit_user_id"
            ),
            sa.ForeignKeyConstraint(
                ["target_tenant_id"], ["tenant.id"], name="fk_admin_audit_target_tenant_id"
            ),
            sa.PrimaryKeyConstraint("id"),
        )

    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_admin_audit_log_admin_user_id ON admin_audit_log (admin_user_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_admin_audit_log_action ON admin_audit_log (action)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_admin_audit_log_target_tenant_id ON admin_audit_log (target_tenant_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_admin_audit_log_created_at ON admin_audit_log (created_at)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_admin_audit_target_tenant_created "
        "ON admin_audit_log (target_tenant_id, created_at)"
    )

    # 3) tenant_anotacao — criar so se nao existir
    if not _table_exists(conn, "tenant_anotacao"):
        op.create_table(
            "tenant_anotacao",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("tenant_id", sa.Integer(), nullable=False),
            sa.Column("admin_user_id", sa.Integer(), nullable=False),
            sa.Column("texto", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(
                ["tenant_id"], ["tenant.id"], name="fk_tenant_anotacao_tenant_id"
            ),
            sa.ForeignKeyConstraint(
                ["admin_user_id"], ["user.id"], name="fk_tenant_anotacao_admin_user_id"
            ),
            sa.PrimaryKeyConstraint("id"),
        )

    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_tenant_anotacao_tenant_id ON tenant_anotacao (tenant_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_tenant_anotacao_created_at ON tenant_anotacao (created_at)"
    )


def downgrade():
    op.execute("DROP INDEX IF EXISTS ix_tenant_anotacao_created_at")
    op.execute("DROP INDEX IF EXISTS ix_tenant_anotacao_tenant_id")
    op.drop_table("tenant_anotacao")

    op.execute("DROP INDEX IF EXISTS ix_admin_audit_target_tenant_created")
    op.execute("DROP INDEX IF EXISTS ix_admin_audit_log_created_at")
    op.execute("DROP INDEX IF EXISTS ix_admin_audit_log_target_tenant_id")
    op.execute("DROP INDEX IF EXISTS ix_admin_audit_log_action")
    op.execute("DROP INDEX IF EXISTS ix_admin_audit_log_admin_user_id")
    op.drop_table("admin_audit_log")

    with op.batch_alter_table("tenant", schema=None) as batch_op:
        batch_op.drop_column("status")
