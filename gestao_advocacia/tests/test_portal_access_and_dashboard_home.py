from datetime import datetime, timedelta
from pathlib import Path

from flask_jwt_extended import create_access_token

from config_test import ConfigTest
from models import Caso, Cliente, ItemAgenda, PublicacaoDJEN, Tenant, User
from utils.datas import hoje_brasil


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


def _criar_usuario_portal(db):
    tenant = Tenant(nome_escritorio="Escritorio Portal", status="ativo")
    db.session.add(tenant)
    db.session.flush()

    advogado = User(
        username="advogado_portal",
        email="advogado.portal@teste.local",
        role="admin",
        tenant_id=tenant.id,
    )
    advogado.set_password("Senha1234!")
    db.session.add(advogado)
    db.session.flush()

    cliente_portal = Cliente(
        nome_razao_social="Cliente do Portal",
        cpf_cnpj="PORTAL-CPF-1",
        tipo_pessoa="PF",
        user_id=advogado.id,
        tenant_id=tenant.id,
    )
    outro_cliente = Cliente(
        nome_razao_social="Outro Cliente",
        cpf_cnpj="PORTAL-CPF-2",
        tipo_pessoa="PF",
        user_id=advogado.id,
        tenant_id=tenant.id,
    )
    db.session.add_all([cliente_portal, outro_cliente])
    db.session.flush()

    caso_portal = Caso(
        titulo="Caso visivel no portal",
        cliente_id=cliente_portal.id,
        user_id=advogado.id,
        tenant_id=tenant.id,
    )
    outro_caso = Caso(
        titulo="Caso sigiloso de outro cliente",
        cliente_id=outro_cliente.id,
        user_id=advogado.id,
        tenant_id=tenant.id,
    )
    db.session.add_all([caso_portal, outro_caso])
    db.session.flush()

    usuario_portal = User(
        username="cliente_portal",
        email="cliente.portal@teste.local",
        role="cliente",
        tenant_id=tenant.id,
        portal_cliente_id=cliente_portal.id,
    )
    usuario_portal.set_password("Senha1234!")
    db.session.add(usuario_portal)

    futuro = datetime.utcnow() + timedelta(days=3)
    db.session.add_all(
        [
            ItemAgenda(
                tipo="evento",
                titulo="Audiencia do cliente correto",
                data_inicio=futuro,
                status="Pendente",
                caso_id=caso_portal.id,
                user_id=advogado.id,
                tenant_id=tenant.id,
            ),
            ItemAgenda(
                tipo="evento",
                titulo="Audiencia sigilosa de outro cliente",
                data_inicio=futuro,
                status="Pendente",
                caso_id=outro_caso.id,
                user_id=advogado.id,
                tenant_id=tenant.id,
            ),
            ItemAgenda(
                tipo="evento",
                titulo="Evento interno sem caso",
                data_inicio=futuro,
                status="Pendente",
                user_id=advogado.id,
                tenant_id=tenant.id,
            ),
        ]
    )
    db.session.commit()
    return usuario_portal


def test_cliente_fica_restrito_as_apis_do_portal(app, client, db):
    usuario = _criar_usuario_portal(db)
    token = create_access_token(
        identity=str(usuario.id),
        additional_claims={"role": "cliente"},
    )

    portal = client.get("/api/v1/portal/situacao", headers=_headers(token))
    dashboard = client.get("/api/v1/dashboard/home", headers=_headers(token))
    publicacoes = client.get("/api/v1/djen/publicacoes", headers=_headers(token))

    assert portal.status_code == 200
    assert dashboard.status_code == 403
    assert publicacoes.status_code == 403
    assert dashboard.get_json()["message"] == "Acesso restrito ao Portal do Cliente."


def test_portal_mostra_somente_eventos_dos_casos_do_cliente(app, client, db):
    usuario = _criar_usuario_portal(db)
    token = create_access_token(
        identity=str(usuario.id),
        additional_claims={"role": "cliente"},
    )

    response = client.get("/api/v1/portal/situacao", headers=_headers(token))

    assert response.status_code == 200
    titulos = {evento["titulo"] for evento in response.get_json()["proximos_eventos"]}
    assert titulos == {"Audiencia do cliente correto"}


def test_dashboard_home_limita_listas_e_entrega_resumo(auth_client, db):
    usuario = db.session.get(User, int(auth_client.user["id"]))
    # Ancora as fixtures no dia civil de Brasilia: o handler classifica
    # urgencia com hoje_brasil(). Usando utcnow() o teste quebrava no CI
    # entre 21h e 0h BRT, quando UTC ja virou o dia e Brasilia nao.
    hoje = hoje_brasil()
    meio_dia_hoje = datetime.combine(hoje, datetime.min.time()) + timedelta(hours=12)

    cliente = Cliente(
        nome_razao_social="Cliente Dashboard Home",
        cpf_cnpj="DASH-HOME-CPF",
        tipo_pessoa="PF",
        user_id=usuario.id,
        tenant_id=usuario.tenant_id,
    )
    db.session.add(cliente)
    db.session.flush()
    caso = Caso(
        titulo="Caso Dashboard Home",
        cliente_id=cliente.id,
        user_id=usuario.id,
        tenant_id=usuario.tenant_id,
    )
    db.session.add(caso)
    db.session.flush()

    for indice in range(7):
        db.session.add(
            ItemAgenda(
                tipo="tarefa",
                titulo=f"Prazo {indice}",
                status="Pendente",
                data_vencimento=meio_dia_hoje + timedelta(days=indice - 2),
                caso_id=caso.id,
                user_id=usuario.id,
                tenant_id=usuario.tenant_id,
            )
        )
        db.session.add(
            PublicacaoDJEN(
                tenant_id=usuario.tenant_id,
                user_id=usuario.id,
                caso_id=caso.id,
                data_disponibilizacao=hoje,
                texto=f"Publicacao recente {indice}",
                sigla_tribunal="TJPR",
                ativo=True,
                triagem_ignorada=False,
            )
        )
    db.session.commit()

    response = auth_client.get("/api/v1/dashboard/home")

    assert response.status_code == 200
    payload = response.get_json()
    assert {
        "resumo",
        "hoje",
        "tarefas_prioritarias",
        "publicacoes_recentes",
        "monitoramento_djen_configurado",
    } <= set(payload)
    assert len(payload["tarefas_prioritarias"]) == 5
    assert len(payload["publicacoes_recentes"]) == 5
    assert payload["resumo"]["prazos_urgentes"] >= 3


def test_app_respeita_upload_folder_da_configuracao(app):
    assert Path(app.config["UPLOAD_FOLDER"]).resolve() == Path(ConfigTest.UPLOAD_FOLDER).resolve()
