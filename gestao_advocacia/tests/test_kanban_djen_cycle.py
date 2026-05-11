"""Testes da Feature Kanban<>DJEN.

Cobre:
- djen_prazo_calculator: regras (recurso/contestacao/sentenca/fallback)
- _criar_tarefa_de_publicacao: cria so' quando importante + caso_id;
  idempotente
- executar_auto_criacao_tarefas: varre multiplas pubs, nao duplica em
  segunda execucao
- DTO TarefaPrazo serializa cliente_nome + numero_processo
- PATCH /tarefas/<id>/validar-prazo marca prazo_validado=True
"""

from datetime import date, datetime, timedelta

import pytest
from flask_jwt_extended import create_access_token

from djen_prazo_calculator import calcular_prazo
from djen_tasks import _criar_tarefa_de_publicacao, executar_auto_criacao_tarefas
from models import Caso, Cliente, PublicacaoDJEN, TarefaPrazo, Tenant, User


@pytest.fixture
def setup_kanban_djen(client, db):
    """Tenant + user + cliente + caso + pub importante vinculada."""
    tenant = Tenant(nome_escritorio="Tenant Kanban")
    db.session.add(tenant)
    db.session.flush()

    user = User(
        username="kanban_user",
        email="kanban@test.com",
        role="admin",
        tenant_id=tenant.id,
    )
    user.set_password("Senha123!")
    db.session.add(user)
    db.session.flush()

    cliente = Cliente(
        tenant_id=tenant.id,
        user_id=user.id,
        nome_razao_social="Acme Industrias LTDA",
        cpf_cnpj="11222333000144",
        tipo_pessoa="PJ",
    )
    db.session.add(cliente)
    db.session.flush()

    caso = Caso(
        tenant_id=tenant.id,
        user_id=user.id,
        cliente_id=cliente.id,
        titulo="Acme x Estado do PR",
        numero_processo="0000123-45.2026.8.16.0075",
        area_direito="Civel",
    )
    db.session.add(caso)
    db.session.flush()

    pub = PublicacaoDJEN(
        user_id=user.id,
        tenant_id=tenant.id,
        caso_id=caso.id,
        djen_id=900100,
        sigla_tribunal="TJPR",
        tipo_comunicacao="Intimacao",
        numero_processo=caso.numero_processo,
        numero_processo_mascara=caso.numero_processo,
        texto=(
            "Fica intimada a parte autora para apresentar contestacao no "
            "prazo de 15 dias, sob pena de revelia."
        ),
        data_disponibilizacao=date(2026, 5, 10),
        importante=True,
        classificacao_motivo="Intimacao para contestar",
        lida=False,
    )
    db.session.add(pub)
    db.session.commit()

    token = create_access_token(identity=str(user.id))
    return {
        "tenant": tenant,
        "user": user,
        "cliente": cliente,
        "caso": caso,
        "pub": pub,
        "headers": {"Authorization": f"Bearer {token}"},
    }


class TestCalculadorPrazo:
    def test_contestacao_15_dias(self):
        base = date(2026, 5, 10)
        out = calcular_prazo(
            "Intimacao",
            "Fica intimada a apresentar contestacao no prazo de 15 dias.",
            base,
        )
        assert out["dias"] == 15
        assert out["regra"] == "contestacao_15d"
        assert out["data_vencimento"].date() == base + timedelta(days=15)
        assert out["prioridade"] == "Alta"

    def test_recurso_15_dias(self):
        base = date(2026, 5, 10)
        out = calcular_prazo(
            "Sentenca",
            "Julgo procedente o pedido. Da sentenca cabe recurso de apelacao.",
            base,
        )
        # Match em "recurso" ANTES de cair no fallback de sentenca_revisao
        assert out["regra"] == "recurso_15d"
        assert out["dias"] == 15

    def test_audiencia_designada_7_dias_urgente(self):
        base = date(2026, 5, 10)
        out = calcular_prazo(
            "Despacho",
            "Designada audiencia de instrucao para 02/06/2026 as 14h.",
            base,
        )
        assert out["regra"] == "audiencia_7d"
        assert out["prioridade"] == "Urgente"
        assert out["dias"] == 7

    def test_fallback_conservador_5d(self):
        """Tipo desconhecido + texto sem keyword cai no fallback de 5 dias."""
        out = calcular_prazo("Outro", "texto sem palavra-chave relevante", date(2026, 5, 10))
        assert out["regra"] == "fallback_conservador_5d"
        assert out["dias"] == 5
        assert out["prioridade"] == "Normal"

    def test_sem_data_disponibilizacao_usa_hoje(self):
        out = calcular_prazo("Intimacao", "contestacao no prazo de 15 dias", None)
        # Aceita qualquer data — apenas garante que retornou prazo valido
        assert out["dias"] >= 5
        assert isinstance(out["data_vencimento"], datetime)


class TestCriarTarefaDePublicacao:
    def test_cria_tarefa_quando_importante_e_com_caso(self, db, setup_kanban_djen):
        pub = setup_kanban_djen["pub"]
        tarefa = _criar_tarefa_de_publicacao(db, TarefaPrazo, pub)
        db.session.commit()

        assert tarefa is not None
        assert tarefa.caso_id == pub.caso_id
        assert tarefa.publicacao_djen_id == pub.id
        assert tarefa.prazo_calculado_por_ia is True
        assert tarefa.prazo_validado is False
        assert tarefa.tipo_tarefa == "Prazo"
        assert tarefa.status == "A Fazer"
        assert tarefa.prazo_dias_origem == 15  # regra contestacao

    def test_nao_cria_se_pub_nao_importante(self, db, setup_kanban_djen):
        pub = setup_kanban_djen["pub"]
        pub.importante = False
        db.session.commit()
        assert _criar_tarefa_de_publicacao(db, TarefaPrazo, pub) is None

    def test_nao_cria_se_pub_sem_caso(self, db, setup_kanban_djen):
        pub = setup_kanban_djen["pub"]
        pub.caso_id = None
        db.session.commit()
        assert _criar_tarefa_de_publicacao(db, TarefaPrazo, pub) is None

    def test_idempotente_nao_duplica(self, db, setup_kanban_djen):
        pub = setup_kanban_djen["pub"]
        primeira = _criar_tarefa_de_publicacao(db, TarefaPrazo, pub)
        db.session.commit()
        segunda = _criar_tarefa_de_publicacao(db, TarefaPrazo, pub)
        assert primeira is not None
        assert segunda is None
        total = TarefaPrazo.query.filter_by(publicacao_djen_id=pub.id).count()
        assert total == 1


class TestExecutarAutoCriacao:
    def test_varre_multiplas_pubs_e_idempotente(self, app, db, setup_kanban_djen):
        user = setup_kanban_djen["user"]
        caso = setup_kanban_djen["caso"]
        tenant = setup_kanban_djen["tenant"]

        # Adiciona mais 2 pubs importantes vinculadas
        for i in range(2):
            db.session.add(
                PublicacaoDJEN(
                    user_id=user.id,
                    tenant_id=tenant.id,
                    caso_id=caso.id,
                    djen_id=900200 + i,
                    sigla_tribunal="TJPR",
                    tipo_comunicacao="Sentenca",
                    numero_processo=caso.numero_processo,
                    texto="Julgo procedente. Cabe recurso no prazo de 15 dias.",
                    data_disponibilizacao=date(2026, 5, 10 + i),
                    importante=True,
                )
            )
        db.session.commit()

        with app.app_context():
            criadas1 = executar_auto_criacao_tarefas(app, tenant_id=tenant.id)
        assert criadas1 == 3  # 1 do setup + 2 novas

        with app.app_context():
            criadas2 = executar_auto_criacao_tarefas(app, tenant_id=tenant.id)
        assert criadas2 == 0  # idempotente — nao duplica

        total = TarefaPrazo.query.filter_by(tenant_id=tenant.id).count()
        assert total == 3


class TestDtoEnriquecido:
    def test_get_tarefas_serializa_cliente_e_caso(self, client, db, setup_kanban_djen):
        pub = setup_kanban_djen["pub"]
        # Cria a tarefa
        _criar_tarefa_de_publicacao(db, TarefaPrazo, pub)
        db.session.commit()

        resp = client.get("/api/v1/tarefas/", headers=setup_kanban_djen["headers"])
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) == 1
        t = data[0]
        assert t["cliente_nome"] == "Acme Industrias LTDA"
        assert t["numero_processo"] == "0000123-45.2026.8.16.0075"
        assert t["prazo_calculado_por_ia"] is True
        assert t["prazo_validado"] is False
        assert t["prazo_dias_origem"] == 15


class TestValidarPrazoRota:
    def test_patch_confirma_prazo(self, client, db, setup_kanban_djen):
        pub = setup_kanban_djen["pub"]
        tarefa = _criar_tarefa_de_publicacao(db, TarefaPrazo, pub)
        db.session.commit()
        assert tarefa.prazo_validado is False

        resp = client.patch(
            f"/api/v1/tarefas/{tarefa.id}/validar-prazo",
            json={},
            headers=setup_kanban_djen["headers"],
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["prazo_validado"] is True

    def test_patch_aceita_nova_data(self, client, db, setup_kanban_djen):
        pub = setup_kanban_djen["pub"]
        tarefa = _criar_tarefa_de_publicacao(db, TarefaPrazo, pub)
        db.session.commit()

        nova = "2026-06-15T12:00:00"
        resp = client.patch(
            f"/api/v1/tarefas/{tarefa.id}/validar-prazo",
            json={"data_vencimento": nova, "prioridade": "Urgente"},
            headers=setup_kanban_djen["headers"],
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["prazo_validado"] is True
        assert data["prioridade"] == "Urgente"
        # data_vencimento serializada pelo DTO em iso8601
        assert "2026-06-15" in data["data_vencimento"]
