"""Fase 2 (inbox de Intimações) — publicacao_djen.tratada_em

Inbox-zero: a intimação só sai da fila quando tratada (gerou prazo/
tarefa/audiência ou registrada conscientemente) ou descartada.

Revision ID: f2b4d6a8c0e3
Revises: e9b1d3f5a7c0
Create Date: 2026-06-11
"""

import sqlalchemy as sa
from alembic import op

revision = "f2b4d6a8c0e3"
down_revision = "e9b1d3f5a7c0"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("publicacao_djen", schema=None) as batch_op:
        batch_op.add_column(sa.Column("tratada_em", sa.DateTime(), nullable=True))
        batch_op.create_index("ix_publicacao_djen_tratada_em", ["tratada_em"], unique=False)


def downgrade():
    with op.batch_alter_table("publicacao_djen", schema=None) as batch_op:
        batch_op.drop_index("ix_publicacao_djen_tratada_em")
        batch_op.drop_column("tratada_em")
