"""add posicao to tarefa_prazo (kanban reorder)

Revision ID: f5a6b7c8d9e0
Revises: ad05c0fea001
Create Date: 2026-04-26 13:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "f5a6b7c8d9e0"
down_revision = "ad05c0fea001"
branch_labels = None
depends_on = None


def _column_exists(conn, table, column):
    cols = {c["name"] for c in sa.inspect(conn).get_columns(table)}
    return column in cols


def _index_exists(conn, table, index):
    idx = {i["name"] for i in sa.inspect(conn).get_indexes(table)}
    return index in idx


def upgrade():
    conn = op.get_bind()

    if not _column_exists(conn, "tarefa_prazo", "posicao"):
        with op.batch_alter_table("tarefa_prazo") as batch:
            batch.add_column(sa.Column("posicao", sa.Integer(), nullable=True))

        # Backfill: posicao = id, para preservar a ordem atual (id crescente = mais antigo primeiro).
        # Cards novos serao inseridos no fim da coluna pelo POST.
        op.execute("UPDATE tarefa_prazo SET posicao = id WHERE posicao IS NULL")

    if not _index_exists(conn, "tarefa_prazo", "ix_tarefa_prazo_tenant_status_posicao"):
        op.create_index(
            "ix_tarefa_prazo_tenant_status_posicao",
            "tarefa_prazo",
            ["tenant_id", "status", "posicao"],
        )


def downgrade():
    conn = op.get_bind()

    if _index_exists(conn, "tarefa_prazo", "ix_tarefa_prazo_tenant_status_posicao"):
        op.drop_index("ix_tarefa_prazo_tenant_status_posicao", table_name="tarefa_prazo")

    if _column_exists(conn, "tarefa_prazo", "posicao"):
        with op.batch_alter_table("tarefa_prazo") as batch:
            batch.drop_column("posicao")
