"""merge_expand_sigla_and_consentimento

Merge das duas branches:
- e4f5a6b7c8d9 (expand_sigla_tribunal_on_djen_oab)  
- d3e4f5a6b7c8 (add_consentimento_usuario)

Revision ID: b2c3d4e5f6a7
Revises: e4f5a6b7c8d9, d3e4f5a6b7c8
Create Date: 2026-04-21 15:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b2c3d4e5f6a7'
down_revision = ('e4f5a6b7c8d9', 'd3e4f5a6b7c8')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
