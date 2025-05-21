# Arquivo: gestao/forms.py
from django import forms
from .models import Cliente, Caso, Recebimento, Despesa, EventoAgenda, Documento

class ClienteForm(forms.ModelForm):
    class Meta:
        model = Cliente
        fields = '__all__' # Inclui todos os campos do modelo no formulário
        # Adiciona widgets para aplicar classes Bootstrap e tipos de input corretos
        widgets = {
            'data_nascimento': forms.DateInput(attrs={'type': 'date', 'class': 'form-control form-control-sm'}),
            'notas_gerais': forms.Textarea(attrs={'rows': 3, 'class': 'form-control form-control-sm'}),
            'nome_razao_social': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'cpf_cnpj': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'tipo_pessoa': forms.Select(attrs={'class': 'form-select form-select-sm'}),
            'rg': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'orgao_emissor': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'estado_civil': forms.Select(attrs={'class': 'form-select form-select-sm'}),
            'profissao': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'nacionalidade': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'nome_fantasia': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'nire': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'inscricao_estadual': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'inscricao_municipal': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'cep': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'rua': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'numero': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'bairro': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'cidade': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'estado': forms.TextInput(attrs={'class': 'form-control form-control-sm', 'maxlength': '2'}),
            'pais': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'telefone': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'email': forms.EmailInput(attrs={'class': 'form-control form-control-sm'}),
        }
        # Você pode definir labels personalizados aqui se necessário:
        # labels = {
        #     'nome_razao_social': 'Nome Completo / Razão Social',
        #     'cpf_cnpj': 'CPF / CNPJ',
        # }

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
        fields = ['cliente', 'caso', 'arquivo', 'descricao'] 
        widgets = {
            'cliente': forms.Select(attrs={'class': 'form-select form-select-sm'}),
            'caso': forms.Select(attrs={'class': 'form-select form-select-sm'}),
            'arquivo': forms.FileInput(attrs={'class': 'form-control form-control-sm'}), # Para upload de arquivo
            'descricao': forms.Textarea(attrs={'rows': 3, 'class': 'form-control form-control-sm'}),
        }
