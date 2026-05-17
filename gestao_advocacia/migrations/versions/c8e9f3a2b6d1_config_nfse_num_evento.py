"""Adiciona nfse_num_evento_atual em config_nfse (Etapa 5.6.6.3).

Contador sequencial de pedidos de registro de evento (cancelamento,
substituicao etc) — vai pro campo nPedRegEvento do XML.

Revision ID: c8e9f3a2b6d1
Revises: b9d5e8f1a2c4
Create Date: 2026-05-17
"""

import sqlalchemy as sa
from alembic import op

revision = "c8e9f3a2b6d1"
down_revision = "b9d5e8f1a2c4"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "config_nfse",
        sa.Column(
            "nfse_num_evento_atual",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )


def downgrade():
    op.drop_column("config_nfse", "nfse_num_evento_atual")
