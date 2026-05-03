"""add hash_arquivo column to documento (idempotencia upload PROJUDI)

Coluna SHA-256 do conteudo do arquivo. Usada pra dedup quando o mesmo PDF
eh re-enviado pelo projudi-agent (Fase 4 da integracao). Nullable porque
docs antigos nao tem hash calculado — sera populado lazy quando atualizado.

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-05-03 00:35:00.000000
"""

import sqlalchemy as sa
from alembic import op

revision = "b8c9d0e1f2a3"
down_revision = "a7b8c9d0e1f2"
branch_labels = None
depends_on = None


def _column_exists(conn, table, column):
    cols = {c["name"] for c in sa.inspect(conn).get_columns(table)}
    return column in cols


def _index_exists(conn, table, idx_name):
    idxs = {i["name"] for i in sa.inspect(conn).get_indexes(table)}
    return idx_name in idxs


def upgrade():
    conn = op.get_bind()

    if not _column_exists(conn, "documento", "hash_arquivo"):
        with op.batch_alter_table("documento") as batch:
            batch.add_column(sa.Column("hash_arquivo", sa.String(length=64), nullable=True))

    if not _index_exists(conn, "documento", "ix_documento_hash_arquivo"):
        op.create_index("ix_documento_hash_arquivo", "documento", ["hash_arquivo"])

    if not _index_exists(conn, "documento", "ix_documento_caso_hash"):
        op.create_index("ix_documento_caso_hash", "documento", ["caso_id", "hash_arquivo"])


def downgrade():
    conn = op.get_bind()

    if _index_exists(conn, "documento", "ix_documento_caso_hash"):
        op.drop_index("ix_documento_caso_hash", table_name="documento")
    if _index_exists(conn, "documento", "ix_documento_hash_arquivo"):
        op.drop_index("ix_documento_hash_arquivo", table_name="documento")
    if _column_exists(conn, "documento", "hash_arquivo"):
        with op.batch_alter_table("documento") as batch:
            batch.drop_column("hash_arquivo")
