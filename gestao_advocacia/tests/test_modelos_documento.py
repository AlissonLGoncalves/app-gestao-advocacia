"""Testes da rota /api/v1/modelos — Epic #9 (#183)."""

import pytest

from extensions import db
from models import Cliente, ModeloDocumento, Tenant, User


@pytest.fixture
def setup_basico(client, db):
    from flask_jwt_extended import create_access_token

    tenant = Tenant(nome_escritorio="Teste Modelos")
    db.session.add(tenant)
    db.session.flush()

    user = User(
        username="modelos_user",
        email="modelos@test.com",
        role="admin",
        tenant_id=tenant.id,
        nome_completo="Dra. Teste",
        numero_oab="12345",
        sigla_oab_tribunal="PR",
    )
    user.set_password("Senha123!")
    db.session.add(user)
    db.session.flush()

    cliente = Cliente(
        tenant_id=tenant.id,
        user_id=user.id,
        nome_razao_social="João da Silva",
        cpf_cnpj="12345678901",
        tipo_pessoa="PF",
        rg="9876543",
        estado_civil="solteiro",
        profissao="engenheiro",
        nacionalidade="brasileiro",
        cidade="Curitiba",
        estado="PR",
        rua="Rua das Flores",
        numero="100",
        bairro="Centro",
    )
    db.session.add(cliente)
    db.session.commit()

    token = create_access_token(identity=str(user.id))
    headers = {"Authorization": f"Bearer {token}"}
    return {"tenant": tenant, "user": user, "cliente": cliente, "headers": headers}


def _criar_modelo_padrao():
    """Cria um modelo padrão (tenant_id=NULL) pra simular o seed."""
    m = ModeloDocumento(
        tenant_id=None,
        titulo="Procuração Teste",
        tipo="procuracao_pf",
        descricao="Modelo de teste",
        conteudo_html="<p>Eu, {{cliente.nome_razao_social}}, CPF {{cliente.cpf_cnpj}}.</p>",
        variaveis_disponiveis=["cliente.nome_razao_social", "cliente.cpf_cnpj"],
        padrao=True,
        ativo=True,
    )
    db.session.add(m)
    db.session.commit()
    return m


class TestListarModelos:
    def test_lista_inclui_modelos_padrao(self, client, setup_basico, db):
        modelo = _criar_modelo_padrao()
        resp = client.get("/api/v1/modelos", headers=setup_basico["headers"])
        assert resp.status_code == 200
        data = resp.get_json()
        ids = [m["id"] for m in data]
        assert modelo.id in ids

    def test_nao_lista_modelos_de_outro_tenant(self, client, setup_basico, db):
        # Cria outro tenant + modelo dele
        outro = Tenant(nome_escritorio="Outro")
        db.session.add(outro)
        db.session.flush()
        outro_user = User(
            username="outro_modelos",
            email="outro_m@test.com",
            role="admin",
            tenant_id=outro.id,
        )
        outro_user.set_password("Senha123!")
        db.session.add(outro_user)
        db.session.flush()
        modelo_outro = ModeloDocumento(
            tenant_id=outro.id,
            user_id=outro_user.id,
            titulo="Privado do outro",
            tipo="outro",
            conteudo_html="<p>privado</p>",
            padrao=False,
        )
        db.session.add(modelo_outro)
        db.session.commit()

        resp = client.get("/api/v1/modelos", headers=setup_basico["headers"])
        ids = [m["id"] for m in resp.get_json()]
        assert modelo_outro.id not in ids


class TestCriarModelo:
    def test_cria_modelo_custom(self, client, setup_basico):
        resp = client.post(
            "/api/v1/modelos",
            json={
                "titulo": "Meu modelo",
                "tipo": "outro",
                "conteudo_html": "<p>Olá {{cliente.nome_razao_social}}.</p>",
            },
            headers=setup_basico["headers"],
        )
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["padrao"] is False
        assert data["tenant_id"] == setup_basico["tenant"].id

    def test_falta_titulo_retorna_400(self, client, setup_basico):
        resp = client.post(
            "/api/v1/modelos",
            json={"conteudo_html": "<p>x</p>"},
            headers=setup_basico["headers"],
        )
        assert resp.status_code == 400


class TestEditarModeloPadraoCriaCopia:
    def test_editar_padrao_clona_pro_tenant(self, client, setup_basico, db):
        """Editar modelo padrão (tenant_id=NULL) deve criar cópia tenant-scoped."""
        original = _criar_modelo_padrao()
        resp = client.put(
            f"/api/v1/modelos/{original.id}",
            json={"titulo": "Procuração customizada"},
            headers=setup_basico["headers"],
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["id"] != original.id  # criou cópia
        assert data["tenant_id"] == setup_basico["tenant"].id
        assert data["padrao"] is False
        assert data["titulo"] == "Procuração customizada"

        # Original preservado
        db.session.expire_all()
        original_db = db.session.get(ModeloDocumento, original.id)
        assert original_db.tenant_id is None
        assert original_db.padrao is True
        assert original_db.titulo == "Procuração Teste"


class TestDeletarModelo:
    def test_padrao_nao_pode_ser_deletado(self, client, setup_basico, db):
        modelo = _criar_modelo_padrao()
        resp = client.delete(
            f"/api/v1/modelos/{modelo.id}",
            headers=setup_basico["headers"],
        )
        assert resp.status_code == 400

    def test_custom_e_soft_deleted(self, client, setup_basico, db):
        custom = ModeloDocumento(
            tenant_id=setup_basico["tenant"].id,
            user_id=setup_basico["user"].id,
            titulo="Custom",
            tipo="outro",
            conteudo_html="<p>x</p>",
            padrao=False,
            ativo=True,
        )
        db.session.add(custom)
        db.session.commit()

        resp = client.delete(
            f"/api/v1/modelos/{custom.id}",
            headers=setup_basico["headers"],
        )
        assert resp.status_code == 204

        db.session.expire_all()
        custom_db = db.session.get(ModeloDocumento, custom.id)
        assert custom_db.ativo is False  # soft delete


class TestGerarDocumento:
    def test_renderiza_substituindo_variaveis(self, client, setup_basico, db):
        modelo = _criar_modelo_padrao()
        cliente = setup_basico["cliente"]
        resp = client.post(
            f"/api/v1/modelos/{modelo.id}/gerar",
            json={"cliente_id": cliente.id},
            headers=setup_basico["headers"],
        )
        assert resp.status_code == 200
        data = resp.get_json()
        html = data["html"]
        assert "João da Silva" in html
        assert "12345678901" in html
        # Não deve ter placeholder remanescente
        assert "{{cliente." not in html

    def test_falta_cliente_id_retorna_400(self, client, setup_basico, db):
        modelo = _criar_modelo_padrao()
        resp = client.post(
            f"/api/v1/modelos/{modelo.id}/gerar",
            json={},
            headers=setup_basico["headers"],
        )
        assert resp.status_code == 400

    def test_cliente_de_outro_tenant_retorna_404(self, client, setup_basico, db):
        modelo = _criar_modelo_padrao()
        # Cliente de outro tenant
        outro_tenant = Tenant(nome_escritorio="Outro2")
        db.session.add(outro_tenant)
        db.session.flush()
        outro_user = User(
            username="outro_xyz",
            email="ouxyz@t.com",
            role="admin",
            tenant_id=outro_tenant.id,
        )
        outro_user.set_password("Senha123!")
        db.session.add(outro_user)
        db.session.flush()
        cliente_outro = Cliente(
            tenant_id=outro_tenant.id,
            user_id=outro_user.id,
            nome_razao_social="Outro Cliente",
            cpf_cnpj="99999999999",
            tipo_pessoa="PF",
        )
        db.session.add(cliente_outro)
        db.session.commit()

        resp = client.post(
            f"/api/v1/modelos/{modelo.id}/gerar",
            json={"cliente_id": cliente_outro.id},
            headers=setup_basico["headers"],
        )
        assert resp.status_code == 404

    def test_render_escapa_xss_em_dados_do_cliente(self, client, setup_basico, db):
        """Cliente com '<script>' no nome NÃO deve aparecer como tag executável."""
        modelo = _criar_modelo_padrao()
        cli = setup_basico["cliente"]
        cli.nome_razao_social = "<script>alert('xss')</script>"
        db.session.commit()
        resp = client.post(
            f"/api/v1/modelos/{modelo.id}/gerar",
            json={"cliente_id": cli.id},
            headers=setup_basico["headers"],
        )
        html = resp.get_json()["html"]
        assert "<script>" not in html
        assert "&lt;script&gt;" in html  # escapado
