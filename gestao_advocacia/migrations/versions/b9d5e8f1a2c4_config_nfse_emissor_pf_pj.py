"""Suporte a emissor PF ou PJ na ConfigNFSe (Etapa 5.6.5).

Adiciona tipo_pessoa_emissor + documento_emissor. Copia cnpj_emissor
existente pra documento_emissor (todos os tenants atuais sao tratados
como PJ por retrocompat).

Revision ID: b9d5e8f1a2c4
Revises: a8c4d5e6f9b3
Create Date: 2026-05-17
"""

import sqlalchemy as sa
from alembic import op

revision = "b9d5e8f1a2c4"
down_revision = "a8c4d5e6f9b3"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "config_nfse",
        sa.Column(
            "tipo_pessoa_emissor",
            sa.String(length=2),
            nullable=False,
            server_default="PJ",
        ),
    )
    op.add_column(
        "config_nfse",
        sa.Column("documento_emissor", sa.String(length=20), nullable=True),
    )
    # Migracao de dados: copia cnpj_emissor pra documento_emissor pra
    # configs ja existentes (todas eram PJ no esquema antigo).
    op.execute(
        "UPDATE config_nfse SET documento_emissor = cnpj_emissor "
        "WHERE cnpj_emissor IS NOT NULL AND documento_emissor IS NULL"
    )


def downgrade():
    op.drop_column("config_nfse", "documento_emissor")
    op.drop_column("config_nfse", "tipo_pessoa_emissor")
