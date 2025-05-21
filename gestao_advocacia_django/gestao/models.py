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
    ext = filename.split('.')[-1]
    timestamp = timezone.now().strftime('%Y%m%d%H%M%S%f')
    # Tenta usar o ID da instância se já existir (ao editar), senão 'novo'
    instance_id_part = instance.pk if instance.pk else 'novo'
    unique_filename = f"{timestamp}_{instance_id_part}.{ext}"
    
    entity_path = "geral"
    if instance.cliente:
        entity_path = f"cliente_{instance.cliente.id}"
    if instance.caso: # Se tiver caso, ele sobrepõe o cliente para organização
        entity_path = os.path.join(f"cliente_{instance.caso.cliente.id}" if instance.caso.cliente else "sem_cliente", f"caso_{instance.caso.id}")

    return os.path.join('documentos', entity_path, unique_filename)

class Documento(models.Model):
    cliente = models.ForeignKey(Cliente, on_delete=models.SET_NULL, blank=True, null=True, related_name='documentos_cliente')
    caso = models.ForeignKey(Caso, on_delete=models.SET_NULL, blank=True, null=True, related_name='documentos_caso')
    arquivo = models.FileField(upload_to=get_upload_path) 
    nome_original_arquivo = models.CharField(max_length=255, blank=True) # Pode ser preenchido no save
    descricao = models.TextField(blank=True, null=True)
    data_upload = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.nome_original_arquivo or f"Documento ID {self.id}"

    def save(self, *args, **kwargs):
        if self.arquivo and not self.nome_original_arquivo:
            self.nome_original_arquivo = os.path.basename(self.arquivo.name)
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.arquivo:
            # Verifica se o arquivo existe antes de tentar deletar
            if hasattr(self.arquivo, 'path') and self.arquivo.path and os.path.isfile(self.arquivo.path):
                os.remove(self.arquivo.path)
        super().delete(*args, **kwargs)
