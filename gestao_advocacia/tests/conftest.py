# Arquivo: tests/conftest.py
# Configurações e fixtures para os testes pytest.
# Este arquivo é executado automaticamente pelo pytest.

import os
import sys
from datetime import datetime
from typing import NamedTuple

import pytest
from sqlalchemy import inspect

# Adiciona o diretório pai (raiz do projeto backend, onde 'app.py' está) ao sys.path
# para que o módulo 'app' possa ser encontrado pelos testes.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import (  # Importa a factory e o objeto db
    create_app,
)
from app import db as _db
from config_test import ConfigTest  # Importa a configuração de teste
from models import (
    Caso,
    Cliente,
    Documento,
    EventoAgenda,
    MovimentacaoCNJ,
    TarefaPrazo,
    Tenant,
    User,
)

_TEST_PASSWORD = "test-password-123"


class TwoTenantsFixture(NamedTuple):
    tenant_a: Tenant
    tenant_b: Tenant
    admin_a: User
    admin_b: User
    admin_password: str
    cliente_a: Cliente
    cliente_b: Cliente
    caso_a: Caso
    caso_b: Caso
    tarefa_a: TarefaPrazo
    tarefa_b: TarefaPrazo
    evento_a: EventoAgenda
    evento_b: EventoAgenda
    documento_a: Documento
    documento_b: Documento
    mov_cnj_a: MovimentacaoCNJ
    mov_cnj_b: MovimentacaoCNJ


@pytest.fixture(scope="session")
def app(request):
    """
    Fixture de sessão para criar uma instância da aplicação Flask configurada para testes.
    O banco de dados de teste é criado uma vez por sessão de teste e limpo no final.
    """
    flask_app = create_app(ConfigTest)

    # Cria a pasta de uploads de teste se não existir
    upload_folder = flask_app.config["UPLOAD_FOLDER"]
    if not os.path.exists(upload_folder):
        os.makedirs(upload_folder)

    ctx = flask_app.app_context()
    ctx.push()

    _db.create_all()  # Cria todas as tabelas no banco de dados de teste

    yield flask_app  # Fornece a instância da aplicação para os testes

    _db.session.remove()  # Garante que a sessão do DB seja fechada
    _db.drop_all()  # Apaga todas as tabelas do banco de dados de teste
    ctx.pop()

    # Limpeza do arquivo do banco de dados SQLite de teste
    # O caminho para o db_path é relativo à raiz do projeto, não à pasta 'tests'
    db_path_str = flask_app.config["SQLALCHEMY_DATABASE_URI"].replace("sqlite:///", "")
    # Garante que o caminho é absoluto a partir da raiz do projeto se for relativo
    if not os.path.isabs(db_path_str):
        db_path_str = os.path.join(
            flask_app.root_path, "..", db_path_str
        )  # Ajuste para subir um nível se config_test está na raiz

    # Se config_test.py está na raiz, e basedir em config_test.py é a raiz,
    # então flask_app.root_path (que é a pasta 'gestao_advocacia') já é o diretório correto
    # para construir o caminho para app_test.db se ele for definido como 'sqlite:///' + os.path.join(basedir, 'app_test.db')
    # No nosso caso, basedir em config_test.py é a raiz do projeto, então o caminho já é relativo à raiz.
    # Apenas precisamos garantir que não estamos a tentar aceder a partir da pasta 'tests'.

    # Correção para o caminho do banco de dados de teste:
    # basedir em config_test.py é a raiz do projeto.
    # flask_app.root_path é a pasta onde app.py está (gestao_advocacia).
    # Se app_test.db está na raiz (onde config_test.py está), precisamos de:
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    db_file_name = os.path.basename(flask_app.config["SQLALCHEMY_DATABASE_URI"])
    actual_db_path = os.path.join(project_root, db_file_name)

    if os.path.exists(actual_db_path):
        try:
            os.remove(actual_db_path)
            print(f"Arquivo de banco de dados de teste removido: {actual_db_path}")
        except Exception as e:
            print(f"Erro ao remover arquivo de banco de dados de teste {actual_db_path}: {e}")
    else:
        print(f"Arquivo de banco de dados de teste não encontrado para remoção: {actual_db_path}")

    # Limpeza da pasta de uploads de teste
    actual_upload_folder = os.path.join(
        project_root, os.path.basename(upload_folder)
    )  # Garante que é relativo à raiz
    if os.path.exists(actual_upload_folder):
        try:
            for item in os.listdir(actual_upload_folder):
                item_path = os.path.join(actual_upload_folder, item)
                if os.path.isfile(item_path):
                    os.remove(item_path)
            if not os.listdir(actual_upload_folder):
                os.rmdir(actual_upload_folder)
                print(f"Pasta de uploads de teste removida: {actual_upload_folder}")
            else:
                print(
                    f"Atenção: A pasta de uploads de teste {actual_upload_folder} não está vazia e não foi removida."
                )
        except OSError as e:
            print(f"Erro ao tentar limpar a pasta de uploads de teste {actual_upload_folder}: {e}")
    else:
        print(f"Pasta de uploads de teste não encontrada para remoção: {actual_upload_folder}")


@pytest.fixture()
def client(app):
    """Um cliente de teste para a aplicação Flask."""
    return app.test_client()


@pytest.fixture()
def db(app):
    """
    Fixture para fornecer o objeto de banco de dados e garantir um estado limpo para cada teste.
    Verifica se cada tabela existe antes de tentar deletar, evitando erros de metadados desincronizados.
    """
    with app.app_context():
        meta = _db.metadata
        inspector = inspect(_db.engine)
        existing_tables = set(inspector.get_table_names())

        for table in reversed(meta.sorted_tables):
            # Verificar se a tabela existe no banco antes de tentar deletar
            if table.name in existing_tables:
                _db.session.execute(table.delete())
        _db.session.commit()
        yield _db


@pytest.fixture()
def two_tenants(db) -> TwoTenantsFixture:
    """Cria 2 tenants completos para testes multi-tenant.

    Cada tenant tem 1 user admin, 1 cliente, 1 caso. Senha plain dos
    admins exposta em .admin_password (mesma para A e B) para testes
    que envolvem login.

    Usage:
        def test_isolation(two_tenants):
            assert two_tenants.cliente_a.tenant_id != two_tenants.cliente_b.tenant_id
    """
    tenant_a = Tenant(nome_escritorio="Tenant A", status="ativo")
    tenant_b = Tenant(nome_escritorio="Tenant B", status="ativo")
    db.session.add_all([tenant_a, tenant_b])
    db.session.flush()

    admin_a = User(
        username="admin_a",
        email="admin_a@teste.local",
        role="admin",
        tenant_id=tenant_a.id,
    )
    admin_a.set_password(_TEST_PASSWORD)
    admin_b = User(
        username="admin_b",
        email="admin_b@teste.local",
        role="admin",
        tenant_id=tenant_b.id,
    )
    admin_b.set_password(_TEST_PASSWORD)
    db.session.add_all([admin_a, admin_b])
    db.session.flush()

    cliente_a = Cliente(
        nome_razao_social="Cliente A",
        cpf_cnpj="TEST-A-CPF",
        tipo_pessoa="PF",
        user_id=admin_a.id,
        tenant_id=tenant_a.id,
    )
    cliente_b = Cliente(
        nome_razao_social="Cliente B",
        cpf_cnpj="TEST-B-CPF",
        tipo_pessoa="PF",
        user_id=admin_b.id,
        tenant_id=tenant_b.id,
    )
    db.session.add_all([cliente_a, cliente_b])
    db.session.flush()

    caso_a = Caso(
        titulo="Caso A",
        cliente_id=cliente_a.id,
        user_id=admin_a.id,
        tenant_id=tenant_a.id,
    )
    caso_b = Caso(
        titulo="Caso B",
        cliente_id=cliente_b.id,
        user_id=admin_b.id,
        tenant_id=tenant_b.id,
    )
    db.session.add_all([caso_a, caso_b])
    db.session.flush()

    tarefa_a = TarefaPrazo(
        titulo="TEST-A-tarefa",
        user_id=admin_a.id,
        tenant_id=tenant_a.id,
        caso_id=caso_a.id,
    )
    tarefa_b = TarefaPrazo(
        titulo="TEST-B-tarefa",
        user_id=admin_b.id,
        tenant_id=tenant_b.id,
        caso_id=caso_b.id,
    )
    db.session.add_all([tarefa_a, tarefa_b])

    _evento_data_inicio = datetime(2026, 1, 1, 10, 0, 0)
    evento_a = EventoAgenda(
        titulo="TEST-A-evento",
        data_inicio=_evento_data_inicio,
        user_id=admin_a.id,
        tenant_id=tenant_a.id,
    )
    evento_b = EventoAgenda(
        titulo="TEST-B-evento",
        data_inicio=_evento_data_inicio,
        user_id=admin_b.id,
        tenant_id=tenant_b.id,
    )
    db.session.add_all([evento_a, evento_b])

    documento_a = Documento(
        nome_arquivo="TEST-A.pdf",
        path_arquivo="/tmp/TEST-A.pdf",
        user_id=admin_a.id,
        tenant_id=tenant_a.id,
        caso_id=caso_a.id,
    )
    documento_b = Documento(
        nome_arquivo="TEST-B.pdf",
        path_arquivo="/tmp/TEST-B.pdf",
        user_id=admin_b.id,
        tenant_id=tenant_b.id,
        caso_id=caso_b.id,
    )
    db.session.add_all([documento_a, documento_b])

    _mov_data = datetime(2026, 1, 5, 12, 0, 0)
    mov_cnj_a = MovimentacaoCNJ(
        tenant_id=tenant_a.id,
        caso_id=caso_a.id,
        data_movimentacao=_mov_data,
        descricao="TEST-A-mov-cnj",
    )
    mov_cnj_b = MovimentacaoCNJ(
        tenant_id=tenant_b.id,
        caso_id=caso_b.id,
        data_movimentacao=_mov_data,
        descricao="TEST-B-mov-cnj",
    )
    db.session.add_all([mov_cnj_a, mov_cnj_b])
    db.session.commit()

    return TwoTenantsFixture(
        tenant_a=tenant_a,
        tenant_b=tenant_b,
        admin_a=admin_a,
        admin_b=admin_b,
        admin_password=_TEST_PASSWORD,
        cliente_a=cliente_a,
        cliente_b=cliente_b,
        caso_a=caso_a,
        caso_b=caso_b,
        tarefa_a=tarefa_a,
        tarefa_b=tarefa_b,
        evento_a=evento_a,
        evento_b=evento_b,
        documento_a=documento_a,
        documento_b=documento_b,
        mov_cnj_a=mov_cnj_a,
        mov_cnj_b=mov_cnj_b,
    )


@pytest.fixture()
def auth_client(client, db):
    """
    Retorna um cliente de teste já autenticado (com token JWT).
    Registra um usuário de teste e faz login, expondo:
      - auth_client.http  : flask test client com cabeçalho Authorization setado
      - auth_client.token : o access_token JWT
      - auth_client.user  : dict com dados do usuário criado
    """
    import json

    # Registra um usuário de teste
    reg_resp = client.post(
        "/api/v1/auth/register",
        json={
            "username": "testuser",
            "email": "testuser@teste.com",
            "password": "Senha1234!",
            "role": "admin",
            "aceite_termos": True,
            "aceite_lgpd": True,
            "versao_termos": "v1.0",
            "versao_lgpd": "v1.0",
        },
    )
    assert reg_resp.status_code == 201, f"Registro falhou: {reg_resp.data}"

    # Faz login para obter o token
    login_resp = client.post(
        "/api/v1/auth/login",
        json={
            "username_or_email": "testuser",
            "password": "Senha1234!",
        },
    )
    assert login_resp.status_code == 200, f"Login falhou: {login_resp.data}"
    data = json.loads(login_resp.data)
    token = data["access_token"]

    class _AuthClient:
        def __init__(self, http_client, access_token, user_data):
            self.token = access_token
            self.user = user_data
            self._client = http_client

        def __getattr__(self, name):
            return getattr(self._client, name)

        def _headers(self):
            return {"Authorization": f"Bearer {self.token}"}

        def get(self, url, **kwargs):
            kwargs.setdefault("headers", {}).update(self._headers())
            return self._client.get(url, **kwargs)

        def post(self, url, **kwargs):
            kwargs.setdefault("headers", {}).update(self._headers())
            return self._client.post(url, **kwargs)

        def put(self, url, **kwargs):
            kwargs.setdefault("headers", {}).update(self._headers())
            return self._client.put(url, **kwargs)

        def patch(self, url, **kwargs):
            kwargs.setdefault("headers", {}).update(self._headers())
            return self._client.patch(url, **kwargs)

        def delete(self, url, **kwargs):
            kwargs.setdefault("headers", {}).update(self._headers())
            return self._client.delete(url, **kwargs)

    yield _AuthClient(client, token, data.get("user", {}))
