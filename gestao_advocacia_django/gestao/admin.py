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
    raw_id_fields = ('cliente',) 

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
    readonly_fields = ('nome_original_arquivo', 'data_upload') # Campos preenchidos automaticamente

    def descricao_curta(self, obj):
        return (obj.descricao[:75] + '...') if obj.descricao and len(obj.descricao) > 75 else obj.descricao
    descricao_curta.short_description = 'Descrição'

admin.site.register(Cliente, ClienteAdmin)
admin.site.register(Caso, CasoAdmin)
admin.site.register(Recebimento, RecebimentoAdmin)
admin.site.register(Despesa, DespesaAdmin)
admin.site.register(EventoAgenda, EventoAgendaAdmin)
admin.site.register(Documento, DocumentoAdmin)
