# Arquivo: gestao/urls.py
from django.urls import path
from . import views

app_name = 'gestao' # Namespace para as URLs desta app

urlpatterns = [
    # URL para o Dashboard (página inicial da app 'gestao')
    path('', views.dashboard_view, name='dashboard'),
    
    # URLs para Clientes
    path('clientes/', views.ClienteListView.as_view(), name='cliente_list'),
    path('clientes/novo/', views.ClienteCreateView.as_view(), name='cliente_create'),
    path('clientes/<int:pk>/', views.ClienteDetailView.as_view(), name='cliente_detail'), 
    path('clientes/<int:pk>/editar/', views.ClienteUpdateView.as_view(), name='cliente_update'),
    path('clientes/<int:pk>/deletar/', views.ClienteDeleteView.as_view(), name='cliente_delete'),

    # URLs para Casos
    path('casos/', views.CasoListView.as_view(), name='caso_list'),
    path('casos/novo/', views.CasoCreateView.as_view(), name='caso_create'),
    # URL para criar um caso associado a um cliente específico
    path('cliente/<int:cliente_pk>/casos/novo/', views.CasoCreateView.as_view(), name='caso_create_for_cliente'),
    path('casos/<int:pk>/', views.CasoDetailView.as_view(), name='caso_detail'), 
    path('casos/<int:pk>/editar/', views.CasoUpdateView.as_view(), name='caso_update'),
    path('casos/<int:pk>/deletar/', views.CasoDeleteView.as_view(), name='caso_delete'),

    # URLs para Recebimentos
    path('recebimentos/', views.RecebimentoListView.as_view(), name='recebimento_list'),
    path('recebimentos/novo/', views.RecebimentoCreateView.as_view(), name='recebimento_create'),
    path('recebimentos/<int:pk>/editar/', views.RecebimentoUpdateView.as_view(), name='recebimento_update'),
    path('recebimentos/<int:pk>/deletar/', views.RecebimentoDeleteView.as_view(), name='recebimento_delete'),

    # URLs para Despesas
    path('despesas/', views.DespesaListView.as_view(), name='despesa_list'),
    path('despesas/nova/', views.DespesaCreateView.as_view(), name='despesa_create'),
    path('despesas/<int:pk>/editar/', views.DespesaUpdateView.as_view(), name='despesa_update'),
    path('despesas/<int:pk>/deletar/', views.DespesaDeleteView.as_view(), name='despesa_delete'),

    # URLs para Eventos da Agenda
    path('agenda/', views.EventoAgendaListView.as_view(), name='evento_list'),
    path('agenda/novo/', views.EventoAgendaCreateView.as_view(), name='evento_create'),
    path('agenda/<int:pk>/editar/', views.EventoAgendaUpdateView.as_view(), name='evento_update'),
    path('agenda/<int:pk>/deletar/', views.EventoAgendaDeleteView.as_view(), name='evento_delete'),

    # URLs para Documentos
    path('documentos/', views.DocumentoListView.as_view(), name='documento_list'),
    path('documentos/novo/', views.DocumentoCreateView.as_view(), name='documento_create'),
    path('documentos/<int:pk>/editar/', views.DocumentoUpdateView.as_view(), name='documento_update'),
    path('documentos/<int:pk>/deletar/', views.DocumentoDeleteView.as_view(), name='documento_delete'),
    path('documentos/download/<int:pk>/', views.documento_download_view, name='documento_download'),
    
    # Adicionar URLs para Relatórios aqui no futuro
    # path('relatorios/', views.relatorios_view, name='relatorio_list'),
]