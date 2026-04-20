"""add_indexes_tenant_created

Revision ID: e6f7a8b9c0d1
Revises: d3e4f5a6b7c8
Create Date: 2026-04-20 20:00:00.000000
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "e6f7a8b9c0d1"
down_revision = "d3e4f5a6b7c8"
branch_labels = None
depends_on = None


def upgrade():
    # Em PostgreSQL, cria índices de forma concorrente para reduzir lock de escrita.
    with op.get_context().autocommit_block():
        op.create_index(
            "ix_publicacao_djen_tenant_created",
            "publicacao_djen",
            ["tenant_id", "data_captura"],
            unique=False,
            postgresql_concurrently=True,
        )
        # A tabela movimentacao_cnj nao possui tenant_id; usa caso_id como particao natural.
        op.create_index(
            "ix_movimentacao_cnj_tenant_created",
            "movimentacao_cnj",
            ["caso_id", "data_registro_sistema"],
            unique=False,
            postgresql_concurrently=True,
        )
        op.create_index(
            "ix_audit_log_tenant_created",
            "audit_log",
            ["tenant_id", "data_hora"],
            unique=False,
            postgresql_concurrently=True,
        )
        op.create_index(
            "ix_documento_tenant_created",
            "documento",
            ["tenant_id", "data_upload"],
            unique=False,
            postgresql_concurrently=True,
        )
        op.create_index(
            "ix_evento_agenda_tenant_created",
            "evento_agenda",
            ["tenant_id", "data_inicio"],
            unique=False,
            postgresql_concurrently=True,
        )
        op.create_index(
            "ix_tarefa_prazo_tenant_created",
            "tarefa_prazo",
            ["tenant_id", "data_criacao"],
            unique=False,
            postgresql_concurrently=True,
        )
        op.create_index(
            "ix_recebimento_tenant_created",
            "recebimento",
            ["tenant_id", "data_recebimento"],
            unique=False,
            postgresql_concurrently=True,
        )
        op.create_index(
            "ix_despesa_tenant_created",
            "despesa",
            ["tenant_id", "data_despesa"],
            unique=False,
            postgresql_concurrently=True,
        )


def downgrade():
    with op.get_context().autocommit_block():
        op.drop_index(
            "ix_despesa_tenant_created", table_name="despesa", postgresql_concurrently=True
        )
        op.drop_index(
            "ix_recebimento_tenant_created",
            table_name="recebimento",
            postgresql_concurrently=True,
        )
        op.drop_index(
            "ix_tarefa_prazo_tenant_created",
            table_name="tarefa_prazo",
            postgresql_concurrently=True,
        )
        op.drop_index(
            "ix_evento_agenda_tenant_created",
            table_name="evento_agenda",
            postgresql_concurrently=True,
        )
        op.drop_index(
            "ix_documento_tenant_created",
            table_name="documento",
            postgresql_concurrently=True,
        )
        op.drop_index(
            "ix_audit_log_tenant_created",
            table_name="audit_log",
            postgresql_concurrently=True,
        )
        op.drop_index(
            "ix_movimentacao_cnj_tenant_created",
            table_name="movimentacao_cnj",
            postgresql_concurrently=True,
        )
        op.drop_index(
            "ix_publicacao_djen_tenant_created",
            table_name="publicacao_djen",
            postgresql_concurrently=True,
        )
