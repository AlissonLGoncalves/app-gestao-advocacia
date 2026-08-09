"""Testes do Epic #175: viewer + download de procuracoes/contratos no detalhe do caso."""

import json
import os
import tempfile

from app import Caso, Cliente, User, db
from models import ContratoHonorario


def _register_and_login(client, suffix):
    username = f"docs_{suffix}"
    email = f"docs_{suffix}@example.com"
    password = "Senha1234!"

    reg = client.post(
        "/api/v1/auth/register",
        json={
            "username": username,
            "email": email,
            "password": password,
            "role": "admin",
            "aceite_termos": True,
            "aceite_lgpd": True,
            "versao_termos": "v1.0",
            "versao_lgpd": "v1.0",
        },
    )
    assert reg.status_code == 201, reg.data

    login = client.post(
        "/api/v1/auth/login",
        json={"username_or_email": username, "password": password},
    )
    assert login.status_code == 200, login.data
    data = json.loads(login.data)
    with client.application.app_context():
        user = db.session.get(User, data["user"]["id"])
        data["user"]["tenant_id"] = user.tenant_id
    return data["access_token"], data["user"]


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


def _criar_cliente_e_caso(app, user_id, tenant_id):
    with app.app_context():
        cliente = Cliente(
            tenant_id=tenant_id,
            nome_razao_social="Cliente Teste",
            cpf_cnpj="529.982.247-25",
            tipo_pessoa="PF",
            user_id=user_id,
        )
        db.session.add(cliente)
        db.session.flush()

        caso = Caso(
            titulo="Caso de teste",
            numero_processo="0000001-23.2024.8.16.0001",
            cliente_id=cliente.id,
            user_id=user_id,
            tenant_id=tenant_id,
        )
        db.session.add(caso)
        db.session.commit()
        return cliente.id, caso.id


def _criar_pdf_temporario(conteudo=b"%PDF-1.4 fake content"):
    tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    tmp.write(conteudo)
    tmp.close()
    return tmp.name


def test_listar_documentos_caso_vazio(client):
    token, user = _register_and_login(client, "vazio")
    _, caso_id = _criar_cliente_e_caso(client.application, user["id"], user["tenant_id"])

    res = client.get(f"/api/v1/casos/{caso_id}/documentos", headers=_headers(token))
    assert res.status_code == 200
    body = res.get_json()
    assert body == {"procuracoes": [], "contratos": []}


def test_listar_documentos_inclui_contratos_do_caso_e_do_cliente(client):
    token, user = _register_and_login(client, "lista")
    cliente_id, caso_id = _criar_cliente_e_caso(client.application, user["id"], user["tenant_id"])

    with client.application.app_context():
        # Contrato vinculado ao caso
        c1 = ContratoHonorario(
            tenant_id=user["tenant_id"],
            tipo_honorario="Fixo",
            valor_total=10000,
            cliente_id=cliente_id,
            caso_id=caso_id,
            user_id=user["id"],
        )
        # Contrato do cliente sem caso (deve aparecer tambem)
        c2 = ContratoHonorario(
            tenant_id=user["tenant_id"],
            tipo_honorario="Êxito",
            percentual_exito=30,
            cliente_id=cliente_id,
            caso_id=None,
            user_id=user["id"],
        )
        db.session.add_all([c1, c2])
        db.session.commit()

    res = client.get(f"/api/v1/casos/{caso_id}/documentos", headers=_headers(token))
    assert res.status_code == 200
    body = res.get_json()
    assert len(body["contratos"]) == 2
    assert all(c["tem_pdf"] is False for c in body["contratos"])


def test_baixar_arquivo_contrato_404_quando_sem_pdf(client):
    token, user = _register_and_login(client, "sempdf")
    cliente_id, _ = _criar_cliente_e_caso(client.application, user["id"], user["tenant_id"])

    with client.application.app_context():
        contrato = ContratoHonorario(
            tenant_id=user["tenant_id"],
            tipo_honorario="Fixo",
            cliente_id=cliente_id,
            user_id=user["id"],
        )
        db.session.add(contrato)
        db.session.commit()
        contrato_id = contrato.id

    res = client.get(f"/api/v1/contratos/{contrato_id}/arquivo", headers=_headers(token))
    assert res.status_code == 404
    assert res.get_json()["code"] == "pdf_unavailable"


def test_baixar_arquivo_contrato_200_quando_pdf_existe(client):
    token, user = _register_and_login(client, "compdf")
    cliente_id, _ = _criar_cliente_e_caso(client.application, user["id"], user["tenant_id"])
    pdf_path = _criar_pdf_temporario()

    try:
        with client.application.app_context():
            contrato = ContratoHonorario(
                tenant_id=user["tenant_id"],
                tipo_honorario="Fixo",
                cliente_id=cliente_id,
                arquivo_path=pdf_path,
                arquivo_nome="contrato.pdf",
                user_id=user["id"],
            )
            db.session.add(contrato)
            db.session.commit()
            contrato_id = contrato.id

        res = client.get(f"/api/v1/contratos/{contrato_id}/arquivo", headers=_headers(token))
        assert res.status_code == 200
        assert res.data.startswith(b"%PDF")
        res.close()
    finally:
        try:
            os.unlink(pdf_path)
        except (OSError, PermissionError):
            pass  # Windows mantem handle aberto; lixo limpado pelo OS depois


def test_baixar_arquivo_contrato_sem_token_401(client):
    res = client.get("/api/v1/contratos/1/arquivo")
    assert res.status_code == 401


def test_listar_documentos_caso_de_outro_tenant_404(client):
    token_a, user_a = _register_and_login(client, "iso_a")
    token_b, _ = _register_and_login(client, "iso_b")
    _, caso_id = _criar_cliente_e_caso(client.application, user_a["id"], user_a["tenant_id"])

    res = client.get(f"/api/v1/casos/{caso_id}/documentos", headers=_headers(token_b))
    assert res.status_code == 404
