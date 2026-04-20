# Arquivo: tests/test_documentos_api.py
# Testes para as rotas da API de Documentos.

import json
from io import BytesIO


def criar_cliente_teste(auth_client, sufixo=1):
    payload = {
        "nome_razao_social": f"Cliente Doc Teste {sufixo}",
        "cpf_cnpj": f"11222333000{str(sufixo).zfill(3)}",
        "tipo_pessoa": "PJ",
    }
    response = auth_client.post("/api/v1/clientes", json=payload)
    assert response.status_code == 201, response.data
    return json.loads(response.data)["id"]


def test_get_documentos_lista_vazia(auth_client, db):
    response = auth_client.get("/api/v1/documentos")
    assert response.status_code == 200
    data = json.loads(response.data)
    assert isinstance(data, list)
    assert len(data) == 0


_PDF_STUB = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<< /Type /Catalog >>\nendobj\n"


def test_upload_documento_sucesso(auth_client, db):
    cliente_id = criar_cliente_teste(auth_client, 1)
    data_form = {
        "cliente_id": str(cliente_id),
        "file": (BytesIO(_PDF_STUB), "teste.pdf"),
    }
    response = auth_client.post(
        "/api/v1/documentos/upload", data=data_form, content_type="multipart/form-data"
    )
    assert response.status_code == 201, response.data
    data = json.loads(response.data)
    assert "id" in data
    assert data["nome_arquivo"].startswith("teste")


def test_upload_documento_sem_arquivo(auth_client, db):
    response = auth_client.post(
        "/api/v1/documentos/upload", data={}, content_type="multipart/form-data"
    )
    assert response.status_code == 400
    data = json.loads(response.data)
    assert "message" in data


def test_upload_documento_tipo_nao_permitido(auth_client, db):
    data_form = {
        "file": (BytesIO(b"x"), "teste.exe"),
    }
    response = auth_client.post(
        "/api/v1/documentos/upload", data=data_form, content_type="multipart/form-data"
    )
    assert response.status_code == 400
    data = json.loads(response.data)
    assert "message" in data


def test_download_documento_existente(auth_client, db):
    cliente_id = criar_cliente_teste(auth_client, 2)
    conteudo = _PDF_STUB
    data_form = {
        "cliente_id": str(cliente_id),
        "file": (BytesIO(conteudo), "download_teste.pdf"),
    }
    res_upload = auth_client.post(
        "/api/v1/documentos/upload", data=data_form, content_type="multipart/form-data"
    )
    assert res_upload.status_code == 201
    doc_id = json.loads(res_upload.data)["id"]

    response_download = auth_client.get(f"/api/v1/documentos/download/{doc_id}")
    assert response_download.status_code == 200
    assert response_download.data == conteudo


def test_delete_documento_sucesso(auth_client, db):
    data_form = {
        "file": (BytesIO(_PDF_STUB), "delete.pdf"),
    }
    res_upload = auth_client.post(
        "/api/v1/documentos/upload", data=data_form, content_type="multipart/form-data"
    )
    assert res_upload.status_code == 201
    doc_id = json.loads(res_upload.data)["id"]

    response_delete = auth_client.delete(f"/api/v1/documentos/{doc_id}")
    assert response_delete.status_code == 204

    response_get = auth_client.get(f"/api/v1/documentos/download/{doc_id}")
    assert response_get.status_code == 404
