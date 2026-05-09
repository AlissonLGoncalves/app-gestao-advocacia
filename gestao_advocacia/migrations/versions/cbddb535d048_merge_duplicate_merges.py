"""merge_duplicate_merges

Revision ID: cbddb535d048
Revises: 240a00ab4f74, 08adffd51be1
Create Date: 2026-05-09 19:55:00.000000

Mais um merge migration. Aconteceu o seguinte: Epic #8 (#195) e Epic #9
(#196) mergearam em paralelo a partir de a0e85cd69f97, criando 2 heads.
Cada sessão (B em #197 e A em outro PR) criou independentemente uma
migration de merge resolvendo esses 2 heads — `240a00ab4f74` e
`08adffd51be1`. Resultado: agora os 2 merges são novos heads paralelos.

Esta migration costura os 2 merges. Não modifica schema.

Lição registrada em .claude/COWORK.md: ao fazer merge migration, validar
que outra sessão não criou merge equivalente em paralelo.
"""

from alembic import op  # noqa: F401


revision = "cbddb535d048"
down_revision = ("240a00ab4f74", "08adffd51be1")
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
