# Arquivo: tests/test_eventos_api.py
# Testes para as rotas da API de Eventos da Agenda.

import json
from app import Cliente, Caso, EventoAgenda # Importa os modelos necessários
from datetime import date, datetime, timezone, timedelta

# --- Funções Auxiliares para criar dados de teste ---

def criar_cliente_teste_para_evento(client, db, sufixo_cpf='00'):
    """Cria um cliente de teste e retorna seu ID."""
    cliente_data = {
        "nome_razao_social": f"Cliente Para Evento Teste {sufixo_cpf}",
        "cpf_cnpj": f"333.444.555-{sufixo_cpf}", # CPF único
        "tipo_pessoa": "PF",
        "email": f"cliente.evento.{sufixo_cpf}@teste.com"
    }
    response = client.post('/api/clientes', json=cliente_data)
    assert response.status_code == 201, f"Falha ao criar cliente de teste para evento: {response.data}"
    return json.loads(response.data)['id']

def criar_caso_teste_para_evento(client, db, cliente_id, titulo_sufixo=""):
    """Cria um caso de teste associado a um cliente e retorna seu ID."""
    caso_data = {
        "cliente_id": cliente_id,
        "titulo": f"Caso para Evento Teste {titulo_sufixo}",
        "status": "Ativo",
        "tipo_acao": "Trabalhista",
        "data_distribuicao": date(2023, 3, 20).isoformat()
    }
    response = client.post('/api/casos', json=caso_data)
    assert response.status_code == 201, f"Falha ao criar caso de teste para evento: {response.data}"
    return json.loads(response.data)['id']

# Dados de exemplo para um evento válido
# Usar datetime.now(timezone.utc) para data_inicio para garantir que é timezone-aware
data_inicio_evento_teste = datetime.now(timezone.utc) + timedelta(days=5)
data_fim_evento_teste = datetime.now(timezone.utc) + timedelta(days=5, hours=2)

evento_data_valido_base = {
    "tipo_evento": "Reunião",
    "titulo": "Reunião Inicial com Cliente",
    "descricao": "Discussão dos próximos passos.",
    "data_inicio": data_inicio_evento_teste.isoformat(),
    "data_fim": data_fim_evento_teste.isoformat(),
    "local": "Escritório Principal",
    "concluido": False
}

# --- Testes para a API de Eventos da Agenda ---

def test_get_eventos_lista_vazia(client, db):
    """Testa GET /api/eventos quando não há eventos."""
    response = client.get('/api/eventos')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'eventos' in data
    assert len(data['eventos']) == 0

def test_create_evento_com_caso_sucesso(client, db):
    """Testa POST /api/eventos com dados válidos e associado a um caso."""
    cliente_id = criar_cliente_teste_para_evento(client, db, "E01")
    caso_id = criar_caso_teste_para_evento(client, db, cliente_id, "EV01")
    
    evento_data = {
        **evento_data_valido_base,
        "caso_id": caso_id,
        "titulo": "Audiência Preliminar Caso EV01"
    }
    
    response = client.post('/api/eventos', json=evento_data)
    assert response.status_code == 201, f"Erro: {response.data.decode()}"
    data = json.loads(response.data)
    assert data['titulo'] == evento_data['titulo']
    assert data['caso_id'] == caso_id
    assert data['concluido'] is False
    assert 'id' in data

    evento_db = db.session.get(EventoAgenda, data['id'])
    assert evento_db is not None
    assert evento_db.local == evento_data['local']

def test_create_evento_geral_sucesso(client, db):
    """Testa POST /api/eventos para um evento geral (sem caso_id)."""
    evento_data_geral = {
        "tipo_evento": "Lembrete",
        "titulo": "Pagar Contas do Escritório",
        "data_inicio": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "concluido": False
        # caso_id é omitido
    }
    response = client.post('/api/eventos', json=evento_data_geral)
    assert response.status_code == 201, f"Erro: {response.data.decode()}"
    data = json.loads(response.data)
    assert data['titulo'] == evento_data_geral['titulo']
    assert data['caso_id'] is None
    
    evento_db = db.session.get(EventoAgenda, data['id'])
    assert evento_db is not None
    assert evento_db.caso_id is None

def test_create_evento_caso_inexistente(client, db):
    """Testa POST /api/eventos com um caso_id que não existe."""
    evento_data_caso_errado = {
        **evento_data_valido_base, "caso_id": 99999 # ID de caso improvável
    }
    response = client.post('/api/eventos', json=evento_data_caso_errado)
    assert response.status_code == 404 
    assert "Caso com ID 99999 não encontrado" in json.loads(response.data)["erro"]

def test_create_evento_dados_incompletos(client, db):
    """Testa POST /api/eventos com dados obrigatórios faltando."""
    # Faltam tipo_evento, data_inicio
    response = client.post('/api/eventos', json={"titulo": "Evento Incompleto"})
    assert response.status_code == 400
    data = json.loads(response.data)
    assert "erro" in data
    assert "Dados incompletos" in data["erro"]

def test_get_evento_especifico_existente(client, db):
    """Testa GET /api/eventos/<id> para um evento que existe."""
    evento_data = {**evento_data_valido_base, "titulo": "Evento Específico para GET"}
    
    res_post = client.post('/api/eventos', json=evento_data)
    assert res_post.status_code == 201
    evento_id_criado = json.loads(res_post.data)['id']

    response = client.get(f'/api/eventos/{evento_id_criado}')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['id'] == evento_id_criado
    assert data['titulo'] == "Evento Específico para GET"

def test_get_evento_especifico_nao_existente(client, db):
    """Testa GET /api/eventos/<id> para um evento que não existe."""
    response = client.get('/api/eventos/99999')
    assert response.status_code == 404
    data = json.loads(response.data)
    assert "erro" in data
    assert "Evento não encontrado" in data["erro"]

def test_update_evento_sucesso(client, db):
    """Testa PUT /api/eventos/<id> para atualizar um evento."""
    evento_data_original = {**evento_data_valido_base, "titulo": "Evento Original para Update"}
    res_post = client.post('/api/eventos', json=evento_data_original)
    assert res_post.status_code == 201
    evento_id_criado = json.loads(res_post.data)['id']

    dados_atualizacao = {
        "titulo": "Evento Atualizado Pytest",
        "concluido": True,
        "local": "Sala de Reuniões Online"
    }
    # É importante enviar todos os campos esperados pela rota PUT,
    # ou garantir que a rota lide com atualizações parciais (PATCH seria mais adequado para isso).
    # Para PUT, geralmente se envia o recurso completo atualizado.
    # Vamos buscar o evento criado e modificar apenas os campos desejados.
    evento_criado = json.loads(client.get(f'/api/eventos/{evento_id_criado}').data)
    payload_put = {**evento_criado, **dados_atualizacao}
    # Ajustar formato de data/hora se necessário para o payload do PUT
    payload_put['data_inicio'] = payload_put['data_inicio'].split('.')[0] if payload_put.get('data_inicio') else None
    if payload_put.get('data_fim'):
        payload_put['data_fim'] = payload_put['data_fim'].split('.')[0]


    response = client.put(f'/api/eventos/{evento_id_criado}', json=payload_put)
    assert response.status_code == 200, f"Erro: {response.data.decode()}"
    data = json.loads(response.data)
    assert data['titulo'] == dados_atualizacao['titulo']
    assert data['concluido'] == dados_atualizacao['concluido']
    assert data['local'] == dados_atualizacao['local']

    evento_db = db.session.get(EventoAgenda, evento_id_criado)
    assert evento_db.concluido is True

def test_update_evento_nao_existente(client, db):
    """Testa PUT /api/eventos/<id> para um evento que não existe."""
    response = client.put('/api/eventos/99999', json={"titulo": "Não Existe"})
    assert response.status_code == 404

def test_delete_evento_sucesso(client, db):
    """Testa DELETE /api/eventos/<id> para deletar um evento."""
    evento_data = {**evento_data_valido_base, "titulo": "Evento para Deletar"}
    res_post = client.post('/api/eventos', json=evento_data)
    assert res_post.status_code == 201
    evento_id_criado = json.loads(res_post.data)['id']

    response_delete = client.delete(f'/api/eventos/{evento_id_criado}')
    assert response_delete.status_code == 200
    data_delete = json.loads(response_delete.data)
    assert "mensagem" in data_delete
    assert f"Evento {evento_id_criado} deletado com sucesso" in data_delete["mensagem"]

    evento_db = db.session.get(EventoAgenda, evento_id_criado)
    assert evento_db is None

    response_get = client.get(f'/api/eventos/{evento_id_criado}')
    assert response_get.status_code == 404

def test_delete_evento_nao_existente(client, db):
    """Testa DELETE /api/eventos/<id> para um evento que não existe."""
    response = client.delete('/api/eventos/99999')
    assert response.status_code == 404

# TODO: Adicionar testes para filtros e ordenação na rota GET /api/eventos
