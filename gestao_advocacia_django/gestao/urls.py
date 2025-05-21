# CAMINHO: gestao/urls.py
from django.urls import path
from . import views

app_name = 'gestao'

urlpatterns = [
    path('', views.dashboard_view, name='dashboard'),
    
    # Clientes
    path('clientes/', views.ClienteListView.as_view(), name='cliente_list'),
    path('clientes/novo/', views.ClienteCreateView.as_view(), name='cliente_create'),
    path('clientes/<int:pk>/', views.ClienteDetailView.as_view(), name='cliente_detail'),
    path('clientes/<int:pk>/editar/', views.ClienteUpdateView.as_view(), name='cliente_update'),
    path('clientes/<int:pk>/deletar/', views.ClienteDeleteView.as_view(), name='cliente_delete'),

    # Casos
    path('casos/', views.CasoListView.as_view(), name='caso_list'),
    path('casos/novo/', views.CasoCreateView.as_view(), name='caso_create'),
    path('cliente/<int:cliente_pk>/casos/novo/', views.CasoCreateView.as_view(), name='caso_create_for_cliente'),
    path('casos/<int:pk>/', views.CasoDetailView.as_view(), name='caso_detail'),
    path('casos/<int:pk>/editar/', views.CasoUpdateView.as_view(), name='caso_update'),
    path('casos/<int:pk>/deletar/', views.CasoDeleteView.as_view(), name='caso_delete'),

    # Recebimentos
    path('recebimentos/', views.RecebimentoListView.as_view(), name='recebimento_list'),
    path('recebimentos/novo/', views.RecebimentoCreateView.as_view(), name='recebimento_create'),
    path('caso/<int:caso_pk>/recebimentos/novo/', views.RecebimentoCreateView.as_view(), name='recebimento_create_for_caso'),
    path('recebimentos/<int:pk>/editar/', views.RecebimentoUpdateView.as_view(), name='recebimento_update'),
    path('recebimentos/<int:pk>/deletar/', views.RecebimentoDeleteView.as_view(), name='recebimento_delete'),

    # Despesas
    path('despesas/', views.DespesaListView.as_view(), name='despesa_list'),
    path('despesas/nova/', views.DespesaCreateView.as_view(), name='despesa_create'),
    path('caso/<int:caso_pk>/despesas/nova/', views.DespesaCreateView.as_view(), name='despesa_create_for_caso'),
    path('despesas/<int:pk>/editar/', views.DespesaUpdateView.as_view(), name='despesa_update'),
    path('despesas/<int:pk>/deletar/', views.DespesaDeleteView.as_view(), name='despesa_delete'),

    # Eventos da Agenda
    path('agenda/', views.EventoAgendaListView.as_view(), name='evento_list'),
    path('agenda/novo/', views.EventoAgendaCreateView.as_view(), name='evento_create'),
    path('caso/<int:caso_pk>/agenda/novo/', views.EventoAgendaCreateView.as_view(), name='evento_create_for_caso'),
    path('agenda/<int:pk>/editar/', views.EventoAgendaUpdateView.as_view(), name='evento_update'),
    path('agenda/<int:pk>/deletar/', views.EventoAgendaDeleteView.as_view(), name='evento_delete'),

    # Documentos
    path('documentos/', views.DocumentoListView.as_view(), name='documento_list'),
    path('documentos/novo/', views.DocumentoCreateView.as_view(), name='documento_create'),
    path('cliente/<int:cliente_pk>/documentos/novo/', views.DocumentoCreateView.as_view(), name='documento_create_for_cliente'),
    path('caso/<int:caso_pk>/documentos/novo/', views.DocumentoCreateView.as_view(), name='documento_create_for_caso'),
    path('documentos/<int:pk>/editar/', views.DocumentoUpdateView.as_view(), name='documento_update'),
    path('documentos/<int:pk>/deletar/', views.DocumentoDeleteView.as_view(), name='documento_delete'),
    path('documentos/download/<int:pk>/', views.documento_download_view, name='documento_download'),
    
    # Relatórios
    path('relatorios/', views.relatorio_list_view, name='relatorio_list'),
    # URLs ADICIONADAS PARA OS RELATÓRIOS ESPECÍFICOS:
    path('relatorios/contas-a-receber/', views.RelatorioContasAReceberView.as_view(), name='relatorio_contas_a_receber'),
    path('relatorios/contas-a-pagar/', views.RelatorioContasAPagarView.as_view(), name='relatorio_contas_a_pagar'),
]
