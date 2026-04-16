"""add_djen_tables_and_user_oab

Revision ID: a1b2c3d4e5f6
Revises: 718a903bd3bc
Create Date: 2026-04-16 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '718a903bd3bc'
branch_labels = None
depends_on = None


def upgrade():
    # ── Novos campos no modelo User (OAB + config DJEN) ──────────────────────
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.add_column(sa.Column('numero_oab', sa.String(length=30), nullable=True))
        batch_op.add_column(sa.Column('sigla_oab_tribunal', sa.String(length=10), nullable=True))
        batch_op.add_column(sa.Column('djen_monitoramento_ativo', sa.Boolean(), nullable=True))

    # ── Novo campo no modelo Caso (controle de verificação DJEN) ─────────────
    with op.batch_alter_table('caso', schema=None) as batch_op:
        batch_op.add_column(sa.Column('data_ultima_verificacao_djen', sa.DateTime(), nullable=True))

    # ── Nova tabela djen_publicacao ───────────────────────────────────────────
    op.create_table(
        'djen_publicacao',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=True),
        sa.Column('caso_id', sa.Integer(), nullable=True),
        sa.Column('hash_comunicacao', sa.String(length=100), nullable=True),
        sa.Column('numero_processo', sa.String(length=50), nullable=True),
        sa.Column('sigla_tribunal', sa.String(length=20), nullable=True),
        sa.Column('tipo_comunicacao', sa.String(length=200), nullable=True),
        sa.Column('data_disponibilizacao', sa.DateTime(), nullable=True),
        sa.Column('data_disponibilizacao_str', sa.String(length=50), nullable=True),
        sa.Column('texto', sa.Text(), nullable=True),
        sa.Column('nome_parte', sa.String(length=300), nullable=True),
        sa.Column('meio', sa.String(length=1), nullable=True),
        sa.Column('dados_raw', sa.JSON(), nullable=True),
        sa.Column('lida', sa.Boolean(), nullable=True),
        sa.Column('origem_busca', sa.String(length=20), nullable=True),
        sa.Column('data_captura', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['caso_id'], ['caso.id'], name='fk_djen_pub_caso_id'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenant.id'], name='fk_djen_pub_tenant_id'),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], name='fk_djen_pub_user_id'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_djen_publicacao_hash', 'djen_publicacao', ['hash_comunicacao'], unique=False)
    op.create_index('ix_djen_publicacao_numero_processo', 'djen_publicacao', ['numero_processo'], unique=False)


def downgrade():
    op.drop_index('ix_djen_publicacao_numero_processo', table_name='djen_publicacao')
    op.drop_index('ix_djen_publicacao_hash', table_name='djen_publicacao')
    op.drop_table('djen_publicacao')

    with op.batch_alter_table('caso', schema=None) as batch_op:
        batch_op.drop_column('data_ultima_verificacao_djen')

    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.drop_column('djen_monitoramento_ativo')
        batch_op.drop_column('sigla_oab_tribunal')
        batch_op.drop_column('numero_oab')
