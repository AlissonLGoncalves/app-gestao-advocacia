"""Despesa Robusto (Fase 1): novas colunas + tabela recorrencia_despesa + backfill.

Revision ID: b2d4f6a8c0e1
Revises: a1c3e5f7b9d2
Create Date: 2026-05-16

Espelha estruturalmente a migration do Recebimento Robusto (a1c3e5f7b9d2).
Mudancas:
  1. Cria tabela `recorrencia_despesa`.
  2. Adiciona em `despesa`: cliente_id, status, data_vencimento, data_pagamento,
     categoria, forma_pagamento, notas, fornecedor, recorrencia_id, numero_parcela.
  3. Torna `data_despesa` nullable (deprecated).
  4. Backfill: data_vencimento <- data_despesa; status <- Pago/Pendente;
     data_pagamento <- data_despesa WHERE pago=TRUE; categoria default
     "Despesa Operacional".
"""

import sqlalchemy as sa
from alembic import op

revision = "b2d4f6a8c0e1"
down_revision = "a1c3e5f7b9d2"
branch_labels = None
depends_on = None


def upgrade():
    # 1. Tabela recorrencia_despesa
    op.create_table(
        "recorrencia_despesa",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("tenant.id", name="fk_recorrencia_despesa_tenant_id"),
            nullable=True,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("user.id", name="fk_recorrencia_despesa_user_id"),
            nullable=False,
        ),
        sa.Column("tipo", sa.String(length=20), nullable=False),
        sa.Column("frequencia", sa.String(length=20), nullable=True),
        sa.Column("valor_parcela", sa.Numeric(10, 2), nullable=False),
        sa.Column("total_parcelas", sa.Integer(), nullable=True),
        sa.Column("data_inicio", sa.Date(), nullable=False),
        sa.Column("data_fim", sa.Date(), nullable=True),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("descricao", sa.String(length=200), nullable=True),
        sa.Column("fornecedor", sa.String(length=200), nullable=True),
        sa.Column(
            "caso_id",
            sa.Integer(),
            sa.ForeignKey("caso.id", name="fk_recorrencia_despesa_caso_id"),
            nullable=True,
        ),
        sa.Column(
            "cliente_id",
            sa.Integer(),
            sa.ForeignKey("cliente.id", name="fk_recorrencia_despesa_cliente_id"),
            nullable=True,
        ),
        sa.Column("categoria", sa.String(length=80), nullable=True),
        sa.Column("data_criacao", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_recorrencia_despesa_tenant_id", "recorrencia_despesa", ["tenant_id"])

    # 2. Colunas em despesa
    with op.batch_alter_table("despesa") as batch_op:
        batch_op.add_column(sa.Column("cliente_id", sa.Integer(), nullable=True))
        batch_op.add_column(
            sa.Column("status", sa.String(length=30), nullable=True, server_default="Pendente")
        )
        batch_op.add_column(sa.Column("data_vencimento", sa.Date(), nullable=True))
        batch_op.add_column(sa.Column("data_pagamento", sa.Date(), nullable=True))
        batch_op.add_column(sa.Column("categoria", sa.String(length=80), nullable=True))
        batch_op.add_column(sa.Column("forma_pagamento", sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column("notas", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("fornecedor", sa.String(length=200), nullable=True))
        batch_op.add_column(sa.Column("recorrencia_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("numero_parcela", sa.Integer(), nullable=True))
        batch_op.alter_column("data_despesa", existing_type=sa.Date(), nullable=True)
        batch_op.create_foreign_key("fk_despesa_cliente_id", "cliente", ["cliente_id"], ["id"])
        batch_op.create_foreign_key(
            "fk_despesa_recorrencia_id",
            "recorrencia_despesa",
            ["recorrencia_id"],
            ["id"],
        )
        batch_op.create_index("ix_despesa_cliente_id", ["cliente_id"])
        batch_op.create_index("ix_despesa_status", ["status"])
        batch_op.create_index("ix_despesa_data_vencimento", ["data_vencimento"])
        batch_op.create_index("ix_despesa_recorrencia_id", ["recorrencia_id"])

    # 3. Backfill — preencher novos campos com dados existentes
    conn = op.get_bind()
    conn.execute(
        sa.text("UPDATE despesa SET status = CASE WHEN pago = TRUE THEN 'Pago' ELSE 'Pendente' END")
    )
    conn.execute(sa.text("UPDATE despesa SET data_vencimento = data_despesa"))
    conn.execute(sa.text("UPDATE despesa SET data_pagamento = data_despesa WHERE pago = TRUE"))
    conn.execute(
        sa.text("UPDATE despesa SET categoria = 'Despesa Operacional' WHERE categoria IS NULL")
    )


def downgrade():
    with op.batch_alter_table("despesa") as batch_op:
        batch_op.drop_index("ix_despesa_recorrencia_id")
        batch_op.drop_index("ix_despesa_data_vencimento")
        batch_op.drop_index("ix_despesa_status")
        batch_op.drop_index("ix_despesa_cliente_id")
        batch_op.drop_constraint("fk_despesa_recorrencia_id", type_="foreignkey")
        batch_op.drop_constraint("fk_despesa_cliente_id", type_="foreignkey")
        batch_op.alter_column("data_despesa", existing_type=sa.Date(), nullable=False)
        batch_op.drop_column("numero_parcela")
        batch_op.drop_column("recorrencia_id")
        batch_op.drop_column("fornecedor")
        batch_op.drop_column("notas")
        batch_op.drop_column("forma_pagamento")
        batch_op.drop_column("categoria")
        batch_op.drop_column("data_pagamento")
        batch_op.drop_column("data_vencimento")
        batch_op.drop_column("status")
        batch_op.drop_column("cliente_id")

    op.drop_index("ix_recorrencia_despesa_tenant_id", table_name="recorrencia_despesa")
    op.drop_table("recorrencia_despesa")
