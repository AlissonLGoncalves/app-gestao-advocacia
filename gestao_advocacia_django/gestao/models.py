# CAMINHO: gestao/models.py
from django.db import models
from django.urls import reverse
from django.utils import timezone # Para default=timezone.now
import os
import uuid
from django.conf import settings

# Choices para campos
ESTADO_CIVIL_CHOICES = [
    ('', '---------'),
    ('Solteiro(a)', 'Solteiro(a)'),
    ('Casado(a)', 'Casado(a)'),
    ('Divorciado(a)', 'Divorciado(a)'),
    ('Viúvo(a)', 'Viúvo(a)'),
    ('União Estável', 'União Estável'),
]

UF_CHOICES = [
    ('', '---------'),
    ('AC', 'Acre'), ('AL', 'Alagoas'), ('AP', 'Amapá'), ('AM', 'Amazonas'),
    ('BA', 'Bahia'), ('CE', 'Ceará'), ('DF', 'Distrito Federal'), ('ES', 'Espírito Santo'),
    ('GO', 'Goiás'), ('MA', 'Maranhão'), ('MT', 'Mato Grosso'), ('MS', 'Mato Grosso do Sul'),
    ('MG', 'Minas Gerais'), ('PA', 'Pará'), ('PB', 'Paraíba'), ('PR', 'Paraná'),
    ('PE', 'Pernambuco'), ('PI', 'Piauí'), ('RJ', 'Rio de Janeiro'),
    ('RN', 'Rio Grande do Norte'), ('RS', 'Rio Grande do Sul'), ('RO', 'Rondônia'),
    ('RR', 'Roraima'), ('SC', 'Santa Catarina'), ('SP', 'São Paulo'),
    ('SE', 'Sergipe'), ('TO', 'Tocantins')
]

class Cliente(models.Model):
    TIPO_PESSOA_CHOICES = [('PF', 'Pessoa Física'), ('PJ', 'Pessoa Jurídica')]
    
    nome_razao_social = models.CharField("Nome / Razão Social", max_length=255)
    cpf_cnpj = models.CharField("CPF/CNPJ", max_length=18, unique=True)
    tipo_pessoa = models.CharField("Tipo de Pessoa", max_length=2, choices=TIPO_PESSOA_CHOICES)
    
    # Campos PF
    rg = models.CharField("RG", max_length=20, blank=True, null=True)
    orgao_emissor = models.CharField("Órgão Emissor", max_length=50, blank=True, null=True)
    data_nascimento = models.DateField("Data de Nascimento", blank=True, null=True)
    estado_civil = models.CharField("Estado Civil", max_length=50, choices=ESTADO_CIVIL_CHOICES, blank=True, null=True)
    profissao = models.CharField("Profissão", max_length=100, blank=True, null=True)
    nacionalidade = models.CharField("Nacionalidade", max_length=100, blank=True, null=True, default='Brasileiro(a)')

    # Campos PJ
    nome_fantasia = models.CharField("Nome Fantasia", max_length=255, blank=True, null=True)
    nire = models.CharField("NIRE", max_length=50, blank=True, null=True) # Número de Identificação do Registro de Empresas
    inscricao_estadual = models.CharField("Inscrição Estadual", max_length=50, blank=True, null=True)
    inscricao_municipal = models.CharField("Inscrição Municipal", max_length=50, blank=True, null=True)

    # Endereço
    cep = models.CharField("CEP", max_length=9, blank=True, null=True)
    rua = models.CharField("Rua/Logradouro", max_length=255, blank=True, null=True)
    numero = models.CharField("Número", max_length=20, blank=True, null=True)
    bairro = models.CharField("Bairro", max_length=100, blank=True, null=True)
    cidade = models.CharField("Cidade", max_length=100, blank=True, null=True)
    estado = models.CharField("UF", max_length=2, choices=UF_CHOICES, blank=True, null=True)
    pais = models.CharField("País", max_length=50, default='Brasil', blank=True, null=True)

    # Contato e Outros
    telefone = models.CharField("Telefone", max_length=20, blank=True, null=True)
    email = models.EmailField("Email", max_length=255, blank=True, null=True)
    notas_gerais = models.TextField("Notas Gerais", blank=True, null=True)
    
    data_criacao = models.DateTimeField("Data de Criação", default=timezone.now)
    data_atualizacao = models.DateTimeField("Data de Atualização", auto_now=True)

    # Relacionamentos
    # casos (definido em Caso)
    # recebimentos (definido em Recebimento)
    # documentos (definido em Documento)

    def __str__(self):
        return self.nome_razao_social

    def get_absolute_url(self):
        return reverse('gestao:cliente_detail', kwargs={'pk': self.pk})

class Caso(models.Model):
    STATUS_CASO_CHOICES = [
        ('Ativo', 'Ativo'),
        ('Pendente', 'Pendente'),
        ('Suspenso', 'Suspenso'),
        ('Encerrado', 'Encerrado'),
        ('Arquivado', 'Arquivado'),
    ]
    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name='casos', verbose_name="Cliente")
    titulo = models.CharField("Título do Caso", max_length=255)
    numero_processo = models.CharField("Número do Processo", max_length=30, blank=True, null=True, unique=True)
    status = models.CharField("Status", max_length=50, choices=STATUS_CASO_CHOICES, default='Ativo')
    
    parte_contraria = models.CharField("Parte Contrária", max_length=255, blank=True, null=True)
    adv_parte_contraria = models.CharField("Advogado da Parte Contrária", max_length=255, blank=True, null=True)
    tipo_acao = models.CharField("Tipo de Ação/Natureza", max_length=100, blank=True, null=True)
    vara_juizo = models.CharField("Vara/Juízo", max_length=100, blank=True, null=True)
    comarca = models.CharField("Comarca", max_length=100, blank=True, null=True)
    instancia = models.CharField("Instância", max_length=50, blank=True, null=True)
    valor_causa = models.DecimalField("Valor da Causa", max_digits=15, decimal_places=2, blank=True, null=True)
    data_distribuicao = models.DateField("Data de Distribuição/Início", blank=True, null=True)
    
    notas_caso = models.TextField("Notas sobre o Caso", blank=True, null=True)
    data_criacao = models.DateTimeField("Data de Criação", default=timezone.now)
    data_atualizacao = models.DateTimeField("Data de Atualização", auto_now=True)

    def __str__(self):
        return f"{self.titulo} (Cliente: {self.cliente.nome_razao_social})"

    def get_absolute_url(self):
        return reverse('gestao:caso_detail', kwargs={'pk': self.pk})

class Recebimento(models.Model):
    STATUS_RECEBIMENTO_CHOICES = [
        ('Pendente', 'Pendente'),
        ('Pago', 'Pago'),
        ('Vencido', 'Vencido'),
        ('Cancelado', 'Cancelado'),
    ]
    CATEGORIA_RECEBIMENTO_CHOICES = [
        ('Honorários Iniciais', 'Honorários Iniciais'),
        ('Honorários Mensais', 'Honorários Mensais'),
        ('Honorários de Êxito', 'Honorários de Êxito'),
        ('Custas Processuais', 'Custas Processuais (Reembolso)'),
        ('Acordo', 'Acordo'),
        ('Outros', 'Outros'),
    ]
    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name='recebimentos_cliente', verbose_name="Cliente")
    caso = models.ForeignKey(Caso, on_delete=models.CASCADE, related_name='recebimentos_caso', verbose_name="Caso Associado")
    descricao = models.CharField("Descrição", max_length=255)
    categoria = models.CharField("Categoria", max_length=100, choices=CATEGORIA_RECEBIMENTO_CHOICES)
    valor = models.DecimalField("Valor (R$)", max_digits=15, decimal_places=2)
    data_vencimento = models.DateField("Data de Vencimento")
    data_recebimento = models.DateField("Data de Recebimento", blank=True, null=True)
    status = models.CharField("Status", max_length=50, choices=STATUS_RECEBIMENTO_CHOICES, default='Pendente')
    forma_pagamento = models.CharField("Forma de Pagamento", max_length=50, blank=True, null=True)
    notas = models.TextField("Notas", blank=True, null=True)
    data_criacao = models.DateTimeField("Data de Criação", default=timezone.now)
    data_atualizacao = models.DateTimeField("Data de Atualização", auto_now=True)

    def __str__(self):
        return f"{self.descricao} - R$ {self.valor} (Venc: {self.data_vencimento})"

class Despesa(models.Model):
    STATUS_DESPESA_CHOICES = [
        ('A Pagar', 'A Pagar'),
        ('Paga', 'Paga'),
        ('Vencida', 'Vencida'),
        ('Cancelada', 'Cancelada'),
    ]
    CATEGORIA_DESPESA_CHOICES = [
        ('Custas Judiciais', 'Custas Judiciais'),
        ('Cópias e Impressões', 'Cópias e Impressões'),
        ('Deslocamento', 'Deslocamento'),
        ('Serviços de Terceiros', 'Serviços de Terceiros (Peritos, etc.)'),
        ('Correspondente Jurídico', 'Correspondente Jurídico'),
        ('Despesas Administrativas', 'Despesas Administrativas (Escritório)'),
        ('Outras', 'Outras'),
    ]
    caso = models.ForeignKey(Caso, on_delete=models.SET_NULL, blank=True, null=True, related_name='despesas_caso', verbose_name="Caso Associado (Opcional)")
    descricao = models.CharField("Descrição", max_length=255)
    categoria = models.CharField("Categoria", max_length=100, choices=CATEGORIA_DESPESA_CHOICES)
    valor = models.DecimalField("Valor (R$)", max_digits=15, decimal_places=2)
    data_vencimento = models.DateField("Data de Vencimento")
    data_despesa = models.DateField("Data da Despesa/Pagamento", blank=True, null=True) # Pode ser a data do pagamento
    status = models.CharField("Status", max_length=50, choices=STATUS_DESPESA_CHOICES, default='A Pagar')
    forma_pagamento = models.CharField("Forma de Pagamento", max_length=50, blank=True, null=True)
    notas = models.TextField("Notas", blank=True, null=True)
    data_criacao = models.DateTimeField("Data de Criação", default=timezone.now)
    data_atualizacao = models.DateTimeField("Data de Atualização", auto_now=True)

    def __str__(self):
        return f"{self.descricao} - R$ {self.valor} (Venc: {self.data_vencimento})"

class EventoAgenda(models.Model):
    TIPO_EVENTO_CHOICES = [
        ('Prazo', 'Prazo Processual'),
        ('Audiência', 'Audiência'),
        ('Reunião', 'Reunião'),
        ('Lembrete', 'Lembrete'),
        ('Outro', 'Outro Compromisso'),
    ]
    caso = models.ForeignKey(Caso, on_delete=models.SET_NULL, blank=True, null=True, related_name='eventos_caso', verbose_name="Caso Associado (Opcional)")
    tipo_evento = models.CharField("Tipo de Evento", max_length=50, choices=TIPO_EVENTO_CHOICES)
    titulo = models.CharField("Título do Evento/Prazo", max_length=255)
    descricao = models.TextField("Descrição Detalhada", blank=True, null=True)
    data_inicio = models.DateTimeField("Data e Hora de Início")
    data_fim = models.DateTimeField("Data e Hora de Fim", blank=True, null=True)
    local = models.CharField("Local (se aplicável)", max_length=255, blank=True, null=True)
    concluido = models.BooleanField("Concluído?", default=False)
    data_criacao = models.DateTimeField("Data de Criação", default=timezone.now)
    data_atualizacao = models.DateTimeField("Data de Atualização", auto_now=True)

    def __str__(self):
        return f"{self.get_tipo_evento_display()}: {self.titulo} ({self.data_inicio.strftime('%d/%m/%Y %H:%M')})"

def get_upload_path(instance, filename):
    # Gera um nome de arquivo único para evitar colisões e organiza por data/cliente/caso
    ext = filename.split('.')[-1]
    unique_id = uuid.uuid4().hex
    timestamp_path = timezone.now().strftime('%Y/%m/%d')
    
    subfolder = "geral"
    if instance.caso:
        subfolder = f"cliente_{instance.caso.cliente.id}/caso_{instance.caso.id}"
    elif instance.cliente:
        subfolder = f"cliente_{instance.cliente.id}/geral"
        
    return os.path.join('documentos', timestamp_path, subfolder, f"{unique_id}.{ext}")

class Documento(models.Model):
    cliente = models.ForeignKey(Cliente, on_delete=models.SET_NULL, blank=True, null=True, related_name='documentos_cliente', verbose_name="Cliente Associado (Opcional)")
    caso = models.ForeignKey(Caso, on_delete=models.SET_NULL, blank=True, null=True, related_name='documentos_caso', verbose_name="Caso Associado (Opcional)")
    
    nome_original_arquivo = models.CharField("Nome Original do Arquivo", max_length=255)
    arquivo = models.FileField("Arquivo", upload_to=get_upload_path) # O caminho será dinâmico
    descricao = models.TextField("Descrição do Documento", blank=True, null=True)
    
    # Metadados preenchidos automaticamente
    nome_armazenado = models.CharField("Nome Armazenado no Servidor", max_length=255, blank=True, editable=False) # Preenchido no save
    tipo_mime = models.CharField("Tipo MIME", max_length=100, blank=True, editable=False)
    tamanho_bytes = models.BigIntegerField("Tamanho (bytes)", blank=True, null=True, editable=False)
    
    data_upload = models.DateTimeField("Data do Upload", default=timezone.now)

    def save(self, *args, **kwargs):
        if self.arquivo and not self.nome_armazenado: # Apenas na criação ou se o arquivo for alterado
            self.nome_armazenado = self.arquivo.name # O 'name' já inclui o caminho gerado por upload_to
            self.tipo_mime = self.arquivo.file.content_type
            self.tamanho_bytes = self.arquivo.size
        super().save(*args, **kwargs)

    def __str__(self):
        return self.nome_original_arquivo

    def delete(self, *args, **kwargs):
        # Deletar o arquivo físico do sistema de arquivos antes de deletar o registro
        if self.arquivo:
            caminho_arquivo = os.path.join(settings.MEDIA_ROOT, str(self.arquivo.name))
            if os.path.exists(caminho_arquivo):
                try:
                    os.remove(caminho_arquivo)
                except Exception as e:
                    # Logar o erro, mas não impedir a deleção do registro do BD
                    print(f"Erro ao deletar arquivo físico {caminho_arquivo}: {e}")
        super().delete(*args, **kwargs)

    def get_absolute_url(self): # Para o botão "Download" ou "Ver"
        return reverse('gestao:documento_download', kwargs={'pk': self.pk})
