"""Issue #304 — item_agenda.tipo_providencia

Guarda o nome da regra do calculador de prazo (contestacao_15d,
recurso_15d, manifestacao_15d, ...) pra UI mostrar a providência que a
intimação exige e sugerir o modelo de peça na resposta.

Revision ID: a1c3e5f7b9d2
Revises: d6f8a0b2c4e7
Create Date: 2026-06-10
"""

import sqlalchemy as sa
from alembic import op

revision = "a1c3e5f7b9d2"
down_revision = "d6f8a0b2c4e7"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("item_agenda", schema=None) as batch_op:
        batch_op.add_column(sa.Column("tipo_providencia", sa.String(length=40), nullable=True))


def downgrade():
    with op.batch_alter_table("item_agenda", schema=None) as batch_op:
        batch_op.drop_column("tipo_providencia")
