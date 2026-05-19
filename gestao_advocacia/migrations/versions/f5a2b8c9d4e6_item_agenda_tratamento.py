"""Adiciona campos de tratamento no item_agenda.

Feature "Tratar Prazo" (Onda 1) — campos pra registrar como o advogado
tratou um prazo, distintos de status=Concluido.

  - tratado_em (DateTime nullable): timestamp do tratamento
  - como_tratado (Text nullable): texto livre da acao tomada
  - peticao_cumpridora_id (FK documento nullable): doc que cumpriu

Revision ID: f5a2b8c9d4e6
Revises: e4f8c9a2b6d7
Create Date: 2026-05-17
"""

import sqlalchemy as sa
from alembic import op

revision = "f5a2b8c9d4e6"
down_revision = "e4f8c9a2b6d7"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("item_agenda") as batch:
        batch.add_column(sa.Column("tratado_em", sa.DateTime(), nullable=True))
        batch.add_column(sa.Column("como_tratado", sa.Text(), nullable=True))
        batch.add_column(sa.Column("peticao_cumpridora_id", sa.Integer(), nullable=True))
        batch.create_foreign_key(
            "fk_item_agenda_peticao_cumpridora_id",
            "documento",
            ["peticao_cumpridora_id"],
            ["id"],
        )


def downgrade():
    with op.batch_alter_table("item_agenda") as batch:
        batch.drop_constraint("fk_item_agenda_peticao_cumpridora_id", type_="foreignkey")
        batch.drop_column("peticao_cumpridora_id")
        batch.drop_column("como_tratado")
        batch.drop_column("tratado_em")
