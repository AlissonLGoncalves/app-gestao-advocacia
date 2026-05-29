"""Adiciona user.notif_email_vencimentos (opt-in de e-mail de vencimento, N3).

Revision ID: d6f8a0b2c4e7
Revises: f5a2b8c9d4e6
Create Date: 2026-05-29

Default TRUE (opt-out): usuarios existentes recebem os avisos por e-mail
ate desligarem em /perfil. As notificacoes in-app independem desta flag.
"""

import sqlalchemy as sa
from alembic import op

revision = "d6f8a0b2c4e7"
down_revision = "f5a2b8c9d4e6"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("user") as batch_op:
        batch_op.add_column(
            sa.Column(
                "notif_email_vencimentos",
                sa.Boolean(),
                nullable=False,
                server_default=sa.true(),
            )
        )


def downgrade():
    with op.batch_alter_table("user") as batch_op:
        batch_op.drop_column("notif_email_vencimentos")
