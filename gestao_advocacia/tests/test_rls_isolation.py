"""Testes de isolamento multi-tenant via RLS.

Skipados em SQLite - RLS e Postgres-only. Em CI sem Postgres esses
testes ficam como scaffolding; em ambiente Postgres real (staging
futuro ou dev local com Docker), exercitam o isolamento de fato.

Cobertura por tabela canario (Fase 3): tarefa_prazo, evento_agenda,
documento. 6 testes por tabela = 18 + 1 smoke = 19 total.
"""

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, ProgrammingError

from app import db


@pytest.fixture(autouse=True)
def _skip_if_not_postgres(db):
    """Pula todos os testes deste modulo em SQLite (RLS e Postgres-only).

    Avaliada em runtime dentro do app context, evita problemas de
    coleta antes da factory rodar.
    """
    if db.engine.dialect.name != "postgresql":
        pytest.skip("RLS e Postgres-only; SQLite nao implementa policies")


def _set_tenant(tenant_id):
    """Ativa contexto RLS pro tenant especificado na transacao atual."""
    db.session.execute(
        text("SELECT set_config('app.current_tenant_id', :tid, true)"),
        {"tid": str(tenant_id)},
    )


# ===== TarefaPrazo =====


class TestRLSTarefaPrazo:
    def test_select_isolates_by_tenant_a(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        rows = db.session.execute(text("SELECT id FROM tarefa_prazo")).fetchall()
        ids = {r[0] for r in rows}
        assert two_tenants.tarefa_a.id in ids
        assert two_tenants.tarefa_b.id not in ids

    def test_select_isolates_by_tenant_b(self, two_tenants):
        _set_tenant(two_tenants.tenant_b.id)
        rows = db.session.execute(text("SELECT id FROM tarefa_prazo")).fetchall()
        ids = {r[0] for r in rows}
        assert two_tenants.tarefa_b.id in ids
        assert two_tenants.tarefa_a.id not in ids

    def test_select_by_id_other_tenant_returns_zero(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        rows = db.session.execute(
            text("SELECT id FROM tarefa_prazo WHERE id = :tid"),
            {"tid": two_tenants.tarefa_b.id},
        ).fetchall()
        assert rows == []

    def test_update_other_tenant_affects_zero_rows(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        result = db.session.execute(
            text("UPDATE tarefa_prazo SET descricao = 'X' WHERE id = :tid"),
            {"tid": two_tenants.tarefa_b.id},
        )
        assert result.rowcount == 0

    def test_delete_other_tenant_affects_zero_rows(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        result = db.session.execute(
            text("DELETE FROM tarefa_prazo WHERE id = :tid"),
            {"tid": two_tenants.tarefa_b.id},
        )
        assert result.rowcount == 0

    def test_insert_with_wrong_tenant_id_violates_check(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        with pytest.raises((ProgrammingError, IntegrityError)):
            db.session.execute(
                text(
                    "INSERT INTO tarefa_prazo (tenant_id, titulo, user_id) "
                    "VALUES (:tid, 'TEST-WRONG', :uid)"
                ),
                {
                    "tid": two_tenants.tenant_b.id,
                    "uid": two_tenants.admin_a.id,
                },
            )
            db.session.flush()


# ===== EventoAgenda =====


class TestRLSEventoAgenda:
    def test_select_isolates_by_tenant_a(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        rows = db.session.execute(text("SELECT id FROM evento_agenda")).fetchall()
        ids = {r[0] for r in rows}
        assert two_tenants.evento_a.id in ids
        assert two_tenants.evento_b.id not in ids

    def test_select_isolates_by_tenant_b(self, two_tenants):
        _set_tenant(two_tenants.tenant_b.id)
        rows = db.session.execute(text("SELECT id FROM evento_agenda")).fetchall()
        ids = {r[0] for r in rows}
        assert two_tenants.evento_b.id in ids
        assert two_tenants.evento_a.id not in ids

    def test_select_by_id_other_tenant_returns_zero(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        rows = db.session.execute(
            text("SELECT id FROM evento_agenda WHERE id = :tid"),
            {"tid": two_tenants.evento_b.id},
        ).fetchall()
        assert rows == []

    def test_update_other_tenant_affects_zero_rows(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        result = db.session.execute(
            text("UPDATE evento_agenda SET descricao = 'X' WHERE id = :tid"),
            {"tid": two_tenants.evento_b.id},
        )
        assert result.rowcount == 0

    def test_delete_other_tenant_affects_zero_rows(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        result = db.session.execute(
            text("DELETE FROM evento_agenda WHERE id = :tid"),
            {"tid": two_tenants.evento_b.id},
        )
        assert result.rowcount == 0

    def test_insert_with_wrong_tenant_id_violates_check(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        with pytest.raises((ProgrammingError, IntegrityError)):
            db.session.execute(
                text(
                    "INSERT INTO evento_agenda (tenant_id, titulo, data_inicio, user_id) "
                    "VALUES (:tid, 'TEST-WRONG', '2026-01-01 10:00:00', :uid)"
                ),
                {
                    "tid": two_tenants.tenant_b.id,
                    "uid": two_tenants.admin_a.id,
                },
            )
            db.session.flush()


# ===== Documento =====


class TestRLSDocumento:
    def test_select_isolates_by_tenant_a(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        rows = db.session.execute(text("SELECT id FROM documento")).fetchall()
        ids = {r[0] for r in rows}
        assert two_tenants.documento_a.id in ids
        assert two_tenants.documento_b.id not in ids

    def test_select_isolates_by_tenant_b(self, two_tenants):
        _set_tenant(two_tenants.tenant_b.id)
        rows = db.session.execute(text("SELECT id FROM documento")).fetchall()
        ids = {r[0] for r in rows}
        assert two_tenants.documento_b.id in ids
        assert two_tenants.documento_a.id not in ids

    def test_select_by_id_other_tenant_returns_zero(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        rows = db.session.execute(
            text("SELECT id FROM documento WHERE id = :tid"),
            {"tid": two_tenants.documento_b.id},
        ).fetchall()
        assert rows == []

    def test_update_other_tenant_affects_zero_rows(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        result = db.session.execute(
            text("UPDATE documento SET nome_arquivo = 'X.pdf' WHERE id = :tid"),
            {"tid": two_tenants.documento_b.id},
        )
        assert result.rowcount == 0

    def test_delete_other_tenant_affects_zero_rows(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        result = db.session.execute(
            text("DELETE FROM documento WHERE id = :tid"),
            {"tid": two_tenants.documento_b.id},
        )
        assert result.rowcount == 0

    def test_insert_with_wrong_tenant_id_violates_check(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        with pytest.raises((ProgrammingError, IntegrityError)):
            db.session.execute(
                text(
                    "INSERT INTO documento (tenant_id, nome_arquivo, path_arquivo, user_id) "
                    "VALUES (:tid, 'TEST-WRONG.pdf', '/tmp/wrong.pdf', :uid)"
                ),
                {
                    "tid": two_tenants.tenant_b.id,
                    "uid": two_tenants.admin_a.id,
                },
            )
            db.session.flush()


# ===== Smoke das policies =====


def test_policies_existem_nas_tres_tabelas(db):
    """Confirma migration aplicada - policies restritivas ativas."""
    rows = db.session.execute(
        text(
            "SELECT tablename, policyname FROM pg_policies "
            "WHERE schemaname='public' "
            "AND tablename IN ('tarefa_prazo','evento_agenda','documento') "
            "ORDER BY tablename, policyname"
        )
    ).fetchall()
    policies = {(r[0], r[1]) for r in rows}
    for table in ("tarefa_prazo", "evento_agenda", "documento"):
        assert (
            table,
            "rls_tenant_isolation_default",
        ) in policies, f"Policy restritiva nao existe em {table}"
        assert (
            table,
            "rls_permissive_default",
        ) not in policies, f"Policy permissiva ainda existe em {table} - deveria ter sido dropada"
