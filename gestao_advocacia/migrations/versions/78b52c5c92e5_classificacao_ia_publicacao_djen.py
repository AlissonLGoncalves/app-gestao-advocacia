"""epic_176_classificacao_ia_publicacao_djen

Revision ID: 78b52c5c92e5
Revises: f91e4a6a229e
Create Date: 2026-05-09 17:50:00.000000

Adiciona colunas em publicacao_djen para classificacao automatica via IA
(Gemini): importante (bool), classificado_em (datetime), classificacao_motivo
(text). NULL em todos os 3 campos significa "ainda nao classificado".

A classificacao roda em batch ao final do job_monitorar_djen e tambem
manualmente via POST /publicacoes/{id}/reclassificar.

"""

from alembic import op
import sqlalchemy as sa


revision = "78b52c5c92e5"
down_revision = "f91e4a6a229e"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("publicacao_djen") as batch_op:
        batch_op.add_column(sa.Column("importante", sa.Boolean(), nullable=True))
        batch_op.add_column(sa.Column("classificado_em", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("classificacao_motivo", sa.Text(), nullable=True))
        batch_op.create_index(
            "ix_publicacao_djen_importante",
            ["importante"],
        )


def downgrade():
    with op.batch_alter_table("publicacao_djen") as batch_op:
        batch_op.drop_index("ix_publicacao_djen_importante")
        batch_op.drop_column("classificacao_motivo")
        batch_op.drop_column("classificado_em")
        batch_op.drop_column("importante")
