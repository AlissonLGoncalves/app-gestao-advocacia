"""Regressao do bug 2026-05-19: scheduler diario pulava o sync DE TODOS OS
TENANTS quando UM tenant tinha backlog > DJEN_SYNC_BACKLOG_LIMIT.

Cenario: contagem global de PublicacaoDJEN com status_origem='pendente'
ultrapassava o limite -> job retornava skipped imediatamente, e como so o
sync limpa pendentes via auto-vinculo, a fila so crescia (death spiral).

Fix: quando tenant_id=None, agrupa por tenant e bloqueia apenas os
individualmente estourados. Tenants saudaveis continuam sincronizando.
"""

from datetime import date

from djen_tasks import job_monitorar_djen
from models import PublicacaoDJEN


def _seed_pendentes(db, tenant_id, user_id, quantos):
    for i in range(quantos):
        db.session.add(
            PublicacaoDJEN(
                tenant_id=tenant_id,
                user_id=user_id,
                djen_id=f"backlog-{tenant_id}-{i}",
                hash_comunicacao=f"hash-backlog-{tenant_id}-{i}",
                numero_processo=f"0000{i:03d}-12.2026.8.16.0001",
                sigla_tribunal="TJPR",
                tipo_comunicacao="Intimacao",
                data_disponibilizacao=date.today(),
                texto=f"pendente {i}",
                status_origem="pendente",
            )
        )
    db.session.commit()


def test_scheduler_multitenant_pula_apenas_tenant_estourado(app, db, two_tenants, monkeypatch):
    """Tenant A com 100 pendentes (acima do limit=10), tenant B limpo.
    Esperado: A pulado; B sincronizado normalmente."""
    monkeypatch.setitem(app.config, "DJEN_SYNC_BACKLOG_LIMIT", 10)
    monkeypatch.setitem(app.config, "DJEN_BUSCAR_TODOS_TRIBUNAIS", False)
    monkeypatch.setitem(app.config, "DJEN_JOB_ENABLED", True)

    _seed_pendentes(
        db,
        tenant_id=two_tenants.tenant_a.id,
        user_id=two_tenants.admin_a.id,
        quantos=100,
    )

    oabs_consultadas = []

    def fake_consultar(**kwargs):
        oabs_consultadas.append(kwargs.get("numero_oab"))
        return {"items": []}

    monkeypatch.setattr("djen_tasks.consultar_comunicacoes", fake_consultar)

    resumo = job_monitorar_djen(app, lookback_days=7, tenant_id=None, force=False)

    assert resumo["ok"] is True
    assert resumo["tenants_pulados_por_backlog"] == [two_tenants.tenant_a.id]
    # OAB do tenant B foi consultada; OAB do tenant A nao.
    assert "22222" in oabs_consultadas
    assert "11111" not in oabs_consultadas


def test_config_carrega_backlog_limit_de_env_var(monkeypatch):
    """Regressao: DJEN_SYNC_BACKLOG_LIMIT antes nao existia em config.py —
    so era lido via app.config.get(..., 50) com default hardcoded. Isso fazia
    `flyctl secrets set DJEN_SYNC_BACKLOG_LIMIT=X` nao ter efeito nenhum em
    prod. Agora vem do Config base e respeita env var.

    Nao toca em ConfigTest (teste-only) — esse fica intencionalmente minimo.
    """
    import importlib

    monkeypatch.setenv("DJEN_SYNC_BACKLOG_LIMIT", "1234")
    import config

    importlib.reload(config)
    try:
        assert config.Config.DJEN_SYNC_BACKLOG_LIMIT == 1234
    finally:
        monkeypatch.delenv("DJEN_SYNC_BACKLOG_LIMIT", raising=False)
        importlib.reload(config)


def test_singletenant_mantem_short_circuit(app, db, two_tenants, monkeypatch):
    """Chamada single-tenant (manual /sync ou worker) mantem o comportamento
    legado: se o tenant alvo esta em backlog, retorna skipped imediatamente."""
    monkeypatch.setitem(app.config, "DJEN_SYNC_BACKLOG_LIMIT", 10)
    monkeypatch.setitem(app.config, "DJEN_JOB_ENABLED", True)

    _seed_pendentes(
        db,
        tenant_id=two_tenants.tenant_a.id,
        user_id=two_tenants.admin_a.id,
        quantos=100,
    )

    def boom(**_kwargs):
        raise AssertionError("nao deveria chamar a API se tenant esta em backlog")

    monkeypatch.setattr("djen_tasks.consultar_comunicacoes", boom)

    resumo = job_monitorar_djen(
        app,
        lookback_days=7,
        tenant_id=two_tenants.tenant_a.id,
        force=False,
    )

    assert resumo["ok"] is False
    assert resumo["skipped"] is True
    assert "backlog" in resumo["reason"]
