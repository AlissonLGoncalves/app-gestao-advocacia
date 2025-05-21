# CAMINHO: gestao_advocacia/config.py
import os
from dotenv import load_dotenv

# Define o diretório base do projeto (onde este arquivo config.py está)
basedir = os.path.abspath(os.path.dirname(__file__))

# Carrega variáveis de ambiente do arquivo .env que deve estar na MESMA PASTA que config.py
# Crie um arquivo .env na pasta 'gestao_advocacia' se ainda não tiver, 
# para FLASK_SECRET_KEY e DATABASE_URL (se não for usar a string direta abaixo)
dotenv_path = os.path.join(basedir, '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)
    print(f"Arquivo .env carregado de: {dotenv_path}")
else:
    print(f"Aviso: Arquivo .env não encontrado em {dotenv_path}. Usando valores padrão ou variáveis de ambiente globais.")

class Config:
    """Configurações base da aplicação Flask."""
    
    # CHAVE SECRETA: Mude para algo único e seguro em produção!
    # Pode ser definida pela variável de ambiente FLASK_SECRET_KEY
    SECRET_KEY = os.environ.get('FLASK_SECRET_KEY') or 'minha-chave-secreta-flask-super-segura-12345'
    
    # Configuração do Banco de Dados:
    # Prioriza DATABASE_URL do ambiente (útil para Heroku/produção ou se definida no .env)
    # Se não encontrar, usa a string para PostgreSQL local.
    # Certifique-se de que seu servidor PostgreSQL está rodando e acessível com estas credenciais.
    # E que a base de dados 'advocacia_db' existe.
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'postgresql://postgres:Alisson075*@localhost:5432/advocacia_db'
        # Exemplo alternativo para SQLite (mais simples para desenvolvimento inicial se não quiser usar PostgreSQL):
        # 'sqlite:///' + os.path.join(basedir, 'app_flask.db') 
    
    SQLALCHEMY_TRACK_MODIFICATIONS = False # Desabilita o tracking de modificações do SQLAlchemy (melhora performance)

    # Configurações para Upload de Arquivos
    UPLOAD_FOLDER = os.path.join(basedir, 'uploads') # Pasta para armazenar uploads
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # Limite de 16MB para uploads
    ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'}

    # A criação da pasta UPLOAD_FOLDER é melhor feita no app.py para garantir o contexto correto da aplicação.
    # No entanto, se quiser garantir aqui, pode descomentar e ajustar:
    # if not os.path.exists(UPLOAD_FOLDER):
    #     try:
    #         os.makedirs(UPLOAD_FOLDER)
    #         print(f"Pasta de uploads criada em: {UPLOAD_FOLDER}")
    #     except Exception as e:
    #         print(f"Erro ao criar pasta de uploads {UPLOAD_FOLDER}: {e}")

# Você pode adicionar outras classes de configuração se precisar (ex: DevelopmentConfig, TestingConfig)
# class DevelopmentConfig(Config):
#     DEBUG = True
#
# class TestingConfig(Config):
#     TESTING = True
#     SQLALCHEMY_DATABASE_URI = os.environ.get('TEST_DATABASE_URL') or \
#         'sqlite:///' + os.path.join(basedir, 'test_flask.db') # Banco de dados de teste separado
