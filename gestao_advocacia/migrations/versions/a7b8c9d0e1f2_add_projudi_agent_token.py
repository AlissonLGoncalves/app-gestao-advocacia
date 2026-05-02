"""add projudi_agent_token table

Tabela pra autenticar o projudi-agent (scraper local) no Patronus sem
usar JWT do usuario. Token tenant-scoped, longo-vivo, revogavel. Banco
guarda so o hash sha256 — valor cru aparece uma unica vez na criacao.

Revision ID: a7b8c9d0e1f2
Revises: f4a5b6c7d8e9
Create Date: 2026-05-02 13:00:00.000000
"""

import sqlalchemy as sa
from alembic import op

revision = "a7b8c9d0e1f2"
down_revision = "f4a5b6c7d8e9"
branch_labels = None
depends_on = None


def _table_exists(conn, table):
    return table in sa.inspect(conn).get_table_names()


def upgrade():
    conn = op.get_bind()

    if _table_exists(conn, "projudi_agent_token"):
        return

    op.create_table(
        "projudi_agent_token",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("tenant.id", name="fk_projudi_token_tenant_id"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("user.id", name="fk_projudi_token_user_id"),
            nullable=False,
        ),
        sa.Column("token_hash", sa.String(length=64), nullable=False, unique=True),
        sa.Column("nome", sa.String(length=100), nullable=True),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("last_used_at", sa.DateTime(), nullable=True),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
    )
    op.create_index(
        "ix_projudi_token_tenant_ativo",
        "projudi_agent_token",
        ["tenant_id", "ativo"],
    )
    op.create_index(
        "ix_projudi_agent_token_token_hash",
        "projudi_agent_token",
        ["token_hash"],
        unique=True,
    )


def downgrade():
    conn = op.get_bind()
    if not _table_exists(conn, "projudi_agent_token"):
        return
    op.drop_index("ix_projudi_agent_token_token_hash", table_name="projudi_agent_token")
    op.drop_index("ix_projudi_token_tenant_ativo", table_name="projudi_agent_token")
    op.drop_table("projudi_agent_token")
