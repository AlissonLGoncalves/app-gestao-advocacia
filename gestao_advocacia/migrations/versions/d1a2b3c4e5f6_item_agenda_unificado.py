"""Cria tabela item_agenda (PR D1) — modelo unificado Tarefas+Eventos.

Tabela paralela: nao toca em tarefa_prazo nem evento_agenda. D2 fara
backfill + dual-write; D3 migra o frontend; D4 dropa as tabelas antigas.

Revision ID: d1a2b3c4e5f6
Revises: c8e9f3a2b6d1
Create Date: 2026-05-17
"""

import sqlalchemy as sa
from alembic import op

revision = "d1a2b3c4e5f6"
down_revision = "c8e9f3a2b6d1"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "item_agenda",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("tenant.id", name="fk_item_agenda_tenant_id"),
            nullable=True,
        ),
        sa.Column("tipo", sa.String(length=20), nullable=False, server_default="tarefa"),
        sa.Column("categoria", sa.String(length=50), nullable=True, server_default="Outros"),
        sa.Column("titulo", sa.String(length=250), nullable=False),
        sa.Column("descricao", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="Pendente"),
        sa.Column("prioridade", sa.String(length=30), nullable=True, server_default="Normal"),
        sa.Column("data_inicio", sa.DateTime(), nullable=True),
        sa.Column("data_fim", sa.DateTime(), nullable=True),
        sa.Column("data_vencimento", sa.DateTime(), nullable=True),
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
            sa.ForeignKey("user.id", name="fk_item_agenda_user_id"),
            nullable=False,
        ),
        sa.Column(
            "caso_id",
            sa.Integer(),
            sa.ForeignKey("caso.id", name="fk_item_agenda_caso_id"),
            nullable=True,
        ),
        sa.Column(
            "publicacao_djen_id",
            sa.Integer(),
            sa.ForeignKey(
                "publicacao_djen.id",
                name="fk_item_agenda_publicacao_djen_id",
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
        sa.Column("origem_id", sa.String(length=100), nullable=True),
        sa.Column("notificacoes_enviadas", sa.JSON(), nullable=True),
        sa.Column("legacy_tarefa_id", sa.Integer(), nullable=True),
        sa.Column("legacy_evento_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        "ix_item_agenda_tenant_tipo_data",
        "item_agenda",
        ["tenant_id", "tipo", "data_inicio"],
    )
    op.create_index(
        "ix_item_agenda_tenant_status", "item_agenda", ["tenant_id", "status"]
    )
    op.create_index("ix_item_agenda_caso", "item_agenda", ["caso_id"])
    op.create_index(
        "ix_item_agenda_publicacao_djen_id", "item_agenda", ["publicacao_djen_id"]
    )
    op.create_index("ix_item_agenda_legacy_tarefa_id", "item_agenda", ["legacy_tarefa_id"])
    op.create_index("ix_item_agenda_legacy_evento_id", "item_agenda", ["legacy_evento_id"])


def downgrade():
    op.drop_index("ix_item_agenda_legacy_evento_id", table_name="item_agenda")
    op.drop_index("ix_item_agenda_legacy_tarefa_id", table_name="item_agenda")
    op.drop_index("ix_item_agenda_publicacao_djen_id", table_name="item_agenda")
    op.drop_index("ix_item_agenda_caso", table_name="item_agenda")
    op.drop_index("ix_item_agenda_tenant_status", table_name="item_agenda")
    op.drop_index("ix_item_agenda_tenant_tipo_data", table_name="item_agenda")
    op.drop_table("item_agenda")
