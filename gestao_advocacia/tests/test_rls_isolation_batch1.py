"""Testes de isolamento RLS — Onda 3.1 Fase 4 Batch 1.

Cobertura: cliente, caso, movimentacao_cnj. 6 testes por tabela = 18 +
1 smoke = 19 total. Espelha exatamente o pattern da Fase 3 em
test_rls_isolation.py para minimizar carga cognitiva de revisao.

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


# ===== Cliente =====


class TestRLSCliente:
    def test_select_isolates_by_tenant_a(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        rows = db.session.execute(text("SELECT id FROM cliente")).fetchall()
        ids = {r[0] for r in rows}
        assert two_tenants.cliente_a.id in ids
        assert two_tenants.cliente_b.id not in ids

    def test_select_isolates_by_tenant_b(self, two_tenants):
        _set_tenant(two_tenants.tenant_b.id)
        rows = db.session.execute(text("SELECT id FROM cliente")).fetchall()
        ids = {r[0] for r in rows}
        assert two_tenants.cliente_b.id in ids
        assert two_tenants.cliente_a.id not in ids

    def test_select_by_id_other_tenant_returns_zero(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        rows = db.session.execute(
            text("SELECT id FROM cliente WHERE id = :tid"),
            {"tid": two_tenants.cliente_b.id},
        ).fetchall()
        assert rows == []

    def test_update_other_tenant_affects_zero_rows(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        result = db.session.execute(
            text("UPDATE cliente SET telefone = '00000' WHERE id = :tid"),
            {"tid": two_tenants.cliente_b.id},
        )
        assert result.rowcount == 0

    def test_delete_other_tenant_affects_zero_rows(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        result = db.session.execute(
            text("DELETE FROM cliente WHERE id = :tid"),
            {"tid": two_tenants.cliente_b.id},
        )
        assert result.rowcount == 0

    def test_insert_with_wrong_tenant_id_violates_check(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        with pytest.raises((ProgrammingError, IntegrityError)):
            db.session.execute(
                text(
                    "INSERT INTO cliente (tenant_id, nome_razao_social, cpf_cnpj, tipo_pessoa, user_id) "
                    "VALUES (:tid, 'TEST-WRONG', '99988877766', 'PF', :uid)"
                ),
                {
                    "tid": two_tenants.tenant_b.id,
                    "uid": two_tenants.admin_a.id,
                },
            )
            db.session.flush()


# ===== Caso =====


class TestRLSCaso:
    def test_select_isolates_by_tenant_a(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        rows = db.session.execute(text("SELECT id FROM caso")).fetchall()
        ids = {r[0] for r in rows}
        assert two_tenants.caso_a.id in ids
        assert two_tenants.caso_b.id not in ids

    def test_select_isolates_by_tenant_b(self, two_tenants):
        _set_tenant(two_tenants.tenant_b.id)
        rows = db.session.execute(text("SELECT id FROM caso")).fetchall()
        ids = {r[0] for r in rows}
        assert two_tenants.caso_b.id in ids
        assert two_tenants.caso_a.id not in ids

    def test_select_by_id_other_tenant_returns_zero(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        rows = db.session.execute(
            text("SELECT id FROM caso WHERE id = :tid"),
            {"tid": two_tenants.caso_b.id},
        ).fetchall()
        assert rows == []

    def test_update_other_tenant_affects_zero_rows(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        result = db.session.execute(
            text("UPDATE caso SET titulo = 'X' WHERE id = :tid"),
            {"tid": two_tenants.caso_b.id},
        )
        assert result.rowcount == 0

    def test_delete_other_tenant_affects_zero_rows(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        result = db.session.execute(
            text("DELETE FROM caso WHERE id = :tid"),
            {"tid": two_tenants.caso_b.id},
        )
        assert result.rowcount == 0

    def test_insert_with_wrong_tenant_id_violates_check(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        with pytest.raises((ProgrammingError, IntegrityError)):
            db.session.execute(
                text(
                    "INSERT INTO caso (tenant_id, titulo, cliente_id, user_id) "
                    "VALUES (:tid, 'TEST-WRONG', :cid, :uid)"
                ),
                {
                    "tid": two_tenants.tenant_b.id,
                    "cid": two_tenants.cliente_a.id,
                    "uid": two_tenants.admin_a.id,
                },
            )
            db.session.flush()


# ===== MovimentacaoCNJ =====


class TestRLSMovimentacaoCNJ:
    def test_select_isolates_by_tenant_a(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        rows = db.session.execute(text("SELECT id FROM movimentacao_cnj")).fetchall()
        ids = {r[0] for r in rows}
        assert two_tenants.mov_cnj_a.id in ids
        assert two_tenants.mov_cnj_b.id not in ids

    def test_select_isolates_by_tenant_b(self, two_tenants):
        _set_tenant(two_tenants.tenant_b.id)
        rows = db.session.execute(text("SELECT id FROM movimentacao_cnj")).fetchall()
        ids = {r[0] for r in rows}
        assert two_tenants.mov_cnj_b.id in ids
        assert two_tenants.mov_cnj_a.id not in ids

    def test_select_by_id_other_tenant_returns_zero(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        rows = db.session.execute(
            text("SELECT id FROM movimentacao_cnj WHERE id = :tid"),
            {"tid": two_tenants.mov_cnj_b.id},
        ).fetchall()
        assert rows == []

    def test_update_other_tenant_affects_zero_rows(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        result = db.session.execute(
            text("UPDATE movimentacao_cnj SET descricao = 'X' WHERE id = :tid"),
            {"tid": two_tenants.mov_cnj_b.id},
        )
        assert result.rowcount == 0

    def test_delete_other_tenant_affects_zero_rows(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        result = db.session.execute(
            text("DELETE FROM movimentacao_cnj WHERE id = :tid"),
            {"tid": two_tenants.mov_cnj_b.id},
        )
        assert result.rowcount == 0

    def test_insert_with_wrong_tenant_id_violates_check(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        with pytest.raises((ProgrammingError, IntegrityError)):
            db.session.execute(
                text(
                    "INSERT INTO movimentacao_cnj (tenant_id, caso_id, data_movimentacao, descricao) "
                    "VALUES (:tid, :cid, '2026-01-01 10:00:00', 'TEST-WRONG')"
                ),
                {
                    "tid": two_tenants.tenant_b.id,
                    "cid": two_tenants.caso_a.id,
                },
            )
            db.session.flush()


# ===== Smoke das policies =====


def test_policies_existem_nas_tres_tabelas_batch1(db):
    """Confirma migration aplicada — policies restritivas ativas em
    cliente, caso, movimentacao_cnj (Fase 4 Batch 1)."""
    rows = db.session.execute(
        text(
            "SELECT tablename, policyname FROM pg_policies "
            "WHERE schemaname='public' "
            "AND tablename IN ('cliente','caso','movimentacao_cnj') "
            "ORDER BY tablename, policyname"
        )
    ).fetchall()
    policies = {(r[0], r[1]) for r in rows}
    for table in ("cliente", "caso", "movimentacao_cnj"):
        assert (
            table,
            "rls_tenant_isolation_default",
        ) in policies, f"Policy restritiva nao existe em {table}"
        assert (
            table,
            "rls_permissive_default",
        ) not in policies, f"Policy permissiva ainda existe em {table} — deveria ter sido dropada"
