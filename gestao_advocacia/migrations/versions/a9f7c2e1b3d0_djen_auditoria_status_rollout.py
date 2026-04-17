"""djen_auditoria_status_rollout

Adiciona: status_origem, triagem_ignorada na publicacao_djen e
cria a tabela djen_vinculo_decisao para trilha auditável.

Revision ID: a9f7c2e1b3d0
Revises: 2f86e47cd662
Create Date: 2026-04-17 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime

revision = 'a9f7c2e1b3d0'
down_revision = '2f86e47cd662'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('publicacao_djen', schema=None) as batch_op:
        batch_op.add_column(sa.Column('status_origem', sa.String(length=40), nullable=True))
        batch_op.add_column(sa.Column('triagem_ignorada', sa.Boolean(), nullable=True, server_default='0'))
        batch_op.create_index(batch_op.f('ix_publicacao_djen_status_origem'), ['status_origem'], unique=False)
        batch_op.create_index(batch_op.f('ix_publicacao_djen_triagem_ignorada'), ['triagem_ignorada'], unique=False)

    op.create_table(
        'djen_vinculo_decisao',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('publicacao_id', sa.Integer(), nullable=False),
        sa.Column('acao', sa.String(length=30), nullable=False),
        sa.Column('origem_acao', sa.String(length=20), nullable=False, server_default='manual'),
        sa.Column('cliente_id', sa.Integer(), nullable=True),
        sa.Column('caso_id', sa.Integer(), nullable=True),
        sa.Column('confianca', sa.Float(), nullable=True),
        sa.Column('motivo', sa.String(length=255), nullable=True),
        sa.Column('payload', sa.JSON(), nullable=True),
        sa.Column('data_decisao', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['caso_id'], ['caso.id'], name='fk_djen_decisao_caso_id'),
        sa.ForeignKeyConstraint(['cliente_id'], ['cliente.id'], name='fk_djen_decisao_cliente_id'),
        sa.ForeignKeyConstraint(['publicacao_id'], ['publicacao_djen.id'], name='fk_djen_decisao_publicacao_id'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenant.id'], name='fk_djen_decisao_tenant_id'),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], name='fk_djen_decisao_user_id'),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('djen_vinculo_decisao', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_djen_vinculo_decisao_acao'), ['acao'], unique=False)
        batch_op.create_index(batch_op.f('ix_djen_vinculo_decisao_data_decisao'), ['data_decisao'], unique=False)
        batch_op.create_index(batch_op.f('ix_djen_vinculo_decisao_publicacao_id'), ['publicacao_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_djen_vinculo_decisao_tenant_id'), ['tenant_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_djen_vinculo_decisao_user_id'), ['user_id'], unique=False)


def downgrade():
    op.drop_table('djen_vinculo_decisao')
    with op.batch_alter_table('publicacao_djen', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_publicacao_djen_triagem_ignorada'))
        batch_op.drop_index(batch_op.f('ix_publicacao_djen_status_origem'))
        batch_op.drop_column('triagem_ignorada')
        batch_op.drop_column('status_origem')
