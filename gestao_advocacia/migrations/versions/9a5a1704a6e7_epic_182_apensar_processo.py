"""epic_182_apensar_processo

Revision ID: 9a5a1704a6e7
Revises: 78b52c5c92e5
Create Date: 2026-05-09 15:28:18.578383

Adiciona suporte a apensar processos (Astrea-like): um Caso pode apontar
para outro Caso "principal" via caso_principal_id (self-FK). Casos sem
caso_principal_id sao independentes (a maioria). Casos com FK preenchida
sao apensos ao caso indicado.

Mantemos o campo `instancia` (string ja existente) — alterar instancia
e apenas um update desse campo via PATCH endpoint.

"""

from alembic import op
import sqlalchemy as sa

revision = "9a5a1704a6e7"
down_revision = "a0e85cd69f97"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("caso") as batch_op:
        batch_op.add_column(sa.Column("caso_principal_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_caso_caso_principal_id",
            "caso",
            ["caso_principal_id"],
            ["id"],
        )
        batch_op.create_index(
            "ix_caso_caso_principal_id",
            ["caso_principal_id"],
        )


def downgrade():
    with op.batch_alter_table("caso") as batch_op:
        batch_op.drop_index("ix_caso_caso_principal_id")
        batch_op.drop_constraint("fk_caso_caso_principal_id", type_="foreignkey")
        batch_op.drop_column("caso_principal_id")
