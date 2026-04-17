"""add_sigla_tribunal_to_djen_oab_monitoramento

Adiciona coluna sigla_tribunal à tabela djen_oab_monitoramento
para permitir monitorar TRTs, TST, STJ e outros tribunais além do TJ.

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-04-17 14:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'c2d3e4f5a6b7'
down_revision = 'b1c2d3e4f5a6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('djen_oab_monitoramento', sa.Column('sigla_tribunal', sa.String(length=20), nullable=True))


def downgrade():
    op.drop_column('djen_oab_monitoramento', 'sigla_tribunal')
