"""add tenant contact fields

Revision ID: 285cafac29e0
Revises: 80366d78be69
Create Date: 2026-04-22 09:56:33.491596

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '285cafac29e0'
down_revision = '80366d78be69'
branch_labels = None
depends_on = None


def _table_exists(conn, name):
    return sa.inspect(conn).has_table(name)


def _index_exists(conn, table, index_name):
    indexes = {i['name'] for i in sa.inspect(conn).get_indexes(table)}
    return index_name in indexes


def _column_exists(conn, table, column):
    cols = {c['name'] for c in sa.inspect(conn).get_columns(table)}
    return column in cols


def upgrade():
    conn = op.get_bind()

    # login_audit — criar só se não existir
    if not _table_exists(conn, 'login_audit'):
        op.create_table(
            'login_audit',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=True),
            sa.Column('email_tentativa', sa.String(length=120), nullable=False),
            sa.Column('sucesso', sa.Boolean(), nullable=False),
            sa.Column('ip', sa.String(length=45), nullable=True),
            sa.Column('user_agent', sa.String(length=500), nullable=True),
            sa.Column('motivo_falha', sa.String(length=50), nullable=True),
            sa.Column('criado_em', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['user_id'], ['user.id'], name='fk_login_audit_user_id'),
            sa.PrimaryKeyConstraint('id'),
        )

    # índices — todos via CREATE INDEX IF NOT EXISTS (PostgreSQL)
    op.execute("CREATE INDEX IF NOT EXISTS ix_login_audit_criado_em ON login_audit (criado_em)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_audit_log_tenant_created ON audit_log (tenant_id, data_hora)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_despesa_tenant_created ON despesa (tenant_id, data_despesa)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_documento_tenant_created ON documento (tenant_id, data_upload)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_evento_agenda_tenant_created ON evento_agenda (tenant_id, data_inicio)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_movimentacao_cnj_tenant_created ON movimentacao_cnj (caso_id, data_registro_sistema)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_publicacao_djen_tenant_created ON publicacao_djen (tenant_id, data_captura)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_recebimento_tenant_created ON recebimento (tenant_id, data_recebimento)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_tarefa_prazo_tenant_created ON tarefa_prazo (tenant_id, data_criacao)")

    # colunas do tenant — adicionar só as que não existem
    tenant_cols = {'email_contato', 'telefone', 'numero_oab_escritorio', 'sigla_oab_escritorio', 'endereco'}
    missing = [c for c in tenant_cols if not _column_exists(conn, 'tenant', c)]
    if missing:
        with op.batch_alter_table('tenant', schema=None) as batch_op:
            if 'email_contato' in missing:
                batch_op.add_column(sa.Column('email_contato', sa.String(length=120), nullable=True))
            if 'telefone' in missing:
                batch_op.add_column(sa.Column('telefone', sa.String(length=30), nullable=True))
            if 'numero_oab_escritorio' in missing:
                batch_op.add_column(sa.Column('numero_oab_escritorio', sa.String(length=30), nullable=True))
            if 'sigla_oab_escritorio' in missing:
                batch_op.add_column(sa.Column('sigla_oab_escritorio', sa.String(length=10), nullable=True))
            if 'endereco' in missing:
                batch_op.add_column(sa.Column('endereco', sa.String(length=300), nullable=True))


def downgrade():
    with op.batch_alter_table('tenant', schema=None) as batch_op:
        batch_op.drop_column('endereco')
        batch_op.drop_column('sigla_oab_escritorio')
        batch_op.drop_column('numero_oab_escritorio')
        batch_op.drop_column('telefone')
        batch_op.drop_column('email_contato')

    op.execute("DROP INDEX IF EXISTS ix_tarefa_prazo_tenant_created")
    op.execute("DROP INDEX IF EXISTS ix_recebimento_tenant_created")
    op.execute("DROP INDEX IF EXISTS ix_publicacao_djen_tenant_created")
    op.execute("DROP INDEX IF EXISTS ix_movimentacao_cnj_tenant_created")
    op.execute("DROP INDEX IF EXISTS ix_evento_agenda_tenant_created")
    op.execute("DROP INDEX IF EXISTS ix_documento_tenant_created")
    op.execute("DROP INDEX IF EXISTS ix_despesa_tenant_created")
    op.execute("DROP INDEX IF EXISTS ix_audit_log_tenant_created")
    op.execute("DROP INDEX IF EXISTS ix_login_audit_criado_em")

    op.drop_table('login_audit')
