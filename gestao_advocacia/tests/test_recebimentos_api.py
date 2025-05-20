# Arquivo: tests/test_recebimentos_api.py
# Testes para as rotas da API de Recebimentos.

import json
from app import Cliente, Caso, Recebimento # Importa os modelos necessários
from datetime import date, datetime, timezone

# --- Funções Auxiliares para criar dados de teste ---

def criar_cliente_teste_para_recebimento(client, db, sufixo_cpf='00'):
    """Cria um cliente de teste e retorna seu ID."""
    cliente_data = {
        "nome_razao_social": f"Cliente Teste Rec {sufixo_cpf}",
        "cpf_cnpj": f"111.222.333-{sufixo_cpf}", # CPF único para cada cliente de teste
        "tipo_pessoa": "PF",
        "email": f"cliente.rec.{sufixo_cpf}@teste.com"
    }
    response = client.post('/api/clientes', json=cliente_data)
    assert response.status_code == 201, f"Falha ao criar cliente de teste: {response.data}"
    return json.loads(response.data)['id']

def criar_caso_teste_para_recebimento(client, db, cliente_id, titulo_sufixo=""):
    """Cria um caso de teste associado a um cliente e retorna seu ID."""
    caso_data = {
        "cliente_id": cliente_id,
        "titulo": f"Caso para Recebimento Teste {titulo_sufixo}",
        "status": "Ativo",
        "tipo_acao": "Consultivo",
        "data_distribuicao": date(2023, 1, 15).isoformat()
    }
    response = client.post('/api/casos', json=caso_data)
    assert response.status_code == 201, f"Falha ao criar caso de teste: {response.data}"
    return json.loads(response.data)['id']

# Dados de exemplo para um recebimento válido
recebimento_data_valido_base = {
    "descricao": "Honorários Iniciais - Contrato XYZ",
    "categoria": "Honorários Advocatícios",
    "valor": "1500.75",
    "data_vencimento": date(date.today().year + 1, 1, 10).isoformat(), # Vencimento futuro
    "status": "Pendente",
    "forma_pagamento": "PIX"
}

# --- Testes para a API de Recebimentos ---

def test_get_recebimentos_lista_vazia(client, db):
    """Testa GET /api/recebimentos quando não há recebimentos."""
    response = client.get('/api/recebimentos')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'recebimentos' in data
    assert len(data['recebimentos']) == 0

def test_create_recebimento_sucesso(client, db):
    """Testa POST /api/recebimentos com dados válidos."""
    cliente_id = criar_cliente_teste_para_recebimento(client, db, "01")
    caso_id = criar_caso_teste_para_recebimento(client, db, cliente_id, "R01")
    
    recebimento_data = {
        **recebimento_data_valido_base,
        "cliente_id": cliente_id,
        "caso_id": caso_id
    }
    
    response = client.post('/api/recebimentos', json=recebimento_data)
    assert response.status_code == 201
    data = json.loads(response.data)
    assert data['descricao'] == recebimento_data['descricao']
    assert data['cliente_id'] == cliente_id
    assert data['caso_id'] == caso_id
    assert data['status'] == "Pendente"
    assert 'id' in data

    # Verifica no banco de dados de teste
    recebimento_db = db.session.get(Recebimento, data['id'])
    assert recebimento_db is not None
    assert str(recebimento_db.valor) == recebimento_data['valor'] # Comparar como string devido a Numeric

def test_create_recebimento_cliente_ou_caso_inexistente(client, db):
    """Testa POST /api/recebimentos com cliente_id ou caso_id inexistente."""
    cliente_id_valido = criar_cliente_teste_para_recebimento(client, db, "02")
    
    # Teste com cliente_id inexistente
    recebimento_data_cliente_errado = {
        **recebimento_data_valido_base, "cliente_id": 99999, "caso_id": 1 # caso_id pode ser qualquer um aqui
    }
    response_cliente = client.post('/api/recebimentos', json=recebimento_data_cliente_errado)
    assert response_cliente.status_code == 404 
    assert "Cliente com ID 99999 não encontrado" in json.loads(response_cliente.data)["erro"]

    # Teste com caso_id inexistente (mas cliente_id válido)
    recebimento_data_caso_errado = {
        **recebimento_data_valido_base, "cliente_id": cliente_id_valido, "caso_id": 99999
    }
    response_caso = client.post('/api/recebimentos', json=recebimento_data_caso_errado)
    assert response_caso.status_code == 404
    assert "Caso com ID 99999 não encontrado" in json.loads(response_caso.data)["erro"]


def test_create_recebimento_dados_incompletos(client, db):
    """Testa POST /api/recebimentos com dados obrigatórios faltando."""
    # Faltam vários campos obrigatórios
    response = client.post('/api/recebimentos', json={"descricao": "Recebimento Incompleto"})
    assert response.status_code == 400
    data = json.loads(response.data)
    assert "erro" in data
    assert "Dados incompletos" in data["erro"]

def test_get_recebimento_especifico_existente(client, db):
    """Testa GET /api/recebimentos/<id> para um recebimento que existe."""
    cliente_id = criar_cliente_teste_para_recebimento(client, db, "03")
    caso_id = criar_caso_teste_para_recebimento(client, db, cliente_id, "R03")
    recebimento_data = {**recebimento_data_valido_base, "cliente_id": cliente_id, "caso_id": caso_id, "descricao": "Recebimento Específico"}
    
    res_post = client.post('/api/recebimentos', json=recebimento_data)
    assert res_post.status_code == 201
    recebimento_id_criado = json.loads(res_post.data)['id']

    response = client.get(f'/api/recebimentos/{recebimento_id_criado}')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['id'] == recebimento_id_criado
    assert data['descricao'] == "Recebimento Específico"

def test_get_recebimento_especifico_nao_existente(client, db):
    """Testa GET /api/recebimentos/<id> para um recebimento que não existe."""
    response = client.get('/api/recebimentos/99999') # ID improvável
    assert response.status_code == 404
    data = json.loads(response.data)
    assert "erro" in data
    assert "Recebimento não encontrado" in data["erro"]

def test_update_recebimento_sucesso(client, db):
    """Testa PUT /api/recebimentos/<id> para atualizar um recebimento."""
    cliente_id = criar_cliente_teste_para_recebimento(client, db, "04")
    caso_id = criar_caso_teste_para_recebimento(client, db, cliente_id, "R04")
    recebimento_data = {**recebimento_data_valido_base, "cliente_id": cliente_id, "caso_id": caso_id}
    
    res_post = client.post('/api/recebimentos', json=recebimento_data)
    assert res_post.status_code == 201
    recebimento_id_criado = json.loads(res_post.data)['id']

    dados_atualizacao = {
        "descricao": "Recebimento Atualizado Pytest",
        "status": "Pago",
        "data_recebimento": date.today().isoformat(),
        "valor": "2000.00"
    }
    response = client.put(f'/api/recebimentos/{recebimento_id_criado}', json=dados_atualizacao)
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['descricao'] == dados_atualizacao['descricao']
    assert data['status'] == dados_atualizacao['status']
    assert data['valor'] == dados_atualizacao['valor']
    assert data['data_recebimento'] == dados_atualizacao['data_recebimento']

    # Verifica no banco
    recebimento_db = db.session.get(Recebimento, recebimento_id_criado)
    assert recebimento_db.status == "Pago"
    assert str(recebimento_db.valor) == "2000.00" # Comparar como string

def test_update_recebimento_nao_existente(client, db):
    """Testa PUT /api/recebimentos/<id> para um recebimento que não existe."""
    response = client.put('/api/recebimentos/99999', json={"status": "Pago"})
    assert response.status_code == 404

def test_delete_recebimento_sucesso(client, db):
    """Testa DELETE /api/recebimentos/<id> para deletar um recebimento."""
    cliente_id = criar_cliente_teste_para_recebimento(client, db, "05")
    caso_id = criar_caso_teste_para_recebimento(client, db, cliente_id, "R05")
    recebimento_data = {**recebimento_data_valido_base, "cliente_id": cliente_id, "caso_id": caso_id}

    res_post = client.post('/api/recebimentos', json=recebimento_data)
    assert res_post.status_code == 201
    recebimento_id_criado = json.loads(res_post.data)['id']

    response_delete = client.delete(f'/api/recebimentos/{recebimento_id_criado}')
    assert response_delete.status_code == 200
    data_delete = json.loads(response_delete.data)
    assert "mensagem" in data_delete
    assert f"Recebimento {recebimento_id_criado} deletado com sucesso" in data_delete["mensagem"]

    # Verifica se foi removido do banco
    recebimento_db = db.session.get(Recebimento, recebimento_id_criado)
    assert recebimento_db is None

    # Tenta buscar novamente para confirmar (deve dar 404)
    response_get = client.get(f'/api/recebimentos/{recebimento_id_criado}')
    assert response_get.status_code == 404

def test_delete_recebimento_nao_existente(client, db):
    """Testa DELETE /api/recebimentos/<id> para um recebimento que não existe."""
    response = client.delete('/api/recebimentos/99999')
    assert response.status_code == 404

# TODO: Adicionar testes para filtros e ordenação na rota GET /api/recebimentos
# Exemplo:
# def test_get_recebimentos_com_filtro_status_pago(client, db):
#     cliente_id = criar_cliente_teste_para_recebimento(client, db, "F01")
#     caso_id = criar_caso_teste_para_recebimento(client, db, cliente_id, "RF01")
#     client.post('/api/recebimentos', json={**recebimento_data_valido_base, "cliente_id": cliente_id, "caso_id": caso_id, "descricao": "Rec Pago 1", "status": "Pago"})
#     client.post('/api/recebimentos', json={**recebimento_data_valido_base, "cliente_id": cliente_id, "caso_id": caso_id, "descricao": "Rec Pendente 1", "status": "Pendente", "data_vencimento": date(2025, 2, 1).isoformat()})
    
#     response = client.get('/api/recebimentos?status=Pago')
#     assert response.status_code == 200
#     data = json.loads(response.data)
#     assert 'recebimentos' in data
#     assert len(data['recebimentos']) >= 1
#     for rec in data['recebimentos']:
#         assert rec['status'] == 'Pago'
