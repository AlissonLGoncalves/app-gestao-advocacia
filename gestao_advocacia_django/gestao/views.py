# CAMINHO: gestao/views.py
from django.shortcuts import render, get_object_or_404
from django.urls import reverse_lazy
from django.views.generic import ListView, CreateView, UpdateView, DeleteView, DetailView
from django.contrib.messages.views import SuccessMessageMixin
from django.contrib import messages
from django.db.models import Sum, Q, Value, CharField
from django.db.models.functions import Concat
from django.http import FileResponse, Http404, HttpResponseForbidden
import os
from django.conf import settings
from django.utils.http import url_has_allowed_host_and_scheme
from datetime import datetime

from .models import Cliente, Caso, Recebimento, Despesa, EventoAgenda, Documento
from .forms import (
    ClienteForm, CasoForm, RecebimentoForm, DespesaForm,
    EventoAgendaForm, DocumentoForm
)

# Função auxiliar para construir querystrings de ordenação para os templates
def get_order_params(request, default_order_by, default_direction='asc'):
    order_by = request.GET.get('order_by', default_order_by)
    direction = request.GET.get('direction', default_direction)
    return order_by, direction

def get_base_querystring_for_ordering(request):
    base_qs_params = request.GET.copy()
    for key in ['order_by', 'direction', 'page']:
        if key in base_qs_params:
            del base_qs_params[key]
    return base_qs_params.urlencode()

# Dashboard (manter como está)
def dashboard_view(request):
    num_clientes = Cliente.objects.count()
    num_casos_ativos = Caso.objects.filter(status='Ativo').count()
    proximos_eventos = EventoAgenda.objects.filter(concluido=False).order_by('data_inicio')[:5]
    total_a_receber = Recebimento.objects.filter(status__in=['Pendente', 'Vencido']).aggregate(total=Sum('valor'))['total'] or 0
    total_a_pagar = Despesa.objects.filter(status__in=['A Pagar', 'Vencida']).aggregate(total=Sum('valor'))['total'] or 0
    context = {
        'num_clientes': num_clientes,
        'num_casos_ativos': num_casos_ativos,
        'proximos_eventos': proximos_eventos,
        'total_a_receber': total_a_receber,
        'total_a_pagar': total_a_pagar,
        'titulo_pagina': 'Dashboard'
    }
    return render(request, 'gestao/dashboard.html', context)

# --- Views para Cliente (manter como no Canvas django_listas_refinadas_parte2_001) ---
class ClienteListView(ListView):
    model = Cliente
    template_name = 'gestao/cliente_list.html'
    context_object_name = 'clientes'
    paginate_by = 10

    def get_queryset(self):
        queryset = Cliente.objects.all()
        self.search_term = self.request.GET.get('q', '').strip()
        self.tipo_pessoa_filter = self.request.GET.get('tipo_pessoa', '').strip()
        
        order_by_param, direction_param = get_order_params(self.request, 'nome_razao_social')
        self.order_by_display = order_by_param 
        self.direction_display = direction_param

        if self.search_term:
            queryset = queryset.filter(
                Q(nome_razao_social__icontains=self.search_term) |
                Q(cpf_cnpj__icontains=self.search_term) |
                Q(email__icontains=self.search_term)
            )
        if self.tipo_pessoa_filter:
            queryset = queryset.filter(tipo_pessoa=self.tipo_pessoa_filter)

        allowed_order_fields = ['nome_razao_social', 'cpf_cnpj', 'tipo_pessoa', 'cidade', 'data_criacao']
        if order_by_param in allowed_order_fields:
            order_field_for_django = f"{'-' if direction_param == 'desc' else ''}{order_by_param}"
            queryset = queryset.order_by(order_field_for_django)
        else:
            queryset = queryset.order_by('nome_razao_social')
        return queryset

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = "Clientes"
        context['q'] = self.search_term
        context['tipo_pessoa_filter'] = self.tipo_pessoa_filter
        context['order_by'] = self.order_by_display
        context['direction'] = self.direction_display
        context['base_querystring'] = get_base_querystring_for_ordering(self.request)
        return context

# ... (Manter ClienteDetailView, ClienteCreateView, ClienteUpdateView, ClienteDeleteView) ...
class ClienteDetailView(DetailView):
    model = Cliente
    template_name = 'gestao/cliente_detail.html'
    context_object_name = 'cliente'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        cliente = self.object
        context['titulo_pagina'] = cliente.nome_razao_social
        context['casos_do_cliente'] = Caso.objects.filter(cliente=cliente).order_by('-data_atualizacao')
        context['recebimentos_do_cliente'] = Recebimento.objects.filter(cliente=cliente).order_by('-data_vencimento')
        context['documentos_do_cliente'] = Documento.objects.filter(Q(cliente=cliente) | Q(caso__cliente=cliente)).distinct().order_by('-data_upload')
        return context

class ClienteCreateView(SuccessMessageMixin, CreateView):
    model = Cliente
    form_class = ClienteForm
    template_name = 'gestao/cliente_form.html'
    success_url = reverse_lazy('gestao:cliente_list')
    success_message = "Cliente \"%(nome_razao_social)s\" adicionado com sucesso!"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = "Adicionar Novo Cliente"
        return context

class ClienteUpdateView(SuccessMessageMixin, UpdateView):
    model = Cliente
    form_class = ClienteForm
    template_name = 'gestao/cliente_form.html'
    success_message = "Cliente \"%(nome_razao_social)s\" atualizado com sucesso!"

    def get_success_url(self):
        return reverse_lazy('gestao:cliente_detail', kwargs={'pk': self.object.pk})

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = f"Editar Cliente: {self.object.nome_razao_social}"
        return context

class ClienteDeleteView(DeleteView):
    model = Cliente
    template_name = 'gestao/cliente_confirm_delete.html'
    success_url = reverse_lazy('gestao:cliente_list')
    
    def post(self, request, *args, **kwargs):
        messages.success(self.request, f"Cliente \"{self.get_object().nome_razao_social}\" deletado com sucesso!")
        return super().post(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = f"Deletar Cliente: {self.object.nome_razao_social}"
        return context

# --- Views para Caso (manter como no Canvas django_listas_refinadas_parte2_001) ---
class CasoListView(ListView):
    model = Caso
    template_name = 'gestao/caso_list.html'
    context_object_name = 'casos'
    paginate_by = 10

    def get_queryset(self):
        queryset = Caso.objects.select_related('cliente')
        self.search_term = self.request.GET.get('q', '').strip()
        self.cliente_id_filter = self.request.GET.get('cliente', '').strip()
        self.status_filter = self.request.GET.get('status', '').strip()
        
        order_by_param, direction_param = get_order_params(self.request, 'data_atualizacao', 'desc')
        self.order_by_display = order_by_param
        self.direction_display = direction_param

        if self.search_term:
            queryset = queryset.filter(
                Q(titulo__icontains=self.search_term) |
                Q(numero_processo__icontains=self.search_term) |
                Q(cliente__nome_razao_social__icontains=self.search_term)
            )
        if self.cliente_id_filter:
            queryset = queryset.filter(cliente_id=self.cliente_id_filter)
        if self.status_filter:
            queryset = queryset.filter(status=self.status_filter)

        allowed_order_fields = {
            'titulo': 'titulo', 'cliente': 'cliente__nome_razao_social',
            'numero_processo': 'numero_processo', 'status': 'status',
            'data_atualizacao': 'data_atualizacao', 'data_criacao': 'data_criacao'
        }
        if order_by_param in allowed_order_fields:
            order_field = allowed_order_fields[order_by_param]
            if direction_param == 'desc':
                order_field = f'-{order_field}'
            queryset = queryset.order_by(order_field)
        else:
            queryset = queryset.order_by('-data_atualizacao')
        return queryset

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = "Casos"
        context['clientes'] = Cliente.objects.all().order_by('nome_razao_social')
        context['status_choices'] = Caso.STATUS_CASO_CHOICES
        context['q'] = self.search_term
        context['cliente_filter'] = self.cliente_id_filter
        context['status_filter'] = self.status_filter
        context['order_by'] = self.order_by_display
        context['direction'] = self.direction_display
        context['base_querystring'] = get_base_querystring_for_ordering(self.request)
        return context

# ... (Manter CasoDetailView, CasoCreateView, CasoUpdateView, CasoDeleteView) ...
class CasoDetailView(DetailView):
    model = Caso
    template_name = 'gestao/caso_detail.html'
    context_object_name = 'caso'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        caso = self.object
        context['titulo_pagina'] = caso.titulo
        context['recebimentos_do_caso'] = Recebimento.objects.filter(caso=caso).order_by('-data_vencimento')
        context['despesas_do_caso'] = Despesa.objects.filter(caso=caso).order_by('-data_vencimento')
        context['eventos_do_caso'] = EventoAgenda.objects.filter(caso=caso).order_by('data_inicio')
        context['documentos_do_caso'] = Documento.objects.filter(caso=caso).order_by('-data_upload')
        return context

class CasoCreateView(SuccessMessageMixin, CreateView):
    model = Caso
    form_class = CasoForm
    template_name = 'gestao/caso_form.html'
    success_message = "Caso \"%(titulo)s\" criado com sucesso!"

    def get_initial(self):
        initial = super().get_initial()
        cliente_pk = self.kwargs.get('cliente_pk') or self.request.GET.get('cliente')
        if cliente_pk:
            initial['cliente'] = get_object_or_404(Cliente, pk=cliente_pk)
        return initial

    def get_success_url(self):
        if self.object.cliente:
            return reverse_lazy('gestao:cliente_detail', kwargs={'pk': self.object.cliente.pk})
        return reverse_lazy('gestao:caso_list')

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = "Adicionar Novo Caso"
        cliente_pk = self.kwargs.get('cliente_pk') or self.request.GET.get('cliente')
        if cliente_pk:
            context['cliente_associado'] = get_object_or_404(Cliente, pk=cliente_pk)
        return context

class CasoUpdateView(SuccessMessageMixin, UpdateView):
    model = Caso
    form_class = CasoForm
    template_name = 'gestao/caso_form.html'
    success_message = "Caso \"%(titulo)s\" atualizado com sucesso!"
    
    def get_success_url(self):
        return reverse_lazy('gestao:caso_detail', kwargs={'pk': self.object.pk})

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = f"Editar Caso: {self.object.titulo}"
        return context

class CasoDeleteView(DeleteView):
    model = Caso
    template_name = 'gestao/caso_confirm_delete.html'
    
    def get_success_url(self):
        messages.success(self.request, f"Caso \"{self.object.titulo}\" deletado com sucesso!")
        if self.object.cliente:
            return reverse_lazy('gestao:cliente_detail', kwargs={'pk': self.object.cliente.pk})
        return reverse_lazy('gestao:caso_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = f"Deletar Caso: {self.object.titulo}"
        return context

# --- Views para Recebimento (manter como no Canvas django_listas_refinadas_parte2_001) ---
class RecebimentoListView(ListView):
    model = Recebimento
    template_name = 'gestao/recebimento_list.html'
    context_object_name = 'recebimentos'
    paginate_by = 15

    def get_queryset(self):
        queryset = Recebimento.objects.select_related('cliente', 'caso')
        self.search_term = self.request.GET.get('q', '').strip()
        self.cliente_id_filter = self.request.GET.get('cliente', '').strip()
        self.caso_id_filter = self.request.GET.get('caso', '').strip()
        self.status_filter = self.request.GET.get('status', '').strip()
        
        order_by_param, direction_param = get_order_params(self.request, 'data_vencimento', 'desc')
        self.order_by_display = order_by_param
        self.direction_display = direction_param

        if self.search_term:
            queryset = queryset.filter(descricao__icontains=self.search_term)
        if self.cliente_id_filter:
            queryset = queryset.filter(cliente_id=self.cliente_id_filter)
        if self.caso_id_filter:
            queryset = queryset.filter(caso_id=self.caso_id_filter)
        if self.status_filter:
            queryset = queryset.filter(status=self.status_filter)

        allowed_order_fields = {
            'descricao': 'descricao', 'cliente': 'cliente__nome_razao_social',
            'caso': 'caso__titulo', 'valor': 'valor',
            'data_vencimento': 'data_vencimento', 'status': 'status'
        }
        if order_by_param in allowed_order_fields:
            order_field = allowed_order_fields[order_by_param]
            if direction_param == 'desc':
                order_field = f'-{order_field}'
            queryset = queryset.order_by(order_field)
        else:
            queryset = queryset.order_by('-data_vencimento')
        return queryset

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = "Recebimentos"
        context['clientes'] = Cliente.objects.all().order_by('nome_razao_social')
        context['casos'] = Caso.objects.select_related('cliente').all().order_by('titulo')
        context['status_choices'] = Recebimento.STATUS_RECEBIMENTO_CHOICES
        context['q'] = self.search_term
        context['cliente_filter'] = self.cliente_id_filter
        context['caso_filter'] = self.caso_id_filter
        context['status_filter'] = self.status_filter
        context['order_by'] = self.order_by_display
        context['direction'] = self.direction_display
        context['base_querystring'] = get_base_querystring_for_ordering(self.request)
        return context

# ... (Manter RecebimentoCreateView, RecebimentoUpdateView, RecebimentoDeleteView) ...
class RecebimentoCreateView(SuccessMessageMixin, CreateView):
    model = Recebimento
    form_class = RecebimentoForm
    template_name = 'gestao/recebimento_form.html'
    success_message = "Recebimento \"%(descricao)s\" adicionado com sucesso!"

    def get_initial(self):
        initial = super().get_initial()
        caso_pk = self.kwargs.get('caso_pk') or self.request.GET.get('caso')
        if caso_pk:
            caso = get_object_or_404(Caso, pk=caso_pk)
            initial['caso'] = caso
            initial['cliente'] = caso.cliente 
        return initial
    
    def get_success_url(self):
        if self.object.caso:
            return reverse_lazy('gestao:caso_detail', kwargs={'pk': self.object.caso.pk})
        return reverse_lazy('gestao:recebimento_list')

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = "Adicionar Recebimento"
        caso_pk = self.kwargs.get('caso_pk') or self.request.GET.get('caso')
        if caso_pk:
            context['caso_associado'] = get_object_or_404(Caso, pk=caso_pk)
        return context

class RecebimentoUpdateView(SuccessMessageMixin, UpdateView):
    model = Recebimento
    form_class = RecebimentoForm
    template_name = 'gestao/recebimento_form.html'
    success_message = "Recebimento \"%(descricao)s\" atualizado com sucesso!"
    
    def get_success_url(self):
        if self.object.caso:
            return reverse_lazy('gestao:caso_detail', kwargs={'pk': self.object.caso.pk})
        return reverse_lazy('gestao:recebimento_list')

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = f"Editar Recebimento: {self.object.descricao}"
        return context

class RecebimentoDeleteView(DeleteView):
    model = Recebimento
    template_name = 'gestao/confirm_delete_base.html' 
    
    def get_success_url(self):
        messages.success(self.request, f"Recebimento \"{self.object.descricao}\" deletado com sucesso!")
        if self.object.caso:
            return reverse_lazy('gestao:caso_detail', kwargs={'pk': self.object.caso.pk})
        return reverse_lazy('gestao:recebimento_list')

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = f"Deletar Recebimento: {self.object.descricao}"
        context['related_object_name'] = self.object.caso.titulo if self.object.caso else "Lista de Recebimentos"
        context['related_object_url'] = self.object.caso.get_absolute_url() if self.object.caso and hasattr(self.object.caso, 'get_absolute_url') else reverse_lazy('gestao:recebimento_list')
        return context

# --- Views para Despesa ---
class DespesaListView(ListView): # ESTA É A VIEW A SER VERIFICADA/CORRIGIDA
    model = Despesa
    template_name = 'gestao/despesa_list.html'
    context_object_name = 'despesas'
    paginate_by = 15

    def get_queryset(self):
        queryset = Despesa.objects.select_related('caso__cliente') # Garante join com cliente através do caso
        self.search_term = self.request.GET.get('q', '').strip()
        self.caso_id_filter = self.request.GET.get('caso', '').strip()
        self.status_filter = self.request.GET.get('status', '').strip()
        order_by_param, direction_param = get_order_params(self.request, 'data_vencimento', 'desc')
        self.order_by_display = order_by_param
        self.direction_display = direction_param

        if self.search_term:
            queryset = queryset.filter(descricao__icontains=self.search_term)
        if self.caso_id_filter:
            queryset = queryset.filter(caso_id=self.caso_id_filter)
        if self.status_filter:
            queryset = queryset.filter(status=self.status_filter)

        allowed_order_fields = {
            'descricao': 'descricao', 'caso': 'caso__titulo', 'valor': 'valor',
            'data_vencimento': 'data_vencimento', 'status': 'status'
        }
        if order_by_param in allowed_order_fields:
            order_field = allowed_order_fields[order_by_param]
            if direction_param == 'desc':
                order_field = f'-{order_field}'
            queryset = queryset.order_by(order_field)
        else:
            queryset = queryset.order_by('-data_vencimento') # Padrão
        return queryset

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = "Despesas"
        context['casos'] = Caso.objects.select_related('cliente').all().order_by('titulo')
        context['status_choices'] = Despesa.STATUS_DESPESA_CHOICES
        context['q'] = self.search_term
        context['caso_filter'] = self.caso_id_filter
        context['status_filter'] = self.status_filter
        context['order_by'] = self.order_by_display
        context['direction'] = self.direction_display
        context['base_querystring'] = get_base_querystring_for_ordering(self.request)
        return context

# ... (Manter DespesaCreateView, DespesaUpdateView, DespesaDeleteView) ...
class DespesaCreateView(SuccessMessageMixin, CreateView):
    model = Despesa
    form_class = DespesaForm
    template_name = 'gestao/despesa_form.html'
    success_message = "Despesa \"%(descricao)s\" adicionada com sucesso!"

    def get_initial(self):
        initial = super().get_initial()
        caso_pk = self.kwargs.get('caso_pk') or self.request.GET.get('caso')
        if caso_pk:
            initial['caso'] = get_object_or_404(Caso, pk=caso_pk)
        return initial

    def get_success_url(self):
        if self.object.caso:
            return reverse_lazy('gestao:caso_detail', kwargs={'pk': self.object.caso.pk})
        return reverse_lazy('gestao:despesa_list')

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = "Adicionar Despesa"
        caso_pk = self.kwargs.get('caso_pk') or self.request.GET.get('caso')
        if caso_pk:
            context['caso_associado'] = get_object_or_404(Caso, pk=caso_pk)
        return context
        
class DespesaUpdateView(SuccessMessageMixin, UpdateView):
    model = Despesa
    form_class = DespesaForm
    template_name = 'gestao/despesa_form.html'
    success_message = "Despesa \"%(descricao)s\" atualizada com sucesso!"
    
    def get_success_url(self):
        if self.object.caso:
            return reverse_lazy('gestao:caso_detail', kwargs={'pk': self.object.caso.pk})
        return reverse_lazy('gestao:despesa_list')

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = f"Editar Despesa: {self.object.descricao}"
        return context

class DespesaDeleteView(DeleteView):
    model = Despesa
    template_name = 'gestao/confirm_delete_base.html'
    
    def get_success_url(self):
        messages.success(self.request, f"Despesa \"{self.object.descricao}\" deletada com sucesso!")
        if self.object.caso:
            return reverse_lazy('gestao:caso_detail', kwargs={'pk': self.object.caso.pk})
        return reverse_lazy('gestao:despesa_list')

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = f"Deletar Despesa: {self.object.descricao}"
        context['related_object_name'] = self.object.caso.titulo if self.object.caso else "Lista de Despesas"
        context['related_object_url'] = self.object.caso.get_absolute_url() if self.object.caso and hasattr(self.object.caso, 'get_absolute_url') else reverse_lazy('gestao:despesa_list')
        return context

# --- Views para EventoAgenda ---
class EventoAgendaListView(ListView): # ESTA É A VIEW A SER VERIFICADA/CORRIGIDA
    model = EventoAgenda
    template_name = 'gestao/eventoagenda_list.html'
    context_object_name = 'eventos'
    paginate_by = 15

    def get_queryset(self):
        queryset = EventoAgenda.objects.select_related('caso__cliente')
        self.search_term = self.request.GET.get('q', '').strip()
        self.caso_id_filter = self.request.GET.get('caso', '').strip()
        self.tipo_evento_filter = self.request.GET.get('tipo_evento', '').strip()
        self.concluido_filter = self.request.GET.get('concluido', '').strip()
        order_by_param, direction_param = get_order_params(self.request, 'data_inicio', 'asc')
        self.order_by_display = order_by_param
        self.direction_display = direction_param

        if self.search_term:
            queryset = queryset.filter(titulo__icontains=self.search_term)
        if self.caso_id_filter:
            queryset = queryset.filter(caso_id=self.caso_id_filter)
        if self.tipo_evento_filter:
            queryset = queryset.filter(tipo_evento=self.tipo_evento_filter)
        if self.concluido_filter:
            if self.concluido_filter == 'true':
                queryset = queryset.filter(concluido=True)
            elif self.concluido_filter == 'false':
                queryset = queryset.filter(concluido=False)

        allowed_order_fields = {
            'titulo': 'titulo', 'tipo_evento': 'tipo_evento', 'caso': 'caso__titulo',
            'data_inicio': 'data_inicio', 'concluido': 'concluido'
        }
        if order_by_param in allowed_order_fields:
            order_field = allowed_order_fields[order_by_param]
            if direction_param == 'desc':
                order_field = f'-{order_field}'
            queryset = queryset.order_by(order_field)
        else:
            queryset = queryset.order_by('data_inicio')
        return queryset

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = "Agenda"
        context['casos'] = Caso.objects.select_related('cliente').all().order_by('titulo')
        context['tipo_evento_choices'] = EventoAgenda.TIPO_EVENTO_CHOICES
        context['q'] = self.search_term
        context['caso_filter'] = self.caso_id_filter
        context['tipo_evento_filter'] = self.tipo_evento_filter
        context['concluido_filter'] = self.concluido_filter
        context['order_by'] = self.order_by_display
        context['direction'] = self.direction_display
        context['base_querystring'] = get_base_querystring_for_ordering(self.request)
        return context

# ... (Manter EventoAgendaCreateView, EventoAgendaUpdateView, EventoAgendaDeleteView) ...
class EventoAgendaCreateView(SuccessMessageMixin, CreateView):
    model = EventoAgenda
    form_class = EventoAgendaForm
    template_name = 'gestao/eventoagenda_form.html'
    success_message = "Evento/Prazo \"%(titulo)s\" adicionado com sucesso!"

    def get_initial(self):
        initial = super().get_initial()
        caso_pk = self.kwargs.get('caso_pk') or self.request.GET.get('caso')
        if caso_pk:
            initial['caso'] = get_object_or_404(Caso, pk=caso_pk)
        return initial

    def get_success_url(self):
        if self.object.caso:
            return reverse_lazy('gestao:caso_detail', kwargs={'pk': self.object.caso.pk})
        return reverse_lazy('gestao:evento_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = "Adicionar Evento/Prazo"
        caso_pk = self.kwargs.get('caso_pk') or self.request.GET.get('caso')
        if caso_pk:
            context['caso_associado'] = get_object_or_404(Caso, pk=caso_pk)
        return context

class EventoAgendaUpdateView(SuccessMessageMixin, UpdateView):
    model = EventoAgenda
    form_class = EventoAgendaForm
    template_name = 'gestao/eventoagenda_form.html'
    success_message = "Evento/Prazo \"%(titulo)s\" atualizado com sucesso!"

    def get_success_url(self):
        if self.object.caso:
            return reverse_lazy('gestao:caso_detail', kwargs={'pk': self.object.caso.pk})
        return reverse_lazy('gestao:evento_list')

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = f"Editar Evento/Prazo: {self.object.titulo}"
        return context

class EventoAgendaDeleteView(DeleteView):
    model = EventoAgenda
    template_name = 'gestao/confirm_delete_base.html'
    
    def get_success_url(self):
        messages.success(self.request, f"Evento/Prazo \"{self.object.titulo}\" deletado com sucesso!")
        if self.object.caso:
            return reverse_lazy('gestao:caso_detail', kwargs={'pk': self.object.caso.pk})
        return reverse_lazy('gestao:evento_list')

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = f"Deletar Evento/Prazo: {self.object.titulo}"
        context['related_object_name'] = self.object.caso.titulo if self.object.caso else "Lista de Eventos"
        context['related_object_url'] = self.object.caso.get_absolute_url() if self.object.caso and hasattr(self.object.caso, 'get_absolute_url') else reverse_lazy('gestao:evento_list')
        return context

# --- Views para Documento ---
class DocumentoListView(ListView): # ESTA É A VIEW A SER VERIFICADA/CORRIGIDA
    model = Documento
    template_name = 'gestao/documento_list.html'
    context_object_name = 'documentos'
    paginate_by = 15

    def get_queryset(self):
        queryset = Documento.objects.select_related('cliente', 'caso')
        self.search_term = self.request.GET.get('q', '').strip()
        self.cliente_id_filter = self.request.GET.get('cliente', '').strip()
        self.caso_id_filter = self.request.GET.get('caso', '').strip()
        order_by_param, direction_param = get_order_params(self.request, 'data_upload', 'desc')
        self.order_by_display = order_by_param
        self.direction_display = direction_param

        if self.search_term:
            queryset = queryset.filter(
                Q(nome_original_arquivo__icontains=self.search_term) |
                Q(descricao__icontains=self.search_term)
            )
        if self.cliente_id_filter:
            queryset = queryset.filter(cliente_id=self.cliente_id_filter)
        if self.caso_id_filter:
            queryset = queryset.filter(caso_id=self.caso_id_filter)

        allowed_order_fields = {
            'nome_original_arquivo': 'nome_original_arquivo', 'descricao': 'descricao',
            'cliente': 'cliente__nome_razao_social', 'caso': 'caso__titulo', 'data_upload': 'data_upload'
        }
        if order_by_param in allowed_order_fields:
            order_field = allowed_order_fields[order_by_param]
            if direction_param == 'desc':
                order_field = f'-{order_field}'
            queryset = queryset.order_by(order_field)
        else:
            queryset = queryset.order_by('-data_upload')
        return queryset

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = "Documentos"
        context['clientes'] = Cliente.objects.all().order_by('nome_razao_social')
        context['casos'] = Caso.objects.select_related('cliente').all().order_by('titulo')
        context['q'] = self.search_term
        context['cliente_filter'] = self.cliente_id_filter
        context['caso_filter'] = self.caso_id_filter
        context['order_by'] = self.order_by_display
        context['direction'] = self.direction_display
        context['base_querystring'] = get_base_querystring_for_ordering(self.request)
        return context

# ... (Manter DocumentoCreateView, DocumentoUpdateView, DocumentoDeleteView, documento_download_view) ...
class DocumentoCreateView(SuccessMessageMixin, CreateView):
    model = Documento
    form_class = DocumentoForm
    template_name = 'gestao/documento_form.html'
    
    def get_initial(self):
        initial = super().get_initial()
        caso_pk = self.kwargs.get('caso_pk')
        cliente_pk = self.kwargs.get('cliente_pk')

        if caso_pk:
            caso = get_object_or_404(Caso, pk=caso_pk)
            initial['caso'] = caso
            initial['cliente'] = caso.cliente 
        elif cliente_pk:
            initial['cliente'] = get_object_or_404(Cliente, pk=cliente_pk)
        return initial

    def form_valid(self, form):
        if form.cleaned_data.get('arquivo'):
            form.instance.nome_original_arquivo = form.cleaned_data['arquivo'].name
        messages.success(self.request, f"Documento \"{form.instance.nome_original_arquivo}\" adicionado com sucesso!")
        return super().form_valid(form)

    def get_success_url(self):
        if self.object.caso:
            return reverse_lazy('gestao:caso_detail', kwargs={'pk': self.object.caso.pk})
        if self.object.cliente:
            return reverse_lazy('gestao:cliente_detail', kwargs={'pk': self.object.cliente.pk})
        return reverse_lazy('gestao:documento_list')
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = "Adicionar Documento"
        caso_pk = self.kwargs.get('caso_pk')
        cliente_pk = self.kwargs.get('cliente_pk')
        if caso_pk:
            context['caso_associado'] = get_object_or_404(Caso, pk=caso_pk)
        elif cliente_pk:
            context['cliente_associado'] = get_object_or_404(Cliente, pk=cliente_pk)
        return context

class DocumentoUpdateView(SuccessMessageMixin, UpdateView):
    model = Documento
    form_class = DocumentoForm 
    template_name = 'gestao/documento_form.html'
    success_message = "Metadados do Documento \"%(nome_original_arquivo)s\" atualizados com sucesso!"
    
    def get_success_url(self):
        if self.object.caso:
            return reverse_lazy('gestao:caso_detail', kwargs={'pk': self.object.caso.pk})
        if self.object.cliente:
            return reverse_lazy('gestao:cliente_detail', kwargs={'pk': self.object.cliente.pk})
        return reverse_lazy('gestao:documento_list')

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = f"Editar Metadados: {self.object.nome_original_arquivo}"
        context['edit_mode'] = True 
        return context

class DocumentoDeleteView(DeleteView):
    model = Documento
    template_name = 'gestao/confirm_delete_base.html'
    
    def get_success_url(self):
        documento = self.get_object()
        if documento.arquivo:
            caminho_arquivo = os.path.join(settings.MEDIA_ROOT, str(documento.arquivo.name))
            if os.path.exists(caminho_arquivo):
                try:
                    os.remove(caminho_arquivo)
                except Exception as e_file:
                    messages.warning(self.request, f"Erro ao deletar arquivo físico {documento.nome_original_arquivo}: {e_file}")
        
        messages.success(self.request, f"Documento \"{documento.nome_original_arquivo}\" deletado com sucesso!")
        if self.object.caso:
            return reverse_lazy('gestao:caso_detail', kwargs={'pk': self.object.caso.pk})
        if self.object.cliente:
            return reverse_lazy('gestao:cliente_detail', kwargs={'pk': self.object.cliente.pk})
        return reverse_lazy('gestao:documento_list')

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = f"Deletar Documento: {self.object.nome_original_arquivo}"
        if self.object.caso:
            context['related_object_name'] = self.object.caso.titulo
            context['related_object_url'] = reverse_lazy('gestao:caso_detail', kwargs={'pk': self.object.caso.pk})
        elif self.object.cliente:
            context['related_object_name'] = self.object.cliente.nome_razao_social
            context['related_object_url'] = reverse_lazy('gestao:cliente_detail', kwargs={'pk': self.object.cliente.pk})
        else:
            context['related_object_name'] = "Lista de Documentos"
            context['related_object_url'] = reverse_lazy('gestao:documento_list')
        return context

def documento_download_view(request, pk):
    documento = get_object_or_404(Documento, pk=pk)
    if not documento.arquivo:
        raise Http404("Arquivo não associado a este documento.")
    
    file_path = os.path.join(settings.MEDIA_ROOT, str(documento.arquivo.name))
    
    safe_path = os.path.abspath(file_path)
    if not safe_path.startswith(os.path.abspath(settings.MEDIA_ROOT)):
        return HttpResponseForbidden("Acesso não permitido.")

    if os.path.exists(safe_path):
        try:
            response = FileResponse(open(safe_path, 'rb'), as_attachment=True, filename=documento.nome_original_arquivo)
            return response
        except Exception as e:
            print(f"Erro ao servir arquivo {safe_path}: {e}")
            raise Http404("Erro ao processar o arquivo para download.")
    else:
        messages.error(request, f"Arquivo físico '{documento.nome_original_arquivo}' não encontrado no servidor.")
        referer_url = request.META.get('HTTP_REFERER')
        redirect_url = reverse_lazy('gestao:documento_list') 
        if referer_url and url_has_allowed_host_and_scheme(referer_url, allowed_hosts=settings.ALLOWED_HOSTS):
            redirect_url = referer_url
        return redirect(redirect_url)

# --- Views para Relatórios ---
class RelatorioContasAReceberView(ListView):
    model = Recebimento
    template_name = 'gestao/relatorio_contas_a_receber.html'
    context_object_name = 'recebimentos'

    def get_queryset(self):
        return Recebimento.objects.filter(status__in=['Pendente', 'Vencido']).select_related('cliente', 'caso').order_by('data_vencimento')

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = "Relatório: Contas a Receber"
        context['total_geral'] = self.get_queryset().aggregate(total=Sum('valor'))['total'] or 0
        return context

class RelatorioContasAPagarView(ListView):
    model = Despesa
    template_name = 'gestao/relatorio_contas_a_pagar.html'
    context_object_name = 'despesas'

    def get_queryset(self):
        return Despesa.objects.filter(status__in=['A Pagar', 'Vencida']).select_related('caso').order_by('data_vencimento')

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = "Relatório: Contas a Pagar"
        context['total_geral'] = self.get_queryset().aggregate(total=Sum('valor'))['total'] or 0
        return context

def relatorio_list_view(request):
    context = {
        'titulo_pagina': "Central de Relatórios"
    }
    return render(request, 'gestao/relatorio_list.html', context)
