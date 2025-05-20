# Arquivo: tests/test_clientes_api.py
# Testes para as rotas da API de Clientes usando pytest-flask.

import json
from app import Cliente # Importa o modelo para verificar ou criar dados no DB de teste

# Dados de exemplo para os testes
cliente_pf_data_valido = {
    "nome_razao_social": "Cliente Teste PF Pytest",
    "cpf_cnpj": "123.456.789-00",
    "tipo_pessoa": "PF",
    "email": "pf.teste.pytest@email.com",
    "telefone": "(11) 11111-1111",
    "cep": "11111-000",
    "rua": "Rua Teste PF",
    "numero": "100",
    "bairro": "Bairro Teste",
    "cidade": "Cidade Teste",
    "estado": "TS"
}

cliente_pj_data_valido = {
    "nome_razao_social": "Empresa Teste Pytest SA",
    "cpf_cnpj": "98.765.432/0001-00",
    "tipo_pessoa": "PJ",
    "nome_fantasia": "Teste Fantasia",
    "email": "contato@empresateste.com"
}


def test_get_clientes_lista_vazia(client, db):
    """Testa GET /api/clientes quando não há clientes."""
    response = client.get('/api/clientes')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'clientes' in data
    assert len(data['clientes']) == 0

def test_create_cliente_pf_sucesso(client, db):
    """Testa POST /api/clientes com dados válidos para Pessoa Física."""
    response = client.post('/api/clientes', json=cliente_pf_data_valido)
    assert response.status_code == 201
    data = json.loads(response.data)
    assert data['nome_razao_social'] == cliente_pf_data_valido['nome_razao_social']
    # A API deve retornar o CPF/CNPJ como foi enviado ou como está no banco.
    # Se o backend remove a formatação, o teste deve esperar isso.
    # Assumindo que o backend salva/retorna como foi enviado (com máscara, se houver).
    assert data['cpf_cnpj'] == cliente_pf_data_valido['cpf_cnpj'] 
    assert 'id' in data

    # Verifica no banco de dados de teste
    cliente_db = db.session.get(Cliente, data['id'])
    assert cliente_db is not None
    assert cliente_db.email == cliente_pf_data_valido['email']

def test_create_cliente_pj_sucesso(client, db):
    """Testa POST /api/clientes com dados válidos para Pessoa Jurídica."""
    response = client.post('/api/clientes', json=cliente_pj_data_valido)
    assert response.status_code == 201
    data = json.loads(response.data)
    assert data['nome_razao_social'] == cliente_pj_data_valido['nome_razao_social']
    assert data['tipo_pessoa'] == "PJ"
    assert 'id' in data

    cliente_db = db.session.get(Cliente, data['id'])
    assert cliente_db is not None
    assert cliente_db.nome_fantasia == cliente_pj_data_valido['nome_fantasia']

def test_create_cliente_dados_incompletos(client, db):
    """Testa POST /api/clientes com dados obrigatórios faltando."""
    response = client.post('/api/clientes', json={"nome_razao_social": "Incompleto"}) # Falta cpf_cnpj e tipo_pessoa
    assert response.status_code == 400
    data = json.loads(response.data)
    assert "erro" in data
    assert "Dados incompletos" in data["erro"]

def test_create_cliente_cpf_cnpj_duplicado(client, db):
    """Testa POST /api/clientes tentando criar um cliente com CPF/CNPJ já existente."""
    client.post('/api/clientes', json=cliente_pf_data_valido) # Cria o primeiro
    
    novo_cliente_com_mesmo_cpf = {
        "nome_razao_social": "Outro Cliente PF",
        "cpf_cnpj": cliente_pf_data_valido["cpf_cnpj"], # Mesmo CPF/CNPJ
        "tipo_pessoa": "PF", # Precisa de tipo_pessoa
        "email": "outro.pf@email.com"
    }
    response = client.post('/api/clientes', json=novo_cliente_com_mesmo_cpf)
    assert response.status_code == 409 # Conflict
    data = json.loads(response.data)
    assert "erro" in data
    assert "já existe" in data["erro"]

def test_get_cliente_especifico_existente(client, db):
    """Testa GET /api/clientes/<id> para um cliente que existe."""
    res_post = client.post('/api/clientes', json=cliente_pf_data_valido)
    assert res_post.status_code == 201 # Garante que a criação foi bem-sucedida
    cliente_id = json.loads(res_post.data)['id']

    response = client.get(f'/api/clientes/{cliente_id}')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['id'] == cliente_id
    assert data['nome_razao_social'] == cliente_pf_data_valido['nome_razao_social']

def test_get_cliente_especifico_nao_existente(client, db):
    """Testa GET /api/clientes/<id> para um cliente que não existe."""
    response = client.get('/api/clientes/99999') # ID improvável
    assert response.status_code == 404
    data = json.loads(response.data)
    assert "erro" in data
    assert "Cliente não encontrado" in data["erro"]

def test_update_cliente_sucesso(client, db):
    """Testa PUT /api/clientes/<id> para atualizar um cliente."""
    res_post = client.post('/api/clientes', json=cliente_pf_data_valido)
    assert res_post.status_code == 201
    cliente_id = json.loads(res_post.data)['id']

    dados_atualizacao = {
        "email": "email.atualizado.pytest@email.com",
        "telefone": "00000-0000"
    }
    response = client.put(f'/api/clientes/{cliente_id}', json=dados_atualizacao)
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['email'] == dados_atualizacao['email']
    assert data['telefone'] == dados_atualizacao['telefone']

    cliente_db = db.session.get(Cliente, cliente_id)
    assert cliente_db.email == dados_atualizacao['email']

def test_update_cliente_nao_existente(client, db):
    """Testa PUT /api/clientes/<id> para um cliente que não existe."""
    response = client.put('/api/clientes/99999', json={"email": "teste@teste.com"})
    assert response.status_code == 404

def test_delete_cliente_sucesso(client, db):
    """Testa DELETE /api/clientes/<id> para deletar um cliente."""
    res_post = client.post('/api/clientes', json=cliente_pf_data_valido)
    assert res_post.status_code == 201
    cliente_id = json.loads(res_post.data)['id']

    response_delete = client.delete(f'/api/clientes/{cliente_id}')
    assert response_delete.status_code == 200
    data_delete = json.loads(response_delete.data)
    assert "mensagem" in data_delete
    assert f"Cliente {cliente_id} deletado com sucesso" in data_delete["mensagem"]

    cliente_db = db.session.get(Cliente, cliente_id)
    assert cliente_db is None

    response_get = client.get(f'/api/clientes/{cliente_id}')
    assert response_get.status_code == 404

def test_delete_cliente_nao_existente(client, db):
    """Testa DELETE /api/clientes/<id> para um cliente que não existe."""
    response = client.delete('/api/clientes/99999')
    assert response.status_code == 404

# TODO: Adicionar testes para filtros e ordenação na rota GET /api/clientes
# Exemplo:
# def test_get_clientes_com_filtro_tipo_pessoa(client, db):
#     client.post('/api/clientes', json=cliente_pf_data_valido)
#     client.post('/api/clientes', json=cliente_pj_data_valido)
#     response = client.get('/api/clientes?tipo_pessoa=PF')
#     assert response.status_code == 200
#     data = json.loads(response.data)
#     assert 'clientes' in data
#     assert len(data['clientes']) == 1
#     assert data['clientes'][0]['tipo_pessoa'] == 'PF'
