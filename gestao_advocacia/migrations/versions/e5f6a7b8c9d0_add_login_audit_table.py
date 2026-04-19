"""add_login_audit_table

Revision ID: e5f6a7b8c9d0
Revises: d3e4f5a6b7c8
Create Date: 2026-04-19 18:20:00.000000
"""

import sqlalchemy as sa
from alembic import op

revision = "e5f6a7b8c9d0"
down_revision = "d3e4f5a6b7c8"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "login_audit",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("email_tentativa", sa.String(length=120), nullable=False),
        sa.Column("sucesso", sa.Boolean(), nullable=False),
        sa.Column("ip", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("motivo_falha", sa.String(length=50), nullable=True),
        sa.Column("criado_em", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], name="fk_login_audit_user_id"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_login_audit_criado_em", "login_audit", ["criado_em"], unique=False)


def downgrade():
    op.drop_index("ix_login_audit_criado_em", table_name="login_audit")
    op.drop_table("login_audit")
