"""Testes do modulo de Notificacoes (model + endpoints + cron job + e-mail N3)."""

import json
from datetime import date, datetime, timedelta  # noqa: F401
from unittest.mock import patch

from extensions import db
from models import Notificacao
from notificacoes_tasks import job_verificar_vencimentos
from utils.datas import hoje_brasil

# ===== Endpoints CRUD =====


def _criar_notif(app_ctx, user_id, **kwargs):
    """Helper pra criar notificacao direto no DB."""
    n = Notificacao(
        user_id=user_id,
        tipo=kwargs.get("tipo", "recebimento_vencendo"),
        severidade=kwargs.get("severidade", "warning"),
        titulo=kwargs.get("titulo", "Teste"),
        mensagem=kwargs.get("mensagem"),
        link=kwargs.get("link"),
        lida=kwargs.get("lida", False),
        data_criacao=kwargs.get("data_criacao", datetime.utcnow()),
        dedupe_key=kwargs.get("dedupe_key"),
    )
    db.session.add(n)
    db.session.commit()
    return n


def test_list_vazia_inicialmente(auth_client, db):
    res = auth_client.get("/api/v1/notificacoes/")
    assert res.status_code == 200
    assert json.loads(res.data) == []


def test_list_so_devolve_notif_do_user(auth_client, db, app):
    res_me = auth_client.get("/api/v1/auth/me")
    user_id = json.loads(res_me.data)["id"]
    _criar_notif(app, user_id, titulo="Minha")
    _criar_notif(app, user_id=user_id + 99, titulo="De outro user")

    res = auth_client.get("/api/v1/notificacoes/")
    data = json.loads(res.data)
    assert len(data) == 1
    assert data[0]["titulo"] == "Minha"


def test_unread_count(auth_client, db, app):
    res_me = auth_client.get("/api/v1/auth/me")
    user_id = json.loads(res_me.data)["id"]
    _criar_notif(app, user_id, lida=False, dedupe_key="a")
    _criar_notif(app, user_id, lida=False, dedupe_key="b")
    _criar_notif(app, user_id, lida=True, dedupe_key="c")

    res = auth_client.get("/api/v1/notificacoes/unread-count")
    assert json.loads(res.data)["count"] == 2


def test_filtro_lida_false(auth_client, db, app):
    res_me = auth_client.get("/api/v1/auth/me")
    user_id = json.loads(res_me.data)["id"]
    _criar_notif(app, user_id, lida=False, titulo="Nova", dedupe_key="x")
    _criar_notif(app, user_id, lida=True, titulo="Velha", dedupe_key="y")

    res = auth_client.get("/api/v1/notificacoes/?lida=false")
    data = json.loads(res.data)
    assert len(data) == 1
    assert data[0]["titulo"] == "Nova"


def test_marcar_lida(auth_client, db, app):
    res_me = auth_client.get("/api/v1/auth/me")
    user_id = json.loads(res_me.data)["id"]
    n = _criar_notif(app, user_id, lida=False)

    res = auth_client.put(f"/api/v1/notificacoes/{n.id}/lida")
    assert res.status_code == 200
    assert json.loads(res.data)["lida"] is True


def test_marcar_todas(auth_client, db, app):
    res_me = auth_client.get("/api/v1/auth/me")
    user_id = json.loads(res_me.data)["id"]
    _criar_notif(app, user_id, lida=False, dedupe_key="1")
    _criar_notif(app, user_id, lida=False, dedupe_key="2")
    _criar_notif(app, user_id, lida=True, dedupe_key="3")

    res = auth_client.post("/api/v1/notificacoes/marcar-todas")
    assert res.status_code == 200
    assert json.loads(res.data)["marcadas"] == 2

    unread = json.loads(auth_client.get("/api/v1/notificacoes/unread-count").data)["count"]
    assert unread == 0


def test_delete_notificacao(auth_client, db, app):
    res_me = auth_client.get("/api/v1/auth/me")
    user_id = json.loads(res_me.data)["id"]
    n = _criar_notif(app, user_id)

    res = auth_client.delete(f"/api/v1/notificacoes/{n.id}")
    assert res.status_code == 204
    assert Notificacao.query.get(n.id) is None


def test_nao_pode_acessar_notif_de_outro_user(auth_client, db, app):
    n = _criar_notif(app, user_id=999, titulo="De outro")
    res = auth_client.put(f"/api/v1/notificacoes/{n.id}/lida")
    assert res.status_code == 404


# ===== Cron job =====


def _criar_recebimento_via_api(auth_client, data_vencimento, status="Pendente"):
    cli = auth_client.post(
        "/api/v1/clientes",
        json={"nome_razao_social": "X", "cpf_cnpj": "123.456.789-00", "tipo_pessoa": "PF"},
    )
    cliente_id = json.loads(cli.data)["id"] if cli.status_code == 201 else 1
    return auth_client.post(
        "/api/v1/recebimentos",
        json={
            "descricao": f"Honor — venc {data_vencimento}",
            "valor": 1000,
            "data_vencimento": data_vencimento,
            "status": status,
            "cliente_id": cliente_id,
        },
    )


def test_cron_cria_notif_recebimento_vencendo_em_3_dias(auth_client, db, app):
    em_3 = (hoje_brasil() + timedelta(days=3)).isoformat()
    _criar_recebimento_via_api(auth_client, em_3)

    job_verificar_vencimentos(app)

    notifs = Notificacao.query.filter_by(tipo="recebimento_vencendo").all()
    assert len(notifs) == 1
    assert "3 dia" in notifs[0].titulo


def test_cron_cria_notif_recebimento_atrasado(auth_client, db, app):
    atrasado = (hoje_brasil() - timedelta(days=5)).isoformat()
    _criar_recebimento_via_api(auth_client, atrasado)

    job_verificar_vencimentos(app)

    notifs = Notificacao.query.filter_by(tipo="recebimento_atrasado").all()
    assert len(notifs) == 1
    assert "5 dia" in notifs[0].titulo
    assert notifs[0].severidade == "danger"


def test_cron_idempotente_nao_duplica(auth_client, db, app):
    """Rodar 2x no mesmo dia nao cria notif duplicada."""
    em_3 = (hoje_brasil() + timedelta(days=3)).isoformat()
    _criar_recebimento_via_api(auth_client, em_3)

    job_verificar_vencimentos(app)
    job_verificar_vencimentos(app)

    notifs = Notificacao.query.filter_by(tipo="recebimento_vencendo").all()
    assert len(notifs) == 1


def test_cron_nao_cria_para_pago(auth_client, db, app):
    em_3 = (hoje_brasil() + timedelta(days=3)).isoformat()
    _criar_recebimento_via_api(auth_client, em_3, status="Pago")

    job_verificar_vencimentos(app)

    assert Notificacao.query.count() == 0


def test_cron_cria_para_despesa_atrasada(auth_client, db, app):
    atrasada = (hoje_brasil() - timedelta(days=2)).isoformat()
    auth_client.post(
        "/api/v1/despesas",
        json={
            "descricao": "Aluguel",
            "valor": 3000,
            "data_vencimento": atrasada,
            "status": "Pendente",
        },
    )

    job_verificar_vencimentos(app)

    notifs = Notificacao.query.filter_by(tipo="despesa_atrasada").all()
    assert len(notifs) == 1
    assert notifs[0].link.startswith("/despesas/editar/")


# ===== N3: e-mail de vencimento (opt-in) =====


def test_me_expoe_preferencia_email_default_true(auth_client, db):
    res = auth_client.get("/api/v1/auth/me")
    assert res.status_code == 200
    assert json.loads(res.data)["notif_email_vencimentos"] is True


def test_put_me_atualiza_preferencia_email(auth_client, db):
    res = auth_client.put("/api/v1/auth/me", json={"notif_email_vencimentos": False})
    assert res.status_code == 200
    assert json.loads(res.data)["notif_email_vencimentos"] is False
    # persiste
    res2 = auth_client.get("/api/v1/auth/me")
    assert json.loads(res2.data)["notif_email_vencimentos"] is False


def test_cron_envia_email_quando_optin_ativo(auth_client, db, app):
    """Por padrao (opt-in True), cron dispara e-mail pra notif nova."""
    em_3 = (hoje_brasil() + timedelta(days=3)).isoformat()
    _criar_recebimento_via_api(auth_client, em_3)

    # enviar_email eh importado dentro de _enviar_email_se_optin
    # (from mail_service import enviar_email), entao patcha-se no modulo origem.
    with patch("mail_service.enviar_email") as mock_email:
        mock_email.return_value = True
        job_verificar_vencimentos(app)

    # E-mail deve ter sido chamado ao menos 1x (a notif criada)
    assert mock_email.called


def test_cron_nao_envia_email_quando_optout(auth_client, db, app):
    """Com opt-out (False), cron cria notif in-app mas NAO envia e-mail."""
    # Desliga preferencia do user logado
    res_me = auth_client.get("/api/v1/auth/me")
    json.loads(res_me.data)["id"]
    auth_client.put("/api/v1/auth/me", json={"notif_email_vencimentos": False})

    em_3 = (hoje_brasil() + timedelta(days=3)).isoformat()
    _criar_recebimento_via_api(auth_client, em_3)

    with patch("mail_service.enviar_email") as mock_email:
        mock_email.return_value = True
        job_verificar_vencimentos(app)

    # Notif in-app criada, mas e-mail NAO enviado
    assert Notificacao.query.filter_by(tipo="recebimento_vencendo").count() == 1
    assert not mock_email.called


def test_cron_idempotente_nao_reenvia_email(auth_client, db, app):
    """Rodar 2x: e-mail so na 1a (2a cai no dedupe e nao reenvia)."""
    em_3 = (hoje_brasil() + timedelta(days=3)).isoformat()
    _criar_recebimento_via_api(auth_client, em_3)

    with patch("mail_service.enviar_email") as mock_email:
        mock_email.return_value = True
        job_verificar_vencimentos(app)
        primeira = mock_email.call_count
        job_verificar_vencimentos(app)
        segunda = mock_email.call_count

    assert primeira == 1
    assert segunda == 1  # nao reenviou na 2a rodada
