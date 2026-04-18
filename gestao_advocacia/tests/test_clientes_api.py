# Arquivo: tests/test_clientes_api.py
# Testes para as rotas da API de Clientes usando pytest-flask.

import io
import json

from app import Cliente

CLIENTE_PF = {
    "nome_razao_social": "Cliente Teste PF Pytest",
    "cpf_cnpj": "123.456.789-00",
    "tipo_pessoa": "PF",
    "email": "pf.teste.pytest@email.com",
}


def test_get_clientes_lista_vazia(auth_client, db):
    response = auth_client.get("/api/v1/clientes")
    assert response.status_code == 200
    data = json.loads(response.data)
    assert isinstance(data, list)
    assert len(data) == 0


def test_create_cliente_pf_sucesso(auth_client, db):
    response = auth_client.post("/api/v1/clientes", json=CLIENTE_PF)
    assert response.status_code == 201
    data = json.loads(response.data)
    assert data["nome_razao_social"] == CLIENTE_PF["nome_razao_social"]
    assert data["cpf_cnpj"] == CLIENTE_PF["cpf_cnpj"]

    cliente_db = db.session.get(Cliente, data["id"])
    assert cliente_db is not None


def test_create_cliente_dados_incompletos(auth_client, db):
    response = auth_client.post("/api/v1/clientes", json={"nome_razao_social": "Incompleto"})
    assert response.status_code == 400


def test_create_cliente_cpf_cnpj_duplicado(auth_client, db):
    r1 = auth_client.post("/api/v1/clientes", json=CLIENTE_PF)
    assert r1.status_code == 201

    payload = {
        "nome_razao_social": "Outro Cliente PF",
        "cpf_cnpj": CLIENTE_PF["cpf_cnpj"],
        "tipo_pessoa": "PF",
    }
    response = auth_client.post("/api/v1/clientes", json=payload)
    assert response.status_code == 409


def test_get_cliente_especifico_existente(auth_client, db):
    res_post = auth_client.post("/api/v1/clientes", json=CLIENTE_PF)
    assert res_post.status_code == 201
    cliente_id = json.loads(res_post.data)["id"]

    response = auth_client.get(f"/api/v1/clientes/{cliente_id}")
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data["id"] == cliente_id


def test_get_cliente_especifico_nao_existente(auth_client, db):
    response = auth_client.get("/api/v1/clientes/99999")
    assert response.status_code == 404
    data = json.loads(response.data)
    assert "message" in data


def test_update_cliente_sucesso(auth_client, db):
    res_post = auth_client.post("/api/v1/clientes", json=CLIENTE_PF)
    assert res_post.status_code == 201
    cliente_id = json.loads(res_post.data)["id"]

    payload = {
        "nome_razao_social": "Cliente Atualizado",
        "cpf_cnpj": CLIENTE_PF["cpf_cnpj"],
        "tipo_pessoa": "PF",
        "email": "email.atualizado.pytest@email.com",
        "telefone": "00000-0000",
    }
    response = auth_client.put(f"/api/v1/clientes/{cliente_id}", json=payload)
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data["email"] == payload["email"]


def test_delete_cliente_sucesso(auth_client, db):
    res_post = auth_client.post("/api/v1/clientes", json=CLIENTE_PF)
    assert res_post.status_code == 201
    cliente_id = json.loads(res_post.data)["id"]

    response_delete = auth_client.delete(f"/api/v1/clientes/{cliente_id}")
    assert response_delete.status_code == 204

    response_get = auth_client.get(f"/api/v1/clientes/{cliente_id}")
    assert response_get.status_code == 404


def test_extrair_dados_procuração_upload_singular(auth_client, db):
    texto = (
        "PROCURAÇÃO\n"
        "OUTORGANTE: EDIMILSON FRANCISCO DA COSTA\n"
        "CPF: 123.456.789-00\n"
        "RG: 12.345.678-9\n"
        "ESTADO CIVIL: Casado\n"
        "PROFISSÃO: Motorista\n"
        "NACIONALIDADE: Brasileiro\n"
        "E-MAIL: edimilson@email.com\n"
        "TELEFONE: (11) 91234-5678\n"
        "ENDEREÇO: Rua das Flores, 123, Centro\n"
        "CEP: 01001-000\n"
    )

    data = {
        "documento": (io.BytesIO(texto.encode("utf-8")), "procuracao.txt"),
    }

    response = auth_client.post(
        "/api/v1/clientes/extrair-dados-doc",
        data=data,
        content_type="multipart/form-data",
    )

    assert response.status_code == 200, response.data
    payload = json.loads(response.data)
    assert payload["nome_razao_social"] == "Edimilson Francisco Da Costa"
    assert payload["cpf"] == "123.456.789-00"
    assert payload["documento_principal"] == "123.456.789-00"
    assert payload["tipo_pessoa_sugerida"] == "PF"
    assert payload["email"] == "edimilson@email.com"
    assert payload["telefone"] == "(11) 91234-5678"


def test_extrair_dados_doc_aceita_documentos_em_lote(auth_client, db):
    texto = "NOME: CLEUSA MARIA SILVA\nCPF: 98765432100\n"
    data = {
        "documentos": [(io.BytesIO(texto.encode("utf-8")), "cliente.txt")],
    }

    response = auth_client.post(
        "/api/v1/clientes/extrair-dados-doc",
        data=data,
        content_type="multipart/form-data",
    )

    assert response.status_code == 200, response.data
    payload = json.loads(response.data)
    assert payload["cpf"] == "98765432100"


def test_extrair_dados_doc_sugere_pj_por_cnpj(auth_client, db):
    texto = "RAZAO SOCIAL: EMPRESA XPTO LTDA\nCNPJ: 12.345.678/0001-90\n"
    data = {
        "documento": (io.BytesIO(texto.encode("utf-8")), "empresa.txt"),
    }

    response = auth_client.post(
        "/api/v1/clientes/extrair-dados-doc",
        data=data,
        content_type="multipart/form-data",
    )

    assert response.status_code == 200, response.data
    payload = json.loads(response.data)
    assert payload["cnpj"] == "12.345.678/0001-90"
    assert payload["documento_principal"] == "12.345.678/0001-90"
    assert payload["tipo_pessoa_sugerida"] == "PJ"
