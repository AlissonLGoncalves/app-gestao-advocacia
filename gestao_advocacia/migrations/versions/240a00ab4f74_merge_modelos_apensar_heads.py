"""merge_modelos_apensar_heads

Revision ID: 240a00ab4f74
Revises: bb78e553a458, 9a5a1704a6e7
Create Date: 2026-05-09 19:18:00.000000

Merge migration: Epic #8 (#195 — apensar processo, revision 9a5a1704a6e7) e
Epic #9 (#196 — modelos de documento, revision bb78e553a458) foram mergeados
em paralelo a partir do mesmo down_revision (a0e85cd69f97). Sem essa
migration de merge, alembic detecta "Multiple head revisions" e quebra o
deploy. Esta migration não modifica schema — só costura os dois heads.

"""

from alembic import op  # noqa: F401


revision = "240a00ab4f74"
down_revision = ("bb78e553a458", "9a5a1704a6e7")
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
