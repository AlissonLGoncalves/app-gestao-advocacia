# Arquivo: tests/test_casos_api.py
# Testes para as rotas da API de Casos.

import json
from app import Cliente, Caso # Importa os modelos necessários
from datetime import date, datetime, timezone

# Dados de exemplo para os testes
# É uma boa prática criar um cliente antes de criar um caso,
# pois um caso depende de um cliente_id.

def criar_cliente_teste(client, db):
    """Função auxiliar para criar um cliente de teste e retornar seu ID."""
    cliente_data = {
        "nome_razao_social": "Cliente Para Casos Teste",
        "cpf_cnpj": "111.222.333-44",
        "tipo_pessoa": "PF",
        "email": "cliente.casos@teste.com"
    }
    response = client.post('/api/clientes', json=cliente_data)
    assert response.status_code == 201
    return json.loads(response.data)['id']

caso_data_valido_base = {
    "titulo": "Caso Teste Inicial",
    "status": "Ativo",
    "tipo_acao": "Cível",
    "valor_causa": "10000.00",
    "data_distribuicao": date.today().isoformat() # Usa a data atual para o teste
}

def test_get_casos_lista_vazia(client, db):
    """Testa GET /api/casos quando não há casos."""
    response = client.get('/api/casos')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'casos' in data
    assert len(data['casos']) == 0

def test_create_caso_sucesso(client, db):
    """Testa POST /api/casos com dados válidos."""
    cliente_id = criar_cliente_teste(client, db)
    caso_data = {**caso_data_valido_base, "cliente_id": cliente_id}
    
    response = client.post('/api/casos', json=caso_data)
    assert response.status_code == 201
    data = json.loads(response.data)
    assert data['titulo'] == caso_data['titulo']
    assert data['cliente_id'] == cliente_id
    assert 'id' in data

    # Verifica no banco de dados de teste
    caso_db = db.session.get(Caso, data['id'])
    assert caso_db is not None
    assert caso_db.status == caso_data['status']

def test_create_caso_cliente_inexistente(client, db):
    """Testa POST /api/casos com um cliente_id que não existe."""
    caso_data = {**caso_data_valido_base, "cliente_id": 99999} # ID de cliente improvável
    response = client.post('/api/casos', json=caso_data)
    assert response.status_code == 404 # Espera Not Found para o cliente
    data = json.loads(response.data)
    assert "erro" in data
    assert "não encontrado" in data["erro"].lower()

def test_create_caso_dados_incompletos(client, db):
    """Testa POST /api/casos com dados obrigatórios faltando."""
    # Falta cliente_id e status
    response = client.post('/api/casos', json={"titulo": "Caso Incompleto"})
    assert response.status_code == 400
    data = json.loads(response.data)
    assert "erro" in data
    assert "Dados incompletos" in data["erro"]

def test_get_caso_especifico_existente(client, db):
    """Testa GET /api/casos/<id> para um caso que existe."""
    cliente_id = criar_cliente_teste(client, db)
    caso_data = {**caso_data_valido_base, "cliente_id": cliente_id, "titulo": "Caso Específico"}
    res_post = client.post('/api/casos', json=caso_data)
    assert res_post.status_code == 201
    caso_id_criado = json.loads(res_post.data)['id']

    response = client.get(f'/api/casos/{caso_id_criado}')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['id'] == caso_id_criado
    assert data['titulo'] == "Caso Específico"

def test_get_caso_especifico_nao_existente(client, db):
    """Testa GET /api/casos/<id> para um caso que não existe."""
    response = client.get('/api/casos/99999') # ID improvável
    assert response.status_code == 404
    data = json.loads(response.data)
    assert "erro" in data
    assert "Caso não encontrado" in data["erro"]

def test_update_caso_sucesso(client, db):
    """Testa PUT /api/casos/<id> para atualizar um caso."""
    cliente_id = criar_cliente_teste(client, db)
    caso_data = {**caso_data_valido_base, "cliente_id": cliente_id}
    res_post = client.post('/api/casos', json=caso_data)
    assert res_post.status_code == 201
    caso_id_criado = json.loads(res_post.data)['id']

    dados_atualizacao = {
        "titulo": "Caso Teste Atualizado Pytest",
        "status": "Encerrado",
        "notas_caso": "Caso encerrado via teste."
    }
    response = client.put(f'/api/casos/{caso_id_criado}', json=dados_atualizacao)
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['titulo'] == dados_atualizacao['titulo']
    assert data['status'] == dados_atualizacao['status']
    assert data['notas_caso'] == dados_atualizacao['notas_caso']

    # Verifica no banco
    caso_db = db.session.get(Caso, caso_id_criado)
    assert caso_db.status == "Encerrado"

def test_update_caso_nao_existente(client, db):
    """Testa PUT /api/casos/<id> para um caso que não existe."""
    response = client.put('/api/casos/99999', json={"titulo": "Não Existe"})
    assert response.status_code == 404

def test_delete_caso_sucesso(client, db):
    """Testa DELETE /api/casos/<id> para deletar um caso."""
    cliente_id = criar_cliente_teste(client, db)
    caso_data = {**caso_data_valido_base, "cliente_id": cliente_id}
    res_post = client.post('/api/casos', json=caso_data)
    assert res_post.status_code == 201
    caso_id_criado = json.loads(res_post.data)['id']

    response_delete = client.delete(f'/api/casos/{caso_id_criado}')
    assert response_delete.status_code == 200
    data_delete = json.loads(response_delete.data)
    assert "mensagem" in data_delete
    assert f"Caso {caso_id_criado} deletado com sucesso" in data_delete["mensagem"]

    # Verifica se foi removido do banco
    caso_db = db.session.get(Caso, caso_id_criado)
    assert caso_db is None

    # Tenta buscar novamente para confirmar (deve dar 404)
    response_get = client.get(f'/api/casos/{caso_id_criado}')
    assert response_get.status_code == 404

def test_delete_caso_nao_existente(client, db):
    """Testa DELETE /api/casos/<id> para um caso que não existe."""
    response = client.delete('/api/casos/99999')
    assert response.status_code == 404

# TODO: Adicionar testes para filtros e ordenação na rota GET /api/casos
# Exemplo:
# def test_get_casos_com_filtro_status(client, db):
#     cliente_id = criar_cliente_teste(client, db)
#     client.post('/api/casos', json={**caso_data_valido_base, "cliente_id": cliente_id, "titulo": "Caso Ativo", "status": "Ativo"})
#     client.post('/api/casos', json={**caso_data_valido_base, "cliente_id": cliente_id, "titulo": "Caso Encerrado", "status": "Encerrado", "numero_processo": "002"})
    
#     response = client.get('/api/casos?status=Ativo')
#     assert response.status_code == 200
#     data = json.loads(response.data)
#     assert 'casos' in data
#     assert len(data['casos']) >= 1 # Pode haver outros casos ativos de testes anteriores se o DB não for limpo por teste
#     for caso in data['casos']:
#         assert caso['status'] == 'Ativo'
