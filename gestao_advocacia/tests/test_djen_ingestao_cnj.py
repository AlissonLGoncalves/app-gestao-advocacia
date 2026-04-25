"""enriquecimento-cnj: testes do hot-path em _salvar_publicacao."""

from datetime import datetime

from djen_tasks import _salvar_publicacao
from extensions import db as _db
from models import PublicacaoDJEN, Tenant, User

CNJ_VALIDO = "0000472-75.2025.8.16.0075"
CNJ_VALIDO_2 = "5001234-80.2024.4.04.7100"
CNJ_INVALIDO_DV = "0000472-99.2025.8.16.0075"  # mesmo formato, DV errado


def _criar_tenant_e_user(*, suffix=""):
    t = Tenant(nome_escritorio=f"Tenant Hotpath {suffix}".strip())
    _db.session.add(t)
    _db.session.commit()

    u = User(
        username=f"hotpath_user_{suffix}".strip("_") or "hotpath_user",
        email=f"hotpath_{suffix or 'main'}@x.com",
        role="admin",
        tenant_id=t.id,
    )
    u.set_password("Senha1234!")
    _db.session.add(u)
    _db.session.commit()
    return t, u


def _item_base(**overrides):
    """Item bruto da ComunicaAPI minimamente valido."""
    base = {
        "id": 1234567,
        "hash": "hash_fake_1",
        "dataDisponibilizacao": "2026-01-15",
        "siglaTribunal": "TJPR",
        "tipoComunicacao": "Intimacao",
        "texto": "",
        "meio": "D",
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
def test_salvar_publicacao_preenche_cnj_quando_top_level_vazio_e_texto_tem_cnj(app, db):
    with app.app_context():
        t, u = _criar_tenant_e_user(suffix="a")
        item = _item_base(
            id=10001,
            hash="hash_a",
            texto=f"Intimacao referente aos autos no {CNJ_VALIDO} para manifestacao.",
        )
        ok = _salvar_publicacao(_db, PublicacaoDJEN, u.id, t.id, None, item, origem="oab")
        assert ok is True
        _db.session.commit()

        pub = PublicacaoDJEN.query.filter_by(tenant_id=t.id, djen_id=10001).first()
        assert pub is not None
        assert pub.numero_processo == CNJ_VALIDO
        # mascara tambem preenchida (canonico ja tem pontuacao)
        assert pub.numero_processo_mascara == CNJ_VALIDO


def test_salvar_publicacao_nao_sobrescreve_cnj_top_level_existente(app, db):
    with app.app_context():
        t, u = _criar_tenant_e_user(suffix="b")
        item = _item_base(
            id=10002,
            hash="hash_b",
            numeroProcesso=CNJ_VALIDO,  # ja vem do top-level
            texto=f"Texto que tambem contem {CNJ_VALIDO_2}",
        )
        ok = _salvar_publicacao(_db, PublicacaoDJEN, u.id, t.id, None, item, origem="oab")
        assert ok is True
        _db.session.commit()

        pub = PublicacaoDJEN.query.filter_by(tenant_id=t.id, djen_id=10002).first()
        assert pub is not None
        # Top-level prevalece sobre extracao do texto
        assert pub.numero_processo == CNJ_VALIDO


def test_salvar_publicacao_ignora_cnj_invalido_no_texto(app, db):
    with app.app_context():
        t, u = _criar_tenant_e_user(suffix="c")
        item = _item_base(
            id=10003,
            hash="hash_c",
            texto=f"Citacao com numero invalido {CNJ_INVALIDO_DV}.",
        )
        ok = _salvar_publicacao(_db, PublicacaoDJEN, u.id, t.id, None, item, origem="oab")
        assert ok is True
        _db.session.commit()

        pub = PublicacaoDJEN.query.filter_by(tenant_id=t.id, djen_id=10003).first()
        assert pub is not None
        # DV invalido NAO e aceito
        assert pub.numero_processo in (None, "")
        assert pub.numero_processo_mascara in (None, "")


def test_salvar_publicacao_preenche_mascara_quando_extraido_e_mascara_vazia(app, db):
    with app.app_context():
        t, u = _criar_tenant_e_user(suffix="d")
        item = _item_base(
            id=10004,
            hash="hash_d",
            # numeroProcesso vazio, numeroProcessoMascara vazio
            texto=f"Processo: {CNJ_VALIDO} despachado.",
        )
        ok = _salvar_publicacao(_db, PublicacaoDJEN, u.id, t.id, None, item, origem="oab")
        assert ok is True
        _db.session.commit()

        pub = PublicacaoDJEN.query.filter_by(tenant_id=t.id, djen_id=10004).first()
        assert pub is not None
        assert pub.numero_processo == CNJ_VALIDO
        assert pub.numero_processo_mascara == CNJ_VALIDO


def test_salvar_publicacao_nao_sobrescreve_mascara_existente(app, db):
    with app.app_context():
        t, u = _criar_tenant_e_user(suffix="e")
        mascara_pre_existente = "0001234-56.2024.8.16.0001"
        item = _item_base(
            id=10005,
            hash="hash_e",
            numeroProcessoMascara=mascara_pre_existente,
            texto=f"Autos no {CNJ_VALIDO}.",
        )
        ok = _salvar_publicacao(_db, PublicacaoDJEN, u.id, t.id, None, item, origem="oab")
        assert ok is True
        _db.session.commit()

        pub = PublicacaoDJEN.query.filter_by(tenant_id=t.id, djen_id=10005).first()
        assert pub is not None
        assert pub.numero_processo == CNJ_VALIDO
        # Mascara que ja vinha do payload nao e sobrescrita
        assert pub.numero_processo_mascara == mascara_pre_existente


def test_salvar_publicacao_texto_sem_cnj_mantem_numero_proc_vazio(app, db):
    with app.app_context():
        t, u = _criar_tenant_e_user(suffix="f")
        item = _item_base(
            id=10006,
            hash="hash_f",
            texto="Texto generico sem nenhum numero de processo nele.",
        )
        ok = _salvar_publicacao(_db, PublicacaoDJEN, u.id, t.id, None, item, origem="oab")
        assert ok is True
        _db.session.commit()

        pub = PublicacaoDJEN.query.filter_by(tenant_id=t.id, djen_id=10006).first()
        assert pub is not None
        assert pub.numero_processo in (None, "")
