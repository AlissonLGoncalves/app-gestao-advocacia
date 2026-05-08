"""adiciona campos extras em contrato_honorario para extrator Gemini

- percentual_recurso: acrescimo em caso de recurso (ex: 5%)
- objeto: descricao livre do servico contratado
- vigencia_condicao: condicao de termino (ex: "ate quitacao da cota")
- arquivo_hash: SHA256 do PDF importado, idempotencia por tenant
- arquivo_nome: nome original do arquivo importado
- parcelas_json: parcelas estruturadas {numero, vencimento, valor, descricao}
- caso_id: torna nullable para permitir importacao retroativa sem caso vinculado

Revision ID: d0e1f2a3b4c5
Revises: c9d0e1f2a3b4
Create Date: 2026-05-08 10:45:00.000000
"""

import sqlalchemy as sa
from alembic import op

revision = "d0e1f2a3b4c5"
down_revision = "c9d0e1f2a3b4"
branch_labels = None
depends_on = None


def _has_column(conn, table, column):
    return any(c["name"] == column for c in sa.inspect(conn).get_columns(table))


def upgrade():
    conn = op.get_bind()

    with op.batch_alter_table("contrato_honorario") as batch_op:
        if not _has_column(conn, "contrato_honorario", "percentual_recurso"):
            batch_op.add_column(sa.Column("percentual_recurso", sa.Numeric(5, 2), nullable=True))
        if not _has_column(conn, "contrato_honorario", "objeto"):
            batch_op.add_column(sa.Column("objeto", sa.Text(), nullable=True))
        if not _has_column(conn, "contrato_honorario", "vigencia_condicao"):
            batch_op.add_column(sa.Column("vigencia_condicao", sa.Text(), nullable=True))
        if not _has_column(conn, "contrato_honorario", "arquivo_hash"):
            batch_op.add_column(sa.Column("arquivo_hash", sa.String(64), nullable=True))
        if not _has_column(conn, "contrato_honorario", "arquivo_nome"):
            batch_op.add_column(sa.Column("arquivo_nome", sa.String(255), nullable=True))
        if not _has_column(conn, "contrato_honorario", "parcelas_json"):
            batch_op.add_column(sa.Column("parcelas_json", sa.Text(), nullable=True))
        batch_op.alter_column("caso_id", existing_type=sa.Integer(), nullable=True)

    op.create_index(
        "ix_contrato_honorario_tenant_hash",
        "contrato_honorario",
        ["tenant_id", "arquivo_hash"],
        unique=True,
        postgresql_where=sa.text("arquivo_hash IS NOT NULL"),
    )


def downgrade():
    op.drop_index("ix_contrato_honorario_tenant_hash", table_name="contrato_honorario")
    with op.batch_alter_table("contrato_honorario") as batch_op:
        batch_op.alter_column("caso_id", existing_type=sa.Integer(), nullable=False)
        batch_op.drop_column("parcelas_json")
        batch_op.drop_column("arquivo_nome")
        batch_op.drop_column("arquivo_hash")
        batch_op.drop_column("vigencia_condicao")
        batch_op.drop_column("objeto")
        batch_op.drop_column("percentual_recurso")
