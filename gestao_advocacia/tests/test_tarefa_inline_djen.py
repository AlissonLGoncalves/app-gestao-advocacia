"""Testes do POST /tarefas com publicacao_djen_id (Epic #3 / #177).

Cobre:
- Criação normal sem publicacao_djen_id (regressão).
- Criação com publicacao_djen_id valida tenant e marca pub como lida.
- Caso_id derivado da pub quando o user não escolhe explicitamente.
- 404 quando publicacao_djen_id é de outro tenant.
"""

import pytest

from models import PublicacaoDJEN, Tenant, User


@pytest.fixture
def setup_user_pub(client, db):
    """Cria tenant + user logado + publicacao DJEN do mesmo tenant."""
    from flask_jwt_extended import create_access_token

    tenant = Tenant(nome_escritorio="Teste Cowork")
    db.session.add(tenant)
    db.session.flush()

    user = User(
        username="cowork_user",
        email="cowork@test.com",
        role="admin",
        tenant_id=tenant.id,
    )
    user.set_password("Senha123!")
    db.session.add(user)
    db.session.flush()

    pub = PublicacaoDJEN(
        user_id=user.id,
        tenant_id=tenant.id,
        djen_id=999001,
        sigla_tribunal="TJPR",
        tipo_comunicacao="Intimação",
        numero_processo="0000123-45.2026.8.16.0075",
        texto="Intimada a parte para contestar no prazo de 15 dias.",
        lida=False,
    )
    db.session.add(pub)
    db.session.commit()

    token = create_access_token(identity=str(user.id))
    headers = {"Authorization": f"Bearer {token}"}
    return {"tenant": tenant, "user": user, "pub": pub, "headers": headers}


class TestPostTarefaComPublicacaoDjen:
    def test_cria_tarefa_sem_publicacao_djen(self, client, setup_user_pub):
        """Caminho original — POST sem publicacao_djen_id continua funcionando."""
        headers = setup_user_pub["headers"]
        resp = client.post(
            "/api/v1/tarefas/",
            json={
                "titulo": "Tarefa manual sem DJEN",
                "prioridade": "Normal",
                "tipo_tarefa": "Prazo",
            },
            headers=headers,
        )
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["titulo"] == "Tarefa manual sem DJEN"
        assert data.get("publicacao_djen_id") is None

    def test_cria_tarefa_com_publicacao_djen_marca_pub_lida(self, client, setup_user_pub, db):
        """Quando publicacao_djen_id válido: cria tarefa + marca pub como lida."""
        pub = setup_user_pub["pub"]
        headers = setup_user_pub["headers"]
        assert pub.lida is False

        resp = client.post(
            "/api/v1/tarefas/",
            json={
                "titulo": "Cumprir intimação",
                "publicacao_djen_id": pub.id,
                "prioridade": "Alta",
            },
            headers=headers,
        )
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["publicacao_djen_id"] == pub.id

        # Confirma que a pub foi marcada como lida (tratada)
        db.session.expire_all()
        pub_db = db.session.get(PublicacaoDJEN, pub.id)
        assert pub_db.lida is True

    def test_cria_tarefa_deriva_caso_id_da_pub(self, client, setup_user_pub, db):
        """Se a pub está vinculada a um caso e o user nao informou caso_id, herda."""
        from models import Caso

        pub = setup_user_pub["pub"]
        user = setup_user_pub["user"]
        tenant = setup_user_pub["tenant"]

        # Cria caso e vincula a pub
        from models import Cliente

        cli = Cliente(
            tenant_id=tenant.id,
            user_id=user.id,
            nome_razao_social="Cliente Teste",
            cpf_cnpj="00000000000",
            tipo_pessoa="PF",
        )
        db.session.add(cli)
        db.session.flush()
        caso = Caso(
            tenant_id=tenant.id,
            user_id=user.id,
            cliente_id=cli.id,
            titulo="Caso teste",
            numero_processo=pub.numero_processo,
        )
        db.session.add(caso)
        db.session.flush()
        pub.caso_id = caso.id
        db.session.commit()

        resp = client.post(
            "/api/v1/tarefas/",
            json={"titulo": "Tarefa do caso", "publicacao_djen_id": pub.id},
            headers=setup_user_pub["headers"],
        )
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["caso_id"] == caso.id  # herdou da pub

    def test_publicacao_de_outro_tenant_retorna_404(self, client, setup_user_pub, db):
        """Cross-tenant: publicacao_djen_id de outro tenant retorna 404."""
        # Cria pub em outro tenant
        outro_tenant = Tenant(nome_escritorio="Outro tenant")
        db.session.add(outro_tenant)
        db.session.flush()
        outro_user = User(
            username="outro_user",
            email="outro@test.com",
            role="admin",
            tenant_id=outro_tenant.id,
        )
        outro_user.set_password("Senha123!")
        db.session.add(outro_user)
        db.session.flush()
        pub_outra = PublicacaoDJEN(
            user_id=outro_user.id,
            tenant_id=outro_tenant.id,
            djen_id=999002,
            sigla_tribunal="TJSP",
            tipo_comunicacao="Intimação",
            texto="Pub de outro tenant",
            lida=False,
        )
        db.session.add(pub_outra)
        db.session.commit()

        # User do tenant 1 tenta criar tarefa com pub do tenant 2
        resp = client.post(
            "/api/v1/tarefas/",
            json={"titulo": "Cross tenant", "publicacao_djen_id": pub_outra.id},
            headers=setup_user_pub["headers"],
        )
        assert resp.status_code == 404
