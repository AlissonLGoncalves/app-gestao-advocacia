"""add_consentimento_usuario

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-04-19 00:00:00.000000
"""
import sqlalchemy as sa
from alembic import op

revision = "d3e4f5a6b7c8"
down_revision = "c2d3e4f5a6b7"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "consentimento_usuario",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("tipo", sa.String(length=32), nullable=False),
        sa.Column("versao", sa.String(length=16), nullable=False),
        sa.Column("aceito_em", sa.DateTime(), nullable=False),
        sa.Column("ip", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("hash_documento", sa.String(length=64), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id", "tipo", "versao", name="uq_consentimento_user_tipo_versao"
        ),
    )
    op.create_index(
        "ix_consentimento_user_tipo",
        "consentimento_usuario",
        ["user_id", "tipo"],
        unique=False,
    )


def downgrade():
    op.drop_index("ix_consentimento_user_tipo", table_name="consentimento_usuario")
    op.drop_table("consentimento_usuario")
