# Arquivo: tests/test_documentos_api.py
# Testes para as rotas da API de Documentos.
# v3: Corrigidas falhas em test_download_documento_existente e na geração de CPF/CNPJ em helpers.

import json
import os
from io import BytesIO
from app import Cliente, Caso, Documento # Importa os modelos necessários
from datetime import date, datetime, timezone
from werkzeug.http import parse_options_header # Para parsear Content-Disposition

# --- Funções Auxiliares para criar dados de teste ---

def criar_cliente_teste_para_documento(client, db, id_numerico_sufixo=0):
    """Cria um cliente de teste com CPF/CNPJ numérico e retorna seu ID."""
    # Gera um CPF/CNPJ numérico simples e único para evitar problemas de formatação/comprimento
    # Garante que não haverá caracteres não numéricos problemáticos e que o comprimento é controlado.
    if id_numerico_sufixo % 2 == 0: # Alterna entre PF e PJ para variedade
        cpf_cnpj_teste = f"11122233{str(id_numerico_sufixo).zfill(3)}" # CPF com 11 dígitos
        tipo_pessoa_teste = "PF"
    else:
        cpf_cnpj_teste = f"11222333000{str(id_numerico_sufixo).zfill(3)}" # CNPJ com 14 dígitos
        tipo_pessoa_teste = "PJ"

    cliente_data = {
        "nome_razao_social": f"Cliente Doc Teste {id_numerico_sufixo}",
        "cpf_cnpj": cpf_cnpj_teste, 
        "tipo_pessoa": tipo_pessoa_teste,
        "email": f"cliente.doc.{id_numerico_sufixo}@teste.com"
    }
    response = client.post('/api/clientes', json=cliente_data)
    assert response.status_code == 201, f"Falha ao criar cliente de teste para documento (sufixo {id_numerico_sufixo}): {response.data.decode()}"
    return json.loads(response.data)['id']

def criar_caso_teste_para_documento(client, db, cliente_id, titulo_sufixo=""):
    """Cria um caso de teste associado a um cliente e retorna seu ID."""
    caso_data = {
        "cliente_id": cliente_id,
        "titulo": f"Caso para Documento Teste {titulo_sufixo}",
        "status": "Ativo",
        "tipo_acao": "Contratual",
        "data_distribuicao": date(2023, 4, 1).isoformat()
    }
    response = client.post('/api/casos', json=caso_data)
    assert response.status_code == 201, f"Falha ao criar caso de teste para documento ({titulo_sufixo}): {response.data.decode()}"
    return json.loads(response.data)['id']

# --- Testes para a API de Documentos ---

def test_get_documentos_lista_vazia(client, db):
    """Testa GET /api/documentos quando não há documentos."""
    response = client.get('/api/documentos')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'documentos' in data
    assert len(data['documentos']) == 0

def test_upload_documento_sucesso(client, db):
    """Testa POST /api/documentos/upload com um arquivo válido."""
    cliente_id = criar_cliente_teste_para_documento(client, db, 1) # Usando sufixo numérico
    caso_id = criar_caso_teste_para_documento(client, db, cliente_id, "DOC01")

    data_form = {
        'descricao': 'Contrato Teste Upload',
        'cliente_id': str(cliente_id), 
        'caso_id': str(caso_id)
    }
    file_content = b"Este eh o conteudo do arquivo de teste."
    file_data = (BytesIO(file_content), 'teste.txt')
    data_form['file'] = file_data
    
    response = client.post('/api/documentos/upload', data=data_form, content_type='multipart/form-data')
    
    assert response.status_code == 201, f"Erro no upload: {response.data.decode()}"
    response_data = json.loads(response.data)
    assert response_data['descricao'] == 'Contrato Teste Upload'
    assert response_data['nome_original_arquivo'] == 'teste.txt'
    assert response_data['cliente_id'] == cliente_id
    assert response_data['caso_id'] == caso_id
    assert 'id' in response_data
    assert 'nome_armazenado' in response_data

def test_upload_documento_sem_arquivo(client, db):
    """Testa POST /api/documentos/upload sem enviar um arquivo."""
    data_form = {'descricao': 'Tentativa sem arquivo'}
    response = client.post('/api/documentos/upload', data=data_form, content_type='multipart/form-data')
    assert response.status_code == 400
    response_data = json.loads(response.data)
    assert "Nenhum arquivo enviado" in response_data["erro"]

def test_upload_documento_tipo_nao_permitido(client, db):
    """Testa POST /api/documentos/upload com um tipo de arquivo não permitido."""
    data_form = {'descricao': 'Arquivo com extensão errada'}
    file_data = (BytesIO(b"conteudo"), 'teste.exe') 
    data_form['file'] = file_data
    response = client.post('/api/documentos/upload', data=data_form, content_type='multipart/form-data')
    assert response.status_code == 400
    response_data = json.loads(response.data)
    assert "Tipo de arquivo não permitido" in response_data["erro"]

def test_get_documento_especifico_apos_upload(client, db):
    """Testa GET /api/documentos para listar o documento após upload."""
    cliente_id = criar_cliente_teste_para_documento(client, db, 2)
    data_upload = {
        'descricao': 'Documento para Listagem',
        'cliente_id': str(cliente_id),
        'file': (BytesIO(b"listagem teste"), 'listagem.pdf')
    }
    res_upload = client.post('/api/documentos/upload', data=data_upload, content_type='multipart/form-data')
    assert res_upload.status_code == 201
    
    response_get_list = client.get('/api/documentos')
    assert response_get_list.status_code == 200
    data_list = json.loads(response_get_list.data)
    assert len(data_list['documentos']) >= 1
    assert any(d['descricao'] == 'Documento para Listagem' for d in data_list['documentos'])

def test_download_documento_existente(client, db):
    """Testa GET /api/documentos/download/<nome_armazenado> para um arquivo existente."""
    cliente_id = criar_cliente_teste_para_documento(client, db, 3)
    nome_original = 'download_teste.txt'
    conteudo_original = b"Conteudo para download."
    data_upload = {
        'descricao': 'Doc para Download',
        'cliente_id': str(cliente_id),
        'file': (BytesIO(conteudo_original), nome_original)
    }
    res_upload = client.post('/api/documentos/upload', data=data_upload, content_type='multipart/form-data')
    assert res_upload.status_code == 201
    doc_data = json.loads(res_upload.data)
    nome_armazenado = doc_data['nome_armazenado']

    response_download = client.get(f'/api/documentos/download/{nome_armazenado}')
    assert response_download.status_code == 200
    assert response_download.data == conteudo_original
    
    # Parseando o header Content-Disposition de forma robusta
    disposition_header = response_download.headers.get('Content-Disposition')
    assert disposition_header is not None
    _ , options = parse_options_header(disposition_header)
    assert options.get('filename') == nome_original


def test_download_documento_nao_existente(client, db):
    """Testa GET /api/documentos/download/<nome_armazenado> para um arquivo que não existe."""
    response = client.get('/api/documentos/download/arquivo_que_nao_existe.txt')
    assert response.status_code == 404

def test_update_documento_metadados_sucesso(client, db):
    """Testa PUT /api/documentos/<id> para atualizar metadados de um documento."""
    cliente_id_orig = criar_cliente_teste_para_documento(client, db, 4) 
    cliente_id_novo = criar_cliente_teste_para_documento(client, db, 5)
    caso_id_novo = criar_caso_teste_para_documento(client, db, cliente_id_novo, "DUC_UPD")

    data_upload = {'descricao': 'Metadados Originais', 'cliente_id': str(cliente_id_orig), 'file': (BytesIO(b"meta"), 'meta.txt')}
    res_upload = client.post('/api/documentos/upload', data=data_upload, content_type='multipart/form-data')
    assert res_upload.status_code == 201, f"Falha no upload inicial para update: {res_upload.data.decode()}"
    doc_id = json.loads(res_upload.data)['id']

    dados_atualizacao = {
        "descricao": "Metadados Atualizados Pytest",
        "cliente_id": cliente_id_novo,
        "caso_id": caso_id_novo
    }
    response = client.put(f'/api/documentos/{doc_id}', json=dados_atualizacao)
    assert response.status_code == 200, f"Erro no update: {response.data.decode()}"
    data = json.loads(response.data)
    assert data['descricao'] == dados_atualizacao['descricao']
    assert data['cliente_id'] == cliente_id_novo
    assert data['caso_id'] == caso_id_novo

    doc_db = db.session.get(Documento, doc_id)
    assert doc_db.descricao == "Metadados Atualizados Pytest"

def test_update_documento_metadados_nao_existente(client, db):
    """Testa PUT /api/documentos/<id> para um documento que não existe."""
    response = client.put('/api/documentos/99999', json={"descricao": "Não Existe"})
    assert response.status_code == 404

def test_delete_documento_sucesso(client, db):
    """Testa DELETE /api/documentos/<id> para deletar um documento."""
    data_upload = {'descricao': 'Doc para Deletar', 'file': (BytesIO(b"delete"), 'delete.txt')}
    res_upload = client.post('/api/documentos/upload', data=data_upload, content_type='multipart/form-data')
    assert res_upload.status_code == 201
    doc_id = json.loads(res_upload.data)['id']
    nome_armazenado = json.loads(res_upload.data)['nome_armazenado']
    
    # Garante que o arquivo físico existe antes de deletar
    # Usa a configuração de UPLOAD_FOLDER do app de teste
    upload_folder_test = client.application.config['UPLOAD_FOLDER']
    file_path = os.path.join(upload_folder_test, nome_armazenado)
    
    # Cria um arquivo dummy se ele não foi criado pela rota (para teste local sem salvar arquivos)
    if not os.path.exists(file_path) and client.application.config['TESTING']:
        with open(file_path, 'wb') as f:
            f.write(b"dummy content for delete test")
    
    assert os.path.exists(file_path) 

    response_delete = client.delete(f'/api/documentos/{doc_id}')
    assert response_delete.status_code == 200
    data_delete = json.loads(response_delete.data)
    assert "mensagem" in data_delete
    assert f"Documento ID {doc_id} e arquivo associado deletados com sucesso" in data_delete["mensagem"]

    doc_db = db.session.get(Documento, doc_id)
    assert doc_db is None
    assert not os.path.exists(file_path) 

def test_delete_documento_nao_existente(client, db):
    """Testa DELETE /api/documentos/<id> para um documento que não existe."""
    response = client.delete('/api/documentos/99999')
    assert response.status_code == 404
