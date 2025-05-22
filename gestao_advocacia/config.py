# ==============================================================================
# ARQUIVO: gestao_advocacia/config.py
# Modificado para incluir configurações do APScheduler e do Job CNJ.
# ==============================================================================
import os
from dotenv import load_dotenv

# Determina o diretório base do projeto (um nível acima de 'gestao_advocacia')
# Isso garante que o .env seja encontrado corretamente, mesmo que config.py esteja em uma subpasta.
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
dotenv_path = os.path.join(BASE_DIR, '.env') 

if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)
    # print(f"INFO: Arquivo .env carregado de: {dotenv_path}") # Para depuração
else:
    # Fallback se o .env não estiver na raiz, mas isso geralmente não é o ideal.
    env_local_path = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(env_local_path):
        load_dotenv(env_local_path)
        # print(f"INFO: Arquivo .env carregado de: {env_local_path}") # Para depuração
    # else:
        # print(f"AVISO: Arquivo .env não encontrado em '{dotenv_path}' nem em '{env_local_path}'. Usando valores padrão ou de ambiente do sistema.")


class Config:
    """Configurações base da aplicação."""
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev_secret_key_fallback' # Use uma chave forte em produção
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or 'dev_jwt_secret_key_fallback' # Use uma chave forte
    
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'sqlite:///' + os.path.join(os.path.abspath(os.path.dirname(__file__)), 'app.db') # Fallback para SQLite
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO = False # Mude para True para logar queries SQL em desenvolvimento, se útil

    UPLOAD_FOLDER = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB

    CNJ_API_KEY = os.environ.get('CNJ_API_KEY')
    APP_VERSION = os.environ.get('APP_VERSION') or '1.0.0'

    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO').upper()

    # --- Configurações do APScheduler e do Job CNJ ---
    CNJ_JOB_ENABLED = os.environ.get('CNJ_JOB_ENABLED', 'True').lower() == 'true'
    CNJ_JOB_INTERVAL_HOURS = int(os.environ.get('CNJ_JOB_INTERVAL_HOURS', 12))
    CNJ_JOB_INTERVAL_MINUTES = int(os.environ.get('CNJ_JOB_INTERVAL_MINUTES', 0))
    CNJ_JOB_REQUEST_DELAY_SECONDS = int(os.environ.get('CNJ_JOB_REQUEST_DELAY_SECONDS', 5))
    CNJ_JOB_MAX_CASES_PER_RUN = int(os.environ.get('CNJ_JOB_MAX_CASES_PER_RUN', 10))

    # Configurações do APScheduler
    SCHEDULER_API_ENABLED = True # Permite gerenciar jobs via API REST (opcional, provido pelo Flask-APScheduler)
    SCHEDULER_TIMEZONE = os.environ.get('SCHEDULER_TIMEZONE', "America/Sao_Paulo") # Fuso horário para o scheduler


