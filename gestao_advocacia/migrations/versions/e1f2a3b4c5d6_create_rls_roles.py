"""create rls roles app_admin and app_user

Onda 3.1 — Fase 1 (infraestrutura). Cria roles Postgres separados
para migrations/admin (app_admin com BYPASSRLS) e runtime (app_user
sem BYPASSRLS), com GRANTs apropriados nas tabelas existentes.

NAO habilita RLS em nenhuma tabela. Habilitacao de policies vira
em Fase 2.

Skip em SQLite — roles sao Postgres-only; dev local segue sem RLS
(documentado no Risco 7.6 do plano).

Senhas dos roles sao definidas via flyctl postgres connect +
\\password em operacoes, nao na migration. Runbook completo em
docs/ops/onda-3.1-fase1-rollout.md.

Revision ID: e1f2a3b4c5d6
Revises: d16beacc9107
Create Date: 2026-04-26 16:30:00.000000

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = "e1f2a3b4c5d6"
down_revision = "d16beacc9107"
branch_labels = None
depends_on = None


# Tabelas existentes na main em 2026-04-26. GRANTs explicitos
# aqui porque foram criadas pelo role `postgres` (antes de
# app_admin existir). Tabelas futuras criadas por app_admin
# recebem GRANTs automaticamente via ALTER DEFAULT PRIVILEGES
# FOR ROLE abaixo - nao precisa GRANT manual em PRs futuros.
_TABLES = [
    "tenant",
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
    "password_reset_token",
    "tenant_anotacao",
    "admin_audit_log",
    "alembic_version",
]


def upgrade():
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        # SQLite (dev local) e outros dialects: roles nao se aplicam.
        return

    # Cria roles idempotentemente.
    # app_admin: BYPASSRLS, owner moral das migrations e tarefas administrativas.
    # app_user: sem BYPASSRLS, role de runtime do gunicorn.
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_admin') THEN
                CREATE ROLE app_admin WITH LOGIN BYPASSRLS;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
                CREATE ROLE app_user WITH LOGIN;
            END IF;
        END
        $$;
    """)

    # Garante que app_admin tem BYPASSRLS mesmo se o role ja existia
    # sem essa flag (rerun de migration em ambiente legado).
    #
    # Cloud SQL (set/2026): nao existe SUPERUSER, e (ALTER|CREATE) ROLE com
    # BYPASSRLS exige superuser -> insufficient_privilege. Nesse caso
    # app_admin continua enxergando tudo porque e OWNER das tabelas (owner
    # ignora RLS enquanto nenhuma tabela usar FORCE ROW LEVEL SECURITY, que
    # nao usamos). Ver docs/ops/gcp-deploy.md.
    op.execute("""
        DO $$
        BEGIN
            BEGIN
                ALTER ROLE app_admin WITH BYPASSRLS;
            EXCEPTION WHEN insufficient_privilege THEN
                RAISE NOTICE 'sem superuser: app_admin fica sem BYPASSRLS (owner das tabelas ja ignora RLS)';
            END;
            BEGIN
                ALTER ROLE app_user WITH NOBYPASSRLS;
            EXCEPTION WHEN insufficient_privilege THEN
                RAISE NOTICE 'sem superuser: ALTER ROLE app_user NOBYPASSRLS ignorado';
            END;
        END
        $$;
    """)

    # GRANTs de schema.
    op.execute("GRANT USAGE ON SCHEMA public TO app_admin, app_user;")

    # GRANTs por tabela.
    for table in _TABLES:
        op.execute(f'GRANT ALL ON TABLE "{table}" TO app_admin;')
        if table == "alembic_version":
            op.execute(f'GRANT SELECT ON TABLE "{table}" TO app_user;')
        elif table == "admin_audit_log":
            # super-admin escreve via app_admin; app_user nao acessa
            pass
        else:
            op.execute(
                f'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE '
                f'"{table}" TO app_user;'
            )

    # Sequences (PKs serial/identity geram sequences associadas).
    op.execute(
        "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_admin, app_user;"
    )

    # Default privileges para tabelas/sequences criadas por app_admin
    # a partir dagora. FOR ROLE e critico: pos-Fase 1, migrations
    # rodam como app_admin; sem FOR ROLE, defaults setados aqui (como
    # role atual) nao se aplicariam a tabelas criadas por app_admin.
    # GRANT ALL para app_admin em tabelas futuras e implicito (owner)
    # — nao precisa default explicito.
    op.execute(
        "ALTER DEFAULT PRIVILEGES FOR ROLE app_admin IN SCHEMA public "
        "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;"
    )
    op.execute(
        "ALTER DEFAULT PRIVILEGES FOR ROLE app_admin IN SCHEMA public "
        "GRANT USAGE, SELECT ON SEQUENCES TO app_user;"
    )


def downgrade():
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    # Revoga GRANTs antes de droppar roles (Postgres exige).
    for table in _TABLES:
        op.execute(f'REVOKE ALL ON TABLE "{table}" FROM app_user;')
        op.execute(f'REVOKE ALL ON TABLE "{table}" FROM app_admin;')

    op.execute(
        "ALTER DEFAULT PRIVILEGES FOR ROLE app_admin IN SCHEMA public "
        "REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM app_user;"
    )
    op.execute(
        "ALTER DEFAULT PRIVILEGES FOR ROLE app_admin IN SCHEMA public "
        "REVOKE USAGE, SELECT ON SEQUENCES FROM app_user;"
    )

    op.execute("REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM app_admin, app_user;")
    op.execute("REVOKE USAGE ON SCHEMA public FROM app_admin, app_user;")

    # DROP em ordem: primeiro app_user (sem dependencias), depois app_admin.
    op.execute("DROP ROLE IF EXISTS app_user;")
    op.execute("DROP ROLE IF EXISTS app_admin;")
