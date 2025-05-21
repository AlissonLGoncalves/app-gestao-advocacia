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
```python
# Arquivo: gestao/models.py
from django.db import models
from django.utils import timezone
import os # Necessário para a função get_upload_path

class Cliente(models.Model):
    TIPO_PESSOA_CHOICES = [('PF', 'Pessoa Física'), ('PJ', 'Pessoa Jurídica')]
    
    nome_razao_social = models.CharField(max_length=255)
    cpf_cnpj = models.CharField(max_length=18, unique=True) # Aumentado para acomodar formatação
    tipo_pessoa = models.CharField(max_length=2, choices=TIPO_PESSOA_CHOICES)
    rg = models.CharField(max_length=20, blank=True, null=True)
    orgao_emissor = models.CharField(max_length=50, blank=True, null=True)
    data_nascimento = models.DateField(blank=True, null=True)
    estado_civil = models.CharField(max_length=50, blank=True, null=True)
    profissao = models.CharField(max_length=100, blank=True, null=True)
    nacionalidade = models.CharField(max_length=100, blank=True, null=True, default='Brasileiro(a)')
    nome_fantasia = models.CharField(max_length=255, blank=True, null=True)
    nire = models.CharField(max_length=50, blank=True, null=True)
    inscricao_estadual = models.CharField(max_length=50, blank=True, null=True)
    inscricao_municipal = models.CharField(max_length=50, blank=True, null=True)
    cep = models.CharField(max_length=9, blank=True, null=True)
    rua = models.CharField(max_length=255, blank=True, null=True)
    numero = models.CharField(max_length=20, blank=True, null=True)
    bairro = models.CharField(max_length=100, blank=True, null=True)
    cidade = models.CharField(max_length=100, blank=True, null=True)
    estado = models.CharField(max_length=2, blank=True, null=True)
    pais = models.CharField(max_length=50, default='Brasil', blank=True, null=True)
    telefone = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(max_length=255, blank=True, null=True)
    notas_gerais = models.TextField(blank=True, null=True)
    data_criacao = models.DateTimeField(default=timezone.now)
    data_atualizacao = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.nome_razao_social

class Caso(models.Model):
    STATUS_CASO_CHOICES = [
        ('Ativo', 'Ativo'), ('Suspenso', 'Suspenso'),
        ('Encerrado', 'Encerrado'), ('Arquivado', 'Arquivado')
    ]
    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name='casos')
    titulo = models.CharField(max_length=255)
    numero_processo = models.CharField(max_length=30, unique=True, blank=True, null=True)
    status = models.CharField(max_length=50, choices=STATUS_CASO_CHOICES, default='Ativo')
    parte_contraria = models.CharField(max_length=255, blank=True, null=True)
    adv_parte_contraria = models.CharField(max_length=255, blank=True, null=True)
    tipo_acao = models.CharField(max_length=100, blank=True, null=True)
    vara_juizo = models.CharField(max_length=100, blank=True, null=True)
    comarca = models.CharField(max_length=100, blank=True, null=True)
    instancia = models.CharField(max_length=50, blank=True, null=True)
    valor_causa = models.DecimalField(max_digits=15, decimal_places=2, blank=True, null=True)
    data_distribuicao = models.DateField(blank=True, null=True)
    notas_caso = models.TextField(blank=True, null=True)
    data_criacao = models.DateTimeField(default=timezone.now)
    data_atualizacao = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.titulo

class Recebimento(models.Model):
    STATUS_RECEBIMENTO_CHOICES = [
        ('Pendente', 'Pendente'), ('Pago', 'Pago'),
        ('Vencido', 'Vencido'), ('Cancelado', 'Cancelado')
    ]
    CATEGORIA_RECEBIMENTO_CHOICES = [
        ('Honorários Advocatícios', 'Honorários Advocatícios'), ('Honorários de Êxito', 'Honorários de Êxito'),
        ('Consultoria', 'Consultoria'), ('Custas Processuais (Reembolso)', 'Custas Processuais (Reembolso)'),
        ('Despesas (Reembolso)', 'Despesas (Reembolso)'), ('Acordo Judicial', 'Acordo Judicial'),
        ('Outros Recebimentos', 'Outros Recebimentos')
    ]
    caso = models.ForeignKey(Caso, on_delete=models.CASCADE, related_name='recebimentos')
    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name='recebimentos_cliente')
    data_recebimento = models.DateField(blank=True, null=True)
    data_vencimento = models.DateField()
    descricao = models.CharField(max_length=255)
    categoria = models.CharField(max_length=100, choices=CATEGORIA_RECEBIMENTO_CHOICES, default='Honorários Advocatícios')
    valor = models.DecimalField(max_digits=15, decimal_places=2)
    status = models.CharField(max_length=50, choices=STATUS_RECEBIMENTO_CHOICES, default='Pendente')
    forma_pagamento = models.CharField(max_length=50, blank=True, null=True)
    notas = models.TextField(blank=True, null=True)
    data_criacao = models.DateTimeField(default=timezone.now)
    data_atualizacao = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.descricao} - R$ {self.valor}"

class Despesa(models.Model):
    STATUS_DESPESA_CHOICES = [
        ('A Pagar', 'A Pagar'), ('Paga', 'Paga'),
        ('Vencida', 'Vencida'), ('Cancelada', 'Cancelada')
    ]
    CATEGORIA_DESPESA_CHOICES = [
        ('Custas Processuais', 'Custas Processuais'), ('Honorários Periciais', 'Honorários Periciais'),
        ('Cópias e Impressões', 'Cópias e Impressões'), ('Deslocamento/Viagem', 'Deslocamento/Viagem'),
        ('Aluguel Escritório', 'Aluguel Escritório'), ('Contas (Água, Luz, Internet, Telefone)', 'Contas (Água, Luz, Internet, Telefone)'),
        ('Software e Assinaturas', 'Software e Assinaturas'), ('Material de Escritório', 'Material de Escritório'),
        ('Marketing e Publicidade', 'Marketing e Publicidade'), ('Impostos e Taxas Escritório', 'Impostos e Taxas Escritório'),
        ('Outras Despesas', 'Outras Despesas')
    ]
    caso = models.ForeignKey(Caso, on_delete=models.SET_NULL, blank=True, null=True, related_name='despesas')
    data_despesa = models.DateField(blank=True, null=True)
    data_vencimento = models.DateField()
    descricao = models.CharField(max_length=255)
    categoria = models.CharField(max_length=100, choices=CATEGORIA_DESPESA_CHOICES, default='Custas Processuais')
    valor = models.DecimalField(max_digits=15, decimal_places=2)
    status = models.CharField(max_length=50, choices=STATUS_DESPESA_CHOICES, default='A Pagar')
    forma_pagamento = models.CharField(max_length=50, blank=True, null=True)
    notas = models.TextField(blank=True, null=True)
    data_criacao = models.DateTimeField(default=timezone.now)
    data_atualizacao = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.descricao} - R$ {self.valor}"

class EventoAgenda(models.Model):
    TIPO_EVENTO_CHOICES = [
        ('Prazo', 'Prazo'), ('Audiência', 'Audiência'),
        ('Reunião', 'Reunião'), ('Lembrete', 'Lembrete'), ('Outro', 'Outro')
    ]
    caso = models.ForeignKey(Caso, on_delete=models.SET_NULL, blank=True, null=True, related_name='eventos')
    tipo_evento = models.CharField(max_length=50, choices=TIPO_EVENTO_CHOICES, default='Lembrete')
    titulo = models.CharField(max_length=255)
    descricao = models.TextField(blank=True, null=True)
    data_inicio = models.DateTimeField()
    data_fim = models.DateTimeField(blank=True, null=True)
    local = models.CharField(max_length=255, blank=True, null=True)
    concluido = models.BooleanField(default=False)
    data_criacao = models.DateTimeField(default=timezone.now)
    data_atualizacao = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.tipo_evento}: {self.titulo} em {self.data_inicio.strftime('%d/%m/%Y %H:%M')}"

def get_upload_path(instance, filename):
    # Gera um nome de arquivo único para evitar colisões e organiza por data e tipo de entidade (opcional)
    ext = filename.split('.')[-1]
    timestamp = timezone.now().strftime('%Y%m%d%H%M%S%f')
    unique_filename = f"{timestamp}_{instance.id if instance.id else 'novo'}.{ext}"
    
    entity_path = "geral"
    if instance.cliente:
        entity_path = f"cliente_{instance.cliente.id}"
    if instance.caso:
        entity_path = os.path.join(entity_path, f"caso_{instance.caso.id}")

    return os.path.join('documentos', entity_path, unique_filename)

class Documento(models.Model):
    cliente = models.ForeignKey(Cliente, on_delete=models.SET_NULL, blank=True, null=True, related_name='documentos_cliente')
    caso = models.ForeignKey(Caso, on_delete=models.SET_NULL, blank=True, null=True, related_name='documentos_caso')
    arquivo = models.FileField(upload_to=get_upload_path) 
    nome_original_arquivo = models.CharField(max_length=255) 
    descricao = models.TextField(blank=True, null=True)
    data_upload = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.nome_original_arquivo or f"Documento ID {self.id}"

    def save(self, *args, **kwargs):
        if self.arquivo and not self.nome_original_arquivo:
            self.nome_original_arquivo = self.arquivo.name
        super().save(*args, **kwargs)

    # Para deletar o arquivo físico quando o registro do Documento é deletado:
    def delete(self, *args, **kwargs):
        if self.arquivo:
            if os.path.isfile(self.arquivo.path):
                os.remove(self.arquivo.path)
        super().delete(*args, **kwargs)

```python
# Arquivo: gestao/admin.py
from django.contrib import admin
from .models import Cliente, Caso, Recebimento, Despesa, EventoAgenda, Documento

class ClienteAdmin(admin.ModelAdmin):
    list_display = ('nome_razao_social', 'cpf_cnpj', 'tipo_pessoa', 'email', 'telefone', 'cidade', 'estado')
    search_fields = ('nome_razao_social', 'cpf_cnpj', 'email', 'cidade')
    list_filter = ('tipo_pessoa', 'estado', 'data_criacao')
    ordering = ('nome_razao_social',)

class CasoAdmin(admin.ModelAdmin):
    list_display = ('titulo', 'cliente', 'numero_processo', 'status', 'tipo_acao', 'data_atualizacao')
    search_fields = ('titulo', 'numero_processo', 'cliente__nome_razao_social')
    list_filter = ('status', 'tipo_acao', 'instancia', 'data_criacao')
    ordering = ('-data_atualizacao',)
    raw_id_fields = ('cliente',) # Melhora a performance para selecionar clientes em casos com muitos clientes

class RecebimentoAdmin(admin.ModelAdmin):
    list_display = ('descricao', 'cliente', 'caso', 'valor', 'data_vencimento', 'status', 'categoria')
    search_fields = ('descricao', 'cliente__nome_razao_social', 'caso__titulo', 'categoria')
    list_filter = ('status', 'categoria', 'data_vencimento', 'data_recebimento')
    ordering = ('-data_vencimento',)
    raw_id_fields = ('cliente', 'caso')

class DespesaAdmin(admin.ModelAdmin):
    list_display = ('descricao', 'caso', 'valor', 'data_vencimento', 'status', 'categoria')
    search_fields = ('descricao', 'caso__titulo', 'categoria')
    list_filter = ('status', 'categoria', 'data_vencimento', 'data_despesa')
    ordering = ('-data_vencimento',)
    raw_id_fields = ('caso',)

class EventoAgendaAdmin(admin.ModelAdmin):
    list_display = ('titulo', 'tipo_evento', 'data_inicio', 'data_fim', 'caso', 'concluido')
    search_fields = ('titulo', 'descricao', 'local', 'caso__titulo')
    list_filter = ('tipo_evento', 'concluido', 'data_inicio')
    ordering = ('data_inicio',)
    raw_id_fields = ('caso',)

class DocumentoAdmin(admin.ModelAdmin):
    list_display = ('nome_original_arquivo', 'descricao_curta', 'cliente', 'caso', 'data_upload')
    search_fields = ('nome_original_arquivo', 'descricao', 'cliente__nome_razao_social', 'caso__titulo')
    list_filter = ('data_upload',)
    ordering = ('-data_upload',)
    raw_id_fields = ('cliente', 'caso')

    def descricao_curta(self, obj):
        return (obj.descricao[:75] + '...') if obj.descricao and len(obj.descricao) > 75 else obj.descricao
    descricao_curta.short_description = 'Descrição'

admin.site.register(Cliente, ClienteAdmin)
admin.site.register(Caso, CasoAdmin)
admin.site.register(Recebimento, RecebimentoAdmin)
admin.site.register(Despesa, DespesaAdmin)
admin.site.register(EventoAgenda, EventoAgendaAdmin)
admin.site.register(Documento, DocumentoAdmin)
```python
# Arquivo: gestao/forms.py
from django import forms
from .models import Cliente, Caso, Recebimento, Despesa, EventoAgenda, Documento

class ClienteForm(forms.ModelForm):
    class Meta:
        model = Cliente
        fields = '__all__'
        widgets = {
            'data_nascimento': forms.DateInput(attrs={'type': 'date', 'class': 'form-control form-control-sm'}),
            'notas_gerais': forms.Textarea(attrs={'rows': 3, 'class': 'form-control form-control-sm'}),
            'nome_razao_social': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'cpf_cnpj': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'tipo_pessoa': forms.Select(attrs={'class': 'form-select form-select-sm'}),
            'rg': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'orgao_emissor': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'estado_civil': forms.Select(choices=[('', '---------')] + list(Cliente._meta.get_field('estado_civil').choices if hasattr(Cliente._meta.get_field('estado_civil'), 'choices') else []), attrs={'class': 'form-select form-select-sm'}), # Adicionar choices se definidos no modelo
            'profissao': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'nacionalidade': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'nome_fantasia': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'nire': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'inscricao_estadual': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'inscricao_municipal': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'cep': forms.TextInput(attrs={'class': 'form-control form-control-sm', 'onblur': 'buscarCep(this.value)'}), # Exemplo de JS inline (não ideal)
            'rua': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'numero': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'bairro': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'cidade': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'estado': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'pais': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'telefone': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'email': forms.EmailInput(attrs={'class': 'form-control form-control-sm'}),
        }
        # Adicionar mais personalizações de widgets e labels aqui

class CasoForm(forms.ModelForm):
    class Meta:
        model = Caso
        fields = '__all__'
        widgets = {
            'cliente': forms.Select(attrs={'class': 'form-select form-select-sm'}),
            'titulo': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'numero_processo': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'status': forms.Select(attrs={'class': 'form-select form-select-sm'}),
            'parte_contraria': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'adv_parte_contraria': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'tipo_acao': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'vara_juizo': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'comarca': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'instancia': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'valor_causa': forms.NumberInput(attrs={'class': 'form-control form-control-sm', 'step': '0.01'}),
            'data_distribuicao': forms.DateInput(attrs={'type': 'date', 'class': 'form-control form-control-sm'}),
            'notas_caso': forms.Textarea(attrs={'rows': 3, 'class': 'form-control form-control-sm'}),
        }

class RecebimentoForm(forms.ModelForm):
    class Meta:
        model = Recebimento
        fields = '__all__'
        widgets = {
            'cliente': forms.Select(attrs={'class': 'form-select form-select-sm'}),
            'caso': forms.Select(attrs={'class': 'form-select form-select-sm'}),
            'data_recebimento': forms.DateInput(attrs={'type': 'date', 'class': 'form-control form-control-sm'}),
            'data_vencimento': forms.DateInput(attrs={'type': 'date', 'class': 'form-control form-control-sm'}),
            'descricao': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'categoria': forms.Select(attrs={'class': 'form-select form-select-sm'}),
            'valor': forms.NumberInput(attrs={'class': 'form-control form-control-sm', 'step': '0.01'}),
            'status': forms.Select(attrs={'class': 'form-select form-select-sm'}),
            'forma_pagamento': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'notas': forms.Textarea(attrs={'rows': 2, 'class': 'form-control form-control-sm'}),
        }

class DespesaForm(forms.ModelForm):
    class Meta:
        model = Despesa
        fields = '__all__'
        widgets = {
            'caso': forms.Select(attrs={'class': 'form-select form-select-sm'}),
            'data_despesa': forms.DateInput(attrs={'type': 'date', 'class': 'form-control form-control-sm'}),
            'data_vencimento': forms.DateInput(attrs={'type': 'date', 'class': 'form-control form-control-sm'}),
            'descricao': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'categoria': forms.Select(attrs={'class': 'form-select form-select-sm'}),
            'valor': forms.NumberInput(attrs={'class': 'form-control form-control-sm', 'step': '0.01'}),
            'status': forms.Select(attrs={'class': 'form-select form-select-sm'}),
            'forma_pagamento': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'notas': forms.Textarea(attrs={'rows': 2, 'class': 'form-control form-control-sm'}),
        }

class EventoAgendaForm(forms.ModelForm):
    class Meta:
        model = EventoAgenda
        fields = '__all__'
        widgets = {
            'caso': forms.Select(attrs={'class': 'form-select form-select-sm'}),
            'tipo_evento': forms.Select(attrs={'class': 'form-select form-select-sm'}),
            'titulo': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'descricao': forms.Textarea(attrs={'rows': 3, 'class': 'form-control form-control-sm'}),
            'data_inicio': forms.DateTimeInput(attrs={'type': 'datetime-local', 'class': 'form-control form-control-sm'}),
            'data_fim': forms.DateTimeInput(attrs={'type': 'datetime-local', 'class': 'form-control form-control-sm'}),
            'local': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'concluido': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
        }

class DocumentoForm(forms.ModelForm):
    class Meta:
        model = Documento
        fields = ['cliente', 'caso', 'arquivo', 'descricao'] # nome_original_arquivo é preenchido automaticamente
        widgets = {
            'cliente': forms.Select(attrs={'class': 'form-select form-select-sm'}),
            'caso': forms.Select(attrs={'class': 'form-select form-select-sm'}),
            'arquivo': forms.FileInput(attrs={'class': 'form-control form-control-sm'}),
            'descricao': forms.Textarea(attrs={'rows': 3, 'class': 'form-control form-control-sm'}),
        }
