"""Adiciona ano_previsao e tipo_recebimento ao Recebimento (Etapa 6).

Campos solicitados pelo Emerson via WhatsApp: previsao de ano de
recebimento (precatorio/RPV demoram anos sem data exata) e tipo de
recebimento (fonte/meio: Precatorio, RPV, Diretamente do cliente,
Deposito judicial, Acordo extrajudicial, Outros).

Revision ID: e5a9b3c4d6f8
Revises: d4f8a9b2c5e7
Create Date: 2026-05-16
"""

import sqlalchemy as sa
from alembic import op

revision = "e5a9b3c4d6f8"
down_revision = "d4f8a9b2c5e7"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("recebimento", sa.Column("ano_previsao", sa.Integer(), nullable=True))
    op.add_column(
        "recebimento", sa.Column("tipo_recebimento", sa.String(length=50), nullable=True)
    )
    op.create_index("ix_recebimento_ano_previsao", "recebimento", ["ano_previsao"])
    op.create_index("ix_recebimento_tipo_recebimento", "recebimento", ["tipo_recebimento"])


def downgrade():
    op.drop_index("ix_recebimento_tipo_recebimento", table_name="recebimento")
    op.drop_index("ix_recebimento_ano_previsao", table_name="recebimento")
    op.drop_column("recebimento", "tipo_recebimento")
    op.drop_column("recebimento", "ano_previsao")
