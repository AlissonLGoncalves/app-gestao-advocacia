"""add procuracao analise table

Revision ID: c1a2b3c4d5e6
Revises: d3e4f5a6b7c8
Create Date: 2026-04-20 10:00:00.000000
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "c1a2b3c4d5e6"
down_revision = "d3e4f5a6b7c8"
branch_labels = None
depends_on = None


procuracao_status_enum = sa.Enum(
    "pending", "processing", "done", "failed", name="procuracao_analise_status"
)

# Versão para uso nas Colunas que NÃO tenta criar/dropar o tipo (já criado manualmente abaixo).
# Usamos o ENUM do dialeto postgresql, que suporta create_type=False.
procuracao_status_enum_col = postgresql.ENUM(
    "pending",
    "processing",
    "done",
    "failed",
    name="procuracao_analise_status",
    create_type=False,
)


def upgrade():
    bind = op.get_bind()
    # Cria o ENUM apenas se ainda não existe (idempotente via pg_type).
    # Alguns deploys falhos anteriores podem ter deixado o tipo criado; checkfirst=True
    # às vezes não é confiável dentro de transações abortadas, então usamos uma checagem explícita.
    existe = bind.execute(
        sa.text(
            "SELECT 1 FROM pg_type WHERE typname = 'procuracao_analise_status'"
        )
    ).scalar()
    if not existe:
        procuracao_status_enum.create(bind, checkfirst=False)
    op.create_table(
        "procuracao_analise",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("arquivo_path", sa.String(length=500), nullable=False),
        sa.Column("arquivo_hash", sa.String(length=64), nullable=False),
        sa.Column("status", procuracao_status_enum_col, nullable=False),
        sa.Column("dados_extraidos", sa.JSON(), nullable=True),
        sa.Column("erro", sa.Text(), nullable=True),
        sa.Column("criado_em", sa.DateTime(), nullable=False),
        sa.Column("processado_em", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["tenant_id"], ["tenant.id"], name="fk_procuracao_analise_tenant_id"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], name="fk_procuracao_analise_user_id"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_procuracao_analise_tenant_status",
        "procuracao_analise",
        ["tenant_id", "status"],
        unique=False,
    )


def downgrade():
    op.drop_index("ix_procuracao_analise_tenant_status", table_name="procuracao_analise")
    op.drop_table("procuracao_analise")
    bind = op.get_bind()
    procuracao_status_enum.drop(bind, checkfirst=True)
