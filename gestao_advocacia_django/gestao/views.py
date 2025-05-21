# gestao/views.py
from django.shortcuts import render, get_object_or_404, redirect
from django.urls import reverse_lazy
from django.views.generic import ListView, CreateView, UpdateView, DeleteView
from .models import Cliente
from .forms import ClienteForm # Criaremos este formulário

class ClienteListView(ListView):
    model = Cliente
    template_name = 'gestao/cliente_list.html' # Template que criaremos
    context_object_name = 'clientes'
    # Adicionar lógica de filtro e ordenação aqui no futuro

class ClienteCreateView(CreateView):
    model = Cliente
    form_class = ClienteForm # Usará um Django Form
    template_name = 'gestao/cliente_form.html'
    success_url = reverse_lazy('gestao:cliente_list') # Redireciona para a lista após sucesso

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = "Adicionar Novo Cliente"
        return context

class ClienteUpdateView(UpdateView):
    model = Cliente
    form_class = ClienteForm
    template_name = 'gestao/cliente_form.html'
    success_url = reverse_lazy('gestao:cliente_list')

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['titulo_pagina'] = "Editar Cliente"
        return context

class ClienteDeleteView(DeleteView):
    model = Cliente
    template_name = 'gestao/cliente_confirm_delete.html' # Template de confirmação
    success_url = reverse_lazy('gestao:cliente_list')

# Renomear as views baseadas em classe para corresponder ao urls.py
cliente_list_view = ClienteListView.as_view()
cliente_create_view = ClienteCreateView.as_view()
cliente_update_view = ClienteUpdateView.as_view()
cliente_delete_view = ClienteDeleteView.as_view()
