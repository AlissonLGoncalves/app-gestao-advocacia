# Arquivo: config/settings.py
# Configurações completas para o projeto Django, incluindo preparação para Heroku.
# Comentários em Português (Pt-BR).

from pathlib import Path
import os
import dj_database_url # Para configurar o banco de dados a partir de uma URL (útil para Heroku)

# Constrói caminhos dentro do projeto como: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


# Configurações de desenvolvimento de início rápido - inadequadas para produção
# Veja https://docs.djangoproject.com/en/stable/howto/deployment/checklist/

# AVISO DE SEGURANÇA: mantenha a chave secreta usada em produção em segredo!
# Para desenvolvimento, pode ser uma chave simples. Para produção, use uma variável de ambiente.
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'django-insecure-sua-chave-secreta-padrao-para-desenvolvimento')

# AVISO DE SEGURANÇA: não execute com debug ativado em produção!
# Em produção, defina a variável de ambiente DJANGO_DEBUG como 'False'
# O padrão é 'True' para desenvolvimento se a variável não estiver definida.
DEBUG = os.environ.get('DJANGO_DEBUG', 'True') == 'True'


# Hosts/domínios permitidos para esta instalação do Django.
ALLOWED_HOSTS = []
if not DEBUG:
    HEROKU_APP_NAME = os.environ.get('HEROKU_APP_NAME') 
    if HEROKU_APP_NAME:
        ALLOWED_HOSTS.append(f"{HEROKU_APP_NAME}.herokuapp.com")
    # Adicione seu domínio personalizado se tiver um, ex: 'www.seuapp.com.br'
    # ALLOWED_HOSTS.append('www.seuadvocaciaapp.com.br') 
else:
    ALLOWED_HOSTS = ['localhost', '127.0.0.1']


# Definição das Aplicações Instaladas
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'gestao', # Sua app principal
    # 'whitenoise.runserver_nostatic', # Descomente se quiser usar WhiteNoise com o runserver local
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware', 
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'], 
        'APP_DIRS': True, 
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                'django.template.context_processors.media',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'


# Banco de Dados
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

DATABASE_URL = os.environ.get('DATABASE_URL')
if DATABASE_URL:
    DATABASES['default'] = dj_database_url.config(
        conn_max_age=600,
        ssl_require=True if os.environ.get('DJANGO_ENV') == 'production' else False 
    )

# Validação de Senhas
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',},
]

# Internacionalização e Localização
LANGUAGE_CODE = 'pt-br'
TIME_ZONE = 'America/Sao_Paulo'
USE_I18N = True
USE_TZ = True

# Arquivos Estáticos (CSS, JavaScript, Imagens da aplicação)
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
# STATICFILES_DIRS = [ BASE_DIR / "static_global", ] # Se tiver uma pasta static global
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Arquivos de Media (Arquivos enviados pelos utilizadores)
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'mediafiles' # Crie esta pasta na raiz do seu projeto

# Tipo de campo de chave primária padrão
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# LOGIN_REDIRECT_URL = '/' 
# LOGOUT_REDIRECT_URL = '/' 
# LOGIN_URL = 'login'
