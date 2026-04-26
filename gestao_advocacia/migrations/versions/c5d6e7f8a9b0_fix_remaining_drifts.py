"""fix remaining schema drifts: cliente.email constraint + login_audit.criado_em NULL

Resolve issue #106. Alinha o schema do Postgres ao modelo SQLAlchemy:

1. cliente.email_key: prod tem UNIQUE constraint mas modelo nao declara
   unique=True. Cliente em escritorio juridico pode compartilhar email
   (familia, mesma empresa, dominio generico). Drop a constraint.

2. login_audit.criado_em: prod e NOT NULL mas modelo nao declara
   nullable=False. Alembic detecta drift toda vez. Alterar prod para
   NULL-able alinha com modelo (default=datetime.utcnow do Python
   continua aplicando em INSERTs via SQLAlchemy).

Idempotente via inspector — no-op se ja canonico. Compativel SQLite +
Postgres via batch_alter_table.

Pre-requisitos para release_command (app_admin):
- cliente owned por app_admin (transferido na Fase 2)
- login_audit owned por app_admin (transferido na Fase 2)
- GRANT CREATE ON SCHEMA public TO app_admin (concedido apos PR #105)

Revision ID: c5d6e7f8a9b0
Revises: b4c5d6e7f8a9
Create Date: 2026-04-26 19:15:00.000000

"""

import sqlalchemy as sa
from alembic import op

revision = "c5d6e7f8a9b0"
down_revision = "b4c5d6e7f8a9"
branch_labels = None
depends_on = None


_CLIENTE_EMAIL_CONSTRAINT = "cliente_email_key"


def _cliente_has_email_unique_constraint(bind):
    inspector = sa.inspect(bind)
    constraints = {uc["name"] for uc in inspector.get_unique_constraints("cliente")}
    return _CLIENTE_EMAIL_CONSTRAINT in constraints


def _login_audit_criado_em_is_nullable(bind):
    inspector = sa.inspect(bind)
    cols = {c["name"]: c for c in inspector.get_columns("login_audit")}
    col = cols.get("criado_em")
    if col is None:
        return None  # coluna nao existe — ignora silenciosamente
    return bool(col.get("nullable"))


def upgrade():
    bind = op.get_bind()

    # Drift 1: drop UNIQUE constraint cliente_email_key
    if _cliente_has_email_unique_constraint(bind):
        with op.batch_alter_table("cliente", schema=None) as batch_op:
            batch_op.drop_constraint(_CLIENTE_EMAIL_CONSTRAINT, type_="unique")

    # Drift 2: tornar login_audit.criado_em NULL-able
    is_nullable = _login_audit_criado_em_is_nullable(bind)
    if is_nullable is False:  # explicit False (None = coluna inexistente, skip)
        with op.batch_alter_table("login_audit", schema=None) as batch_op:
            batch_op.alter_column(
                "criado_em",
                existing_type=sa.DateTime(),
                nullable=True,
            )


def downgrade():
    bind = op.get_bind()

    # Reverte drift 2: tornar criado_em NOT NULL de novo
    is_nullable = _login_audit_criado_em_is_nullable(bind)
    if is_nullable is True:
        with op.batch_alter_table("login_audit", schema=None) as batch_op:
            batch_op.alter_column(
                "criado_em",
                existing_type=sa.DateTime(),
                nullable=False,
            )

    # Reverte drift 1: recria UNIQUE constraint
    if not _cliente_has_email_unique_constraint(bind):
        with op.batch_alter_table("cliente", schema=None) as batch_op:
            batch_op.create_unique_constraint(_CLIENTE_EMAIL_CONSTRAINT, ["email"])
