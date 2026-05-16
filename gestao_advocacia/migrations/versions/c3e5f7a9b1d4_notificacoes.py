"""Cria tabela notificacao (in-app notifications + cron de vencimentos).

Revision ID: c3e5f7a9b1d4
Revises: b2d4f6a8c0e1
Create Date: 2026-05-16
"""

import sqlalchemy as sa
from alembic import op

revision = "c3e5f7a9b1d4"
down_revision = "b2d4f6a8c0e1"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "notificacao",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("tenant.id", name="fk_notificacao_tenant_id"),
            nullable=True,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("user.id", name="fk_notificacao_user_id"),
            nullable=False,
        ),
        sa.Column("tipo", sa.String(length=50), nullable=False),
        sa.Column("severidade", sa.String(length=20), nullable=False, server_default="info"),
        sa.Column("titulo", sa.String(length=200), nullable=False),
        sa.Column("mensagem", sa.Text(), nullable=True),
        sa.Column("link", sa.String(length=500), nullable=True),
        sa.Column("lida", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("data_criacao", sa.DateTime(), nullable=False),
        sa.Column("data_leitura", sa.DateTime(), nullable=True),
        sa.Column("dedupe_key", sa.String(length=200), nullable=True),
        sa.UniqueConstraint("user_id", "dedupe_key", name="uq_notificacao_user_dedupe"),
    )
    op.create_index("ix_notificacao_tenant_id", "notificacao", ["tenant_id"])
    op.create_index("ix_notificacao_user_id", "notificacao", ["user_id"])
    op.create_index("ix_notificacao_tipo", "notificacao", ["tipo"])
    op.create_index("ix_notificacao_lida", "notificacao", ["lida"])
    op.create_index("ix_notificacao_data_criacao", "notificacao", ["data_criacao"])
    op.create_index("ix_notificacao_dedupe_key", "notificacao", ["dedupe_key"])
    op.create_index("ix_notificacao_user_lida", "notificacao", ["user_id", "lida"])


def downgrade():
    op.drop_index("ix_notificacao_user_lida", table_name="notificacao")
    op.drop_index("ix_notificacao_dedupe_key", table_name="notificacao")
    op.drop_index("ix_notificacao_data_criacao", table_name="notificacao")
    op.drop_index("ix_notificacao_lida", table_name="notificacao")
    op.drop_index("ix_notificacao_tipo", table_name="notificacao")
    op.drop_index("ix_notificacao_user_id", table_name="notificacao")
    op.drop_index("ix_notificacao_tenant_id", table_name="notificacao")
    op.drop_table("notificacao")
