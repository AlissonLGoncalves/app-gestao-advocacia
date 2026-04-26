"""enriquecimento-cnj: testes do script de backfill (validacao DV + auto-vincular).

Chama a funcao interna `_reprocessar` do script diretamente, evitando
overhead de subprocess e mantendo o teste auto-contido.
"""

from datetime import date

from extensions import db as _db
from models import Caso, Cliente, PublicacaoDJEN, Tenant, User
from scripts.maintenance.reprocessar_triagem_djen import _reprocessar

CNJ_VALIDO = "0000472-75.2025.8.16.0075"
CNJ_VALIDO_2 = "5001234-80.2024.4.04.7100"
CNJ_INVALIDO_DV = "0000472-99.2025.8.16.0075"


def _bootstrap_tenant_e_user(suffix=""):
    t = Tenant(nome_escritorio=f"BackfillTenant{suffix}")
    _db.session.add(t)
    _db.session.commit()
    u = User(
        username=f"backfill_user_{suffix}".strip("_"),
        email=f"backfill_{suffix or 'main'}@x.com",
        role="admin",
        tenant_id=t.id,
    )
    u.set_password("Senha1234!")
    _db.session.add(u)
    _db.session.commit()
    return t, u


def _criar_publicacao(
    *,
    tenant_id,
    user_id,
    texto,
    numero_processo=None,
    caso_id=None,
    hash_com="hash_x",
    djen_id=None,
    status_origem=None,
):
    pub = PublicacaoDJEN(
        user_id=user_id,
        tenant_id=tenant_id,
        caso_id=caso_id,
        djen_id=djen_id,
        hash_comunicacao=hash_com,
        numero_processo=numero_processo,
        sigla_tribunal="TJPR",
        tipo_comunicacao="Intimacao",
        data_disponibilizacao=date(2026, 1, 15),
        texto=texto,
        link="",
        meio="D",
        raw_json={},
        origem_busca="oab",
        status_origem=status_origem,
        triagem_ignorada=False,
    )
    _db.session.add(pub)
    _db.session.commit()
    return pub


# ---------------------------------------------------------------------------
def test_backfill_rejeita_match_com_dv_invalido(app, db):
    """Texto contem string no formato CNJ mas com DV errado: nao deve atualizar."""
    with app.app_context():
        t, u = _bootstrap_tenant_e_user(suffix="dv_inv")
        pub = _criar_publicacao(
            tenant_id=t.id,
            user_id=u.id,
            texto=f"Numero falso: {CNJ_INVALIDO_DV} no corpo do texto.",
            numero_processo=None,
            hash_com="hash_dv_inv",
            djen_id=20001,
        )
        pub_id = pub.id

        _reprocessar(app, tenant_id=t.id, apply=True, auto_vincular_caso=False)

        _db.session.expire_all()
        atualizada = _db.session.get(PublicacaoDJEN, pub_id)
        # Numero NAO foi preenchido com o invalido
        assert atualizada.numero_processo in (None, "")


def test_backfill_aceita_match_com_dv_valido(app, db):
    with app.app_context():
        t, u = _bootstrap_tenant_e_user(suffix="dv_ok")
        pub = _criar_publicacao(
            tenant_id=t.id,
            user_id=u.id,
            texto=f"Autos no {CNJ_VALIDO} para vista.",
            numero_processo=None,
            hash_com="hash_dv_ok",
            djen_id=20002,
        )
        pub_id = pub.id

        _reprocessar(app, tenant_id=t.id, apply=True, auto_vincular_caso=False)

        _db.session.expire_all()
        atualizada = _db.session.get(PublicacaoDJEN, pub_id)
        assert atualizada.numero_processo == CNJ_VALIDO


def test_auto_vincular_caso_quando_existir(app, db):
    with app.app_context():
        t, u = _bootstrap_tenant_e_user(suffix="vinc_ok")
        cliente = Cliente(
            tenant_id=t.id,
            nome_razao_social="Cliente X",
            cpf_cnpj="00000000000",
            tipo_pessoa="PF",
            user_id=u.id,
        )
        _db.session.add(cliente)
        _db.session.commit()

        caso = Caso(
            tenant_id=t.id,
            titulo="Caso A",
            numero_processo=CNJ_VALIDO,
            cliente_id=cliente.id,
            user_id=u.id,
        )
        _db.session.add(caso)
        _db.session.commit()
        caso_id = caso.id

        pub = _criar_publicacao(
            tenant_id=t.id,
            user_id=u.id,
            texto=f"Autos no {CNJ_VALIDO} citacao.",
            numero_processo=None,
            hash_com="hash_vinc_ok",
            djen_id=20003,
        )
        pub_id = pub.id

        _reprocessar(app, tenant_id=t.id, apply=True, auto_vincular_caso=True)

        _db.session.expire_all()
        atualizada = _db.session.get(PublicacaoDJEN, pub_id)
        assert atualizada.numero_processo == CNJ_VALIDO
        assert atualizada.caso_id == caso_id
        assert atualizada.status_origem == "criado_automaticamente"


def test_auto_vincular_nao_vincula_caso_de_outro_tenant(app, db):
    """Caso com mesmo numero_processo em OUTRO tenant nao deve ser usado."""
    with app.app_context():
        t1, u1 = _bootstrap_tenant_e_user(suffix="t1_other")
        t2, u2 = _bootstrap_tenant_e_user(suffix="t2_other")

        cliente_t2 = Cliente(
            tenant_id=t2.id,
            nome_razao_social="Cliente T2",
            cpf_cnpj="11111111111",
            tipo_pessoa="PF",
            user_id=u2.id,
        )
        _db.session.add(cliente_t2)
        _db.session.commit()

        caso_t2 = Caso(
            tenant_id=t2.id,
            titulo="Caso do tenant 2",
            numero_processo=CNJ_VALIDO,
            cliente_id=cliente_t2.id,
            user_id=u2.id,
        )
        _db.session.add(caso_t2)
        _db.session.commit()

        # Publicacao do TENANT 1 com mesmo numero
        pub = _criar_publicacao(
            tenant_id=t1.id,
            user_id=u1.id,
            texto=f"Autos no {CNJ_VALIDO}.",
            numero_processo=None,
            hash_com="hash_other",
            djen_id=20004,
        )
        pub_id = pub.id

        _reprocessar(app, tenant_id=t1.id, apply=True, auto_vincular_caso=True)

        _db.session.expire_all()
        atualizada = _db.session.get(PublicacaoDJEN, pub_id)
        # Numero foi preenchido (extraido do texto), mas NAO houve vinculo cross-tenant
        assert atualizada.numero_processo == CNJ_VALIDO
        assert atualizada.caso_id is None


def test_auto_vincular_nao_sobrescreve_caso_id_existente(app, db):
    with app.app_context():
        t, u = _bootstrap_tenant_e_user(suffix="vinc_keep")
        cliente = Cliente(
            tenant_id=t.id,
            nome_razao_social="Cliente Y",
            cpf_cnpj="22222222222",
            tipo_pessoa="PF",
            user_id=u.id,
        )
        _db.session.add(cliente)
        _db.session.commit()

        caso_inicial = Caso(
            tenant_id=t.id,
            titulo="Caso inicial",
            numero_processo=CNJ_VALIDO,
            cliente_id=cliente.id,
            user_id=u.id,
        )
        outro_caso = Caso(
            tenant_id=t.id,
            titulo="Outro caso",
            numero_processo=CNJ_VALIDO_2,
            cliente_id=cliente.id,
            user_id=u.id,
        )
        _db.session.add_all([caso_inicial, outro_caso])
        _db.session.commit()

        # Publicacao ja vinculada a `outro_caso`, mas com texto contendo numero do `caso_inicial`
        pub = _criar_publicacao(
            tenant_id=t.id,
            user_id=u.id,
            texto=f"Autos no {CNJ_VALIDO}.",
            numero_processo=CNJ_VALIDO_2,  # ja preenchido
            caso_id=outro_caso.id,
            hash_com="hash_keep",
            djen_id=20005,
            status_origem="revisado_manual",
        )
        pub_id = pub.id

        _reprocessar(app, tenant_id=t.id, apply=True, auto_vincular_caso=True)

        _db.session.expire_all()
        atualizada = _db.session.get(PublicacaoDJEN, pub_id)
        # caso_id pre-existente NAO e sobrescrito
        assert atualizada.caso_id == outro_caso.id
        # status_origem nao alterado
        assert atualizada.status_origem == "revisado_manual"


def test_idempotente_segunda_execucao_nao_muda_nada(app, db):
    with app.app_context():
        t, u = _bootstrap_tenant_e_user(suffix="idem")
        pub = _criar_publicacao(
            tenant_id=t.id,
            user_id=u.id,
            texto=f"Autos no {CNJ_VALIDO} para vista.",
            numero_processo=None,
            hash_com="hash_idem",
            djen_id=20006,
        )

        # Primeira passagem: preenche
        _reprocessar(app, tenant_id=t.id, apply=True, auto_vincular_caso=False)
        _db.session.expire_all()
        atualizada_1 = _db.session.get(PublicacaoDJEN, pub.id)
        snapshot_1 = (
            atualizada_1.numero_processo,
            atualizada_1.sigla_tribunal,
            atualizada_1.polo_ativo,
            atualizada_1.polo_passivo,
            atualizada_1.caso_id,
            atualizada_1.status_origem,
        )

        # Segunda passagem: nada deve mudar
        _reprocessar(app, tenant_id=t.id, apply=True, auto_vincular_caso=False)
        _db.session.expire_all()
        atualizada_2 = _db.session.get(PublicacaoDJEN, pub.id)
        snapshot_2 = (
            atualizada_2.numero_processo,
            atualizada_2.sigla_tribunal,
            atualizada_2.polo_ativo,
            atualizada_2.polo_passivo,
            atualizada_2.caso_id,
            atualizada_2.status_origem,
        )

        assert snapshot_1 == snapshot_2
