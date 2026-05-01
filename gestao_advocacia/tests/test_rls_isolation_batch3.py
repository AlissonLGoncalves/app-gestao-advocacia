"""Testes de isolamento RLS — Onda 3.1 Fase 4 Batch 3.

Cobertura: djen_oab_monitoramento, publicacao_djen, djen_vinculo_decisao,
procuracao_analise. 6 testes por tabela = 24 + 1 smoke = 25 total.
Mesmo pattern de Batches 1-2 e Fase 3.

Skipados em SQLite (RLS e Postgres-only).
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


# ===== DjenOabMonitoramento =====


class TestRLSDjenOabMonitoramento:
    def test_select_isolates_by_tenant_a(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        rows = db.session.execute(text("SELECT id FROM djen_oab_monitoramento")).fetchall()
        ids = {r[0] for r in rows}
        assert two_tenants.djen_oab_a.id in ids
        assert two_tenants.djen_oab_b.id not in ids

    def test_select_isolates_by_tenant_b(self, two_tenants):
        _set_tenant(two_tenants.tenant_b.id)
        rows = db.session.execute(text("SELECT id FROM djen_oab_monitoramento")).fetchall()
        ids = {r[0] for r in rows}
        assert two_tenants.djen_oab_b.id in ids
        assert two_tenants.djen_oab_a.id not in ids

    def test_select_by_id_other_tenant_returns_zero(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        rows = db.session.execute(
            text("SELECT id FROM djen_oab_monitoramento WHERE id = :tid"),
            {"tid": two_tenants.djen_oab_b.id},
        ).fetchall()
        assert rows == []

    def test_update_other_tenant_affects_zero_rows(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        result = db.session.execute(
            text("UPDATE djen_oab_monitoramento SET ativo = false WHERE id = :tid"),
            {"tid": two_tenants.djen_oab_b.id},
        )
        assert result.rowcount == 0

    def test_delete_other_tenant_affects_zero_rows(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        result = db.session.execute(
            text("DELETE FROM djen_oab_monitoramento WHERE id = :tid"),
            {"tid": two_tenants.djen_oab_b.id},
        )
        assert result.rowcount == 0

    def test_insert_with_wrong_tenant_id_violates_check(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        with pytest.raises((ProgrammingError, IntegrityError)):
            db.session.execute(
                text(
                    "INSERT INTO djen_oab_monitoramento (tenant_id, user_id, numero_oab) "
                    "VALUES (:tid, :uid, '99999')"
                ),
                {
                    "tid": two_tenants.tenant_b.id,
                    "uid": two_tenants.admin_a.id,
                },
            )
            db.session.flush()


# ===== PublicacaoDJEN =====


class TestRLSPublicacaoDJEN:
    def test_select_isolates_by_tenant_a(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        rows = db.session.execute(text("SELECT id FROM publicacao_djen")).fetchall()
        ids = {r[0] for r in rows}
        assert two_tenants.publicacao_djen_a.id in ids
        assert two_tenants.publicacao_djen_b.id not in ids

    def test_select_isolates_by_tenant_b(self, two_tenants):
        _set_tenant(two_tenants.tenant_b.id)
        rows = db.session.execute(text("SELECT id FROM publicacao_djen")).fetchall()
        ids = {r[0] for r in rows}
        assert two_tenants.publicacao_djen_b.id in ids
        assert two_tenants.publicacao_djen_a.id not in ids

    def test_select_by_id_other_tenant_returns_zero(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        rows = db.session.execute(
            text("SELECT id FROM publicacao_djen WHERE id = :tid"),
            {"tid": two_tenants.publicacao_djen_b.id},
        ).fetchall()
        assert rows == []

    def test_update_other_tenant_affects_zero_rows(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        result = db.session.execute(
            text("UPDATE publicacao_djen SET lida = true WHERE id = :tid"),
            {"tid": two_tenants.publicacao_djen_b.id},
        )
        assert result.rowcount == 0

    def test_delete_other_tenant_affects_zero_rows(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        result = db.session.execute(
            text("DELETE FROM publicacao_djen WHERE id = :tid"),
            {"tid": two_tenants.publicacao_djen_b.id},
        )
        assert result.rowcount == 0

    def test_insert_with_wrong_tenant_id_violates_check(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        with pytest.raises((ProgrammingError, IntegrityError)):
            db.session.execute(
                text(
                    "INSERT INTO publicacao_djen (tenant_id, user_id, sigla_tribunal) "
                    "VALUES (:tid, :uid, 'WRONG')"
                ),
                {
                    "tid": two_tenants.tenant_b.id,
                    "uid": two_tenants.admin_a.id,
                },
            )
            db.session.flush()


# ===== DjenVinculoDecisao =====


class TestRLSDjenVinculoDecisao:
    def test_select_isolates_by_tenant_a(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        rows = db.session.execute(text("SELECT id FROM djen_vinculo_decisao")).fetchall()
        ids = {r[0] for r in rows}
        assert two_tenants.djen_vinculo_a.id in ids
        assert two_tenants.djen_vinculo_b.id not in ids

    def test_select_isolates_by_tenant_b(self, two_tenants):
        _set_tenant(two_tenants.tenant_b.id)
        rows = db.session.execute(text("SELECT id FROM djen_vinculo_decisao")).fetchall()
        ids = {r[0] for r in rows}
        assert two_tenants.djen_vinculo_b.id in ids
        assert two_tenants.djen_vinculo_a.id not in ids

    def test_select_by_id_other_tenant_returns_zero(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        rows = db.session.execute(
            text("SELECT id FROM djen_vinculo_decisao WHERE id = :tid"),
            {"tid": two_tenants.djen_vinculo_b.id},
        ).fetchall()
        assert rows == []

    def test_update_other_tenant_affects_zero_rows(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        result = db.session.execute(
            text("UPDATE djen_vinculo_decisao SET motivo = 'X' WHERE id = :tid"),
            {"tid": two_tenants.djen_vinculo_b.id},
        )
        assert result.rowcount == 0

    def test_delete_other_tenant_affects_zero_rows(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        result = db.session.execute(
            text("DELETE FROM djen_vinculo_decisao WHERE id = :tid"),
            {"tid": two_tenants.djen_vinculo_b.id},
        )
        assert result.rowcount == 0

    def test_insert_with_wrong_tenant_id_violates_check(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        with pytest.raises((ProgrammingError, IntegrityError)):
            db.session.execute(
                text(
                    "INSERT INTO djen_vinculo_decisao "
                    "(tenant_id, user_id, publicacao_id, acao, origem_acao) "
                    "VALUES (:tid, :uid, :pid, 'criar', 'manual')"
                ),
                {
                    "tid": two_tenants.tenant_b.id,
                    "uid": two_tenants.admin_a.id,
                    "pid": two_tenants.publicacao_djen_a.id,
                },
            )
            db.session.flush()


# ===== ProcuracaoAnalise =====


class TestRLSProcuracaoAnalise:
    def test_select_isolates_by_tenant_a(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        rows = db.session.execute(text("SELECT id FROM procuracao_analise")).fetchall()
        ids = {r[0] for r in rows}
        assert two_tenants.procuracao_a.id in ids
        assert two_tenants.procuracao_b.id not in ids

    def test_select_isolates_by_tenant_b(self, two_tenants):
        _set_tenant(two_tenants.tenant_b.id)
        rows = db.session.execute(text("SELECT id FROM procuracao_analise")).fetchall()
        ids = {r[0] for r in rows}
        assert two_tenants.procuracao_b.id in ids
        assert two_tenants.procuracao_a.id not in ids

    def test_select_by_id_other_tenant_returns_zero(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        rows = db.session.execute(
            text("SELECT id FROM procuracao_analise WHERE id = :tid"),
            {"tid": two_tenants.procuracao_b.id},
        ).fetchall()
        assert rows == []

    def test_update_other_tenant_affects_zero_rows(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        result = db.session.execute(
            text("UPDATE procuracao_analise SET status = 'failed' WHERE id = :tid"),
            {"tid": two_tenants.procuracao_b.id},
        )
        assert result.rowcount == 0

    def test_delete_other_tenant_affects_zero_rows(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        result = db.session.execute(
            text("DELETE FROM procuracao_analise WHERE id = :tid"),
            {"tid": two_tenants.procuracao_b.id},
        )
        assert result.rowcount == 0

    def test_insert_with_wrong_tenant_id_violates_check(self, two_tenants):
        _set_tenant(two_tenants.tenant_a.id)
        with pytest.raises((ProgrammingError, IntegrityError)):
            db.session.execute(
                text(
                    "INSERT INTO procuracao_analise "
                    "(tenant_id, user_id, arquivo_path, arquivo_hash, status, criado_em) "
                    "VALUES (:tid, :uid, '/tmp/wrong.pdf', 'wrong-hash', 'pending', now())"
                ),
                {
                    "tid": two_tenants.tenant_b.id,
                    "uid": two_tenants.admin_a.id,
                },
            )
            db.session.flush()


# ===== Smoke das policies =====


def test_policies_existem_nas_quatro_tabelas_batch3(db):
    """Confirma migration aplicada — policies restritivas ativas em
    djen_oab_monitoramento, publicacao_djen, djen_vinculo_decisao,
    procuracao_analise (Fase 4 Batch 3)."""
    rows = db.session.execute(
        text(
            "SELECT tablename, policyname FROM pg_policies "
            "WHERE schemaname='public' "
            "AND tablename IN ("
            "'djen_oab_monitoramento','publicacao_djen',"
            "'djen_vinculo_decisao','procuracao_analise'"
            ") "
            "ORDER BY tablename, policyname"
        )
    ).fetchall()
    policies = {(r[0], r[1]) for r in rows}
    for table in (
        "djen_oab_monitoramento",
        "publicacao_djen",
        "djen_vinculo_decisao",
        "procuracao_analise",
    ):
        assert (
            table,
            "rls_tenant_isolation_default",
        ) in policies, f"Policy restritiva nao existe em {table}"
        assert (
            table,
            "rls_permissive_default",
        ) not in policies, f"Policy permissiva ainda existe em {table} — deveria ter sido dropada"
