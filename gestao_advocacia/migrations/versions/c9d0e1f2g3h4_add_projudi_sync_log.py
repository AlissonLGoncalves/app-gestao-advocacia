"""add projudi_sync_log table (Fase 6 da integracao)

Registra cada execucao bem-sucedida do projudi-agent (push de processos,
movimentacoes, pecas). Usado pelo Dashboard pra mostrar 'sync ha X min'.

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-05-03 00:55:00.000000
"""

import sqlalchemy as sa
from alembic import op

revision = "c9d0e1f2a3b4"
down_revision = "b8c9d0e1f2a3"
branch_labels = None
depends_on = None


def _table_exists(conn, table):
    return table in sa.inspect(conn).get_table_names()


def upgrade():
    conn = op.get_bind()

    if _table_exists(conn, "projudi_sync_log"):
        return

    op.create_table(
        "projudi_sync_log",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("tenant.id", name="fk_projudi_sync_log_tenant_id"),
            nullable=False,
        ),
        sa.Column(
            "token_id",
            sa.Integer(),
            sa.ForeignKey("projudi_agent_token.id", name="fk_projudi_sync_log_token_id"),
            nullable=True,
        ),
        sa.Column("tipo", sa.String(length=20), nullable=False),
        sa.Column("counts", sa.JSON(), nullable=True),
        sa.Column("duracao_ms", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_projudi_sync_log_tenant_tipo_created",
        "projudi_sync_log",
        ["tenant_id", "tipo", "created_at"],
    )


def downgrade():
    conn = op.get_bind()
    if not _table_exists(conn, "projudi_sync_log"):
        return
    op.drop_index("ix_projudi_sync_log_tenant_tipo_created", table_name="projudi_sync_log")
    op.drop_table("projudi_sync_log")
