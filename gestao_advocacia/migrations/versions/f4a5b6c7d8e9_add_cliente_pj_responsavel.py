"""add representante legal (PJ) ao cliente: responsavel_nome/cpf/cargo

Pessoa fisica que assina procuracoes em nome da empresa cliente. Sem isso,
para PJ falta o vinculo com a pessoa que de fato representa a entidade
juridicamente.

Revision ID: f4a5b6c7d8e9
Revises: 95fd9fcb32b4
Create Date: 2026-05-01 17:00:00.000000
"""

import sqlalchemy as sa
from alembic import op

revision = "f4a5b6c7d8e9"
down_revision = "95fd9fcb32b4"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("cliente") as batch:
        batch.add_column(sa.Column("responsavel_nome", sa.String(length=200), nullable=True))
        batch.add_column(sa.Column("responsavel_cpf", sa.String(length=14), nullable=True))
        batch.add_column(sa.Column("responsavel_cargo", sa.String(length=100), nullable=True))


def downgrade():
    with op.batch_alter_table("cliente") as batch:
        batch.drop_column("responsavel_cargo")
        batch.drop_column("responsavel_cpf")
        batch.drop_column("responsavel_nome")
