"""Recebimento Robusto (Fase 1): novas colunas + tabela recorrencia + backfill.

Revision ID: a1c3e5f7b9d2
Revises: e7b9c1d2a4f5
Create Date: 2026-05-16

Mudancas:
  1. Cria tabela `recorrencia_recebimento` (config de serie recorrente/parcelada).
  2. Adiciona colunas em `recebimento`:
     - cliente_id (FK), status, data_vencimento, data_pagamento, categoria,
       forma_pagamento, notas, recorrencia_id (FK), numero_parcela.
  3. Torna `data_recebimento` nullable (era NOT NULL — agora deprecated).
  4. Backfill dos dados existentes:
     - data_vencimento <- data_recebimento (todos os registros tinham data).
     - status <- "Pago" se recebido=True, senao "Pendente".
     - data_pagamento <- data_recebimento (so para os que estavam pagos).
     - cliente_id <- caso.cliente_id (deduzido via JOIN).
     - categoria <- "Honorarios Advocaticios" (default sensato).
"""

from alembic import op
import sqlalchemy as sa


revision = "a1c3e5f7b9d2"
down_revision = "e7b9c1d2a4f5"
branch_labels = None
depends_on = None


def upgrade():
    # 1. Tabela recorrencia_recebimento
    op.create_table(
        "recorrencia_recebimento",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("tenant.id", name="fk_recorrencia_recebimento_tenant_id"),
            nullable=True,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("user.id", name="fk_recorrencia_recebimento_user_id"),
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
        sa.Column(
            "cliente_id",
            sa.Integer(),
            sa.ForeignKey("cliente.id", name="fk_recorrencia_recebimento_cliente_id"),
            nullable=True,
        ),
        sa.Column(
            "caso_id",
            sa.Integer(),
            sa.ForeignKey("caso.id", name="fk_recorrencia_recebimento_caso_id"),
            nullable=True,
        ),
        sa.Column("categoria", sa.String(length=80), nullable=True),
        sa.Column("data_criacao", sa.DateTime(), nullable=True),
    )
    op.create_index(
        "ix_recorrencia_recebimento_tenant_id",
        "recorrencia_recebimento",
        ["tenant_id"],
    )

    # 2. Adiciona colunas em recebimento
    with op.batch_alter_table("recebimento") as batch_op:
        batch_op.add_column(sa.Column("cliente_id", sa.Integer(), nullable=True))
        batch_op.add_column(
            sa.Column(
                "status",
                sa.String(length=30),
                nullable=True,
                server_default="Pendente",
            )
        )
        batch_op.add_column(sa.Column("data_vencimento", sa.Date(), nullable=True))
        batch_op.add_column(sa.Column("data_pagamento", sa.Date(), nullable=True))
        batch_op.add_column(sa.Column("categoria", sa.String(length=80), nullable=True))
        batch_op.add_column(sa.Column("forma_pagamento", sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column("notas", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("recorrencia_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("numero_parcela", sa.Integer(), nullable=True))
        # Tornar data_recebimento nullable (deprecated; novos registros podem
        # nao ter — ex: "sem vencimento" da Fase 4).
        batch_op.alter_column("data_recebimento", existing_type=sa.Date(), nullable=True)
        batch_op.create_foreign_key(
            "fk_recebimento_cliente_id",
            "cliente",
            ["cliente_id"],
            ["id"],
        )
        batch_op.create_foreign_key(
            "fk_recebimento_recorrencia_id",
            "recorrencia_recebimento",
            ["recorrencia_id"],
            ["id"],
        )
        batch_op.create_index(
            "ix_recebimento_cliente_id", ["cliente_id"]
        )
        batch_op.create_index(
            "ix_recebimento_status", ["status"]
        )
        batch_op.create_index(
            "ix_recebimento_data_vencimento", ["data_vencimento"]
        )
        batch_op.create_index(
            "ix_recebimento_recorrencia_id", ["recorrencia_id"]
        )

    # 3. Backfill — preencher novos campos com dados que ja existem.
    # Usamos SQL puro pra rodar dentro da mesma transacao da migration.
    conn = op.get_bind()

    # status <- Pago/Pendente conforme recebido
    conn.execute(
        sa.text(
            "UPDATE recebimento SET status = CASE WHEN recebido = TRUE "
            "THEN 'Pago' ELSE 'Pendente' END"
        )
    )

    # data_vencimento <- data_recebimento (todos os registros antigos tinham
    # data, pois era NOT NULL)
    conn.execute(
        sa.text("UPDATE recebimento SET data_vencimento = data_recebimento")
    )

    # data_pagamento <- data_recebimento, mas so onde estava pago
    conn.execute(
        sa.text(
            "UPDATE recebimento SET data_pagamento = data_recebimento "
            "WHERE recebido = TRUE"
        )
    )

    # cliente_id <- caso.cliente_id (deduzido via JOIN onde tem caso)
    # PostgreSQL: usar UPDATE ... FROM. SQLite/outros: subquery.
    dialect = conn.dialect.name
    if dialect == "postgresql":
        conn.execute(
            sa.text(
                "UPDATE recebimento SET cliente_id = caso.cliente_id "
                "FROM caso WHERE recebimento.caso_id = caso.id "
                "AND recebimento.cliente_id IS NULL"
            )
        )
    else:
        # SQLite / fallback generico
        conn.execute(
            sa.text(
                "UPDATE recebimento SET cliente_id = ("
                "SELECT caso.cliente_id FROM caso WHERE caso.id = recebimento.caso_id"
                ") WHERE caso_id IS NOT NULL AND cliente_id IS NULL"
            )
        )

    # categoria padrao para registros antigos sem categoria
    conn.execute(
        sa.text(
            "UPDATE recebimento SET categoria = 'Honorarios Advocaticios' "
            "WHERE categoria IS NULL"
        )
    )


def downgrade():
    with op.batch_alter_table("recebimento") as batch_op:
        batch_op.drop_index("ix_recebimento_recorrencia_id")
        batch_op.drop_index("ix_recebimento_data_vencimento")
        batch_op.drop_index("ix_recebimento_status")
        batch_op.drop_index("ix_recebimento_cliente_id")
        batch_op.drop_constraint("fk_recebimento_recorrencia_id", type_="foreignkey")
        batch_op.drop_constraint("fk_recebimento_cliente_id", type_="foreignkey")
        batch_op.alter_column("data_recebimento", existing_type=sa.Date(), nullable=False)
        batch_op.drop_column("numero_parcela")
        batch_op.drop_column("recorrencia_id")
        batch_op.drop_column("notas")
        batch_op.drop_column("forma_pagamento")
        batch_op.drop_column("categoria")
        batch_op.drop_column("data_pagamento")
        batch_op.drop_column("data_vencimento")
        batch_op.drop_column("status")
        batch_op.drop_column("cliente_id")

    op.drop_index(
        "ix_recorrencia_recebimento_tenant_id", table_name="recorrencia_recebimento"
    )
    op.drop_table("recorrencia_recebimento")
