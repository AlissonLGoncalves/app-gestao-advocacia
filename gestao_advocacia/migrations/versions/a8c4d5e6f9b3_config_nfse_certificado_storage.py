"""Storage criptografado do certificado A1 em config_nfse (Etapa 5.6.2).

Adiciona colunas para guardar o certificado .pfx criptografado com
Fernet (cryptography), a senha do .pfx tambem criptografada, e
metadados extraidos no upload (titular, validade).

Revision ID: a8c4d5e6f9b3
Revises: f7b2c8d9e4a1
Create Date: 2026-05-17
"""

import sqlalchemy as sa
from alembic import op

revision = "a8c4d5e6f9b3"
down_revision = "f7b2c8d9e4a1"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "config_nfse",
        sa.Column("certificado_pfx_encrypted", sa.LargeBinary(), nullable=True),
    )
    op.add_column(
        "config_nfse",
        sa.Column("certificado_senha_encrypted", sa.LargeBinary(), nullable=True),
    )
    op.add_column(
        "config_nfse",
        sa.Column("certificado_nome_titular", sa.String(length=300), nullable=True),
    )
    op.add_column(
        "config_nfse",
        sa.Column("certificado_valido_ate", sa.Date(), nullable=True),
    )


def downgrade():
    op.drop_column("config_nfse", "certificado_valido_ate")
    op.drop_column("config_nfse", "certificado_nome_titular")
    op.drop_column("config_nfse", "certificado_senha_encrypted")
    op.drop_column("config_nfse", "certificado_pfx_encrypted")
