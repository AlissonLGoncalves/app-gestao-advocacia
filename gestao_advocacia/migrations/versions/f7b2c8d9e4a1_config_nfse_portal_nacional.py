"""Adiciona campos do Portal Nacional NFS-e em config_nfse (Etapa 5.6.1).

Campos para suportar adapter real do Portal Nacional (gov.br):
- URLs base configuraveis por ambiente
- Codigo IBGE do municipio do prestador
- Numeracao sequencial da DPS (serie + numero)

Revision ID: f7b2c8d9e4a1
Revises: e5a9b3c4d6f8
Create Date: 2026-05-17
"""

import sqlalchemy as sa
from alembic import op

revision = "f7b2c8d9e4a1"
down_revision = "e5a9b3c4d6f8"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "config_nfse",
        sa.Column("nfse_base_url_homologacao", sa.String(length=300), nullable=True),
    )
    op.add_column(
        "config_nfse",
        sa.Column("nfse_base_url_producao", sa.String(length=300), nullable=True),
    )
    op.add_column(
        "config_nfse",
        sa.Column("codigo_municipio_ibge", sa.String(length=10), nullable=True),
    )
    op.add_column(
        "config_nfse",
        sa.Column("nfse_serie_atual", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column(
        "config_nfse",
        sa.Column("nfse_numero_atual", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade():
    op.drop_column("config_nfse", "nfse_numero_atual")
    op.drop_column("config_nfse", "nfse_serie_atual")
    op.drop_column("config_nfse", "codigo_municipio_ibge")
    op.drop_column("config_nfse", "nfse_base_url_producao")
    op.drop_column("config_nfse", "nfse_base_url_homologacao")
