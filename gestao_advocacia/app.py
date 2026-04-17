# ==============================================================================
# ARQUIVO: gestao_advocacia/app.py (COMPLETO)
# Contém a factory function create_app, definições de modelos,
# namespaces da API, rotas e inicialização do APScheduler.
# ==============================================================================
import os
import logging # Para configurar o logging
from flask import Flask, request, jsonify, send_from_directory, Blueprint
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename
from datetime import datetime
from flask_cors import CORS
import re
from flask_restx import Api, Namespace, Resource, fields

# Definições base
from dotenv import load_dotenv
load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads_documentos')
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# Importe suas configurações, o serviço CNJ e a nova task
# Assumindo que config.py, cnj_service.py, tasks.py estão no mesmo diretório (gestao_advocacia)
from config import Config 
from cnj_service import consultar_processo_cnj 
from tasks import job_verificar_processos_cnj 
from extensions import db, jwt, migrate, scheduler, mail
from helpers import (
    get_existing_item,
    get_item_or_404,
    get_list_query,
    get_tenant_id,
    query_for_tenant,
    tenant_scoped,
)
from routes import register_auth_routes
from routes import register_casos_routes
from routes import register_clientes_routes
from functools import wraps
from flask_restx import abort
from flask_jwt_extended import get_jwt

def finance_access_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        claims = get_jwt()
        if claims.get('role', '') == 'assistente':
            abort(403, "Acesso negado: Perfil 'assistente' não tem acesso a dados financeiros.")
        return fn(*args, **kwargs)
    return wrapper

from models import (
    AuditLog,
    Caso,
    Cliente,
    ContratoHonorario,
    Despesa,
    Documento,
    DjenOabMonitoramento,
    DjenVinculoDecisao,
    EventoAgenda,
    MovimentacaoCNJ,
    PublicacaoDJEN,
    Recebimento,
    TarefaPrazo,
    Tenant,
    User,
    log_audit,
)


# Factory Function para criar a aplicação Flask
def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
    app.url_map.strict_slashes = False

    # Configuração de Logging
    if not app.logger.handlers:
        log_level_config = app.config.get('LOG_LEVEL', 'INFO').upper()
        log_level_map = {
            'DEBUG': logging.DEBUG, 'INFO': logging.INFO, 
            'WARNING': logging.WARNING, 'ERROR': logging.ERROR, 'CRITICAL': logging.CRITICAL
        }
        app.logger.setLevel(log_level_map.get(log_level_config, logging.INFO))
        stream_handler = logging.StreamHandler()
        stream_handler.setFormatter(logging.Formatter(
            '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
        ))
        app.logger.addHandler(stream_handler)
    app.logger.info(f"Aplicação Gestão Advocacia (v{app.config.get('APP_VERSION')}) iniciando com LOG_LEVEL={app.config.get('LOG_LEVEL')}")

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    # Restrict CORS to known frontend origins instead of allowing all domains
    allowed_origins = [
        os.environ.get('FRONTEND_URL', 'http://localhost:5173'),
        'http://127.0.0.1:5173',
        'http://localhost:5173',
        'https://app-gestao-advocacia.vercel.app',
        re.compile(r"https://.*\.vercel\.app$"),
    ]
    # Allow additional origins via comma-separated env var
    extra_origins = os.environ.get('CORS_ALLOWED_ORIGINS', '')
    if extra_origins:
        allowed_origins.extend([o.strip() for o in extra_origins.split(',') if o.strip()])
    CORS(app, origins=allowed_origins)

    api_bp = Blueprint('api', __name__, url_prefix='/api')
    # Disable Swagger UI in production to avoid exposing the full API surface
    swagger_doc_path = '/api/docs' if os.environ.get('FLASK_ENV') != 'production' else False
    api = Api(api_bp, version='1.0', title='API Gestão Advocacia',
              description='API para gerenciar informações de um escritório de advocacia.',
              doc=swagger_doc_path, 
              authorizations={
                  'jsonWebToken': {
                      'type': 'apiKey', 'in': 'header', 'name': 'Authorization',
                      'description': "Token JWT no formato 'Bearer <token>'. Ex: \"Bearer ey...\""
                  }
              },
              security='jsonWebToken'
             )

    # --- NAMESPACES DA API ---
    auth_ns = Namespace('auth', description='Operações de Autenticação')
    clientes_ns = Namespace('clientes', description='Operações de Clientes')
    casos_ns = Namespace('casos', description='Operações de Casos Jurídicos')
    eventos_ns = Namespace('eventos', description='Operações de Eventos da Agenda')
    documentos_ns = Namespace('documentos', description='Operações de Documentos')
    despesas_ns = Namespace('despesas', description='Operações de Despesas')
    recebimentos_ns = Namespace('recebimentos', description='Operações de Recebimentos')
    dashboard_ns = Namespace('dashboard', description='Dados agregados para o Dashboard')
    contratos_ns = Namespace('contratos', description='Operações relacionadas aos Contratos de Honorários')
    audit_ns = Namespace('auditoria', description='Trilhas de Auditoria e Logs (LGPD)')
    tarefas_ns = Namespace('tarefas', description='Operações de Prazos e Tarefas')
    djen_ns = Namespace('djen', description='Publicações DJEN — Diário de Justiça Eletrônico Nacional')

    api.add_namespace(auth_ns)
    api.add_namespace(clientes_ns)
    api.add_namespace(casos_ns)
    api.add_namespace(eventos_ns)
    api.add_namespace(documentos_ns)
    api.add_namespace(despesas_ns)
    api.add_namespace(recebimentos_ns)
    api.add_namespace(dashboard_ns)
    api.add_namespace(contratos_ns)
    api.add_namespace(audit_ns)
    api.add_namespace(tarefas_ns)
    api.add_namespace(djen_ns)

    # --- DEFINIÇÃO DOS MODELOS DA API (DTOs - Data Transfer Objects) para Flask-RESTx ---
    user_model_dto = auth_ns.model('UserRegistration', {
        'username': fields.String(required=True, description='Nome de usuário único'),
        'email': fields.String(required=True, description='Email único do usuário', format='email'),
        'password': fields.String(required=True, description='Senha do usuário (mínimo 6 caracteres)', min_length=6),
        'role': fields.String(description='Papel do usuário (admin, advogado, assistente)', default='admin', enum=['admin', 'advogado', 'assistente']),
        'documento_identificacao': fields.String(description='CPF ou CNPJ preenchido no cadastro (SaaS)'),
        'tipo_pessoa': fields.String(description='PF ou PJ'),
        'oab': fields.String(description='Registro OAB (se houver)')
    })
    login_model_dto = auth_ns.model('UserLogin', {
        'username_or_email': fields.String(required=True, description='Nome de usuário ou email para login'),
        'password': fields.String(required=True, description='Senha para login')
    })
    user_output_model_dto = auth_ns.model('UserOutput', {
        'id': fields.Integer(readonly=True, description='ID único do usuário'),
        'username': fields.String(description='Nome de usuário'),
        'email': fields.String(description='Email do usuário'),
        'role': fields.String(description='Papel do usuário no sistema')
    })
    
    audit_log_model_dto = audit_ns.model('AuditLogOutput', {
        'id': fields.Integer(readonly=True),
        'username': fields.String(),
        'acao': fields.String(),
        'tabela_afetada': fields.String(),
        'registro_id': fields.Integer(),
        'detalhes': fields.String(),
        'data_hora': fields.String()
    })
    
    user_invite_dto = auth_ns.model('UserInvite', {
        'email': fields.String(required=True, description='Email do convidado', format='email'),
        'role': fields.String(description='Papel do convidado', default='advogado', enum=['advogado', 'assistente'])
    })
    
    user_register_invite_dto = auth_ns.model('UserRegisterInvite', {
        'invite_token': fields.String(required=True, description='Token Mágico JWT'),
        'username': fields.String(required=True, description='Nome Completo do Convidado'),
        'password': fields.String(required=True, description='Senha para a conta')
    })
    token_model_dto = auth_ns.model('Token', {
        'access_token': fields.String(description='Token de Acesso JWT gerado após login bem-sucedido'),
        'user': fields.Nested(user_output_model_dto, description='Dados do usuário', skip_none=True)
    })

    register_auth_routes(
        app,
        auth_ns,
        user_model_dto,
        user_invite_dto,
        user_register_invite_dto,
        login_model_dto,
        token_model_dto,
        user_output_model_dto,
    )

    cliente_input_model_dto = clientes_ns.model('ClienteInput', {
        'nome_razao_social': fields.String(required=True, description='Nome completo ou Razão Social'),
        'cpf_cnpj': fields.String(required=True, description='CPF ou CNPJ principal'),
        'tipo_pessoa': fields.String(required=True, description='PF ou PJ', enum=['PF', 'PJ']),
        'email': fields.String(description='Email do cliente'),
        'telefone': fields.String(description='Telefone do cliente'),
        'rg': fields.String(description='RG (PF)'),
        'orgao_emissor': fields.String(description='Órgão emissor do RG'),
        'data_nascimento': fields.String(description='Data de nascimento (YYYY-MM-DD)'),
        'estado_civil': fields.String(description='Estado civil'),
        'profissao': fields.String(description='Profissão'),
        'nacionalidade': fields.String(description='Nacionalidade'),
        'nome_fantasia': fields.String(description='Nome Fantasia (PJ)'),
        'nire': fields.String(description='NIRE (PJ)'),
        'inscricao_estadual': fields.String(description='Inscrição Estadual (PJ)'),
        'inscricao_municipal': fields.String(description='Inscrição Municipal (PJ)'),
        'cnpj_secundario': fields.String(description='CNPJ Secundário (PJ)'),
        'descricao_cnpj_secundario': fields.String(description='Descrição do CNPJ Secundário'),
        'cnpj_terciario': fields.String(description='CNPJ Terciário (PJ)'),
        'descricao_cnpj_terciario': fields.String(description='Descrição do CNPJ Terciário'),
        'cep': fields.String(description='CEP'),
        'rua': fields.String(description='Rua/Logradouro'),
        'numero': fields.String(description='Número'),
        'bairro': fields.String(description='Bairro'),
        'cidade': fields.String(description='Cidade'),
        'estado': fields.String(description='Estado (UF)'),
        'pais': fields.String(description='País'),
        'notas_gerais': fields.String(description='Notas gerais sobre o cliente'),
    })
    cliente_model_dto = clientes_ns.model('ClienteOutput', {
        'id': fields.Integer(readonly=True, description='ID único do cliente'),
        'nome_razao_social': fields.String(description='Nome completo ou Razão Social'),
        'cpf_cnpj': fields.String(description='CPF ou CNPJ principal'),
        'tipo_pessoa': fields.String(description='PF ou PJ'),
        'email': fields.String(description='Email do cliente'),
        'telefone': fields.String(description='Telefone do cliente'),
        'rg': fields.String, 'orgao_emissor': fields.String,
        'data_nascimento': fields.String,
        'estado_civil': fields.String, 'profissao': fields.String,
        'nacionalidade': fields.String,
        'nome_fantasia': fields.String, 'nire': fields.String,
        'inscricao_estadual': fields.String, 'inscricao_municipal': fields.String,
        'cnpj_secundario': fields.String, 'descricao_cnpj_secundario': fields.String,
        'cnpj_terciario': fields.String, 'descricao_cnpj_terciario': fields.String,
        'cep': fields.String, 'rua': fields.String, 'numero': fields.String,
        'bairro': fields.String, 'cidade': fields.String,
        'estado': fields.String, 'pais': fields.String,
        'notas_gerais': fields.String,
        'user_id': fields.Integer(description='ID do usuário advogado responsável')
    })

    register_clientes_routes(
        app,
        clientes_ns,
        cliente_input_model_dto,
        cliente_model_dto,
    )

    caso_input_model_dto = casos_ns.model('CasoInput', {
        'titulo': fields.String(required=True, description='Título do caso'),
        'numero_processo': fields.String(description='Número do processo CNJ'),
        'status': fields.String(description='Status (Ativo, Suspenso, Encerrado, Arquivado)'),
        'tipo_acao': fields.String(description='Tipo de ação'),
        'area_direito': fields.String(description='Área do direito'),
        'fase_processual': fields.String(description='Fase processual'),
        'vara_juizo': fields.String(description='Vara/Juízo'),
        'comarca': fields.String(description='Comarca'),
        'instancia': fields.String(description='Instância'),
        'parte_contraria': fields.String(description='Parte contrária'),
        'adv_parte_contraria': fields.String(description='Advogado da parte contrária'),
        'valor_causa': fields.Float(description='Valor da causa em R$'),
        'data_distribuicao': fields.String(description='Data de distribuição (YYYY-MM-DD)'),
        'notas_caso': fields.String(description='Notas sobre o caso'),
        'cliente_id': fields.Integer(required=True, description='ID do cliente associado')
    })
    caso_model_dto = casos_ns.model('CasoOutput', {
        'id': fields.Integer(readonly=True),
        'titulo': fields.String, 'numero_processo': fields.String,
        'status': fields.String,
        'tipo_acao': fields.String, 'area_direito': fields.String,
        'fase_processual': fields.String,
        'vara_juizo': fields.String, 'comarca': fields.String, 'instancia': fields.String,
        'parte_contraria': fields.String, 'adv_parte_contraria': fields.String,
        'valor_causa': fields.String, 'data_distribuicao': fields.String,
        'notas_caso': fields.String,
        'data_criacao': fields.DateTime(dt_format='iso8601'),
        'data_atualizacao': fields.DateTime(dt_format='iso8601'),
        'cliente_id': fields.Integer,
        'cliente': fields.Raw(description='Objeto cliente {id, nome_razao_social}'),
        'user_id': fields.Integer,
        'data_ultima_verificacao_cnj': fields.DateTime(dt_format='iso8601', nullable=True),
        'movimentacoes_cnj_count': fields.Integer
    })

    movimentacao_cnj_output_model_dto = casos_ns.model('MovimentacaoCNJOutput', {
       'id': fields.Integer(readonly=True, description='ID da movimentação no sistema local'),
       'data_movimentacao': fields.DateTime(dt_format='iso8601', description='Data/hora da movimentação conforme consta no processo CNJ'),
       'descricao': fields.String(required=True, description='Descrição da movimentação processual'),
       'dados_integra_cnj': fields.Raw(description="JSON original completo da movimentação como recebido da API do CNJ (pode ser extenso e técnico)"),
       'data_registro_sistema': fields.DateTime(dt_format='iso8601', description='Data/hora em que esta movimentação foi registrada no sistema local')
    })

    register_casos_routes(
        app,
        casos_ns,
        caso_input_model_dto,
        caso_model_dto,
        movimentacao_cnj_output_model_dto,
    )
    
    evento_input_model_dto = eventos_ns.model('EventoInput', {
        'titulo': fields.String(required=True, description='Título do evento da agenda'),
        'data_inicio': fields.DateTime(required=True, description='Data e hora de início (formato ISO 8601)'),
        'data_fim': fields.DateTime(description='Data e hora de término (formato ISO 8601)'),
        'descricao': fields.String(description='Descrição extra'),
        'tipo_evento': fields.String(description='Prazo, Audiência, Reunião, Outros'),
        'prioridade': fields.String(description='Baixa, Normal, Alta, Urgente'),
        'status_evento': fields.String(description='Pendente, Concluído, Cancelado')
    })
    evento_model_dto = eventos_ns.model('EventoOutput', {
        'id': fields.Integer(readonly=True),
        'title': fields.String(attribute='titulo', description='Título do evento (compatível com FullCalendar)'), 
        'start': fields.DateTime(attribute='data_inicio', dt_format='iso8601', description='Início do evento (compatível com FullCalendar)'),
        'end': fields.DateTime(attribute='data_fim', dt_format='iso8601', nullable=True, description='Fim do evento (compatível com FullCalendar)'),
        'description': fields.String(attribute='descricao', nullable=True, description='Descrição do evento'),
        'tipo_evento': fields.String,
        'prioridade': fields.String,
        'status_evento': fields.String,
        'notificacoes_enviadas': fields.Raw(description='Dicionário controlando as notificações já enviadas'),
        'user_id': fields.Integer(description='ID do usuário criador do evento')
    })

    documento_model_dto = documentos_ns.model('DocumentoOutput', {
        'id': fields.Integer(readonly=True),
        'nome_arquivo': fields.String(description='Nome original do arquivo enviado'),
        'data_upload': fields.DateTime(dt_format='iso8601', description='Data do upload do arquivo'),
        'caso_id': fields.Integer(nullable=True, description='ID do caso ao qual o documento está associado (se houver)'),
        'user_id': fields.Integer(description='ID do usuário que fez o upload'),
        'url_download': fields.String(description="URL para baixar o documento (gerada dinamicamente pela API)")
    })

    despesa_input_model_dto = despesas_ns.model('DespesaInput', {
        'descricao': fields.String(required=True, description='Descrição da despesa'),
        'valor': fields.Float(required=True, description='Valor da despesa (ex: 150.75)', min=0.01),
        'data_despesa': fields.Date(required=True, description='Data em que a despesa ocorreu (formato YYYY-MM-DD)'),
        'pago': fields.Boolean(description='Indica se a despesa já foi paga', default=False),
        'caso_id': fields.Integer(description='ID do caso ao qual esta despesa está associada (opcional)')
    })
    despesa_model_dto = despesas_ns.model('DespesaOutput', {
        'id': fields.Integer(readonly=True),
        'descricao': fields.String,
        'valor': fields.String(attribute=lambda x: str(x.valor), description='Valor da despesa formatado como string'), 
        'data_despesa': fields.Date(dt_format='iso8601'),
        'pago': fields.Boolean,
        'caso_id': fields.Integer(nullable=True),
        'user_id': fields.Integer
    })

    recebimento_input_model_dto = recebimentos_ns.model('RecebimentoInput', {
        'descricao': fields.String(required=True, description='Descrição do recebimento/honorário'),
        'valor': fields.Float(required=True, description='Valor do recebimento (ex: 1200.50)', min=0.01),
        'data_recebimento': fields.Date(required=True, description='Data em que o valor foi ou será recebido (YYYY-MM-DD)'),
        'recebido': fields.Boolean(description='Indica se o valor já foi efetivamente recebido', default=False),
        'caso_id': fields.Integer(description='ID do caso ao qual este recebimento está associado (opcional)')
    })
    recebimento_model_dto = recebimentos_ns.model('RecebimentoOutput', {
        'id': fields.Integer(readonly=True),
        'descricao': fields.String,
        'valor': fields.String(attribute=lambda x: str(x.valor), description='Valor do recebimento formatado como string'),
        'data_recebimento': fields.Date(dt_format='iso8601'),
        'recebido': fields.Boolean,
        'caso_id': fields.Integer(nullable=True),
        'user_id': fields.Integer
    })



    contrato_input_model_dto = contratos_ns.model('ContratoInput', {
        'tipo_honorario': fields.String(required=True, description='Fixo, Êxito, Mensal ou Horas', enum=['Fixo', 'Êxito', 'Mensal', 'Horas']),
        'valor_total': fields.Float(description='Valor total ou Mensal (se aplicável)', min=0.0),
        'percentual_exito': fields.Float(description='Percentual de Êxito (%) se aplicável', min=0.0, max=100.0),
        'data_assinatura': fields.Date(description='Data de assinatura do contrato (YYYY-MM-DD)'),
        'status': fields.String(description='Status', default='Ativo', enum=['Ativo', 'Finalizado', 'Cancelado', 'Inadimplente']),
        'notas_condicoes': fields.String(description='Notas/Condições'),
        'caso_id': fields.Integer(required=True, description='ID do caso vinculado'),
        'cliente_id': fields.Integer(required=True, description='ID do cliente')
    })
    contrato_model_dto = contratos_ns.model('ContratoOutput', {
        'id': fields.Integer(readonly=True),
        'tipo_honorario': fields.String,
        'valor_total': fields.String(attribute=lambda x: str(x.valor_total) if x.valor_total else None),
        'percentual_exito': fields.String(attribute=lambda x: str(x.percentual_exito) if x.percentual_exito else None),
        'data_assinatura': fields.Date(dt_format='iso8601'),
        'status': fields.String,
        'notas_condicoes': fields.String,
        'caso_id': fields.Integer,
        'cliente_id': fields.Integer,
        'user_id': fields.Integer
    })

    tarefa_input_model_dto = tarefas_ns.model('TarefaInput', {
        'titulo': fields.String(required=True, description='Título abreviado da tarefa'),
        'descricao': fields.String(description='Detalhes'),
        'status': fields.String(description='Status da tarefa', default='A Fazer', enum=['A Fazer', 'Fazendo', 'Concluído']),
        'prioridade': fields.String(description='Prioridade', default='Normal', enum=['Baixa', 'Normal', 'Alta', 'Urgente']),
        'data_vencimento': fields.DateTime(description='Data fatal/vencimento (ISO 8601)'),
        'tipo_tarefa': fields.String(description='Tipo (Prazo, Reunião, etc)'),
        'origem_id': fields.String(description='ID na integração (MNI, etc)'),
        'caso_id': fields.Integer(description='ID do Caso associado (opcional mas recomendado)')
    })

    tarefa_model_dto = tarefas_ns.model('TarefaOutput', {
        'id': fields.Integer(readonly=True),
        'titulo': fields.String,
        'descricao': fields.String,
        'status': fields.String,
        'prioridade': fields.String,
        'data_vencimento': fields.DateTime(dt_format='iso8601'),
        'tipo_tarefa': fields.String,
        'origem_id': fields.String,
        'data_criacao': fields.DateTime(dt_format='iso8601'),
        'user_id': fields.Integer,
        'caso_id': fields.Integer
    })

    # --- ENDPOINT DO DASHBOARD ---
    @dashboard_ns.route('/stats')
    class DashboardStatsAPI(Resource):
        @jwt_required()
        @dashboard_ns.doc(security='jsonWebToken', description="Retorna estatísticas consolidadas para o Dashboard.")
        def get(self):
            user_id = get_jwt_identity()

            # Total de clientes
            total_clientes = Cliente.query.filter_by(user_id=user_id).count()

            # Casos ativos (status diferente de 'Concluído', 'Arquivado', 'Encerrado')
            status_inativos = ['Concluído', 'Arquivado', 'Encerrado']
            casos_ativos = Caso.query.filter(
                Caso.user_id == user_id,
                ~Caso.status.in_(status_inativos)
            ).count()

            # Recebimentos pendentes (não recebidos)
            recebimentos_pendentes = Recebimento.query.filter_by(user_id=user_id, recebido=False).all()
            recebimentos_pendentes_qtd = len(recebimentos_pendentes)
            recebimentos_pendentes_valor = sum(float(r.valor) for r in recebimentos_pendentes)

            # Despesas a pagar (não pagas)
            despesas_a_pagar = Despesa.query.filter_by(user_id=user_id, pago=False).all()
            despesas_a_pagar_qtd = len(despesas_a_pagar)
            despesas_a_pagar_valor = sum(float(d.valor) for d in despesas_a_pagar)

            # Próximos eventos (futuros, ordenados por data, limite de 5)
            agora = datetime.utcnow()
            proximos_eventos = EventoAgenda.query.filter(
                EventoAgenda.user_id == user_id,
                EventoAgenda.data_inicio >= agora
            ).order_by(EventoAgenda.data_inicio.asc()).limit(5).all()

            eventos_lista = []
            for ev in proximos_eventos:
                eventos_lista.append({
                    'id': ev.id,
                    'titulo': ev.titulo,
                    'data_inicio': ev.data_inicio.isoformat() if ev.data_inicio else None,
                    'data_fim': ev.data_fim.isoformat() if ev.data_fim else None,
                    'descricao': ev.descricao
                })

            # Alertas DJEN relevantes para o dashboard operacional.
            # Usa try/except para não quebrar o dashboard caso a migração
            # ainda não tenha sido aplicada no ambiente de produção.
            try:
                djen_nao_lidas = PublicacaoDJEN.query.filter_by(
                    tenant_id=user.tenant_id,
                    lida=False,
                    triagem_ignorada=False,
                ).count()
                djen_sem_vinculo = PublicacaoDJEN.query.filter_by(
                    tenant_id=user.tenant_id,
                    triagem_ignorada=False,
                ).filter(PublicacaoDJEN.caso_id.is_(None)).count()
            except Exception:
                db.session.rollback()
                djen_nao_lidas = 0
                djen_sem_vinculo = 0

            return {
                'total_clientes': total_clientes,
                'casos_ativos': casos_ativos,
                'recebimentos_pendentes': {
                    'quantidade': recebimentos_pendentes_qtd,
                    'valor_total': round(recebimentos_pendentes_valor, 2)
                },
                'despesas_a_pagar': {
                    'quantidade': despesas_a_pagar_qtd,
                    'valor_total': round(despesas_a_pagar_valor, 2)
                },
                'proximos_eventos': eventos_lista,
                'alertas_djen': {
                    'nao_lidas': djen_nao_lidas,
                    'pendentes_triagem': djen_sem_vinculo,
                },
            }, 200

    @eventos_ns.route('/')
    class EventoListAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @eventos_ns.marshal_list_with(evento_model_dto)
        @eventos_ns.doc(security='jsonWebToken')
        def get(self):
            user_id = get_jwt_identity()
            eventos = get_list_query(EventoAgenda).order_by(EventoAgenda.data_inicio.asc()).all()
            return eventos

        @jwt_required()
        @tenant_scoped
        @eventos_ns.expect(evento_input_model_dto)
        @eventos_ns.marshal_with(evento_model_dto, code=201)
        @eventos_ns.doc(security='jsonWebToken')
        def post(self):
            user_id = get_jwt_identity()
            data = request.get_json()
            if not data.get('titulo') or not data.get('data_inicio'):
                return {"message": "Título e data de início são obrigatórios para o evento."}, 400
            try:
                data_inicio_obj = datetime.fromisoformat(data['data_inicio'])
                data_fim_obj = datetime.fromisoformat(data['data_fim']) if data.get('data_fim') else None
            except ValueError:
                return {"message": "Formato de data inválido. Utilize o formato ISO 8601 (ex: YYYY-MM-DDTHH:MM:SS)."}, 400
            novo_evento = EventoAgenda(
                titulo=data['titulo'], data_inicio=data_inicio_obj, data_fim=data_fim_obj, 
                descricao=data.get('descricao'), 
                tipo_evento=data.get('tipo_evento', 'Outros'),
                prioridade=data.get('prioridade', 'Normal'),
                status_evento=data.get('status_evento', 'Pendente'),
                user_id=user_id,
                tenant_id=get_tenant_id()
            )
            db.session.add(novo_evento)
            db.session.commit()
            app.logger.info(f"Novo evento '{novo_evento.titulo}' (ID: {novo_evento.id}) criado para usuário ID {user_id}.")
            return novo_evento, 201

    @eventos_ns.route('/<int:evento_id_param>')
    @eventos_ns.response(404, 'Evento não encontrado ou não pertence ao usuário.')
    @eventos_ns.param('evento_id_param', 'O ID único do evento da agenda')
    class EventoDetailAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @eventos_ns.marshal_with(evento_model_dto)
        @eventos_ns.doc(security='jsonWebToken')
        def get(self, evento_id_param):
            user_id = get_jwt_identity()
            evento = get_item_or_404(EventoAgenda, evento_id_param)
            return evento

        @jwt_required()
        @tenant_scoped
        @eventos_ns.expect(evento_input_model_dto)
        @eventos_ns.marshal_with(evento_model_dto)
        @eventos_ns.doc(security='jsonWebToken')
        def put(self, evento_id_param):
            user_id = get_jwt_identity()
            evento = get_item_or_404(EventoAgenda, evento_id_param)
            data = request.get_json()
            if not data.get('titulo') or not data.get('data_inicio'):
                 return {"message": "Título e data de início são obrigatórios para atualização do evento."}, 400
            try:
                data_inicio_obj = datetime.fromisoformat(data['data_inicio'])
                data_fim_obj = datetime.fromisoformat(data['data_fim']) if data.get('data_fim') else None
            except ValueError:
                return {"message": "Formato de data inválido. Utilize ISO 8601."}, 400
            evento.titulo = data['titulo']
            evento.data_inicio = data_inicio_obj
            evento.data_fim = data_fim_obj
            evento.descricao = data.get('descricao', evento.descricao)
            evento.tipo_evento = data.get('tipo_evento', evento.tipo_evento)
            evento.prioridade = data.get('prioridade', evento.prioridade)
            evento.status_evento = data.get('status_evento', evento.status_evento)
            db.session.commit()
            app.logger.info(f"Evento ID {evento.id} atualizado pelo usuário ID {user_id}.")
            return evento

        @jwt_required()
        @tenant_scoped
        @eventos_ns.response(204, 'Evento deletado com sucesso.')
        @eventos_ns.doc(security='jsonWebToken')
        def delete(self, evento_id_param):
            user_id = get_jwt_identity()
            evento = get_item_or_404(EventoAgenda, evento_id_param)
            db.session.delete(evento)
            db.session.commit()
            app.logger.info(f"Evento ID {evento.id} ('{evento.titulo}') deletado pelo usuário ID {user_id}.")
            return '', 204
    
    ALLOWED_EXTENSIONS_UPLOAD = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp'}
    def is_allowed_file_upload(filename):
        return '.' in filename and \
            filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS_UPLOAD
            
    @documentos_ns.route('/')
    class DocumentoListAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @documentos_ns.marshal_list_with(documento_model_dto)
        @documentos_ns.doc(security='jsonWebToken', description="Lista documentos do usuário, com filtro opcional por 'caso_id'.")
        @documentos_ns.param('caso_id', 'ID do caso para filtrar os documentos (opcional)', type=int)
        def get(self):
            user_id = get_jwt_identity()
            caso_id_query_param = request.args.get('caso_id', type=int)
            query = query_for_tenant(Documento)
            if caso_id_query_param is not None:
                query = query.filter_by(caso_id=caso_id_query_param)
            documentos = query.order_by(Documento.data_upload.desc()).all()
            return documentos

    @documentos_ns.route('/upload')
    class DocumentoUploadAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @documentos_ns.doc(security='jsonWebToken', description="Faz upload de um novo documento. Use 'multipart/form-data'. Campo 'file' para o arquivo e opcionalmente 'caso_id' no formulário.")
        @documentos_ns.response(201, "Documento enviado com sucesso.", model=documento_model_dto)
        @documentos_ns.response(400, "Erro nos dados de entrada ou tipo de arquivo não permitido.")
        def post(self):
            user_id = get_jwt_identity()
            if 'file' not in request.files:
                return {'message': 'Nenhum arquivo foi incluído na requisição (campo "file" ausente).'}, 400
            file_storage = request.files['file']
            if file_storage.filename == '':
                return {'message': 'Nenhum arquivo foi selecionado para upload.'}, 400
            if file_storage and is_allowed_file_upload(file_storage.filename):
                original_filename = secure_filename(file_storage.filename)
                user_upload_folder_path = os.path.join(app.config['UPLOAD_FOLDER'], str(user_id))
                os.makedirs(user_upload_folder_path, exist_ok=True)
                file_base, file_ext = os.path.splitext(original_filename)
                counter = 1
                final_filename_to_save = original_filename
                full_file_path_to_save = os.path.join(user_upload_folder_path, final_filename_to_save)
                while os.path.exists(full_file_path_to_save):
                    final_filename_to_save = f"{file_base}_{counter}{file_ext}"
                    full_file_path_to_save = os.path.join(user_upload_folder_path, final_filename_to_save)
                    counter += 1
                file_storage.save(full_file_path_to_save)
                caso_id_from_form = request.form.get('caso_id')
                db_caso_id = None
                if caso_id_from_form:
                    try:
                        db_caso_id = int(caso_id_from_form)
                        if not query_for_tenant(Caso).filter_by(id=db_caso_id).first():
                            os.remove(full_file_path_to_save)
                            return {'message': f'Caso com ID {db_caso_id} não encontrado ou não pertence ao usuário.'}, 400
                    except ValueError:
                        os.remove(full_file_path_to_save)
                        return {'message': 'O valor fornecido para "caso_id" é inválido.'}, 400
                novo_documento_db = Documento(
                    nome_arquivo=final_filename_to_save, path_arquivo=full_file_path_to_save, 
                    user_id=user_id, caso_id=db_caso_id, tenant_id=get_tenant_id()
                )
                db.session.add(novo_documento_db)
                db.session.commit()
                app.logger.info(f"Documento '{novo_documento_db.nome_arquivo}' (ID: {novo_documento_db.id}) salvo para usuário ID {user_id}.")
                doc_dict = novo_documento_db.to_dict()
                return doc_dict, 201
            return {'message': 'Tipo de arquivo não permitido. Extensões permitidas: ' + ", ".join(ALLOWED_EXTENSIONS_UPLOAD)}, 400

    @documentos_ns.route('/download/<int:doc_id_param>')
    @documentos_ns.param('doc_id_param', 'O ID do documento para realizar o download')
    class DocumentoDownloadAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @documentos_ns.doc(security='jsonWebToken', description="Permite o download de um documento específico.")
        @documentos_ns.response(404, "Documento não encontrado ou acesso negado.")
        @documentos_ns.response(500, "Erro no servidor ao tentar enviar o arquivo.")
        def get(self, doc_id_param):
            user_id = get_jwt_identity()
            documento_db = get_item_or_404(Documento, doc_id_param)
            if not os.path.exists(documento_db.path_arquivo):
                app.logger.error(f"Arquivo para Doc ID {doc_id_param} não encontrado em '{documento_db.path_arquivo}'.")
                return {"message": "Arquivo não encontrado no servidor."}, 500
            try:
                file_directory = os.path.dirname(documento_db.path_arquivo)
                file_name_on_disk = os.path.basename(documento_db.path_arquivo)
                return send_from_directory(file_directory, file_name_on_disk, as_attachment=True, download_name=documento_db.nome_arquivo)
            except Exception as e_download:
                app.logger.error(f"Erro ao enviar arquivo '{documento_db.path_arquivo}' (Doc ID: {doc_id_param}): {str(e_download)}")
                return {"message": "Erro ao processar download."}, 500

    @documentos_ns.route('/<int:doc_id_param>')
    @documentos_ns.response(404, 'Documento não encontrado.')
    @documentos_ns.param('doc_id_param', 'O ID do documento a ser deletado')
    class DocumentoDetailAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @documentos_ns.response(204, 'Documento deletado com sucesso.')
        @documentos_ns.doc(security='jsonWebToken', description="Deleta um documento específico.")
        def delete(self, doc_id_param):
            user_id = get_jwt_identity()
            documento_db = get_item_or_404(Documento, doc_id_param)
            file_path_on_disk = documento_db.path_arquivo
            document_name_log = documento_db.nome_arquivo
            try:
                if os.path.exists(file_path_on_disk): os.remove(file_path_on_disk)
                else: app.logger.warning(f"Arquivo físico '{file_path_on_disk}' para Doc ID {doc_id_param} não encontrado durante exclusão.")
            except Exception as e_delete_file:
                app.logger.error(f"Erro ao deletar arquivo físico '{file_path_on_disk}' para Doc ID {doc_id_param}: {str(e_delete_file)}")
            db.session.delete(documento_db)
            db.session.commit()
            app.logger.info(f"Documento ID {doc_id_param} ('{document_name_log}') deletado pelo usuário ID {user_id}.")
            return '', 204

    @despesas_ns.route('/')
    class DespesaListAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @finance_access_required
        @despesas_ns.marshal_list_with(despesa_model_dto)
        @despesas_ns.doc(security='jsonWebToken')
        def get(self):
            user_id = get_jwt_identity()
            despesas = get_list_query(Despesa).order_by(Despesa.data_despesa.desc()).all()
            return despesas
        @jwt_required()
        @tenant_scoped
        @despesas_ns.expect(despesa_input_model_dto)
        @despesas_ns.marshal_with(despesa_model_dto, code=201)
        @despesas_ns.doc(security='jsonWebToken')
        def post(self):
            user_id = get_jwt_identity()
            data = request.get_json()
            if not all(k in data for k in ('descricao', 'valor', 'data_despesa')): return {"message": "Descrição, valor e data são obrigatórios."}, 400
            try:
                valor_decimal = float(data['valor'])
                if valor_decimal <= 0: return {"message": "Valor da despesa deve ser positivo."}, 400
                data_despesa_obj = datetime.strptime(data['data_despesa'], '%Y-%m-%d').date()
            except ValueError: return {"message": "Formato de valor ou data inválido."}, 400
            caso_id_val = data.get('caso_id')
            if caso_id_val:
                if not query_for_tenant(Caso).filter_by(id=caso_id_val).first():
                    return {"message": f"Caso ID {caso_id_val} não encontrado."}, 404
            nova_despesa = Despesa(descricao=data['descricao'], valor=valor_decimal, data_despesa=data_despesa_obj, pago=data.get('pago', False), caso_id=caso_id_val, user_id=user_id, tenant_id=get_tenant_id())
            db.session.add(nova_despesa)
            db.session.commit()
            app.logger.info(f"Nova despesa ID {nova_despesa.id} criada para usuário ID {user_id}.")
            return nova_despesa, 201

    @despesas_ns.route('/<int:despesa_id_param>')
    @despesas_ns.response(404, 'Despesa não encontrada.')
    @despesas_ns.param('despesa_id_param', 'O ID da despesa')
    class DespesaDetailAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @finance_access_required
        @despesas_ns.marshal_with(despesa_model_dto)
        @despesas_ns.doc(security='jsonWebToken')
        def get(self, despesa_id_param):
            user_id = get_jwt_identity()
            despesa = get_item_or_404(Despesa, despesa_id_param)
            return despesa
        @jwt_required()
        @tenant_scoped
        @despesas_ns.expect(despesa_input_model_dto)
        @despesas_ns.marshal_with(despesa_model_dto)
        @despesas_ns.doc(security='jsonWebToken')
        def put(self, despesa_id_param):
            user_id = get_jwt_identity()
            despesa = get_item_or_404(Despesa, despesa_id_param)
            data = request.get_json()
            if not all(k in data for k in ('descricao', 'valor', 'data_despesa')): return {"message": "Descrição, valor e data são obrigatórios."}, 400
            try:
                valor_decimal = float(data['valor'])
                if valor_decimal <= 0: return {"message": "Valor da despesa deve ser positivo."}, 400
                data_despesa_obj = datetime.strptime(data['data_despesa'], '%Y-%m-%d').date()
            except ValueError: return {"message": "Formato de valor ou data inválido."}, 400
            caso_id_val = data.get('caso_id')
            if 'caso_id' in data:
                if caso_id_val is not None:
                    if not query_for_tenant(Caso).filter_by(id=caso_id_val).first():
                        return {"message": f"Caso ID {caso_id_val} não encontrado."}, 404
                    despesa.caso_id = caso_id_val
                else: despesa.caso_id = None
            despesa.descricao = data['descricao']
            despesa.valor = valor_decimal
            despesa.data_despesa = data_despesa_obj
            despesa.pago = data.get('pago', despesa.pago)
            db.session.commit()
            app.logger.info(f"Despesa ID {despesa.id} atualizada pelo usuário ID {user_id}.")
            return despesa
        @jwt_required()
        @tenant_scoped
        @despesas_ns.response(204, 'Despesa deletada.')
        @despesas_ns.doc(security='jsonWebToken')
        def delete(self, despesa_id_param):
            user_id = get_jwt_identity()
            despesa = get_item_or_404(Despesa, despesa_id_param)
            db.session.delete(despesa)
            db.session.commit()
            app.logger.info(f"Despesa ID {despesa.id} deletada pelo usuário ID {user_id}.")
            return '', 204

    @recebimentos_ns.route('/')
    class RecebimentoListAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @finance_access_required
        @recebimentos_ns.marshal_list_with(recebimento_model_dto)
        @recebimentos_ns.doc(security='jsonWebToken')
        def get(self):
            user_id = get_jwt_identity()
            recebimentos = get_list_query(Recebimento).order_by(Recebimento.data_recebimento.desc()).all()
            return recebimentos
        @jwt_required()
        @tenant_scoped
        @recebimentos_ns.expect(recebimento_input_model_dto)
        @recebimentos_ns.marshal_with(recebimento_model_dto, code=201)
        @recebimentos_ns.doc(security='jsonWebToken')
        def post(self):
            user_id = get_jwt_identity()
            data = request.get_json()
            if not all(k in data for k in ('descricao', 'valor', 'data_recebimento')): return {"message": "Descrição, valor e data são obrigatórios."}, 400
            try:
                valor_decimal = float(data['valor'])
                if valor_decimal <= 0: return {"message": "Valor do recebimento deve ser positivo."}, 400
                data_recebimento_obj = datetime.strptime(data['data_recebimento'], '%Y-%m-%d').date()
            except ValueError: return {"message": "Formato de valor ou data inválido."}, 400
            caso_id_val = data.get('caso_id')
            if caso_id_val:
                if not query_for_tenant(Caso).filter_by(id=caso_id_val).first():
                    return {"message": f"Caso ID {caso_id_val} não encontrado."}, 404
            novo_recebimento = Recebimento(descricao=data['descricao'], valor=valor_decimal, data_recebimento=data_recebimento_obj, 
                                           recebido=data.get('recebido', False), caso_id=caso_id_val, user_id=user_id, tenant_id=get_tenant_id())
            db.session.add(novo_recebimento)
            db.session.commit()
            app.logger.info(f"Novo recebimento ID {novo_recebimento.id} criado para usuário ID {user_id}.")
            return novo_recebimento, 201

    @recebimentos_ns.route('/<int:recebimento_id_param>')
    @recebimentos_ns.response(404, 'Recebimento não encontrado.')
    @recebimentos_ns.param('recebimento_id_param', 'O ID do recebimento')
    class RecebimentoDetailAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @finance_access_required
        @recebimentos_ns.marshal_with(recebimento_model_dto)
        @recebimentos_ns.doc(security='jsonWebToken')
        def get(self, recebimento_id_param):
            user_id = get_jwt_identity()
            recebimento = get_item_or_404(Recebimento, recebimento_id_param)
            return recebimento
        @jwt_required()
        @tenant_scoped
        @recebimentos_ns.expect(recebimento_input_model_dto)
        @recebimentos_ns.marshal_with(recebimento_model_dto)
        @recebimentos_ns.doc(security='jsonWebToken')
        def put(self, recebimento_id_param):
            user_id = get_jwt_identity()
            recebimento = get_item_or_404(Recebimento, recebimento_id_param)
            data = request.get_json()
            if not all(k in data for k in ('descricao', 'valor', 'data_recebimento')): return {"message": "Descrição, valor e data são obrigatórios."}, 400
            try:
                valor_decimal = float(data['valor'])
                if valor_decimal <= 0: return {"message": "Valor do recebimento deve ser positivo."}, 400
                data_recebimento_obj = datetime.strptime(data['data_recebimento'], '%Y-%m-%d').date()
            except ValueError: return {"message": "Formato de valor ou data inválido."}, 400
            caso_id_val = data.get('caso_id')
            if 'caso_id' in data:
                if caso_id_val is not None:
                    if not query_for_tenant(Caso).filter_by(id=caso_id_val).first():
                        return {"message": f"Caso ID {caso_id_val} não encontrado."}, 404
                    recebimento.caso_id = caso_id_val
                else: recebimento.caso_id = None
            recebimento.descricao = data['descricao']
            recebimento.valor = valor_decimal
            recebimento.data_recebimento = data_recebimento_obj
            recebimento.recebido = data.get('recebido', recebimento.recebido)
            db.session.commit()
            app.logger.info(f"Recebimento ID {recebimento.id} atualizado pelo usuário ID {user_id}.")
            return recebimento
        @jwt_required()
        @tenant_scoped
        @recebimentos_ns.response(204, 'Recebimento deletado.')
        @recebimentos_ns.doc(security='jsonWebToken')
        def delete(self, recebimento_id_param):
            user_id = get_jwt_identity()
            recebimento = get_item_or_404(Recebimento, recebimento_id_param)
            db.session.delete(recebimento)
            db.session.commit()
            app.logger.info(f"Recebimento ID {recebimento.id} deletado pelo usuário ID {user_id}.")
            return '', 204

    # --- REGISTRO DAS ROTAS DJEN ---
    try:
        from djen_routes import registrar_rotas_djen
        registrar_rotas_djen(
            djen_ns, db,
            DjenOabMonitoramento, PublicacaoDJEN, Caso,
            jwt_required, get_jwt_identity,
            app.logger
        )
    except Exception as e_djen:
        app.logger.warning(f"Rotas DJEN não carregadas: {e_djen}")

    app.register_blueprint(api_bp)

    # --- INICIALIZAÇÃO DO APSCHEDULER ---
    if app.config.get('CNJ_JOB_ENABLED', False):
        if not app.config.get('TESTING', False): 
            scheduler.init_app(app)
            if not app.debug or os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
                job_id = 'VerificarProcessosCNJJob'
                if not scheduler.get_job(job_id):
                    try:
                        interval_hours = app.config.get('CNJ_JOB_INTERVAL_HOURS', 12)
                        interval_minutes = app.config.get('CNJ_JOB_INTERVAL_MINUTES', 0)
                        scheduler.add_job(
                            id=job_id, func=job_verificar_processos_cnj, trigger='interval', 
                            hours=interval_hours, minutes=interval_minutes, replace_existing=True
                        )
                        app.logger.info(f"Job '{job_id}' agendado: {interval_hours}h{interval_minutes}m.")
                        
                        # --- JOB DE ALERTAS DE PRAZOS ---
                        job_alertas_id = 'VerificarAlertasPrazosJob'
                        if not scheduler.get_job(job_alertas_id):
                            from alertas_tasks import job_verificar_prazos
                            scheduler.add_job(
                                id=job_alertas_id, func=job_verificar_prazos, args=[app], trigger='cron',
                                hour=6, minute=0, replace_existing=True
                            )
                            app.logger.info(f"Job '{job_alertas_id}' agendado para rodar diariamente às 06:00.")

                        # --- JOB DE MONITORAMENTO DJEN ---
                        if app.config.get('DJEN_JOB_ENABLED', False):
                            djen_job_id = 'SincronizarDJENJob'
                            if not scheduler.get_job(djen_job_id):
                                from djen_tasks import job_monitorar_djen
                                djen_hour = app.config.get('DJEN_JOB_HOUR', 4)
                                djen_minute = app.config.get('DJEN_JOB_MINUTE', 0)
                                scheduler.add_job(
                                    id=djen_job_id, func=job_monitorar_djen, args=[app],
                                    trigger='cron', hour=djen_hour, minute=djen_minute,
                                    replace_existing=True
                                )
                                app.logger.info(f"Job '{djen_job_id}' agendado às {djen_hour:02d}:{djen_minute:02d}.")
                    except Exception as e_add_job:
                        app.logger.error(f"Falha ao adicionar job '{job_id}': {str(e_add_job)}")
                if not scheduler.running:
                    try:
                        scheduler.start(paused=False)
                        app.logger.info("APScheduler iniciado com sucesso.")
                    except Exception as e_start_scheduler:
                        app.logger.error(f"Falha ao iniciar APScheduler: {str(e_start_scheduler)}")
                else:
                    app.logger.info("APScheduler já está em execução.")
            else:
                app.logger.info("APScheduler não iniciado (Werkzeug reloader ou debug).")
        else:
            app.logger.info("APScheduler não iniciado (TESTING=True).")
    else:
        app.logger.info("Job CNJ (CNJ_JOB_ENABLED) está DESABILITADO.")
    # --- FIM DA INICIALIZAÇÃO DO APSCHEDULER ---

    static_folder_path = os.path.join(app.root_path, '..', 'gestao_advocacia_vite', 'dist')
    if not os.path.exists(static_folder_path):
        static_folder_path_alt = os.path.join(app.root_path, 'static_frontend')
        if os.path.exists(static_folder_path_alt):
            static_folder_path = static_folder_path_alt
        else:
            app.logger.warning(f"Pasta de build do frontend não encontrada em '{static_folder_path}' nem em '{static_folder_path_alt}'.")
            static_folder_path = None 

    @app.route('/')
    def serve_api_status():
        return jsonify({
            "status": "online",
            "message": "API Patronus (Servidor Backend) operando com sucesso. Utilize o Front-end Vercel para acessar a Interface."
        }), 200
                

    # --- ENDPOINTS DOS CONTRATOS ---
    @contratos_ns.route('/')
    class ContratoListAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @finance_access_required
        @contratos_ns.marshal_list_with(contrato_model_dto)
        @contratos_ns.doc(security='jsonWebToken')
        def get(self):
            contratos = get_list_query(ContratoHonorario).all()
            return contratos

        @jwt_required()
        @tenant_scoped
        @finance_access_required
        @contratos_ns.expect(contrato_input_model_dto)
        @contratos_ns.marshal_with(contrato_model_dto, code=201)
        @contratos_ns.doc(security='jsonWebToken')
        def post(self):
            user_id = get_jwt_identity()
            data = request.get_json()
            
            caso = query_for_tenant(Caso).filter_by(id=data['caso_id']).first()
            if not caso:
                return {"message": "Caso não encontrado."}, 404

            # Validar permissão de Acesso se for advogado
            from flask_jwt_extended import get_jwt
            if get_jwt().get('role') == 'advogado' and caso.user_id != user_id:
                return {"message": "Acesso negado ao caso informado."}, 403

            vt = data.get('valor_total')
            pe = data.get('percentual_exito')
            da = data.get('data_assinatura')
            
            novo_contrato = ContratoHonorario(
                tipo_honorario=data['tipo_honorario'],
                valor_total=float(vt) if vt is not None else None,
                percentual_exito=float(pe) if pe is not None else None,
                status=data.get('status', 'Ativo'),
                notas_condicoes=data.get('notas_condicoes'),
                caso_id=data['caso_id'],
                cliente_id=data['cliente_id'],
                user_id=user_id,
                tenant_id=get_tenant_id()
            )
            
            if da:
                from datetime import datetime
                novo_contrato.data_assinatura = datetime.strptime(da, '%Y-%m-%d').date()

            db.session.add(novo_contrato)
            db.session.commit()
            return novo_contrato, 201

    @contratos_ns.route('/<int:id>')
    class ContratoDetailAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @finance_access_required
        @contratos_ns.marshal_with(contrato_model_dto)
        @contratos_ns.doc(security='jsonWebToken')
        def get(self, id):
            contrato = get_item_or_404(ContratoHonorario, id)
            return contrato

        @jwt_required()
        @tenant_scoped
        @finance_access_required
        @contratos_ns.expect(contrato_input_model_dto)
        @contratos_ns.marshal_with(contrato_model_dto)
        @contratos_ns.doc(security='jsonWebToken')
        def put(self, id):
            contrato = get_item_or_404(ContratoHonorario, id)
            data = request.get_json()
            contrato.tipo_honorario = data.get('tipo_honorario', contrato.tipo_honorario)
            vt = data.get('valor_total')
            contrato.valor_total = float(vt) if vt is not None else None
            pe = data.get('percentual_exito')
            contrato.percentual_exito = float(pe) if pe is not None else None
            da = data.get('data_assinatura')
            if da:
                from datetime import datetime
                contrato.data_assinatura = datetime.strptime(da, '%Y-%m-%d').date()
            contrato.status = data.get('status', contrato.status)
            contrato.notas_condicoes = data.get('notas_condicoes', contrato.notas_condicoes)
            db.session.commit()
            return contrato

        @jwt_required()
        @tenant_scoped
        @finance_access_required
        @contratos_ns.response(204, 'Deletado com sucesso')
        @contratos_ns.doc(security='jsonWebToken')
        def delete(self, id):
            contrato = get_item_or_404(ContratoHonorario, id)
            db.session.delete(contrato)
            db.session.commit()
            return '', 204

    @contratos_ns.route('/<int:id>/gerar-parcelas')
    class ContratoGerarParcelasAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @finance_access_required
        @contratos_ns.doc(security='jsonWebToken')
        def post(self, id):
            from datetime import timedelta
            from dateutil.relativedelta import relativedelta
            
            user_id = get_jwt_identity()
            contrato = get_item_or_404(ContratoHonorario, id)
            data = request.get_json() or {}
            qtd_parcelas = int(data.get('quantidade_parcelas', 1))
            primeiro_vencimento = data.get('primeiro_vencimento')
            
            if qtd_parcelas <= 0:
                return {"message": "Quantidade deve ser maior que zero."}, 400
            
            if not contrato.valor_total:
                return {"message": "O contrato deve ter um valor total para parcelar."}, 400
                
            valor_parcela = round(float(contrato.valor_total) / qtd_parcelas, 2)
            
            from datetime import datetime
            
            if primeiro_vencimento:
                data_base = datetime.strptime(primeiro_vencimento, '%Y-%m-%d').date()
            else:
                from datetime import date
                data_base = date.today()

            novos_recebimentos = []
            for i in range(qtd_parcelas):
                desc = f'Parcela {i+1}/{qtd_parcelas} - Cód. contrato {id}'
                venc = data_base + relativedelta(months=i)
                
                novo_rec = Recebimento(
                    descricao=desc,
                    valor=valor_parcela,
                    data_recebimento=venc,
                    recebido=False,
                    caso_id=contrato.caso_id,
                    user_id=user_id,
                    contrato_id=id
                )
                db.session.add(novo_rec)
                novos_recebimentos.append(novo_rec)
                
            db.session.commit()
            return {"message": f"{qtd_parcelas} parcelas geradas com sucesso!"}, 201

    @audit_ns.route('/')
    class AuditLogListAPI(Resource):
        @jwt_required()
        @audit_ns.marshal_list_with(audit_log_model_dto)
        @audit_ns.doc(security='jsonWebToken', description='Lista o log de auditoria LGPD do Escritório.')
        def get(self):
            tenant_id = get_tenant_id()
            user_id = get_jwt_identity()
            user = db.session.get(User, user_id)
            if not user or user.role != 'admin':
                return []
            
            logs = AuditLog.query.filter_by(tenant_id=tenant_id).order_by(AuditLog.data_hora.desc()).limit(200).all()
            return logs

    # --- ENDPOINTS DE TAREFAS/PRAZOS ---
    @tarefas_ns.route('/')
    class TarefaListAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @tarefas_ns.marshal_list_with(tarefa_model_dto)
        @tarefas_ns.doc(security='jsonWebToken')
        def get(self):
            tarefas = get_list_query(TarefaPrazo).all()
            return tarefas

        @jwt_required()
        @tenant_scoped
        @tarefas_ns.expect(tarefa_input_model_dto)
        @tarefas_ns.marshal_with(tarefa_model_dto, code=201)
        @tarefas_ns.doc(security='jsonWebToken')
        def post(self):
            user_id = get_jwt_identity()
            data = request.get_json()
            
            dv = data.get('data_vencimento')
            from datetime import datetime
            data_vencimento_obj = None
            if dv:
                try:
                    data_vencimento_obj = datetime.fromisoformat(dv.replace('Z', '+00:00'))
                except ValueError:
                    pass

            nova_tarefa = TarefaPrazo(
                titulo=data['titulo'],
                descricao=data.get('descricao'),
                status=data.get('status', 'A Fazer'),
                prioridade=data.get('prioridade', 'Normal'),
                tipo_tarefa=data.get('tipo_tarefa', 'Prazo'),
                data_vencimento=data_vencimento_obj,
                origem_id=data.get('origem_id'),
                caso_id=data.get('caso_id'),
                user_id=user_id,
                tenant_id=get_tenant_id()
            )
            
            db.session.add(nova_tarefa)
            db.session.commit()
            return nova_tarefa, 201

    @tarefas_ns.route('/<int:id>')
    class TarefaDetailAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @tarefas_ns.marshal_with(tarefa_model_dto)
        @tarefas_ns.doc(security='jsonWebToken')
        def get(self, id):
            tarefa = get_item_or_404(TarefaPrazo, id)
            return tarefa

        @jwt_required()
        @tenant_scoped
        @tarefas_ns.expect(tarefa_input_model_dto)
        @tarefas_ns.marshal_with(tarefa_model_dto)
        @tarefas_ns.doc(security='jsonWebToken')
        def put(self, id):
            tarefa = get_item_or_404(TarefaPrazo, id)
            data = request.get_json()
            
            tarefa.titulo = data.get('titulo', tarefa.titulo)
            tarefa.descricao = data.get('descricao', tarefa.descricao)
            tarefa.status = data.get('status', tarefa.status)
            tarefa.prioridade = data.get('prioridade', tarefa.prioridade)
            tarefa.tipo_tarefa = data.get('tipo_tarefa', tarefa.tipo_tarefa)
            if 'caso_id' in data:
                tarefa.caso_id = data.get('caso_id')

            dv = data.get('data_vencimento')
            if dv is not None:
                if dv == "":
                    tarefa.data_vencimento = None
                else:
                    from datetime import datetime
                    try:
                        tarefa.data_vencimento = datetime.fromisoformat(dv.replace('Z', '+00:00'))
                    except ValueError:
                        pass
                        
            db.session.commit()
            return tarefa

        @jwt_required()
        @tenant_scoped
        @tarefas_ns.response(204, 'Deletado com sucesso')
        @tarefas_ns.doc(security='jsonWebToken')
        def delete(self, id):
            tarefa = get_item_or_404(TarefaPrazo, id)
            db.session.delete(tarefa)
            db.session.commit()
            return '', 204

    return app

# No final de gestao_advocacia/app.py
if __name__ == '__main__':
   app = create_app()
   app.run(debug=(os.environ.get('FLASK_ENV') == 'development'),
           # Remova ou altere a linha abaixo se existir e estiver como port=5001
           # port=5000, # Garanta que seja 5000 ou remova para usar o padrão
           use_reloader=(os.environ.get('FLASK_ENV') == 'development' and os.environ.get('WERKZEUG_RUN_MAIN') != 'true'))


