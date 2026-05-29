"""Auto-vinculo de publicacao DJEN ao caso por NUMERO DE PROCESSO (CNJ).

Foco: o match normalizado (remove "."/"-") que resolve o caso em que o caso
foi cadastrado com mascara e a publicacao chega com formato diferente — antes
o filter_by exato falhava e a intimacao caia na fila de triagem unificada.
"""

import re

from djen_tasks import _salvar_publicacao
from djen_triagem import (
    construir_indices_auto_vinculo,
    tentar_auto_vincular_via_indices,
)
from extensions import db as _db
from models import Caso, Cliente, PublicacaoDJEN, Tenant, User

CNJ_MASCARA = "0000472-75.2025.8.16.0075"
CNJ_SO_DIGITOS = re.sub(r"\D", "", CNJ_MASCARA)  # "00004727520258160075"


def _tenant_user(suffix=""):
    t = Tenant(nome_escritorio=f"Tenant AV {suffix}".strip())
    _db.session.add(t)
    _db.session.commit()
    u = User(
        username=f"av_user_{suffix}".strip("_") or "av_user",
        email=f"av_{suffix or 'main'}@x.com",
        role="admin",
        tenant_id=t.id,
    )
    u.set_password("Senha1234!")
    _db.session.add(u)
    _db.session.commit()
    return t, u


def _criar_caso(tenant_id, user_id, numero_processo, suffix=""):
    # cpf_cnpj unico por cliente (NOT NULL no schema). Usa o suffix pra variar.
    digito = "".join(c for c in suffix if c.isdigit()) or str(abs(hash(suffix)) % 100)
    cli = Cliente(
        nome_razao_social=f"Cliente {suffix}".strip(),
        cpf_cnpj=f"{digito:0<11}"[:11],
        tenant_id=tenant_id,
        user_id=user_id,
    )
    _db.session.add(cli)
    _db.session.commit()
    caso = Caso(
        titulo=f"Caso {suffix}".strip(),
        numero_processo=numero_processo,
        status="Ativo",
        cliente_id=cli.id,
        user_id=user_id,
        tenant_id=tenant_id,
    )
    _db.session.add(caso)
    _db.session.commit()
    return caso


def _item(**ov):
    base = {
        "id": 70001,
        "hash": "hash_av",
        "dataDisponibilizacao": "2026-01-15",
        "siglaTribunal": "TJPR",
        "tipoComunicacao": "Intimacao",
        "texto": "",
        "meio": "D",
    }
    base.update(ov)
    return base


# ===== Sincronizacao (_salvar_publicacao) =====


def test_sync_vincula_quando_formato_identico(app, db):
    """Caso e pub com a MESMA mascara — match exato (caminho original)."""
    with app.app_context():
        t, u = _tenant_user(suffix="id")
        caso = _criar_caso(t.id, u.id, CNJ_MASCARA, suffix="id")
        item = _item(id=70010, hash="h_id", numeroProcesso=CNJ_MASCARA)

        _salvar_publicacao(_db, PublicacaoDJEN, u.id, t.id, None, item, origem="oab")
        _db.session.commit()

        pub = PublicacaoDJEN.query.filter_by(tenant_id=t.id, djen_id=70010).first()
        assert pub is not None
        assert pub.caso_id == caso.id


def test_sync_vincula_quando_caso_tem_mascara_e_pub_so_digitos(app, db):
    """Caso cadastrado COM mascara, pub chega SO com digitos — antes falhava."""
    with app.app_context():
        t, u = _tenant_user(suffix="dig")
        caso = _criar_caso(t.id, u.id, CNJ_MASCARA, suffix="dig")
        # pub chega com o numero so em digitos (sem ./-)
        item = _item(id=70011, hash="h_dig", numeroProcesso=CNJ_SO_DIGITOS)

        _salvar_publicacao(_db, PublicacaoDJEN, u.id, t.id, None, item, origem="oab")
        _db.session.commit()

        pub = PublicacaoDJEN.query.filter_by(tenant_id=t.id, djen_id=70011).first()
        assert pub is not None
        assert pub.caso_id == caso.id, "deveria vincular por match normalizado"


def test_sync_nao_vincula_processo_de_outro(app, db):
    """Numero diferente NAO deve vincular."""
    with app.app_context():
        t, u = _tenant_user(suffix="dif")
        _criar_caso(t.id, u.id, CNJ_MASCARA, suffix="dif")
        item = _item(id=70012, hash="h_dif", numeroProcesso="5001234-80.2024.4.04.7100")

        _salvar_publicacao(_db, PublicacaoDJEN, u.id, t.id, None, item, origem="oab")
        _db.session.commit()

        pub = PublicacaoDJEN.query.filter_by(tenant_id=t.id, djen_id=70012).first()
        assert pub is not None
        assert pub.caso_id is None


def test_sync_nao_vincula_cross_tenant(app, db):
    """Caso de outro tenant com mesmo numero NAO deve vincular."""
    with app.app_context():
        t1, u1 = _tenant_user(suffix="t1")
        t2, u2 = _tenant_user(suffix="t2")
        # caso no tenant 1
        _criar_caso(t1.id, u1.id, CNJ_MASCARA, suffix="t1")
        # pub chega no tenant 2 com o mesmo numero
        item = _item(id=70013, hash="h_t2", numeroProcesso=CNJ_MASCARA)

        _salvar_publicacao(_db, PublicacaoDJEN, u2.id, t2.id, None, item, origem="oab")
        _db.session.commit()

        pub = PublicacaoDJEN.query.filter_by(tenant_id=t2.id, djen_id=70013).first()
        assert pub is not None
        assert pub.caso_id is None, "nao pode vincular a caso de outro tenant"


# ===== Indices (backlog / endpoint auto-vincular-pendentes) =====


def test_indice_cnj_e_match_via_indices(app, db):
    with app.app_context():
        t, u = _tenant_user(suffix="idx")
        caso = _criar_caso(t.id, u.id, CNJ_MASCARA, suffix="idx")

        indices = construir_indices_auto_vinculo(Cliente, Caso, t.id)
        assert CNJ_SO_DIGITOS in indices["cnj_to_caso_id"]
        assert indices["cnj_to_caso_id"][CNJ_SO_DIGITOS] == caso.id

        # analise com numero em mascara diferente -> normaliza e bate
        analise = {"numero_processo": CNJ_MASCARA, "partes_autoras": [], "partes_reus": []}
        assert tentar_auto_vincular_via_indices(analise, indices) == caso.id

        # analise com numero so digitos -> tambem bate
        analise2 = {"numero_processo": CNJ_SO_DIGITOS, "partes_autoras": [], "partes_reus": []}
        assert tentar_auto_vincular_via_indices(analise2, indices) == caso.id


def test_indice_cnj_precedencia_sobre_nome(app, db):
    """CNJ deve ter precedencia: mesmo que o nome bata com outro caso, o
    numero de processo manda."""
    with app.app_context():
        t, u = _tenant_user(suffix="prec")
        caso_certo = _criar_caso(t.id, u.id, CNJ_MASCARA, suffix="certo")

        indices = construir_indices_auto_vinculo(Cliente, Caso, t.id)
        analise = {
            "numero_processo": CNJ_SO_DIGITOS,
            "partes_autoras": ["Fulano Inexistente"],
            "partes_reus": [],
        }
        assert tentar_auto_vincular_via_indices(analise, indices) == caso_certo.id


def test_indice_cnj_sem_match_retorna_none(app, db):
    with app.app_context():
        t, u = _tenant_user(suffix="none")
        _criar_caso(t.id, u.id, CNJ_MASCARA, suffix="none")
        indices = construir_indices_auto_vinculo(Cliente, Caso, t.id)
        analise = {
            "numero_processo": "9999999-99.2099.8.16.0001",
            "partes_autoras": [],
            "partes_reus": [],
        }
        assert tentar_auto_vincular_via_indices(analise, indices) is None
