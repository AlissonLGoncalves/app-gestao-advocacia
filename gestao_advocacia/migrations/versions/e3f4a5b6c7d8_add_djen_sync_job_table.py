"""add djen_sync_job table (B1 do roteiro)

Fila persistente de jobs de sincronizacao DJEN. Endpoint POST /djen/sync
enfileira (status=pending) + retorna 202; processo djen-worker pega FOR
UPDATE SKIP LOCKED + processa.

Categoria C (sem RLS) — worker opera cross-tenant; tenant_id e coluna
de dado, nao filtro de policy.

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
Create Date: 2026-05-01 14:00:00.000000
"""

import sqlalchemy as sa
from alembic import op

revision = "e3f4a5b6c7d8"
down_revision = "d2e3f4a5b6c7"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "djen_sync_job",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("lookback_days", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("resumo", sa.JSON(), nullable=True),
        sa.Column("erro", sa.Text(), nullable=True),
        sa.Column("criado_em", sa.DateTime(), nullable=False),
        sa.Column("iniciado_em", sa.DateTime(), nullable=True),
        sa.Column("concluido_em", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenant.id"], name="fk_djen_sync_job_tenant_id"),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], name="fk_djen_sync_job_user_id"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_djen_sync_job_tenant_id", "djen_sync_job", ["tenant_id"])
    op.create_index("ix_djen_sync_job_status", "djen_sync_job", ["status"])
    op.create_index("ix_djen_sync_job_criado_em", "djen_sync_job", ["criado_em"])
    # Indice composto para a query do worker: pegar pending mais antigos primeiro
    op.create_index(
        "ix_djen_sync_job_status_criado",
        "djen_sync_job",
        ["status", "criado_em"],
    )


def downgrade():
    op.drop_index("ix_djen_sync_job_status_criado", table_name="djen_sync_job")
    op.drop_index("ix_djen_sync_job_criado_em", table_name="djen_sync_job")
    op.drop_index("ix_djen_sync_job_status", table_name="djen_sync_job")
    op.drop_index("ix_djen_sync_job_tenant_id", table_name="djen_sync_job")
    op.drop_table("djen_sync_job")
