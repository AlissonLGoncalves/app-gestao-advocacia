# CAMINHO: gestao/forms.py
from django import forms
from .models import Cliente, Caso, Recebimento, Despesa, EventoAgenda, Documento

class ClienteForm(forms.ModelForm):
    class Meta:
        model = Cliente
        fields = '__all__'
        widgets = {
            'nome_razao_social': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'cpf_cnpj': forms.TextInput(attrs={'class': 'form-control form-control-sm', 'placeholder': '000.000.000-00 ou 00.000.000/0000-00'}),
            'tipo_pessoa': forms.Select(attrs={'class': 'form-select form-select-sm'}),
            'rg': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'orgao_emissor': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'data_nascimento': forms.DateInput(attrs={'type': 'date', 'class': 'form-control form-control-sm'}),
            'estado_civil': forms.Select(attrs={'class': 'form-select form-select-sm'}), # Usará choices do modelo
            'profissao': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'nacionalidade': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'nome_fantasia': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'nire': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'inscricao_estadual': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'inscricao_municipal': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'cep': forms.TextInput(attrs={'class': 'form-control form-control-sm', 'placeholder': '00000-000', 'id': 'id_cep_cliente'}), # Adicionado ID para JS
            'rua': forms.TextInput(attrs={'class': 'form-control form-control-sm', 'id': 'id_rua_cliente'}),
            'numero': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'bairro': forms.TextInput(attrs={'class': 'form-control form-control-sm', 'id': 'id_bairro_cliente'}),
            'cidade': forms.TextInput(attrs={'class': 'form-control form-control-sm', 'id': 'id_cidade_cliente'}),
            'estado': forms.Select(attrs={'class': 'form-select form-select-sm', 'id': 'id_estado_cliente'}), # Usará choices do modelo
            'pais': forms.TextInput(attrs={'class': 'form-control form-control-sm'}),
            'telefone': forms.TextInput(attrs={'class': 'form-control form-control-sm', 'placeholder': '(00) 00000-0000'}),
            'email': forms.EmailInput(attrs={'class': 'form-control form-control-sm', 'placeholder': 'email@exemplo.com'}),
            'notas_gerais': forms.Textarea(attrs={'rows': 3, 'class': 'form-control form-control-sm'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Define valor inicial para país e nacionalidade apenas na criação
        if not self.instance.pk:
            if 'pais' in self.fields:
                self.fields['pais'].initial = 'Brasil'
            # A nacionalidade será definida com base no tipo_pessoa no template/JS
            # ou pode ser definida aqui se o tipo_pessoa já tiver um valor inicial


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
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if 'caso' in self.fields and isinstance(self.fields['caso'].widget, forms.Select):
            current_choices = list(self.fields['caso'].widget.choices)
            if not any(choice[0] == '' for choice in current_choices) and not self.fields['caso'].required:
                 self.fields['caso'].widget.choices = [('', '--------- (Despesa Geral)')] + current_choices

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
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if 'caso' in self.fields and isinstance(self.fields['caso'].widget, forms.Select):
            current_choices = list(self.fields['caso'].widget.choices)
            if not any(choice[0] == '' for choice in current_choices) and not self.fields['caso'].required:
                 self.fields['caso'].widget.choices = [('', '--------- (Evento Geral)')] + current_choices

class DocumentoForm(forms.ModelForm):
    arquivo = forms.FileField(label="Arquivo", required=False, widget=forms.FileInput(attrs={'class': 'form-control form-control-sm'}))

    class Meta:
        model = Documento
        fields = ['cliente', 'caso', 'arquivo', 'descricao'] # 'arquivo' está aqui para upload
        widgets = {
            'cliente': forms.Select(attrs={'class': 'form-select form-select-sm'}),
            'caso': forms.Select(attrs={'class': 'form-select form-select-sm'}),
            'descricao': forms.Textarea(attrs={'rows': 3, 'class': 'form-control form-control-sm'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Se estiver a editar, o campo de arquivo é para mostrar o nome e não permitir novo upload (a menos que você queira essa lógica)
        if self.instance and self.instance.pk:
            self.fields['arquivo'].required = False
            self.fields['arquivo'].widget = forms.HiddenInput() # Esconde o input de arquivo na edição
            # Ou, para mostrar o nome do arquivo atual e uma mensagem:
            # self.fields['arquivo'].widget = forms.TextInput(attrs={'class': 'form-control form-control-sm', 'readonly': True})
            # self.fields['arquivo'].initial = self.instance.nome_original_arquivo
            # self.fields['arquivo'].help_text = "Para alterar o arquivo, delete e adicione um novo."
        else: # Na criação, o arquivo é obrigatório
            self.fields['arquivo'].required = True
        
        optional_select_fields = ['cliente', 'caso']
        for field_name in optional_select_fields:
            if field_name in self.fields and isinstance(self.fields[field_name].widget, forms.Select):
                current_choices = list(self.fields[field_name].widget.choices)
                if not any(choice[0] == '' for choice in current_choices) and not self.fields[field_name].required:
                     self.fields[field_name].widget.choices = [('', '---------')] + current_choices
