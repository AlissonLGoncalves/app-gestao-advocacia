"""Testes de isolamento RLS — Onda 3.1 Fase 4 Batch 2.

Cobertura: despesa, recebimento, contrato_honorario. 6 testes por
tabela = 18 + 1 smoke = 19 total. Mesmo pattern de Batch 1
(test_rls_isolation_batch1.py) e Fase 3 (test_rls_isolation.py).

Skipados em SQLite (RLS e Postgres-only). Em CI sem Postgres ficam
como scaffolding; em ambiente Postgres real exercitam o isolamento.
"""

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, ProgrammingError

from app import db


@pytest.fixture(autouse=True)
def _skip_if_not_postgres(db):
    if db.engine.dialect.name != "postgresql":
        pytest.skip("RLS e Postgres-only; SQLite nao implementa policies")


def _set_tenant(tenant_id):
    db.session.execute(
        text("SELECT set_config('app.current_tenant_id', :tid, true)"),
        {"tid": str(tenant_id)},
    )


# ===== Despesa =====


class TestRLSDespesa:
    def test_select_isolates_by_tenant_a(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        rows = db.session.execute(text("SELECT id FROM despesa")).fetchall()
        ids = {r[0] for r in rows}
        assert two_tenants.despesa_a.id in ids
        assert two_tenants.despesa_b.id not in ids

    def test_select_isolates_by_tenant_b(self, two_tenants):
        _set_tenant(two_tenants.tenant_b.id)
        rows = db.session.execute(text("SELECT id FROM despesa")).fetchall()
        ids = {r[0] for r in rows}
        assert two_tenants.despesa_b.id in ids
        assert two_tenants.despesa_a.id not in ids

    def test_select_by_id_other_tenant_returns_zero(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        rows = db.session.execute(
            text("SELECT id FROM despesa WHERE id = :tid"),
            {"tid": two_tenants.despesa_b.id},
        ).fetchall()
        assert rows == []

    def test_update_other_tenant_affects_zero_rows(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        result = db.session.execute(
            text("UPDATE despesa SET descricao = 'X' WHERE id = :tid"),
            {"tid": two_tenants.despesa_b.id},
        )
        assert result.rowcount == 0

    def test_delete_other_tenant_affects_zero_rows(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        result = db.session.execute(
            text("DELETE FROM despesa WHERE id = :tid"),
            {"tid": two_tenants.despesa_b.id},
        )
        assert result.rowcount == 0

    def test_insert_with_wrong_tenant_id_violates_check(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        with pytest.raises((ProgrammingError, IntegrityError)):
            db.session.execute(
                text(
                    "INSERT INTO despesa (tenant_id, descricao, valor, data_despesa, user_id) "
                    "VALUES (:tid, 'TEST-WRONG', 100, '2026-01-01', :uid)"
                ),
                {
                    "tid": two_tenants.tenant_b.id,
                    "uid": two_tenants.admin_a.id,
                },
            )
            db.session.flush()


# ===== Recebimento =====


class TestRLSRecebimento:
    def test_select_isolates_by_tenant_a(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        rows = db.session.execute(text("SELECT id FROM recebimento")).fetchall()
        ids = {r[0] for r in rows}
        assert two_tenants.recebimento_a.id in ids
        assert two_tenants.recebimento_b.id not in ids

    def test_select_isolates_by_tenant_b(self, two_tenants):
        _set_tenant(two_tenants.tenant_b.id)
        rows = db.session.execute(text("SELECT id FROM recebimento")).fetchall()
        ids = {r[0] for r in rows}
        assert two_tenants.recebimento_b.id in ids
        assert two_tenants.recebimento_a.id not in ids

    def test_select_by_id_other_tenant_returns_zero(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        rows = db.session.execute(
            text("SELECT id FROM recebimento WHERE id = :tid"),
            {"tid": two_tenants.recebimento_b.id},
        ).fetchall()
        assert rows == []

    def test_update_other_tenant_affects_zero_rows(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        result = db.session.execute(
            text("UPDATE recebimento SET descricao = 'X' WHERE id = :tid"),
            {"tid": two_tenants.recebimento_b.id},
        )
        assert result.rowcount == 0

    def test_delete_other_tenant_affects_zero_rows(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        result = db.session.execute(
            text("DELETE FROM recebimento WHERE id = :tid"),
            {"tid": two_tenants.recebimento_b.id},
        )
        assert result.rowcount == 0

    def test_insert_with_wrong_tenant_id_violates_check(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        with pytest.raises((ProgrammingError, IntegrityError)):
            db.session.execute(
                text(
                    "INSERT INTO recebimento (tenant_id, descricao, valor, data_recebimento, user_id) "
                    "VALUES (:tid, 'TEST-WRONG', 100, '2026-01-01', :uid)"
                ),
                {
                    "tid": two_tenants.tenant_b.id,
                    "uid": two_tenants.admin_a.id,
                },
            )
            db.session.flush()


# ===== ContratoHonorario =====


class TestRLSContratoHonorario:
    def test_select_isolates_by_tenant_a(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        rows = db.session.execute(text("SELECT id FROM contrato_honorario")).fetchall()
        ids = {r[0] for r in rows}
        assert two_tenants.contrato_a.id in ids
        assert two_tenants.contrato_b.id not in ids

    def test_select_isolates_by_tenant_b(self, two_tenants):
        _set_tenant(two_tenants.tenant_b.id)
        rows = db.session.execute(text("SELECT id FROM contrato_honorario")).fetchall()
        ids = {r[0] for r in rows}
        assert two_tenants.contrato_b.id in ids
        assert two_tenants.contrato_a.id not in ids

    def test_select_by_id_other_tenant_returns_zero(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        rows = db.session.execute(
            text("SELECT id FROM contrato_honorario WHERE id = :tid"),
            {"tid": two_tenants.contrato_b.id},
        ).fetchall()
        assert rows == []

    def test_update_other_tenant_affects_zero_rows(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        result = db.session.execute(
            text("UPDATE contrato_honorario SET tipo_honorario = 'X' WHERE id = :tid"),
            {"tid": two_tenants.contrato_b.id},
        )
        assert result.rowcount == 0

    def test_delete_other_tenant_affects_zero_rows(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        result = db.session.execute(
            text("DELETE FROM contrato_honorario WHERE id = :tid"),
            {"tid": two_tenants.contrato_b.id},
        )
        assert result.rowcount == 0

    def test_insert_with_wrong_tenant_id_violates_check(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        with pytest.raises((ProgrammingError, IntegrityError)):
            db.session.execute(
                text(
                    "INSERT INTO contrato_honorario "
                    "(tenant_id, tipo_honorario, caso_id, cliente_id, user_id) "
                    "VALUES (:tid, 'Fixo', :caso_id, :cli_id, :uid)"
                ),
                {
                    "tid": two_tenants.tenant_b.id,
                    "caso_id": two_tenants.caso_a.id,
                    "cli_id": two_tenants.cliente_a.id,
                    "uid": two_tenants.admin_a.id,
                },
            )
            db.session.flush()


# ===== Smoke das policies =====


def test_policies_existem_nas_tres_tabelas_batch2(db):
    """Confirma migration aplicada — policies restritivas ativas em
    despesa, recebimento, contrato_honorario (Fase 4 Batch 2)."""
    rows = db.session.execute(
        text(
            "SELECT tablename, policyname FROM pg_policies "
            "WHERE schemaname='public' "
            "AND tablename IN ('despesa','recebimento','contrato_honorario') "
            "ORDER BY tablename, policyname"
        )
    ).fetchall()
    policies = {(r[0], r[1]) for r in rows}
    for table in ("despesa", "recebimento", "contrato_honorario"):
        assert (
            table,
            "rls_tenant_isolation_default",
        ) in policies, f"Policy restritiva nao existe em {table}"
        assert (
            table,
            "rls_permissive_default",
        ) not in policies, f"Policy permissiva ainda existe em {table} — deveria ter sido dropada"
