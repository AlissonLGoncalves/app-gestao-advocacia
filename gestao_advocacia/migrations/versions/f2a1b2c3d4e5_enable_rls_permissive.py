"""enable rls permissivo em 17 tabelas categoria A

Onda 3.1 - Fase 2. Habilita ROW LEVEL SECURITY em 17 tabelas
categoria A (com tenant_id) e cria policy permissiva
"rls_permissive_default" USING (true) WITH CHECK (true).

Esta fase intermediaria valida que ENABLE RLS sozinho nao quebra
jobs, scripts, release_command ou queries com role errado, antes
de aplicar policies restritivas em Fase 3+.

A policy e PERMISSIVA: nao restringe acesso. Fase 3+ substitui
ela por policies que checam tenant_id contra
current_setting('app.current_tenant_id').

Tabelas SEM RLS (intencional):
- tenant: categoria C, tabela mae sem tenant_id
- password_reset_token: categoria C, pre-auth (Decisao 2 do plano)
- tenant_anotacao: categoria especial (super-admin)
- admin_audit_log: cross-tenant by design
- alembic_version: gerenciada por Alembic

Skip em SQLite - RLS e Postgres-only (Risco 7.6 do plano).

Revision ID: f2a1b2c3d4e5
Revises: e1f2a3b4c5d6
Create Date: 2026-04-26 18:25:00.000000

"""

from alembic import op

revision = "f2a1b2c3d4e5"
down_revision = "e1f2a3b4c5d6"
branch_labels = None
depends_on = None


_RLS_TABLES = [
    "user",
    "cliente",
    "caso",
    "movimentacao_cnj",
    "evento_agenda",
    "documento",
    "procuracao_analise",
    "contrato_honorario",
    "despesa",
    "recebimento",
    "tarefa_prazo",
    "djen_oab_monitoramento",
    "publicacao_djen",
    "djen_vinculo_decisao",
    "audit_log",
    "login_audit",
    "consentimento_usuario",
]

_POLICY_NAME = "rls_permissive_default"


def upgrade():
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    for table in _RLS_TABLES:
        op.execute(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY')
        op.execute(
            f'CREATE POLICY {_POLICY_NAME} ON "{table}" ' f"FOR ALL USING (true) WITH CHECK (true)"
        )


def downgrade():
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    for table in reversed(_RLS_TABLES):
        op.execute(f'DROP POLICY IF EXISTS {_POLICY_NAME} ON "{table}"')
        op.execute(f'ALTER TABLE "{table}" DISABLE ROW LEVEL SECURITY')
