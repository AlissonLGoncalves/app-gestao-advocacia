# Arquivo: config/urls.py
from django.contrib import admin
from django.urls import path, include
from django.conf import settings 
from django.conf.urls.static import static 
from gestao import views as gestao_views 

urlpatterns = [
    path('admin/', admin.site.urls),
    # Inclui as URLs da app 'gestao' sob o prefixo 'app/'
    # Ex: /app/clientes/, /app/casos/
    path('app/', include('gestao.urls', namespace='gestao')), 
    # Define a view do dashboard como a página inicial do site (raiz /)
    path('', gestao_views.dashboard_view, name='home_dashboard'), 
]

# Configuração para servir arquivos de media (uploads) em ambiente de desenvolvimento
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    # Adicionar também para arquivos estáticos se você não estiver usando WhiteNoise com runserver_nostatic
    # urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT) 
```python
# Arquivo: gestao/views.py
from django.shortcuts import render, get_object_or_404, redirect, HttpResponse
from django.urls import reverse_lazy, reverse
from django.views.generic import ListView, CreateView, UpdateView, DeleteView, DetailView
from django.contrib.auth.mixins import LoginRequiredMixin # Para proteger views (se for implementar login)
from django.contrib.messages.views import SuccessMessageMixin # Para mensagens de sucesso
from django.contrib import messages # Para adicionar mensagens
from .models import Cliente, Caso, Recebimento, Despesa, EventoAgenda, Documento
from .forms import ClienteForm, CasoForm, RecebimentoForm, DespesaForm, EventoAgendaForm, DocumentoForm
import os
from django.conf import settings
from django.http import FileResponse, Http404, HttpResponseForbidden
from django.utils.http import url_has_allowed_host_and_scheme # Para segurança em redirecionamentos

# View para o Dashboard (exemplo simples)
# @login_required (se for implementar login)
def dashboard_view(request):
    num_clientes = Cliente.objects.count()
    num_casos_ativos = Caso.objects.filter(status='Ativo').count()
    # Buscar próximos 5 eventos/prazos não concluídos
    proximos_eventos = EventoAgenda.objects.filter(concluido=False).order_by('data_inicio')[:5]
    
    # Buscar totais de contas a receber e a pagar
    total_a_receber = Recebimento.objects.filter(status__in=['Pendente', 'Vencido']).aggregate(total=models.Sum('valor'))['total'] or 0
    total_a_pagar = Despesa.objects.filter(status__in=['A Pagar', 'Vencida']).aggregate(total=models.Sum('valor'))['total'] or 0

    context = {
        'num_clientes': num_clientes,
        'num_casos_ativos': num_casos_ativos,
        'proximos_eventos': proximos_eventos,
        'total_a_receber': total_a_receber,
        'total_a_pagar': total_a_pagar,
        'titulo_pagina': 'Dashboard'
    }
    return render(request, 'gestao/dashboard.html', context)

# --- Views para Cliente ---
# Adicionar LoginRequiredMixin se necessário: class ClienteListView(LoginRequiredMixin, ListView):
class ClienteListView(ListView):
    model = Cliente
    template_name = 'gestao/cliente_list.html'
    context_object_name = 'clientes'
    paginate_by = 10 

    def get_queryset(self):
        queryset = super().get_queryset().order_by('nome_razao_social')
        search_term = self.request.GET.get('q')
        tipo_pessoa = self.request.GET.get('tipo_pessoa')

        if search_term:
            queryset = queryset.filter(
                models.Q(nome_razao_social__icontains=search_term) |
                models.Q(cpf_cnpj__icontains=search_term) |
                models.Q(email__icontains=search_term)
            )
        if tipo_pessoa:
            queryset = queryset.filter(tipo_pessoa=tipo_pessoa)
        return queryset

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = "Clientes"
        context['search_term'] = self.request.GET.get('q', '')
        context['tipo_pessoa_filter'] = self.request.GET.get('tipo_pessoa', '')
        return context

class ClienteDetailView(DetailView): 
    model = Cliente
    template_name = 'gestao/cliente_detail.html'
    context_object_name = 'cliente'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = self.object.nome_razao_social
        # Adiciona casos relacionados ao cliente no contexto
        context['casos_do_cliente'] = Caso.objects.filter(cliente=self.object).order_by('-data_atualizacao')
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

    def get_success_url(self): # Redireciona para a página de detalhes do cliente após editar
        return reverse_lazy('gestao:cliente_detail', kwargs={'pk': self.object.pk})

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = f"Editar Cliente: {self.object.nome_razao_social}"
        return context

class ClienteDeleteView(DeleteView): # Removido SuccessMessageMixin para mensagem manual
    model = Cliente
    template_name = 'gestao/cliente_confirm_delete.html'
    success_url = reverse_lazy('gestao:cliente_list')
    
    def post(self, request, *args, **kwargs):
        # Adiciona a mensagem de sucesso antes de deletar
        messages.success(self.request, f"Cliente \"{self.get_object().nome_razao_social}\" deletado com sucesso!")
        return super().post(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = f"Deletar Cliente: {self.object.nome_razao_social}"
        return context

# --- Views para Caso ---
class CasoListView(ListView):
    model = Caso
    template_name = 'gestao/caso_list.html' 
    context_object_name = 'casos'
    paginate_by = 10

    def get_queryset(self):
        queryset = Caso.objects.select_related('cliente').order_by('-data_atualizacao')
        # Adicionar filtros aqui conforme necessidade (ex: por cliente, status)
        cliente_id = self.request.GET.get('cliente')
        status = self.request.GET.get('status')
        if cliente_id:
            queryset = queryset.filter(cliente_id=cliente_id)
        if status:
            queryset = queryset.filter(status=status)
        return queryset

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = "Casos"
        context['clientes'] = Cliente.objects.all().order_by('nome_razao_social') # Para o filtro
        context['status_choices'] = Caso.STATUS_CASO_CHOICES
        return context

class CasoDetailView(DetailView):
    model = Caso
    template_name = 'gestao/caso_detail.html' 
    context_object_name = 'caso'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = self.object.titulo
        # Adicionar listas relacionadas (recebimentos, despesas, eventos, documentos) ao contexto
        context['recebimentos_do_caso'] = Recebimento.objects.filter(caso=self.object).order_by('-data_vencimento')
        context['despesas_do_caso'] = Despesa.objects.filter(caso=self.object).order_by('-data_vencimento')
        context['eventos_do_caso'] = EventoAgenda.objects.filter(caso=self.object).order_by('data_inicio')
        context['documentos_do_caso'] = Documento.objects.filter(caso=self.object).order_by('-data_upload')
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

# --- Views para Recebimento ---
class RecebimentoListView(ListView):
    model = Recebimento
    template_name = 'gestao/recebimento_list.html' 
    context_object_name = 'recebimentos'
    paginate_by = 15
    def get_queryset(self): 
        queryset = Recebimento.objects.select_related('cliente', 'caso').order_by('-data_vencimento')
        # Adicionar filtros aqui
        return queryset
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = "Recebimentos"
        return context

class RecebimentoCreateView(SuccessMessageMixin, CreateView):
    model = Recebimento
    form_class = RecebimentoForm
    template_name = 'gestao/recebimento_form.html' 
    success_message = "Recebimento \"%(descricao)s\" adicionado com sucesso!"
    def get_success_url(self): return reverse_lazy('gestao:recebimento_list')
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = "Adicionar Recebimento"
        return context

class RecebimentoUpdateView(SuccessMessageMixin, UpdateView):
    model = Recebimento
    form_class = RecebimentoForm
    template_name = 'gestao/recebimento_form.html'
    success_message = "Recebimento \"%(descricao)s\" atualizado com sucesso!"
    def get_success_url(self): return reverse_lazy('gestao:recebimento_list')
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = f"Editar Recebimento: {self.object.descricao}"
        return context

class RecebimentoDeleteView(DeleteView):
    model = Recebimento
    template_name = 'gestao/confirm_delete_base.html' 
    success_url = reverse_lazy('gestao:recebimento_list')
    def post(self, request, *args, **kwargs):
        messages.success(self.request, f"Recebimento \"{self.get_object().descricao}\" deletado com sucesso!")
        return super().post(request, *args, **kwargs)
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = f"Deletar Recebimento: {self.object.descricao}"
        return context

# --- Views para Despesa ---
class DespesaListView(ListView):
    model = Despesa
    template_name = 'gestao/despesa_list.html' 
    context_object_name = 'despesas'
    paginate_by = 15
    def get_queryset(self): return Despesa.objects.select_related('caso').order_by('-data_vencimento')
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = "Despesas"
        return context

class DespesaCreateView(SuccessMessageMixin, CreateView):
    model = Despesa
    form_class = DespesaForm
    template_name = 'gestao/despesa_form.html' 
    success_message = "Despesa \"%(descricao)s\" adicionada com sucesso!"
    def get_success_url(self): return reverse_lazy('gestao:despesa_list')
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = "Adicionar Despesa"
        return context
        
class DespesaUpdateView(SuccessMessageMixin, UpdateView):
    model = Despesa
    form_class = DespesaForm
    template_name = 'gestao/despesa_form.html'
    success_message = "Despesa \"%(descricao)s\" atualizada com sucesso!"
    def get_success_url(self): return reverse_lazy('gestao:despesa_list')
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = f"Editar Despesa: {self.object.descricao}"
        return context

class DespesaDeleteView(DeleteView):
    model = Despesa
    template_name = 'gestao/confirm_delete_base.html'
    success_url = reverse_lazy('gestao:despesa_list')
    def post(self, request, *args, **kwargs):
        messages.success(self.request, f"Despesa \"{self.get_object().descricao}\" deletada com sucesso!")
        return super().post(request, *args, **kwargs)
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = f"Deletar Despesa: {self.object.descricao}"
        return context

# --- Views para EventoAgenda ---
class EventoAgendaListView(ListView):
    model = EventoAgenda
    template_name = 'gestao/eventoagenda_list.html' 
    context_object_name = 'eventos'
    paginate_by = 15
    def get_queryset(self): return EventoAgenda.objects.select_related('caso').order_by('data_inicio')
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = "Agenda"
        return context

class EventoAgendaCreateView(SuccessMessageMixin, CreateView):
    model = EventoAgenda
    form_class = EventoAgendaForm
    template_name = 'gestao/eventoagenda_form.html' 
    success_message = "Evento/Prazo \"%(titulo)s\" adicionado com sucesso!"
    def get_success_url(self): return reverse_lazy('gestao:evento_list')
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = "Adicionar Evento/Prazo"
        return context

class EventoAgendaUpdateView(SuccessMessageMixin, UpdateView):
    model = EventoAgenda
    form_class = EventoAgendaForm
    template_name = 'gestao/eventoagenda_form.html'
    success_message = "Evento/Prazo \"%(titulo)s\" atualizado com sucesso!"
    def get_success_url(self): return reverse_lazy('gestao:evento_list')
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = f"Editar Evento/Prazo: {self.object.titulo}"
        return context

class EventoAgendaDeleteView(DeleteView):
    model = EventoAgenda
    template_name = 'gestao/confirm_delete_base.html'
    success_url = reverse_lazy('gestao:evento_list')
    def post(self, request, *args, **kwargs):
        messages.success(self.request, f"Evento/Prazo \"{self.get_object().titulo}\" deletado com sucesso!")
        return super().post(request, *args, **kwargs)
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = f"Deletar Evento/Prazo: {self.object.titulo}"
        return context

# --- Views para Documento ---
class DocumentoListView(ListView):
    model = Documento
    template_name = 'gestao/documento_list.html' 
    context_object_name = 'documentos'
    paginate_by = 15
    def get_queryset(self): return Documento.objects.select_related('cliente', 'caso').order_by('-data_upload')
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = "Documentos"
        return context

class DocumentoCreateView(SuccessMessageMixin, CreateView):
    model = Documento
    form_class = DocumentoForm
    template_name = 'gestao/documento_form.html' 
    success_message = "Documento \"%(nome_original_arquivo)s\" adicionado com sucesso!"
    
    def form_valid(self, form):
        if form.cleaned_data.get('arquivo'):
            form.instance.nome_original_arquivo = form.cleaned_data['arquivo'].name
        return super().form_valid(form)

    def get_success_url(self): return reverse_lazy('gestao:documento_list')
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = "Adicionar Documento"
        return context

class DocumentoUpdateView(SuccessMessageMixin, UpdateView): 
    model = Documento
    form_class = DocumentoForm 
    template_name = 'gestao/documento_form.html'
    success_message = "Metadados do Documento \"%(nome_original_arquivo)s\" atualizados com sucesso!"
    
    def get_form(self, form_class=None): 
        form = super().get_form(form_class)
        if 'arquivo' in form.fields: # Não permite alterar o arquivo na edição de metadados
            del form.fields['arquivo']
        return form

    def get_success_url(self): return reverse_lazy('gestao:documento_list')
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = f"Editar Metadados: {self.object.nome_original_arquivo}"
        return context

class DocumentoDeleteView(DeleteView):
    model = Documento
    template_name = 'gestao/confirm_delete_base.html'
    success_url = reverse_lazy('gestao:documento_list')
    def post(self, request, *args, **kwargs):
        messages.success(self.request, f"Documento \"{self.get_object().nome_original_arquivo}\" deletado com sucesso!")
        return super().post(request, *args, **kwargs)
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = f"Deletar Documento: {self.object.nome_original_arquivo}"
        return context

def documento_download_view(request, pk):
    documento = get_object_or_404(Documento, pk=pk)
    if not documento.arquivo:
        raise Http404("Arquivo não associado a este documento.")
    
    # Segurança: Garante que o caminho do arquivo é seguro e dentro de MEDIA_ROOT
    file_path = os.path.join(settings.MEDIA_ROOT, str(documento.arquivo.name))
    
    # Normaliza e verifica se o caminho é seguro
    safe_path = os.path.abspath(file_path)
    if not safe_path.startswith(os.path.abspath(settings.MEDIA_ROOT)):
        return HttpResponseForbidden("Acesso não permitido.")

    if os.path.exists(safe_path):
        try:
            return FileResponse(open(safe_path, 'rb'), as_attachment=True, filename=documento.nome_original_arquivo)
        except Exception as e:
            print(f"Erro ao servir arquivo {safe_path}: {e}")
            raise Http404("Erro ao processar o arquivo para download.")
    else:
        raise Http404("Arquivo físico não encontrado no servidor.")
