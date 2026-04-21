"""expand_sigla_tribunal_on_djen_oab

Expande sigla_tribunal em djen_oab_monitoramento para suportar multiplos tribunais.

Revision ID: e4f5a6b7c8d9
Revises: c2d3e4f5a6b7
Create Date: 2026-04-21 14:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "e4f5a6b7c8d9"
down_revision = "c2d3e4f5a6b7"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        "djen_oab_monitoramento",
        "sigla_tribunal",
        existing_type=sa.String(length=20),
        type_=sa.String(length=120),
        existing_nullable=True,
    )


def downgrade():
    op.alter_column(
        "djen_oab_monitoramento",
        "sigla_tribunal",
        existing_type=sa.String(length=120),
        type_=sa.String(length=20),
        existing_nullable=True,
    )