# tests/test_api_clientes.py
import requests # Para fazer as requisições HTTP
import pytest   # Framework de teste

# URL base da sua API Flask (quando está rodando localmente)
# Certifique-se de que o servidor Flask (python app.py) esteja rodando antes de executar os testes.
BASE_URL = "http://127.0.0.1:5000/api" 

# Variável global para guardar o ID do cliente criado para usar em outros testes
cliente_criado_id = None 

def test_get_clientes_lista_vazia_inicialmente():
    """
    Testa se GET /api/clientes retorna uma lista vazia quando o BD está limpo (ou no início).
    Assume que o banco de dados está limpo ou que outros testes não deixaram dados.
    """
    response = requests.get(f"{BASE_URL}/clientes")
    assert response.status_code == 200 # Verifica se o status HTTP é 200 OK
    assert response.json() == []       # Verifica se o corpo da resposta é uma lista vazia []

def test_create_cliente_pf_sucesso():
    """Testa a criação de um cliente Pessoa Física com sucesso."""
    global cliente_criado_id # Para guardar o ID para testes futuros
    
    novo_cliente_pf_data = {
        "nome_razao_social": "Cliente Teste PF pytest",
        "cpf_cnpj": "123.456.789-00", # Use um CPF/CNPJ único para cada teste se necessário
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
    response = requests.post(f"{BASE_URL}/clientes", json=novo_cliente_pf_data)
    
    # Verifica o status code da criação (201 Created)
    assert response.status_code == 201 
    
    response_data = response.json() # Pega os dados retornados pela API
    
    # Verifica se os dados retornados contêm as informações enviadas
    assert response_data["nome_razao_social"] == novo_cliente_pf_data["nome_razao_social"]
    assert response_data["cpf_cnpj"] == novo_cliente_pf_data["cpf_cnpj"]
    assert response_data["tipo_pessoa"] == novo_cliente_pf_data["tipo_pessoa"]
    assert response_data["email"] == novo_cliente_pf_data["email"]
    assert "id" in response_data # Verifica se a API retornou um ID
    
    # Guarda o ID para usar em outros testes
    cliente_criado_id = response_data["id"] 
    print(f"\nCliente PF criado com ID: {cliente_criado_id}") # Imprime o ID (útil para debug)

def test_get_cliente_especifico_sucesso():
    """Testa buscar o cliente que acabamos de criar pelo ID."""
    global cliente_criado_id
    assert cliente_criado_id is not None, "ID do cliente não foi criado no teste anterior"
    
    response = requests.get(f"{BASE_URL}/clientes/{cliente_criado_id}")
    assert response.status_code == 200
    
    response_data = response.json()
    assert response_data["id"] == cliente_criado_id
    assert response_data["nome_razao_social"] == "Cliente Teste PF pytest" # Verifica se o nome está correto

def test_update_cliente_sucesso():
    """Testa atualizar o telefone do cliente criado."""
    global cliente_criado_id
    assert cliente_criado_id is not None, "ID do cliente não foi criado"

    dados_atualizacao = {
        "telefone": "(99) 99999-9999",
        "notas_gerais": "Telefone atualizado pelo teste"
    }
    response = requests.put(f"{BASE_URL}/clientes/{cliente_criado_id}", json=dados_atualizacao)
    assert response.status_code == 200

    response_data = response.json()
    assert response_data["id"] == cliente_criado_id
    assert response_data["telefone"] == dados_atualizacao["telefone"]
    assert response_data["notas_gerais"] == dados_atualizacao["notas_gerais"]

def test_delete_cliente_sucesso():
    """Testa deletar o cliente criado."""
    global cliente_criado_id
    assert cliente_criado_id is not None, "ID do cliente não foi criado"

    response = requests.delete(f"{BASE_URL}/clientes/{cliente_criado_id}")
    assert response.status_code == 200
    assert "mensagem" in response.json()

    # Verifica se o cliente realmente foi deletado tentando buscá-lo novamente
    response_get = requests.get(f"{BASE_URL}/clientes/{cliente_criado_id}")
    assert response_get.status_code == 404 # Espera 404 Not Found

# --- Outros Testes (Exemplos de casos de erro) ---

def test_create_cliente_dados_incompletos():
    """Testa criar cliente sem campos obrigatórios."""
    cliente_incompleto = { "tipo_pessoa": "PF" } # Faltam nome e cpf_cnpj
    response = requests.post(f"{BASE_URL}/clientes", json=cliente_incompleto)
    assert response.status_code == 400 # Espera Bad Request

def test_get_cliente_inexistente():
    """Testa buscar um cliente com ID que não existe."""
    response = requests.get(f"{BASE_URL}/clientes/999999") # ID muito alto, improvável existir
    assert response.status_code == 404 # Espera Not Found

