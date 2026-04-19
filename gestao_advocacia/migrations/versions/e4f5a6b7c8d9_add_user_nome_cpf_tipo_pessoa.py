"""add_user_nome_cpf_tipo_pessoa

Revision ID: e4f5a6b7c8d9
Revises: d3e4f5a6b7c8
Create Date: 2026-04-19 12:00:00.000000
"""

import sqlalchemy as sa
from alembic import op

revision = "e4f5a6b7c8d9"
down_revision = "d3e4f5a6b7c8"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("user", sa.Column("nome_completo", sa.String(length=200), nullable=True))
    op.add_column("user", sa.Column("cpf", sa.String(length=14), nullable=True))
    op.add_column("user", sa.Column("tipo_pessoa", sa.String(length=2), nullable=True))


def downgrade():
    op.drop_column("user", "tipo_pessoa")
    op.drop_column("user", "cpf")
    op.drop_column("user", "nome_completo")
