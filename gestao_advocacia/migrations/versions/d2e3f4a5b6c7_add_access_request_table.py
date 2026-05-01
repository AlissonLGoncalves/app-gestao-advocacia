"""add access_request table (issue #112 v2)

Tabela para coletar solicitacoes de acesso a beta privada via
landing page /solicitar-acesso. Superadmin revisa em
/admin/v1/access-requests e aprova (gera invite token) ou rejeita.

Categoria C — sem tenant_id, sem RLS. Acesso so via admin_session
(endpoint publico de criacao usa admin escape; endpoints admin
requerem role superadmin).

Revision ID: d2e3f4a5b6c7
Revises: c1d2e3f4a5b6
Create Date: 2026-05-01 02:35:00.000000
"""

import sqlalchemy as sa
from alembic import op

revision = "d2e3f4a5b6c7"
down_revision = "c1d2e3f4a5b6"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "access_request",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nome", sa.String(length=200), nullable=False),
        sa.Column("email", sa.String(length=120), nullable=False),
        sa.Column("oab", sa.String(length=30), nullable=True),
        sa.Column("sigla_oab", sa.String(length=10), nullable=True),
        sa.Column("telefone", sa.String(length=30), nullable=True),
        sa.Column("escritorio", sa.String(length=200), nullable=True),
        sa.Column("mensagem", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("motivo_rejeicao", sa.String(length=500), nullable=True),
        sa.Column("ip", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("criado_em", sa.DateTime(), nullable=False),
        sa.Column("processado_em", sa.DateTime(), nullable=True),
        sa.Column("processado_por_user_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["processado_por_user_id"],
            ["user.id"],
            name="fk_access_request_processado_por_user_id",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_access_request_email", "access_request", ["email"], unique=False)
    op.create_index("ix_access_request_status", "access_request", ["status"], unique=False)
    op.create_index("ix_access_request_criado_em", "access_request", ["criado_em"], unique=False)


def downgrade():
    op.drop_index("ix_access_request_criado_em", table_name="access_request")
    op.drop_index("ix_access_request_status", table_name="access_request")
    op.drop_index("ix_access_request_email", table_name="access_request")
    op.drop_table("access_request")
