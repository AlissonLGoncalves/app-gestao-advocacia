"""fix password_reset_token schema drift (issue 99)

Alinha o schema real ao modelo Python: dropa UNIQUE CONSTRAINT
"uq_password_reset_token_hash" e substitui o INDEX nao-unico
"ix_password_reset_token_token_hash" por um INDEX unico.

Problema: a migration original (f2a3b4c5d6e7) criou simultaneamente
uma UNIQUE constraint e um INDEX nao-unico para a coluna token_hash.
O modelo SQLAlchemy declara `unique=True, index=True` — semantica de
um unico INDEX UNIQUE. Resultado: --autogenerate detecta drift toda
vez que rodado.

Idempotente: se o estado canonico ja esta presente (unique index e
sem unique constraint), no-op. Funciona tanto em SQLite (dev local)
quanto em Postgres (prod) via batch_alter_table.

Revision ID: b4c5d6e7f8a9
Revises: a3b4c5d6e7f8
Create Date: 2026-04-26 19:30:00.000000

"""

import sqlalchemy as sa
from alembic import op

revision = "b4c5d6e7f8a9"
down_revision = "a3b4c5d6e7f8"
branch_labels = None
depends_on = None


_TABLE = "password_reset_token"
_INDEX = "ix_password_reset_token_token_hash"
_CONSTRAINT = "uq_password_reset_token_hash"


def _inspect_state(bind):
    inspector = sa.inspect(bind)
    indexes = {idx["name"]: idx for idx in inspector.get_indexes(_TABLE)}
    constraints = {uc["name"] for uc in inspector.get_unique_constraints(_TABLE)}
    has_unique_index = bool(indexes.get(_INDEX, {}).get("unique"))
    has_unique_constraint = _CONSTRAINT in constraints
    return has_unique_index, has_unique_constraint


def upgrade():
    bind = op.get_bind()
    has_unique_index, has_unique_constraint = _inspect_state(bind)

    if has_unique_index and not has_unique_constraint:
        return

    with op.batch_alter_table(_TABLE, schema=None) as batch_op:
        if has_unique_constraint:
            batch_op.drop_constraint(_CONSTRAINT, type_="unique")
        batch_op.drop_index(_INDEX)
        batch_op.create_index(_INDEX, ["token_hash"], unique=True)


def downgrade():
    bind = op.get_bind()
    has_unique_index, has_unique_constraint = _inspect_state(bind)

    if not has_unique_index and has_unique_constraint:
        return

    with op.batch_alter_table(_TABLE, schema=None) as batch_op:
        batch_op.drop_index(_INDEX)
        batch_op.create_index(_INDEX, ["token_hash"], unique=False)
        batch_op.create_unique_constraint(_CONSTRAINT, ["token_hash"])
