"""caso_prioridade

Revision ID: e7b9c1d2a4f5
Revises: d4f7b1a3c2e8
Create Date: 2026-05-11 16:30:00.000000

Epico 4 do roadmap UX cockpit: adiciona campo prioridade ao Caso.
TarefaPrazo ja tem prioridade desde 2c0abaea2600; agora Caso herda o
mesmo conceito para permitir triagem visual nos cards via CardMeta
(Epico 1).

Valores: 'Urgente', 'Alta', 'Normal', 'Baixa'. Default 'Normal' pra
registros existentes (sem perda de sinal — quem precisar marcar
urgencia atualiza explicitamente).
"""

from alembic import op
import sqlalchemy as sa

revision = "e7b9c1d2a4f5"
down_revision = "d4f7b1a3c2e8"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("caso") as batch_op:
        batch_op.add_column(
            sa.Column(
                "prioridade",
                sa.String(length=20),
                nullable=False,
                server_default="Normal",
            )
        )


def downgrade():
    with op.batch_alter_table("caso") as batch_op:
        batch_op.drop_column("prioridade")
