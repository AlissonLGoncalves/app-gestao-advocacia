# config/urls.py
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from gestao import views as gestao_views # Importa as views da app 'gestao'

urlpatterns = [
    path('admin/', admin.site.urls),
    # Inclui as URLs da app 'gestao' sob o prefixo 'app/'
    # Ex: /app/clientes/, /app/casos/
    path('app/', include('gestao.urls', namespace='gestao')),
    
    # Define a view do dashboard como a página inicial do site (raiz /)
    # A view 'dashboard_view' deve estar definida em gestao/views.py
    path('', gestao_views.dashboard_view, name='home_dashboard'),
]

# Configuração para servir arquivos de media (uploads) em ambiente de desenvolvimento
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    # Se você também quiser que o Django sirva arquivos estáticos em desenvolvimento 
    # (além do que o runserver já faz por padrão para as apps), você pode adicionar:
    # urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    # No entanto, para arquivos estáticos de apps, o Django já os encontra.
    # E para arquivos estáticos globais (definidos em STATICFILES_DIRS),
    # o runserver também costuma encontrá-los.
    # Esta linha é mais relevante se você estiver usando algo como WhiteNoise
    # com `runserver_nostatic` e ainda quiser que o Django sirva os estáticos.