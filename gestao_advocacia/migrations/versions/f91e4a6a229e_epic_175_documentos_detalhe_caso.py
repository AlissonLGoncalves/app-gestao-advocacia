"""epic_175_documentos_detalhe_caso

Revision ID: f91e4a6a229e
Revises: d0e1f2a3b4c5
Create Date: 2026-05-09 14:15:55.512777

Adiciona suporte a viewer + download de procuracoes/contratos no detalhe do caso:
- procuracao_analise.cliente_id (FK nullable) — vinculo da procuracao ao cliente
- procuracao_analise.caso_id (FK nullable) — vinculo opcional ao caso
- contrato_honorario.arquivo_path (nullable) — caminho do PDF persistido em disco

Os 21 contratos atuais nao tem PDF persistido (so dados extraidos), entao
arquivo_path fica NULL e a UI mostra badge 'PDF nao anexado'.

"""

from alembic import op
import sqlalchemy as sa

revision = "f91e4a6a229e"
down_revision = "d0e1f2a3b4c5"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("procuracao_analise") as batch_op:
        batch_op.add_column(sa.Column("cliente_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("caso_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_procuracao_analise_cliente_id",
            "cliente",
            ["cliente_id"],
            ["id"],
        )
        batch_op.create_foreign_key(
            "fk_procuracao_analise_caso_id",
            "caso",
            ["caso_id"],
            ["id"],
        )
        batch_op.create_index(
            "ix_procuracao_analise_cliente_id",
            ["cliente_id"],
        )
        batch_op.create_index(
            "ix_procuracao_analise_caso_id",
            ["caso_id"],
        )

    with op.batch_alter_table("contrato_honorario") as batch_op:
        batch_op.add_column(sa.Column("arquivo_path", sa.String(length=500), nullable=True))


def downgrade():
    with op.batch_alter_table("contrato_honorario") as batch_op:
        batch_op.drop_column("arquivo_path")

    with op.batch_alter_table("procuracao_analise") as batch_op:
        batch_op.drop_index("ix_procuracao_analise_caso_id")
        batch_op.drop_index("ix_procuracao_analise_cliente_id")
        batch_op.drop_constraint("fk_procuracao_analise_caso_id", type_="foreignkey")
        batch_op.drop_constraint("fk_procuracao_analise_cliente_id", type_="foreignkey")
        batch_op.drop_column("caso_id")
        batch_op.drop_column("cliente_id")
