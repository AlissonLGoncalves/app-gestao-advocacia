"""add_partes_juiz_publicacao_djen

Adiciona colunas polo_ativo, polo_passivo e nome_juiz à tabela publicacao_djen.

Revision ID: b1c2d3e4f5a6
Revises: a9f7c2e1b3d0
Create Date: 2026-04-17 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'b1c2d3e4f5a6'
down_revision = 'a9f7c2e1b3d0'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('publicacao_djen', sa.Column('polo_ativo', sa.Text(), nullable=True))
    op.add_column('publicacao_djen', sa.Column('polo_passivo', sa.Text(), nullable=True))
    op.add_column('publicacao_djen', sa.Column('nome_juiz', sa.String(length=200), nullable=True))


def downgrade():
    op.drop_column('publicacao_djen', 'nome_juiz')
    op.drop_column('publicacao_djen', 'polo_passivo')
    op.drop_column('publicacao_djen', 'polo_ativo')
