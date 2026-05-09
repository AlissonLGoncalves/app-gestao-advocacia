"""epic_177_tarefa_prazo_publicacao_djen_id

Revision ID: a0e85cd69f97
Revises: 78b52c5c92e5
Create Date: 2026-05-09 18:30:00.000000

Adiciona FK opcional `tarefa_prazo.publicacao_djen_id` para vincular tarefas
criadas a partir do botao "Criar tarefa" no detalhe de uma publicacao DJEN
(Epic #3 / #177). NULL para tarefas criadas manualmente.

"""

from alembic import op
import sqlalchemy as sa


revision = "a0e85cd69f97"
down_revision = "78b52c5c92e5"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("tarefa_prazo") as batch_op:
        batch_op.add_column(sa.Column("publicacao_djen_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_tarefaprazo_publicacao_djen_id",
            "publicacao_djen",
            ["publicacao_djen_id"],
            ["id"],
        )
        batch_op.create_index(
            "ix_tarefa_prazo_publicacao_djen_id",
            ["publicacao_djen_id"],
        )


def downgrade():
    with op.batch_alter_table("tarefa_prazo") as batch_op:
        batch_op.drop_index("ix_tarefa_prazo_publicacao_djen_id")
        batch_op.drop_constraint("fk_tarefaprazo_publicacao_djen_id", type_="foreignkey")
        batch_op.drop_column("publicacao_djen_id")
