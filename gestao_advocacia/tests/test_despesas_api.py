# Arquivo: tests/test_despesas_api.py
# Testes para as rotas da API de Despesas.

import json
from app import Cliente, Caso, Despesa # Importa os modelos necessários
from datetime import date, datetime, timezone

# --- Funções Auxiliares para criar dados de teste (podem ser movidas para conftest.py se usadas em múltiplos arquivos) ---

def criar_cliente_teste_para_despesa(client, db, sufixo_cpf='00'):
    """Cria um cliente de teste e retorna seu ID."""
    cliente_data = {
        "nome_razao_social": f"Cliente Para Despesa Teste {sufixo_cpf}",
        "cpf_cnpj": f"222.333.444-{sufixo_cpf}", # CPF único
        "tipo_pessoa": "PF",
        "email": f"cliente.despesa.{sufixo_cpf}@teste.com"
    }
    response = client.post('/api/clientes', json=cliente_data)
    assert response.status_code == 201, f"Falha ao criar cliente de teste para despesa: {response.data}"
    return json.loads(response.data)['id']

def criar_caso_teste_para_despesa(client, db, cliente_id, titulo_sufixo=""):
    """Cria um caso de teste associado a um cliente e retorna seu ID."""
    caso_data = {
        "cliente_id": cliente_id,
        "titulo": f"Caso para Despesa Teste {titulo_sufixo}",
        "status": "Ativo",
        "tipo_acao": "Administrativo",
        "data_distribuicao": date(2023, 2, 10).isoformat()
    }
    response = client.post('/api/casos', json=caso_data)
    assert response.status_code == 201, f"Falha ao criar caso de teste para despesa: {response.data}"
    return json.loads(response.data)['id']

# Dados de exemplo para uma despesa válida
despesa_data_valida_base = {
    "descricao": "Pagamento de Custas Iniciais",
    "categoria": "Custas Processuais",
    "valor": "350.50",
    "data_vencimento": date(date.today().year + 1, 3, 15).isoformat(),
    "status": "A Pagar",
    "forma_pagamento": "Boleto"
}

# --- Testes para a API de Despesas ---

def test_get_despesas_lista_vazia(client, db):
    """Testa GET /api/despesas quando não há despesas."""
    response = client.get('/api/despesas')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'despesas' in data
    assert len(data['despesas']) == 0

def test_create_despesa_com_caso_sucesso(client, db):
    """Testa POST /api/despesas com dados válidos e associada a um caso."""
    cliente_id = criar_cliente_teste_para_despesa(client, db, "D01")
    caso_id = criar_caso_teste_para_despesa(client, db, cliente_id, "DS01")
    
    despesa_data = {
        **despesa_data_valida_base,
        "caso_id": caso_id 
        # cliente_id não é um campo direto de Despesa, é inferido pelo caso_id
    }
    
    response = client.post('/api/despesas', json=despesa_data)
    assert response.status_code == 201
    data = json.loads(response.data)
    assert data['descricao'] == despesa_data['descricao']
    assert data['caso_id'] == caso_id
    assert data['status'] == "A Pagar"
    assert 'id' in data

    despesa_db = db.session.get(Despesa, data['id'])
    assert despesa_db is not None
    assert str(despesa_db.valor) == despesa_data['valor']

def test_create_despesa_geral_sucesso(client, db):
    """Testa POST /api/despesas para uma despesa geral (sem caso_id)."""
    despesa_data_geral = {
        "descricao": "Compra de Material de Escritório",
        "categoria": "Material de Escritório",
        "valor": "120.00",
        "data_vencimento": date(date.today().year, 12, 20).isoformat(),
        "status": "Paga",
        "data_despesa": date.today().isoformat(), # Data que foi paga
        "forma_pagamento": "Cartão Corporativo"
        # caso_id é omitido ou enviado como null/None
    }
    response = client.post('/api/despesas', json=despesa_data_geral)
    assert response.status_code == 201
    data = json.loads(response.data)
    assert data['descricao'] == despesa_data_geral['descricao']
    assert data['caso_id'] is None # Verifica se caso_id é nulo
    assert data['status'] == "Paga"
    
    despesa_db = db.session.get(Despesa, data['id'])
    assert despesa_db is not None
    assert despesa_db.caso_id is None

def test_create_despesa_caso_inexistente(client, db):
    """Testa POST /api/despesas com um caso_id que não existe."""
    despesa_data_caso_errado = {
        **despesa_data_valida_base, "caso_id": 99999 # ID de caso improvável
    }
    response = client.post('/api/despesas', json=despesa_data_caso_errado)
    assert response.status_code == 404 
    assert "Caso com ID 99999 não encontrado" in json.loads(response.data)["erro"]

def test_create_despesa_dados_incompletos(client, db):
    """Testa POST /api/despesas com dados obrigatórios faltando."""
    response = client.post('/api/despesas', json={"descricao": "Despesa Incompleta"})
    assert response.status_code == 400
    data = json.loads(response.data)
    assert "erro" in data
    assert "Dados incompletos" in data["erro"]

def test_get_despesa_especifica_existente(client, db):
    """Testa GET /api/despesas/<id> para uma despesa que existe."""
    cliente_id = criar_cliente_teste_para_despesa(client, db, "D02")
    caso_id = criar_caso_teste_para_despesa(client, db, cliente_id, "DS02")
    despesa_data = {**despesa_data_valida_base, "caso_id": caso_id, "descricao": "Despesa Específica"}
    
    res_post = client.post('/api/despesas', json=despesa_data)
    assert res_post.status_code == 201
    despesa_id_criada = json.loads(res_post.data)['id']

    response = client.get(f'/api/despesas/{despesa_id_criada}')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['id'] == despesa_id_criada
    assert data['descricao'] == "Despesa Específica"

def test_get_despesa_especifica_nao_existente(client, db):
    """Testa GET /api/despesas/<id> para uma despesa que não existe."""
    response = client.get('/api/despesas/99999')
    assert response.status_code == 404
    data = json.loads(response.data)
    assert "erro" in data
    assert "Despesa não encontrada" in data["erro"]

def test_update_despesa_sucesso(client, db):
    """Testa PUT /api/despesas/<id> para atualizar uma despesa."""
    cliente_id = criar_cliente_teste_para_despesa(client, db, "D03")
    caso_id = criar_caso_teste_para_despesa(client, db, cliente_id, "DS03")
    despesa_data = {**despesa_data_valida_base, "caso_id": caso_id}
    
    res_post = client.post('/api/despesas', json=despesa_data)
    assert res_post.status_code == 201
    despesa_id_criada = json.loads(res_post.data)['id']

    dados_atualizacao = {
        "descricao": "Despesa Atualizada Pytest",
        "status": "Paga",
        "data_despesa": date.today().isoformat(),
        "valor": "400.00"
    }
    response = client.put(f'/api/despesas/{despesa_id_criada}', json=dados_atualizacao)
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['descricao'] == dados_atualizacao['descricao']
    assert data['status'] == dados_atualizacao['status']
    assert data['valor'] == dados_atualizacao['valor']
    assert data['data_despesa'] == dados_atualizacao['data_despesa']

    despesa_db = db.session.get(Despesa, despesa_id_criada)
    assert despesa_db.status == "Paga"
    assert str(despesa_db.valor) == "400.00"

def test_update_despesa_nao_existente(client, db):
    """Testa PUT /api/despesas/<id> para uma despesa que não existe."""
    response = client.put('/api/despesas/99999', json={"status": "Paga"})
    assert response.status_code == 404

def test_delete_despesa_sucesso(client, db):
    """Testa DELETE /api/despesas/<id> para deletar uma despesa."""
    cliente_id = criar_cliente_teste_para_despesa(client, db, "D04")
    caso_id = criar_caso_teste_para_despesa(client, db, cliente_id, "DS04")
    despesa_data = {**despesa_data_valida_base, "caso_id": caso_id}

    res_post = client.post('/api/despesas', json=despesa_data)
    assert res_post.status_code == 201
    despesa_id_criada = json.loads(res_post.data)['id']

    response_delete = client.delete(f'/api/despesas/{despesa_id_criada}')
    assert response_delete.status_code == 200
    data_delete = json.loads(response_delete.data)
    assert "mensagem" in data_delete
    assert f"Despesa {despesa_id_criada} deletada com sucesso" in data_delete["mensagem"]

    despesa_db = db.session.get(Despesa, despesa_id_criada)
    assert despesa_db is None

    response_get = client.get(f'/api/despesas/{despesa_id_criada}')
    assert response_get.status_code == 404

def test_delete_despesa_nao_existente(client, db):
    """Testa DELETE /api/despesas/<id> para uma despesa que não existe."""
    response = client.delete('/api/despesas/99999')
    assert response.status_code == 404

# TODO: Adicionar testes para filtros e ordenação na rota GET /api/despesas
