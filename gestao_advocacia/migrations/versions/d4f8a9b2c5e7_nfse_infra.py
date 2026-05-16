"""Cria tabelas config_nfse e emissao_nfse (Etapa 5 da feature Pagamentos Recebidos).

Infra para emissao on-demand de NFS-e via Portal Nacional (gov.br). Esta
fase entrega tudo com adapter mock; adapter real fica para PR seguinte.

Revision ID: d4f8a9b2c5e7
Revises: c3e5f7a9b1d4
Create Date: 2026-05-16
"""

import sqlalchemy as sa
from alembic import op

revision = "d4f8a9b2c5e7"
down_revision = "c3e5f7a9b1d4"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "config_nfse",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("tenant.id", name="fk_config_nfse_tenant_id"),
            nullable=False,
        ),
        sa.Column("cnpj_emissor", sa.String(length=20), nullable=True),
        sa.Column("inscricao_municipal", sa.String(length=30), nullable=True),
        sa.Column("razao_social", sa.String(length=200), nullable=True),
        sa.Column("municipio", sa.String(length=100), nullable=True),
        sa.Column("uf", sa.String(length=2), nullable=True),
        sa.Column("codigo_servico", sa.String(length=20), nullable=True),
        sa.Column("regime_tributario", sa.String(length=50), nullable=True),
        sa.Column("aliquota_iss", sa.Numeric(5, 2), nullable=True),
        sa.Column("ambiente", sa.String(length=20), nullable=False, server_default="sandbox"),
        sa.Column("gateway_tipo", sa.String(length=30), nullable=False, server_default="mock"),
        sa.Column(
            "tem_certificado", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("tenant_id", name="uq_config_nfse_tenant_id"),
    )
    op.create_index("ix_config_nfse_tenant_id", "config_nfse", ["tenant_id"])

    op.create_table(
        "emissao_nfse",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("tenant.id", name="fk_emissao_nfse_tenant_id"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("user.id", name="fk_emissao_nfse_user_id"),
            nullable=False,
        ),
        sa.Column(
            "recebimento_id",
            sa.Integer(),
            sa.ForeignKey("recebimento.id", name="fk_emissao_nfse_recebimento_id"),
            nullable=False,
        ),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="Pendente"),
        sa.Column("gateway_id", sa.String(length=120), nullable=True),
        sa.Column("gateway_tipo", sa.String(length=30), nullable=False, server_default="mock"),
        sa.Column("numero_nfse", sa.String(length=40), nullable=True),
        sa.Column("serie", sa.String(length=20), nullable=True),
        sa.Column("codigo_verificacao", sa.String(length=60), nullable=True),
        sa.Column("xml_url", sa.String(length=500), nullable=True),
        sa.Column("pdf_url", sa.String(length=500), nullable=True),
        sa.Column("mensagem_erro", sa.Text(), nullable=True),
        sa.Column("tentativas", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_emissao_nfse_tenant_id", "emissao_nfse", ["tenant_id"])
    op.create_index("ix_emissao_nfse_recebimento_id", "emissao_nfse", ["recebimento_id"])
    op.create_index("ix_emissao_nfse_status", "emissao_nfse", ["status"])
    op.create_index("ix_emissao_nfse_created_at", "emissao_nfse", ["created_at"])
    op.create_index(
        "ix_emissao_nfse_recebimento_status",
        "emissao_nfse",
        ["recebimento_id", "status"],
    )


def downgrade():
    op.drop_index("ix_emissao_nfse_recebimento_status", table_name="emissao_nfse")
    op.drop_index("ix_emissao_nfse_created_at", table_name="emissao_nfse")
    op.drop_index("ix_emissao_nfse_status", table_name="emissao_nfse")
    op.drop_index("ix_emissao_nfse_recebimento_id", table_name="emissao_nfse")
    op.drop_index("ix_emissao_nfse_tenant_id", table_name="emissao_nfse")
    op.drop_table("emissao_nfse")

    op.drop_index("ix_config_nfse_tenant_id", table_name="config_nfse")
    op.drop_table("config_nfse")
