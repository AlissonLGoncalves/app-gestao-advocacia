# config.py
import os
from dotenv import load_dotenv

# Carrega as variáveis do arquivo .env para o ambiente
basedir = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, '.env'))

class Config:  # Sem espaços antes de 'class'
    """Configurações base da aplicação.""" # Linha indentada
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'uma-chave-secreta-muito-dificil' # Linha indentada

    # Configuração do Banco de Dados usando SQLAlchemy # Linha indentada
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'postgresql://postgres:Alisson075*@localhost:5432/advocacia_db' + os.path.join(basedir, 'app.db') # Continuação indentada
    SQLALCHEMY_TRACK_MODIFICATIONS = False # Linha indentada