"""kanban_djen_prazo_validacao

Revision ID: d4f7b1a3c2e8
Revises: cbddb535d048
Create Date: 2026-05-11 14:00:00.000000

Feature Kanban<>DJEN: campos para auditoria e validacao de prazos
gerados automaticamente a partir de publicacoes DJEN classificadas como
importantes pela IA.

- prazo_validado: False quando prazo foi calculado por IA e ainda nao foi
  confirmado pelo advogado. True quando criado manualmente ou apos clique
  em "Confirmar prazo" no card do Kanban.
- prazo_calculado_por_ia: True quando o registro nasceu do auto-fluxo
  DJEN -> TarefaPrazo (Etapa 1 do ciclo). False/NULL para tarefas criadas
  manualmente pelo usuario.
- prazo_dias_origem: numero de dias usado pela tabela de regras para
  calcular data_vencimento (5/10/15/30). Util para auditoria e ajuste fino
  da tabela de regras em djen_prazo_calculator.py.

Default conservador: prazo_validado=True para os registros existentes (sao
tarefas manuais — nao precisam de revisao).
"""

from alembic import op
import sqlalchemy as sa


revision = "d4f7b1a3c2e8"
down_revision = "cbddb535d048"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("tarefa_prazo") as batch_op:
        batch_op.add_column(
            sa.Column(
                "prazo_validado",
                sa.Boolean(),
                nullable=False,
                server_default=sa.true(),
            )
        )
        batch_op.add_column(
            sa.Column(
                "prazo_calculado_por_ia",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )
        batch_op.add_column(
            sa.Column("prazo_dias_origem", sa.Integer(), nullable=True)
        )
        batch_op.create_index(
            "ix_tarefa_prazo_prazo_validado",
            ["tenant_id", "prazo_validado"],
        )


def downgrade():
    with op.batch_alter_table("tarefa_prazo") as batch_op:
        batch_op.drop_index("ix_tarefa_prazo_prazo_validado")
        batch_op.drop_column("prazo_dias_origem")
        batch_op.drop_column("prazo_calculado_por_ia")
        batch_op.drop_column("prazo_validado")
