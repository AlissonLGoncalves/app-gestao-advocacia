"""merge tarefa_prazo_posicao e onboarding heads

Revision ID: d16beacc9107
Revises: f5a6b7c8d9e0, a6b7c8d9e0f1
Create Date: 2026-04-26 11:13:01.493694

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd16beacc9107'
down_revision = ('f5a6b7c8d9e0', 'a6b7c8d9e0f1')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
