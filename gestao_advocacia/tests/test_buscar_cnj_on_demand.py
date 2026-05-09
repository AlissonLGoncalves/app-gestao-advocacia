"""Testes do Epic #12 (#186): busca on-demand de processo via CNJ."""

import json
from unittest.mock import patch

import pytest

from app import Caso, Cliente, User, db
from tribunal_adapters.base import BuscaProcessoResultado
from utils.tribunal_detector import detectar_tribunal_do_cnj


# ---------------------------------------------------------------------------
# detectar_tribunal_do_cnj
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "cnj,esperado_tr,esperado_nome",
    [
        ("0000472-75.2025.8.16.0075", "8.16", "TJPR"),
        ("00004727520258160075", "8.16", "TJPR"),
        ("0000001-84.2020.8.26.0001", "8.26", "TJSP"),
        ("5022967-43.2026.4.04.7000", "4.04", "TRF4"),
        ("1234567-66.2026.5.02.0001", "5.02", "TRT2"),
    ],
)
def test_detector_identifica_tribunais_conhecidos(cnj, esperado_tr, esperado_nome):
    info = detectar_tribunal_do_cnj(cnj)
    assert info["tribunal_codigo"] == esperado_tr
    assert info["tribunal_nome"] == esperado_nome
    assert info["suportado"] is True
    assert info["erro"] is None


@pytest.mark.parametrize("cnj", ["", "abc", "123", None, "0000472"])
def test_detector_retorna_erro_para_cnj_invalido(cnj):
    info = detectar_tribunal_do_cnj(cnj)
    assert info["erro"] == "cnj_formato_invalido"
    assert info["suportado"] is False


def test_detector_normaliza_apenas_digitos_para_canonico():
    info = detectar_tribunal_do_cnj("00004727520258160075")
    assert info["cnj_normalizado"] == "0000472-75.2025.8.16.0075"
    assert info["ano"] == 2025
    assert info["origem"] == 75


# ---------------------------------------------------------------------------
# Endpoint POST /casos/buscar-cnj
# ---------------------------------------------------------------------------
def _register_and_login(client, suffix):
    username = f"busc_{suffix}"
    password = "Senha1234!"
    reg = client.post(
        "/api/v1/auth/register",
        json={
            "username": username,
            "email": f"{username}@example.com",
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
    data = json.loads(login.data)
    with client.application.app_context():
        user = db.session.get(User, data["user"]["id"])
        data["user"]["tenant_id"] = user.tenant_id
    return data["access_token"], data["user"]


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


def test_buscar_cnj_sem_token_retorna_401(client):
    res = client.post("/api/v1/casos/buscar-cnj", json={"cnj": "0000472-75.2025.8.16.0075"})
    assert res.status_code == 401


def test_buscar_cnj_sem_campo_retorna_400(client):
    token, _ = _register_and_login(client, "missing")
    res = client.post("/api/v1/casos/buscar-cnj", json={}, headers=_headers(token))
    assert res.status_code == 400
    assert res.get_json()["code"] == "missing_cnj"


def test_buscar_cnj_invalido_retorna_400(client):
    token, _ = _register_and_login(client, "inv")
    res = client.post(
        "/api/v1/casos/buscar-cnj",
        json={"cnj": "abc"},
        headers=_headers(token),
    )
    assert res.status_code == 400
    assert res.get_json()["code"] == "cnj_invalido"


def test_buscar_cnj_de_tribunal_desconhecido_retorna_422(client):
    """CNJ com J=2 (CNJ-CNJ administrativo) — sem adapter."""
    token, _ = _register_and_login(client, "unsup")
    # Constroi CNJ valido em formato mas com segmento 2 (sem entrada no mapa)
    cnj_segmento_2 = "1234567-66.2026.2.02.0001"
    res = client.post(
        "/api/v1/casos/buscar-cnj",
        json={"cnj": cnj_segmento_2},
        headers=_headers(token),
    )
    assert res.status_code == 422
    assert res.get_json()["code"] == "tribunal_nao_suportado"


def test_buscar_cnj_chama_adapter_e_retorna_200_com_sucesso(client):
    token, _ = _register_and_login(client, "ok")
    fake_resultado = BuscaProcessoResultado(
        sucesso=True,
        cnj_normalizado="0000472-75.2025.8.16.0075",
        titulo_sugerido="Joao x Banco X",
        classe_acao="Procedimento Comum",
        vara_juizo="2ª Vara Cível",
        instancia="1ª Instância",
        fonte="datajud",
    )

    with patch(
        "tribunal_adapters.datajud.DataJudAdapter.buscar",
        return_value=fake_resultado,
    ) as mock_buscar:
        res = client.post(
            "/api/v1/casos/buscar-cnj",
            json={"cnj": "0000472-75.2025.8.16.0075"},
            headers=_headers(token),
        )

    assert res.status_code == 200
    body = res.get_json()
    assert body["resultado"]["sucesso"] is True
    assert body["resultado"]["titulo_sugerido"] == "Joao x Banco X"
    assert body["tribunal"]["tribunal_nome"] == "TJPR"
    mock_buscar.assert_called_once()


def test_buscar_cnj_indica_quando_ja_cadastrado(client):
    token, user = _register_and_login(client, "dup")
    cnj_canonico = "0000472-75.2025.8.16.0075"

    with client.application.app_context():
        cliente = Cliente(
            tenant_id=user["tenant_id"],
            nome_razao_social="X",
            cpf_cnpj="123.456.789-09",
            tipo_pessoa="PF",
            user_id=user["id"],
        )
        db.session.add(cliente)
        db.session.flush()
        caso = Caso(
            titulo="Caso ja existente",
            numero_processo=cnj_canonico,
            cliente_id=cliente.id,
            user_id=user["id"],
            tenant_id=user["tenant_id"],
        )
        db.session.add(caso)
        db.session.commit()
        caso_id = caso.id

    fake_resultado = BuscaProcessoResultado(
        sucesso=True, cnj_normalizado=cnj_canonico, fonte="datajud"
    )
    with patch(
        "tribunal_adapters.datajud.DataJudAdapter.buscar",
        return_value=fake_resultado,
    ):
        res = client.post(
            "/api/v1/casos/buscar-cnj",
            json={"cnj": cnj_canonico},
            headers=_headers(token),
        )

    assert res.status_code == 200
    body = res.get_json()
    assert body["ja_cadastrado"]["caso_id"] == caso_id
    assert body["ja_cadastrado"]["titulo"] == "Caso ja existente"


def test_buscar_cnj_quando_adapter_falha_retorna_200_com_erro(client):
    """Adapter retorna sucesso=False (ex: DataJud fora do ar) — endpoint
    devolve 200 com erro_codigo no payload, para UI tratar de forma rica."""
    token, _ = _register_and_login(client, "fail")
    fake_falha = BuscaProcessoResultado(
        sucesso=False,
        fonte="datajud",
        erro="DataJud fora do ar",
        erro_codigo="tribunal_indisponivel",
    )
    with patch(
        "tribunal_adapters.datajud.DataJudAdapter.buscar",
        return_value=fake_falha,
    ):
        res = client.post(
            "/api/v1/casos/buscar-cnj",
            json={"cnj": "0000472-75.2025.8.16.0075"},
            headers=_headers(token),
        )

    assert res.status_code == 200
    body = res.get_json()
    assert body["resultado"]["sucesso"] is False
    assert body["resultado"]["erro_codigo"] == "tribunal_indisponivel"
