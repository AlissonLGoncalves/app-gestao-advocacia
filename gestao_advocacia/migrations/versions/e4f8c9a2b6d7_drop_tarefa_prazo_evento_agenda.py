"""Drop tabelas legadas tarefa_prazo + evento_agenda + colunas legacy_*_id (PR D4.4).

Fase final do refator D (Expand → Migrate → Contract):
  - D1: tabela item_agenda criada paralela
  - D2: backfill + dual-write
  - D3: frontend migrado pra /v1/itens-agenda
  - D4.1-3: backend migrado, rotas /tarefas e /eventos removidas
  - D4.4 (este): dropa as tabelas fisicas + colunas de rastreio

Tabelas dropadas:
  - tarefa_prazo (76 registros no tenant 2 ja migrados pra item_agenda
    via backfill em prod em 2026-05-17)
  - evento_agenda (vazia em prod)

Colunas removidas de item_agenda:
  - legacy_tarefa_id (apontava pra tarefa_prazo.id durante a transicao)
  - legacy_evento_id (idem pra evento_agenda.id)

REVERSÃO: O downgrade re-cria as tabelas vazias mas NÃO restaura os
dados — eles foram migrados pra item_agenda e estao seguros la. Em
caso de necessidade, rode um script que repopule tarefa_prazo a
partir de item_agenda(tipo='tarefa').

Revision ID: e4f8c9a2b6d7
Revises: d1a2b3c4e5f6
Create Date: 2026-05-17
"""

import sqlalchemy as sa
from alembic import op

revision = "e4f8c9a2b6d7"
down_revision = "d1a2b3c4e5f6"
branch_labels = None
depends_on = None


def upgrade():
    # 1. Drop indices das colunas legacy_*_id antes de droppar as colunas
    with op.batch_alter_table("item_agenda") as batch:
        batch.drop_index("ix_item_agenda_legacy_tarefa_id")
        batch.drop_index("ix_item_agenda_legacy_evento_id")
        batch.drop_column("legacy_tarefa_id")
        batch.drop_column("legacy_evento_id")

    # 2. Drop tabela tarefa_prazo (com seus indices/FKs)
    op.drop_index("ix_tarefa_prazo_prazo_validado", table_name="tarefa_prazo")
    op.drop_index("ix_tarefa_prazo_tenant_status_posicao", table_name="tarefa_prazo")
    op.drop_index("ix_tarefa_prazo_tenant_created", table_name="tarefa_prazo")
    op.drop_table("tarefa_prazo")

    # 3. Drop tabela evento_agenda
    op.drop_index("ix_evento_agenda_tenant_created", table_name="evento_agenda")
    op.drop_table("evento_agenda")


def downgrade():
    # Re-cria evento_agenda (vazia)
    op.create_table(
        "evento_agenda",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("tenant.id", name="fk_evento_tenant_id"),
            nullable=True,
        ),
        sa.Column("titulo", sa.String(length=100), nullable=False),
        sa.Column("data_inicio", sa.DateTime(), nullable=False),
        sa.Column("data_fim", sa.DateTime(), nullable=True),
        sa.Column("descricao", sa.Text(), nullable=True),
        sa.Column("tipo_evento", sa.String(length=50), nullable=True, server_default="Outros"),
        sa.Column("prioridade", sa.String(length=30), nullable=True, server_default="Normal"),
        sa.Column("status_evento", sa.String(length=30), nullable=True, server_default="Pendente"),
        sa.Column("notificacoes_enviadas", sa.JSON(), nullable=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("user.id", name="fk_evento_user_id"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_evento_agenda_tenant_created", "evento_agenda", ["tenant_id", "data_inicio"]
    )

    # Re-cria tarefa_prazo (vazia)
    op.create_table(
        "tarefa_prazo",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("tenant.id", name="fk_tarefaprazo_tenant_id"),
            nullable=True,
        ),
        sa.Column("titulo", sa.String(length=250), nullable=False),
        sa.Column("descricao", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=True, server_default="A Fazer"),
        sa.Column("prioridade", sa.String(length=50), nullable=True, server_default="Normal"),
        sa.Column("data_vencimento", sa.DateTime(), nullable=True),
        sa.Column("tipo_tarefa", sa.String(length=50), nullable=True, server_default="Prazo"),
        sa.Column("origem_id", sa.String(length=100), nullable=True),
        sa.Column(
            "data_criacao",
            sa.DateTime(),
            nullable=True,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("posicao", sa.Integer(), nullable=True, server_default="0"),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("user.id", name="fk_tarefaprazo_user_id"),
            nullable=False,
        ),
        sa.Column(
            "caso_id",
            sa.Integer(),
            sa.ForeignKey("caso.id", name="fk_tarefaprazo_caso_id"),
            nullable=True,
        ),
        sa.Column(
            "publicacao_djen_id",
            sa.Integer(),
            sa.ForeignKey(
                "publicacao_djen.id", name="fk_tarefaprazo_publicacao_djen_id"
            ),
            nullable=True,
        ),
        sa.Column(
            "prazo_validado", sa.Boolean(), nullable=False, server_default=sa.text("TRUE")
        ),
        sa.Column(
            "prazo_calculado_por_ia",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("FALSE"),
        ),
        sa.Column("prazo_dias_origem", sa.Integer(), nullable=True),
    )
    op.create_index(
        "ix_tarefa_prazo_tenant_created", "tarefa_prazo", ["tenant_id", "data_criacao"]
    )
    op.create_index(
        "ix_tarefa_prazo_tenant_status_posicao",
        "tarefa_prazo",
        ["tenant_id", "status", "posicao"],
    )
    op.create_index(
        "ix_tarefa_prazo_prazo_validado", "tarefa_prazo", ["tenant_id", "prazo_validado"]
    )

    # Restaura colunas legacy_*_id em item_agenda
    with op.batch_alter_table("item_agenda") as batch:
        batch.add_column(sa.Column("legacy_tarefa_id", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("legacy_evento_id", sa.Integer(), nullable=True))
        batch.create_index("ix_item_agenda_legacy_tarefa_id", ["legacy_tarefa_id"])
        batch.create_index("ix_item_agenda_legacy_evento_id", ["legacy_evento_id"])
