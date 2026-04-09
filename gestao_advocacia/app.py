# ==============================================================================
# ARQUIVO: gestao_advocacia/app.py (COMPLETO)
# Contém a factory function create_app, definições de modelos,
# namespaces da API, rotas e inicialização do APScheduler.
# ==============================================================================
import os
import logging # Para configurar o logging
from flask import Flask, request, jsonify, send_from_directory, Blueprint
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta
from flask_cors import CORS
from flask_restx import Api, Namespace, Resource, fields
from flask_apscheduler import APScheduler # IMPORT para o Scheduler

# Importe suas configurações, o serviço CNJ e a nova task
# Assumindo que config.py, cnj_service.py, tasks.py estão no mesmo diretório (gestao_advocacia)
from config import Config 
from cnj_service import consultar_processo_cnj 
from tasks import job_verificar_processos_cnj 
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

def get_tenant_id():
    # Helper central para extrair o Tenant logado. Resolve import circular
    from flask_jwt_extended import get_jwt_identity
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)
    if not user:
        abort(401, "Acesso Inválido. Usuário não encontrado no banco.")
    return user.tenant_id

def get_list_query(model):
    tenant_id = get_tenant_id()
    # Se ainda estivermos na transição onde o Tenant do usuario Master é nulo, retorna tudo pra n quebrar
    # Num SaaS 100% maturado, tenant nulo = error.
    if not tenant_id:
        return model.query
    # Se o modelo tem a coluna tenant_id, a query ganha a amarra de isolamento!
    if hasattr(model, 'tenant_id'):
        return model.query.filter_by(tenant_id=tenant_id)
    return model.query

def get_item_or_404(model, item_id):
    tenant_id = get_tenant_id()
    item = model.query.get_or_404(item_id)
    
    # Validação Cruzada (Cross-Tenant Breach Prevention)
    if tenant_id and hasattr(item, 'tenant_id'):
        if item.tenant_id and item.tenant_id != tenant_id:
            abort(403, "Acesso Negado (LGPD): Este registro pertence a outro Escritório (Cross-Tenant Request).")
    return item

def get_existing_item(model, **kwargs):
    tenant_id = get_tenant_id()
    if tenant_id and hasattr(model, 'tenant_id'):
        kwargs['tenant_id'] = tenant_id
    return model.query.filter_by(**kwargs).first()
# Inicialização das extensões
db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
scheduler = APScheduler()

# --- MODELOS SQLAlchemy ---
class Tenant(db.Model):
    __tablename__ = 'tenant'
    id = db.Column(db.Integer, primary_key=True)
    nome_escritorio = db.Column(db.String(250), nullable=False)
    documento = db.Column(db.String(20), nullable=True) # CNPJ ou CPF
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    users = db.relationship('User', backref='tenant', lazy='dynamic')

class User(db.Model):
    __tablename__ = 'user'
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenant.id', name='fk_user_tenant_id'), nullable=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False) 
    email = db.Column(db.String(120), unique=True, nullable=False)
    role = db.Column(db.String(20), nullable=False, default='admin') # admin, advogado, assistente
    
    casos = db.relationship('Caso', backref='responsavel_user', lazy='dynamic', foreign_keys='Caso.user_id')
    clientes = db.relationship('Cliente', backref='advogado_responsavel', lazy='dynamic', foreign_keys='Cliente.user_id')
    eventos_agenda = db.relationship('EventoAgenda', backref='criador_evento', lazy='dynamic', foreign_keys='EventoAgenda.user_id')
    documentos = db.relationship('Documento', backref='uploader_documento', lazy='dynamic', foreign_keys='Documento.user_id')
    despesas = db.relationship('Despesa', backref='registrador_despesa', lazy='dynamic', foreign_keys='Despesa.user_id')
    recebimentos = db.relationship('Recebimento', backref='registrador_recebimento', lazy='dynamic', foreign_keys='Recebimento.user_id')
    contratos = db.relationship('ContratoHonorario', backref='responsavel_contrato', lazy='dynamic', foreign_keys='ContratoHonorario.user_id')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {'id': self.id, 'username': self.username, 'email': self.email, 'role': self.role}

class Cliente(db.Model):
    __tablename__ = 'cliente'
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenant.id', name='fk_cliente_tenant_id'), nullable=True)
    # Dados principais
    nome_razao_social = db.Column(db.String(200), nullable=False)
    cpf_cnpj = db.Column(db.String(20), nullable=False)
    tipo_pessoa = db.Column(db.String(2), nullable=False, default='PF')  # PF ou PJ
    email = db.Column(db.String(120), nullable=True)
    telefone = db.Column(db.String(20), nullable=True)
    # Campos PF
    rg = db.Column(db.String(20), nullable=True)
    orgao_emissor = db.Column(db.String(20), nullable=True)
    data_nascimento = db.Column(db.Date, nullable=True)
    estado_civil = db.Column(db.String(30), nullable=True)
    profissao = db.Column(db.String(100), nullable=True)
    nacionalidade = db.Column(db.String(60), nullable=True, default='Brasileiro(a)')
    # Campos PJ
    nome_fantasia = db.Column(db.String(200), nullable=True)
    nire = db.Column(db.String(30), nullable=True)
    inscricao_estadual = db.Column(db.String(30), nullable=True)
    inscricao_municipal = db.Column(db.String(30), nullable=True)
    cnpj_secundario = db.Column(db.String(20), nullable=True)
    descricao_cnpj_secundario = db.Column(db.String(200), nullable=True)
    cnpj_terciario = db.Column(db.String(20), nullable=True)
    descricao_cnpj_terciario = db.Column(db.String(200), nullable=True)
    # Endereço
    cep = db.Column(db.String(10), nullable=True)
    rua = db.Column(db.String(200), nullable=True)
    numero = db.Column(db.String(20), nullable=True)
    bairro = db.Column(db.String(100), nullable=True)
    cidade = db.Column(db.String(100), nullable=True)
    estado = db.Column(db.String(2), nullable=True)
    pais = db.Column(db.String(60), nullable=True, default='Brasil')
    # Outros
    notas_gerais = db.Column(db.Text, nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id', name='fk_cliente_user_id'), nullable=False)
    
    casos = db.relationship('Caso', backref='cliente_associado', lazy='dynamic', cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id, 'nome_razao_social': self.nome_razao_social,
            'cpf_cnpj': self.cpf_cnpj, 'tipo_pessoa': self.tipo_pessoa,
            'email': self.email, 'telefone': self.telefone,
            'rg': self.rg, 'orgao_emissor': self.orgao_emissor,
            'data_nascimento': self.data_nascimento.isoformat() if self.data_nascimento else None,
            'estado_civil': self.estado_civil, 'profissao': self.profissao,
            'nacionalidade': self.nacionalidade,
            'nome_fantasia': self.nome_fantasia, 'nire': self.nire,
            'inscricao_estadual': self.inscricao_estadual,
            'inscricao_municipal': self.inscricao_municipal,
            'cnpj_secundario': self.cnpj_secundario,
            'descricao_cnpj_secundario': self.descricao_cnpj_secundario,
            'cnpj_terciario': self.cnpj_terciario,
            'descricao_cnpj_terciario': self.descricao_cnpj_terciario,
            'cep': self.cep, 'rua': self.rua, 'numero': self.numero,
            'bairro': self.bairro, 'cidade': self.cidade,
            'estado': self.estado, 'pais': self.pais,
            'notas_gerais': self.notas_gerais, 'user_id': self.user_id
        }

class Caso(db.Model):
    __tablename__ = 'caso'
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenant.id', name='fk_caso_tenant_id'), nullable=True)
    titulo = db.Column(db.String(200), nullable=False)
    numero_processo = db.Column(db.String(30), unique=False, nullable=True, index=True)
    status = db.Column(db.String(50), nullable=True, default='Ativo')
    # Dados processuais
    tipo_acao = db.Column(db.String(100), nullable=True)
    area_direito = db.Column(db.String(80), nullable=True)
    fase_processual = db.Column(db.String(80), nullable=True)
    vara_juizo = db.Column(db.String(100), nullable=True)
    comarca = db.Column(db.String(100), nullable=True)
    instancia = db.Column(db.String(50), nullable=True)
    # Partes
    parte_contraria = db.Column(db.String(200), nullable=True)
    adv_parte_contraria = db.Column(db.String(200), nullable=True)
    # Valores e datas
    valor_causa = db.Column(db.Numeric(14, 2), nullable=True)
    data_distribuicao = db.Column(db.Date, nullable=True)
    notas_caso = db.Column(db.Text, nullable=True)
    # Timestamps e relações
    data_criacao = db.Column(db.DateTime, default=datetime.utcnow)
    data_atualizacao = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    cliente_id = db.Column(db.Integer, db.ForeignKey('cliente.id', name='fk_caso_cliente_id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id', name='fk_caso_user_id'), nullable=False)
    data_ultima_verificacao_cnj = db.Column(db.DateTime, nullable=True)

    movimentacoes_cnj = db.relationship('MovimentacaoCNJ', backref='caso_cnj_associado', lazy='dynamic', cascade="all, delete-orphan")
    documentos_caso = db.relationship('Documento', backref='caso_documento_associado', lazy='dynamic', cascade="all, delete-orphan")
    despesas_caso = db.relationship('Despesa', backref='caso_despesa_associado', lazy='dynamic', cascade="all, delete-orphan")
    recebimentos_caso = db.relationship('Recebimento', backref='caso_recebimento_associado', lazy='dynamic', cascade="all, delete-orphan")
    contratos_caso = db.relationship('ContratoHonorario', backref='caso_contrato_associado', lazy='dynamic', cascade="all, delete-orphan")

    def __repr__(self): return f'<Caso {self.id} - {self.titulo}>'
    def to_dict(self):
        cliente_obj = self.cliente_associado if hasattr(self, 'cliente_associado') else None
        return {
            'id': self.id, 'titulo': self.titulo, 'numero_processo': self.numero_processo,
            'status': self.status, 'tipo_acao': self.tipo_acao,
            'area_direito': self.area_direito, 'fase_processual': self.fase_processual,
            'vara_juizo': self.vara_juizo, 'comarca': self.comarca, 'instancia': self.instancia,
            'parte_contraria': self.parte_contraria, 'adv_parte_contraria': self.adv_parte_contraria,
            'valor_causa': str(self.valor_causa) if self.valor_causa else None,
            'data_distribuicao': self.data_distribuicao.isoformat() if self.data_distribuicao else None,
            'notas_caso': self.notas_caso,
            'data_criacao': self.data_criacao.isoformat() if self.data_criacao else None,
            'data_atualizacao': self.data_atualizacao.isoformat() if self.data_atualizacao else None,
            'cliente_id': self.cliente_id,
            'cliente': {'id': cliente_obj.id, 'nome_razao_social': cliente_obj.nome_razao_social} if cliente_obj else None,
            'user_id': self.user_id,
            'data_ultima_verificacao_cnj': self.data_ultima_verificacao_cnj.isoformat() if self.data_ultima_verificacao_cnj else None,
            'movimentacoes_cnj_count': self.movimentacoes_cnj.count()
        }

class MovimentacaoCNJ(db.Model):
    __tablename__ = 'movimentacao_cnj'
    id = db.Column(db.Integer, primary_key=True)
    caso_id = db.Column(db.Integer, db.ForeignKey('caso.id', name='fk_movimentacao_cnj_caso_id'), nullable=False, index=True)
    data_movimentacao = db.Column(db.DateTime, nullable=False, index=True)
    descricao = db.Column(db.Text, nullable=False)
    dados_integra_cnj = db.Column(db.JSON, nullable=True) 
    data_registro_sistema = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self): return f'<MovimentacaoCNJ id={self.id} caso_id={self.caso_id} data="{self.data_movimentacao.strftime("%Y-%m-%d %H:%M")}">'
    def to_dict(self):
        return {
            'id': self.id, 'caso_id': self.caso_id,
            'data_movimentacao': self.data_movimentacao.isoformat() if self.data_movimentacao else None,
            'descricao': self.descricao, 'dados_integra_cnj': self.dados_integra_cnj,
            'data_registro_sistema': self.data_registro_sistema.isoformat() if self.data_registro_sistema else None
        }

class AuditLog(db.Model):
    __tablename__ = 'audit_log'
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenant.id', name='fk_auditlog_tenant_id'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id', name='fk_auditlog_user_id'), nullable=False)
    acao = db.Column(db.String(50), nullable=False) 
    tabela_afetada = db.Column(db.String(50), nullable=False) 
    registro_id = db.Column(db.Integer, nullable=True) 
    detalhes = db.Column(db.Text, nullable=True) 
    data_hora = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    usuario = db.relationship('User', foreign_keys=[user_id])
    
    def to_dict(self):
        return {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'user_id': self.user_id,
            'username': self.usuario.username if self.usuario else 'Sistema',
            'acao': self.acao,
            'tabela_afetada': self.tabela_afetada,
            'registro_id': self.registro_id,
            'detalhes': self.detalhes,
            'data_hora': self.data_hora.isoformat() if self.data_hora else None
        }

def log_audit(acao, tabela_afetada, registro_id=None, detalhes=""):
    """
    Registra silenciosamente na tabela de auditoria a ação executada por quem está logado.
    ATENÇÃO: Deve ser chamado ANTES do db.session.commit() da transação principal se quiser atrelar na mesma.
    Se não, dê commit.
    """
    try:
        from flask_jwt_extended import get_jwt_identity
        user_id = get_jwt_identity()
        if not user_id: return
        user = db.session.get(User, user_id)
        if not user or not user.tenant_id: return
        
        novo_log = AuditLog(
            tenant_id=user.tenant_id,
            user_id=user.id,
            acao=acao,
            tabela_afetada=tabela_afetada,
            registro_id=registro_id,
            detalhes=detalhes
        )
        db.session.add(novo_log)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Falha ao registrar AuditLog: {str(e)}")

class EventoAgenda(db.Model):
    __tablename__ = 'evento_agenda'
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenant.id', name='fk_evento_tenant_id'), nullable=True)
    titulo = db.Column(db.String(100), nullable=False)
    data_inicio = db.Column(db.DateTime, nullable=False)
    data_fim = db.Column(db.DateTime, nullable=True)
    descricao = db.Column(db.Text, nullable=True)
    
    # NOVAS COLUNAS PARA ALERTAS AUTOMÁTICOS
    tipo_evento = db.Column(db.String(50), nullable=True, default='Outros') # Prazo, Audiência, Reunião, Outros
    prioridade = db.Column(db.String(30), nullable=True, default='Normal') # Baixa, Normal, Alta, Urgente
    status_evento = db.Column(db.String(30), nullable=True, default='Pendente') # Pendente, Concluído, Cancelado
    notificacoes_enviadas = db.Column(db.JSON, nullable=True, default=dict) # Guarda estado {"7d": True, "3d": False}

    user_id = db.Column(db.Integer, db.ForeignKey('user.id', name='fk_evento_user_id'), nullable=False)

    def to_dict(self):
        return {
            'id': self.id, 'title': self.titulo, 'start': self.data_inicio.isoformat(),
            'end': self.data_fim.isoformat() if self.data_fim else None,
            'description': self.descricao, 
            'tipo_evento': self.tipo_evento, 'prioridade': self.prioridade, 
            'status_evento': self.status_evento, 'notificacoes_enviadas': self.notificacoes_enviadas,
            'user_id': self.user_id
        }

class Documento(db.Model):
    __tablename__ = 'documento'
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenant.id', name='fk_documento_tenant_id'), nullable=True)
    nome_arquivo = db.Column(db.String(255), nullable=False)
    path_arquivo = db.Column(db.String(500), nullable=False)
    data_upload = db.Column(db.DateTime, default=datetime.utcnow)
    caso_id = db.Column(db.Integer, db.ForeignKey('caso.id', name='fk_documento_caso_id'), nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id', name='fk_documento_user_id'), nullable=False)

    def to_dict(self):
        return {'id': self.id, 'nome_arquivo': self.nome_arquivo, 
                'data_upload': self.data_upload.isoformat(),
                'caso_id': self.caso_id, 'user_id': self.user_id,
                'url_download': f"/api/documentos/download/{self.id}"
                }

class ContratoHonorario(db.Model):
    __tablename__ = 'contrato_honorario'
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenant.id', name='fk_contrato_tenant_id'), nullable=True)
    tipo_honorario = db.Column(db.String(50), nullable=False) # Fixo, Êxito, Mensal, Horas
    valor_total = db.Column(db.Numeric(14, 2), nullable=True)
    percentual_exito = db.Column(db.Numeric(5, 2), nullable=True)
    data_assinatura = db.Column(db.Date, nullable=True)
    status = db.Column(db.String(30), nullable=True, default='Ativo')
    notas_condicoes = db.Column(db.Text, nullable=True)
    
    caso_id = db.Column(db.Integer, db.ForeignKey('caso.id', name='fk_contrato_caso_id'), nullable=False)
    cliente_id = db.Column(db.Integer, db.ForeignKey('cliente.id', name='fk_contrato_cliente_id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id', name='fk_contrato_user_id'), nullable=False)

    recebimentos_contrato = db.relationship('Recebimento', backref='contrato_recebimento_associado', lazy='dynamic', cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id, 'tipo_honorario': self.tipo_honorario,
            'valor_total': str(self.valor_total) if self.valor_total else None,
            'percentual_exito': str(self.percentual_exito) if self.percentual_exito else None,
            'data_assinatura': self.data_assinatura.isoformat() if self.data_assinatura else None,
            'status': self.status, 'notas_condicoes': self.notas_condicoes,
            'caso_id': self.caso_id, 'cliente_id': self.cliente_id, 'user_id': self.user_id
        }

class Despesa(db.Model):
    __tablename__ = 'despesa'
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenant.id', name='fk_despesa_tenant_id'), nullable=True)
    descricao = db.Column(db.String(200), nullable=False)
    valor = db.Column(db.Numeric(10, 2), nullable=False)
    data_despesa = db.Column(db.Date, nullable=False)
    pago = db.Column(db.Boolean, default=False)
    caso_id = db.Column(db.Integer, db.ForeignKey('caso.id', name='fk_despesa_caso_id'), nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id', name='fk_despesa_user_id'), nullable=False)

    def to_dict(self):
        return {'id': self.id, 'descricao': self.descricao, 'valor': str(self.valor),
                'data_despesa': self.data_despesa.isoformat(), 'pago': self.pago,
                'caso_id': self.caso_id, 'user_id': self.user_id}

class Recebimento(db.Model):
    __tablename__ = 'recebimento'
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenant.id', name='fk_recebimento_tenant_id'), nullable=True)
    descricao = db.Column(db.String(200), nullable=False)
    valor = db.Column(db.Numeric(10, 2), nullable=False)
    data_recebimento = db.Column(db.Date, nullable=False)
    recebido = db.Column(db.Boolean, default=False)
    caso_id = db.Column(db.Integer, db.ForeignKey('caso.id', name='fk_recebimento_caso_id'), nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id', name='fk_recebimento_user_id'), nullable=False)
    contrato_id = db.Column(db.Integer, db.ForeignKey('contrato_honorario.id', name='fk_recebimento_contrato_id'), nullable=True)

    def to_dict(self):
        return {'id': self.id, 'descricao': self.descricao, 'valor': str(self.valor),
                'data_recebimento': self.data_recebimento.isoformat(), 'recebido': self.recebido,
                'caso_id': self.caso_id, 'user_id': self.user_id, 'contrato_id': self.contrato_id}
# --- FIM DOS MODELOS SQLAlchemy ---


# Factory Function para criar a aplicação Flask
def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
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
    CORS(app) 

    api_bp = Blueprint('api', __name__, url_prefix='/api')
    api = Api(api_bp, version='1.0', title='API Gestão Advocacia',
              description='API para gerenciar informações de um escritório de advocacia.',
              doc='/api/docs', 
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
                'proximos_eventos': eventos_lista
            }, 200

    # --- ROTAS DA API (Endpoints) ---
    @auth_ns.route('/register')
    class UserRegister(Resource):
        @auth_ns.expect(user_model_dto)
        @auth_ns.response(201, 'Usuário registrado com sucesso.')
        @auth_ns.response(400, 'Dados de entrada inválidos.')
        @auth_ns.response(409, 'Nome de usuário ou email já existem.')
        def post(self):
            data = request.get_json()
            username = data.get('username')
            email = data.get('email')
            password = data.get('password')
            role = data.get('role', 'admin')
            documento = data.get('documento_identificacao')

            if role not in ['admin', 'advogado', 'assistente']:
                return {"message": "Role deve ser admin, advogado ou assistente."}, 400

            if not username or not email or not password:
                return {"message": "Todos os campos (username, email, password) são obrigatórios."}, 400
            if len(password) < 6:
                return {"message": "A senha deve ter no mínimo 6 caracteres."}, 400
            
            if User.query.filter_by(username=username).first():
                return {"message": "Nome de usuário já cadastrado."}, 409
            if User.query.filter_by(email=email).first():
                return {"message": "Email já cadastrado."}, 409
            
            # Se for 'admin', significa que é uma criação de NOVO Escritório (Tenant)
            novo_tenant = None
            if role == 'admin':
                novo_tenant = Tenant(nome_escritorio=username, documento=documento)
                db.session.add(novo_tenant)
                db.session.flush() # Força injeção do ID pro Tenant para atrelar abaixo
            
            # Cria o Super-User
            new_user = User(
                username=username, 
                email=email, 
                role=role, 
                tenant_id=novo_tenant.id if novo_tenant else None
            )
            new_user.set_password(password)
            db.session.add(new_user)
            db.session.commit()
            
            app.logger.info(f"Novo Tenant/Escritório registrado: {username} (Logado pelo Master admin ID: {new_user.id})")
            return {"message": "Ambiente de Escritório criado com sucesso! Faça login para gerenciar sua assinatura."}, 201

    @auth_ns.route('/invite')
    class UserInvite(Resource):
        @auth_ns.expect(user_invite_dto)
        @jwt_required()
        def post(self):
            user_id = get_jwt_identity()
            user = db.session.get(User, user_id)
            if not user or user.role != 'admin':
                return {"message": "Apenas o Admin do escritório pode convidar novos membros."}, 403
            
            data = request.get_json()
            email_convidado = data.get('email')
            papel = data.get('role', 'advogado')
            if not email_convidado:
                return {"message": "Email do convidado é obrigatório."}, 400
                
            # Gera um token JWT especial pra invite atrelado ao Tenant do Admin
            invite_token = create_access_token(
                identity="invite", 
                additional_claims={
                    'is_invite': True, 
                    'invite_email': email_convidado,
                    'invite_role': papel,
                    'invite_tenant_id': user.tenant_id,
                    'escritorio_nome': user.tenant.nome_escritorio if user.tenant else "Escritório"
                },
                expires_delta=timedelta(days=7) # 7 dias pra expirar
            )
            
            base_url = request.host_url
            if 'localhost' in base_url or '127.0.0.1' in base_url:
                base_url = "http://localhost:5173/" 
            else:
                base_url = os.environ.get('FRONTEND_URL', 'https://app-gestao-advocacia-frontend.vercel.app/')
                
            link = f"{base_url.rstrip('/')}/register?invite_token={invite_token}"
            
            corpo_email = f"""
            <h3>Você foi convidado para o Patronus!</h3>
            <p>O administrador do escritório <strong>{user.tenant.nome_escritorio if user.tenant else 'Jurídico'}</strong> convidou você para se juntar à equipe como <strong>{papel}</strong>.</p>
            <br>
            <p><a href='{link}' style='padding: 10px 20px; background-color: #0f172a; color: white; text-decoration: none; border-radius: 5px;'>Aceitar Convite e Cadastrar</a></p>
            <br>
            <p>Se o botão não funcionar, copie e cole o link: {link}</p>
            """
            
            from mail_service import enviar_alerta_email
            from flask import current_app
            enviar_alerta_email(current_app, email_convidado, f"Convite para o portal Patronus - {user.tenant.nome_escritorio if user.tenant else 'Escritório'}", corpo_email)
            
            return {"message": "Convite disparado com sucesso!", "link_simulado": link}, 200

    @auth_ns.route('/register-invite')
    class RegisterInvite(Resource):
        @auth_ns.expect(user_register_invite_dto)
        def post(self):
            data = request.get_json()
            token = data.get('invite_token')
            username = data.get('username')
            password = data.get('password')
            
            if not token or not username or not password:
                return {"message": "Dados incompletos."}, 400
                
            from flask_jwt_extended import decode_token
            from jwt.exceptions import ExpiredSignatureError, DecodeError
            try:
                decoded = decode_token(token)
                if not decoded.get('is_invite'):
                    return {"message": "Token inválido para convite."}, 400
                    
                invite_email = decoded.get('invite_email')
                invite_role = decoded.get('invite_role')
                invite_tenant_id = decoded.get('invite_tenant_id')
                
                if User.query.filter_by(email=invite_email).first() or User.query.filter_by(username=username).first():
                   return {"message": "Usuário ou email já está em uso no sistema."}, 409
                   
                new_user = User(username=username, email=invite_email, role=invite_role, tenant_id=invite_tenant_id)
                new_user.set_password(password)
                db.session.add(new_user)
                db.session.commit()
                
                app.logger.info(f"Novo usuário entrou via CONVITE: {username} (Logado no Tenant ID: {invite_tenant_id})")
                return {"message": "Registro corporativo finalizado com sucesso! Faça login."}, 201
            except ExpiredSignatureError:
                 return {"message": "Token de convite expirado."}, 400
            except DecodeError:
                 return {"message": "Token de convite inválido ou corrompido."}, 400
            except Exception as e:
                return {"message": f"Falha na validação do link mágico. {str(e)}"}, 400

    @auth_ns.route('/login')
    class UserLogin(Resource):
        @auth_ns.expect(login_model_dto)
        @auth_ns.marshal_with(token_model_dto) 
        @auth_ns.response(401, 'Credenciais inválidas.')
        def post(self):
            data = request.get_json()
            username_or_email = data.get('username_or_email')
            password = data.get('password')
            
            user = User.query.filter((User.username == username_or_email) | (User.email == username_or_email)).first()
            
            if user and user.check_password(password):
                expires = timedelta(days=app.config.get('JWT_ACCESS_TOKEN_EXPIRES_DAYS', 1))
                # Converta user.id para string AQUI e adicione role como claim_adicional:
                access_token = create_access_token(identity=str(user.id), additional_claims={'role': user.role}, expires_delta=expires) 
                app.logger.info(f"Usuário {user.username} (ID: {user.id}) logado com sucesso.")
                return {'access_token': access_token, 'user': user.to_dict()}, 200
            app.logger.warning(f"Tentativa de login falhou para: {username_or_email}")
            return {'message': 'Nome de usuário/email ou senha inválidos.'}, 401

    @auth_ns.route('/me')
    class UserMe(Resource):
        @jwt_required()
        @auth_ns.marshal_with(user_output_model_dto)
        @auth_ns.doc(security='jsonWebToken', description="Retorna os dados do usuário atualmente autenticado.")
        @auth_ns.response(404, "Usuário não encontrado.")
        def get(self):
            current_user_id = get_jwt_identity()
            user = db.session.get(User, current_user_id)
            if not user:
                app.logger.warning(f"Tentativa de acesso /me com user ID {current_user_id} não encontrado no banco.")
                return {"message": "Usuário associado ao token não encontrado."}, 404
            return user, 200

    def _preencher_cliente_from_data(cliente, data):
        """Helper para preencher campos do cliente a partir dos dados recebidos."""
        cliente.nome_razao_social = data.get('nome_razao_social', cliente.nome_razao_social)
        cliente.tipo_pessoa = data.get('tipo_pessoa', cliente.tipo_pessoa)
        cliente.email = data.get('email', cliente.email)
        cliente.telefone = data.get('telefone', cliente.telefone)
        # Campos PF
        cliente.rg = data.get('rg', cliente.rg)
        cliente.orgao_emissor = data.get('orgao_emissor', cliente.orgao_emissor)
        dn = data.get('data_nascimento')
        if dn:
            try:
                cliente.data_nascimento = datetime.strptime(dn, '%Y-%m-%d').date()
            except (ValueError, TypeError):
                pass
        elif dn == '' or dn is None:
            cliente.data_nascimento = None
        cliente.estado_civil = data.get('estado_civil', cliente.estado_civil)
        cliente.profissao = data.get('profissao', cliente.profissao)
        cliente.nacionalidade = data.get('nacionalidade', cliente.nacionalidade)
        # Campos PJ
        cliente.nome_fantasia = data.get('nome_fantasia', cliente.nome_fantasia)
        cliente.nire = data.get('nire', cliente.nire)
        cliente.inscricao_estadual = data.get('inscricao_estadual', cliente.inscricao_estadual)
        cliente.inscricao_municipal = data.get('inscricao_municipal', cliente.inscricao_municipal)
        cliente.cnpj_secundario = data.get('cnpj_secundario', cliente.cnpj_secundario)
        cliente.descricao_cnpj_secundario = data.get('descricao_cnpj_secundario', cliente.descricao_cnpj_secundario)
        cliente.cnpj_terciario = data.get('cnpj_terciario', cliente.cnpj_terciario)
        cliente.descricao_cnpj_terciario = data.get('descricao_cnpj_terciario', cliente.descricao_cnpj_terciario)
        # Endereço
        cliente.cep = data.get('cep', cliente.cep)
        cliente.rua = data.get('rua', cliente.rua)
        cliente.numero = data.get('numero', cliente.numero)
        cliente.bairro = data.get('bairro', cliente.bairro)
        cliente.cidade = data.get('cidade', cliente.cidade)
        cliente.estado = data.get('estado', cliente.estado)
        cliente.pais = data.get('pais', cliente.pais)
        # Outros
        cliente.notas_gerais = data.get('notas_gerais', cliente.notas_gerais)
        return cliente

    from werkzeug.datastructures import FileStorage
    upload_parser = clientes_ns.parser()
    upload_parser.add_argument('documentos', location='files', type=FileStorage, required=True, action='append', help='Arquivos para OCR Biométrico (Até 100MB)')

    @clientes_ns.route('/extrair-dados-doc')
    class ClienteExtrairDadosAPI(Resource):
        @jwt_required()
        @clientes_ns.doc(security='jsonWebToken', description="Processa um Lote de Documentos com OCR nativo para extração de dados.")
        def post(self):
            user_id = get_jwt_identity()
            if 'documentos' not in request.files:
                return {"message": "Nenhum arquivo 'documentos' foi enviado no form-data."}, 400
            
            files = request.files.getlist('documentos')
            if not files or files[0].filename == '':
                return {"message": "Nenhum arquivo selecionado."}, 400
                
            PERMITIDOS = ['.pdf', '.txt', '.docx', '.xlsx', '.xls', '.jpg', '.jpeg', '.png']
            
            try:
                from ocr_service import extract_client_data_from_file
                combined_data = {}
                
                for file in files:
                    extensao = '.' + file.filename.split('.')[-1].lower() if '.' in file.filename else ''
                    if extensao not in PERMITIDOS:
                        continue
                        
                    dados = extract_client_data_from_file(file.stream, file.filename)
                    file.stream.seek(0)
                    
                    if "error" not in dados:
                        for k, v in dados.items():
                            if v and not combined_data.get(k):
                                combined_data[k] = v
                
                if not combined_data:
                    return {"message": "Motor finalizado sem identificar Biometrias visíveis nesta bateria de arquivos."}, 422
                    
                app.logger.info(f"Dados OCR LOTE extraídos com sucesso para usuário {user_id}. CPF Pescado: {combined_data.get('cpf', 'N/A')}")
                return combined_data, 200
            except Exception as e:
                app.logger.error(f"Erro Crítico de OCR: {str(e)}")
                return {"message": f"Erro interno de processamento dos arquivos: {str(e)}"}, 500

    @clientes_ns.route('/')
    class ClienteListAPI(Resource):
        @jwt_required()
        @clientes_ns.marshal_list_with(cliente_model_dto)
        @clientes_ns.doc(security='jsonWebToken', description="Lista todos os clientes do usuário autenticado.")
        def get(self):
            user_id = get_jwt_identity()
            clientes = get_list_query(Cliente).order_by(Cliente.nome_razao_social.asc()).all()
            return clientes

        @jwt_required()
        @clientes_ns.expect(cliente_input_model_dto)
        @clientes_ns.marshal_with(cliente_model_dto, code=201)
        @clientes_ns.doc(security='jsonWebToken', description="Cria um novo cliente para o usuário autenticado.")
        def post(self):
            user_id = get_jwt_identity()
            data = request.get_json()
            if not data.get('nome_razao_social') or not data.get('cpf_cnpj') or not data.get('tipo_pessoa'):
                return {"message": "Nome/Razão Social, CPF/CNPJ e Tipo de Pessoa são obrigatórios."}, 400
            if data['tipo_pessoa'] not in ('PF', 'PJ'):
                return {"message": "Tipo de pessoa deve ser 'PF' ou 'PJ'."}, 400
            # Verificar CPF/CNPJ duplicado para o mesmo usuário
            cpf_cnpj_limpo = data['cpf_cnpj'].strip()
            existente = get_existing_item(Cliente, cpf_cnpj=cpf_cnpj_limpo)
            if existente:
                return {"message": f"Já existe um cliente com o CPF/CNPJ '{cpf_cnpj_limpo}'."}, 409
            novo_cliente = Cliente(cpf_cnpj=cpf_cnpj_limpo, user_id=user_id)
            _preencher_cliente_from_data(novo_cliente, data)
            db.session.add(novo_cliente)
            db.session.flush()
            log_audit('CREATE', 'Cliente', novo_cliente.id, f"Cliente {novo_cliente.cpf_cnpj} cadastrado.")
            db.session.commit()
            app.logger.info(f"Novo cliente '{novo_cliente.nome_razao_social}' (ID: {novo_cliente.id}) criado para usuário ID {user_id}.")
            return novo_cliente, 201

    @clientes_ns.route('/<int:cliente_id_param>')
    @clientes_ns.response(404, 'Cliente não encontrado ou não pertence ao usuário.')
    @clientes_ns.param('cliente_id_param', 'O ID único do cliente')
    class ClienteDetailAPI(Resource):
        @jwt_required()
        @clientes_ns.marshal_with(cliente_model_dto)
        @clientes_ns.doc(security='jsonWebToken', description="Obtém os detalhes de um cliente específico.")
        def get(self, cliente_id_param):
            user_id = get_jwt_identity()
            cliente = get_item_or_404(Cliente, cliente_id_param)
            return cliente

        @jwt_required()
        @clientes_ns.expect(cliente_input_model_dto)
        @clientes_ns.marshal_with(cliente_model_dto)
        @clientes_ns.doc(security='jsonWebToken', description="Atualiza os dados de um cliente existente.")
        def put(self, cliente_id_param):
            user_id = get_jwt_identity()
            cliente = get_item_or_404(Cliente, cliente_id_param)
            data = request.get_json()
            if not data.get('nome_razao_social'):
                return {"message": "Nome/Razão Social é obrigatório."}, 400
            _preencher_cliente_from_data(cliente, data)
            log_audit('UPDATE', 'Cliente', cliente.id, "Atualização de dados cadastrais.")
            db.session.commit()
            app.logger.info(f"Cliente ID {cliente.id} atualizado pelo usuário ID {user_id}.")
            return cliente

        @jwt_required()
        @clientes_ns.response(204, 'Cliente deletado com sucesso.')
        @clientes_ns.response(400, 'Não é possível deletar cliente com casos associados.')
        @clientes_ns.doc(security='jsonWebToken', description="Deleta um cliente, se não houver casos associados.")
        def delete(self, cliente_id_param):
            user_id = get_jwt_identity()
            cliente = get_item_or_404(Cliente, cliente_id_param)
            if cliente.casos.first():
                return {"message": "Não é possível deletar cliente com casos associados. Utilize a funcionalidade Anonimizar."}, 400
            log_audit('DELETE', 'Cliente', cliente.id, f"Exclusão do cliente ({cliente.cpf_cnpj}).")
            db.session.delete(cliente)
            db.session.commit()
            app.logger.info(f"Cliente ID {cliente.id} ('{cliente.nome_razao_social}') deletado pelo usuário ID {user_id}.")
            return '', 204

    @clientes_ns.route('/<int:cliente_id_param>/anonimizar')
    @clientes_ns.response(404, 'Cliente não encontrado.')
    @clientes_ns.param('cliente_id_param', 'O ID único do cliente')
    class ClienteAnonimizarAPI(Resource):
        @jwt_required()
        @clientes_ns.doc(security='jsonWebToken', description="Executa o Direito ao Esquecimento (Art. 18 LGPD). Mascara os dados pessoais e exclui documentos associados.")
        def post(self, cliente_id_param):
            user_id = get_jwt_identity()
            cliente = get_item_or_404(Cliente, cliente_id_param)
            
            # Deletar Documentos Associados a este Cliente (via Casos)
            for caso in cliente.casos:
                for doc in caso.documentos_caso:
                    try:
                        if os.path.exists(doc.path_arquivo):
                            os.remove(doc.path_arquivo)
                    except Exception as e:
                        app.logger.error(f"Erro ao deletar arquivo físico {doc.path_arquivo}: {e}")
                    db.session.delete(doc)
            
            # Mascarar Dados do Cliente
            cliente_original_nome = cliente.nome_razao_social
            cliente.nome_razao_social = "*** ANONIMIZADO ***"
            cliente.cpf_cnpj = "000.000.000-00"
            cliente.email = "anonimizado@local"
            cliente.telefone = "(00) 00000-0000"
            cliente.rg = "***"
            cliente.orgao_emissor = "***"
            cliente.estado_civil = "***"
            cliente.profissao = "***"
            cliente.nacionalidade = "***"
            cliente.nome_fantasia = "*** ANONIMIZADO ***"
            cliente.rua = "***"
            cliente.numero = "***"
            cliente.bairro = "***"
            cliente.cidade = "***"
            cliente.cep = "00000-000"
            cliente.notas_gerais = "Dados originais destruídos a pedido do titular (Direito ao Esquecimento - LGPD)."
            
            log_audit('UPDATE', 'Cliente', cliente.id, f"Tratamento de Exclusão/Anonimização LGPD executado no cliente ({cliente_original_nome}).")
            db.session.commit()
            
            app.logger.info(f"Cliente ID {cliente.id} anonimizado pelo usuário ID {user_id}. Todos os documentos associados foram purgados.")
            return {"message": "Direito ao esquecimento executado. Dados mascarados e documentos apagados."}, 200


    def _preencher_caso_from_data(caso, data):
        """Helper para preencher campos do caso a partir dos dados recebidos."""
        caso.titulo = data.get('titulo', caso.titulo)
        caso.status = data.get('status', caso.status)
        caso.tipo_acao = data.get('tipo_acao', caso.tipo_acao)
        caso.area_direito = data.get('area_direito', caso.area_direito)
        caso.fase_processual = data.get('fase_processual', caso.fase_processual)
        caso.vara_juizo = data.get('vara_juizo', caso.vara_juizo)
        caso.comarca = data.get('comarca', caso.comarca)
        caso.instancia = data.get('instancia', caso.instancia)
        caso.parte_contraria = data.get('parte_contraria', caso.parte_contraria)
        caso.adv_parte_contraria = data.get('adv_parte_contraria', caso.adv_parte_contraria)
        vc = data.get('valor_causa')
        if vc is not None:
            try:
                caso.valor_causa = float(vc) if vc != '' else None
            except (ValueError, TypeError):
                pass
        dd = data.get('data_distribuicao')
        if dd:
            try:
                caso.data_distribuicao = datetime.strptime(dd, '%Y-%m-%d').date()
            except (ValueError, TypeError):
                pass
        elif dd == '' or dd is None:
            caso.data_distribuicao = None
        caso.notas_caso = data.get('notas_caso', caso.notas_caso)
        return caso

    @casos_ns.route('/')
    class CasoListAPI(Resource):
        @jwt_required()
        @casos_ns.marshal_list_with(caso_model_dto)
        @casos_ns.doc(security='jsonWebToken', description="Lista todos os casos jurídicos do usuário.")
        def get(self):
            user_id = get_jwt_identity()
            casos = get_list_query(Caso).order_by(Caso.data_atualizacao.desc()).all()
            return casos

        @jwt_required()
        @casos_ns.expect(caso_input_model_dto)
        @casos_ns.marshal_with(caso_model_dto, code=201)
        @casos_ns.doc(security='jsonWebToken', description="Cria um novo caso jurídico.")
        def post(self):
            user_id = get_jwt_identity()
            data = request.get_json()
            if not data.get('titulo') or data.get('cliente_id') is None:
                return {"message": "Título do caso e ID do cliente são obrigatórios."}, 400
            cliente = Cliente.query.filter_by(id=data['cliente_id'], user_id=user_id).first()
            if not cliente:
                return {"message": f"Cliente com ID {data['cliente_id']} não encontrado."}, 404
            num_proc_strip = data.get('numero_processo', '').strip() or None
            if num_proc_strip and get_existing_item(Caso, numero_processo=num_proc_strip):
                return {"message": f"Já existe um caso com o número de processo '{num_proc_strip}'."}, 409
            novo_caso = Caso(
                titulo=data['titulo'], numero_processo=num_proc_strip,
                status=data.get('status', 'Ativo'),
                cliente_id=data['cliente_id'], user_id=user_id
            )
            _preencher_caso_from_data(novo_caso, data)
            db.session.add(novo_caso)
            db.session.flush()
            log_audit('CREATE', 'Caso', novo_caso.id, f"Caso criado: {novo_caso.numero_processo or novo_caso.titulo}")
            db.session.commit()
            app.logger.info(f"Novo caso '{novo_caso.titulo}' (ID: {novo_caso.id}) criado para usuário ID {user_id}.")
            return novo_caso, 201

    @casos_ns.route('/<int:caso_id_param>')
    @casos_ns.response(404, 'Caso não encontrado.')
    @casos_ns.param('caso_id_param', 'O ID do caso jurídico')
    class CasoDetailAPI(Resource):
        @jwt_required()
        @casos_ns.marshal_with(caso_model_dto)
        @casos_ns.doc(security='jsonWebToken', description="Obtém os detalhes de um caso jurídico.")
        def get(self, caso_id_param):
            user_id = get_jwt_identity()
            caso = get_item_or_404(Caso, caso_id_param)
            return caso

        @jwt_required()
        @casos_ns.expect(caso_input_model_dto)
        @casos_ns.marshal_with(caso_model_dto)
        @casos_ns.doc(security='jsonWebToken', description="Atualiza um caso jurídico existente.")
        def put(self, caso_id_param):
            user_id = get_jwt_identity()
            caso = get_item_or_404(Caso, caso_id_param)
            data = request.get_json()
            if not data.get('titulo'):
                return {"message": "Título do caso é obrigatório."}, 400
            novo_numero_processo = data.get('numero_processo', '').strip() or None
            if novo_numero_processo and novo_numero_processo != caso.numero_processo:
                if Caso.query.filter(Caso.user_id == user_id, Caso.numero_processo == novo_numero_processo, Caso.id != caso_id_param).first():
                    return {"message": f"Outro caso já utiliza o número de processo '{novo_numero_processo}'."}, 409
            caso.numero_processo = novo_numero_processo
            _preencher_caso_from_data(caso, data)
            log_audit('UPDATE', 'Caso', caso.id, f"Alteração no caso ({caso.numero_processo or caso.titulo}).")
            db.session.commit()
            app.logger.info(f"Caso ID {caso.id} atualizado pelo usuário ID {user_id}.")
            return caso

        @jwt_required()
        @casos_ns.response(204, 'Caso deletado com sucesso.')
        @casos_ns.doc(security='jsonWebToken', description="Deleta um caso jurídico.")
        def delete(self, caso_id_param):
            user_id = get_jwt_identity()
            caso = get_item_or_404(Caso, caso_id_param)
            log_audit('DELETE', 'Caso', caso.id, f"Caso deletado: {caso.titulo}.")
            db.session.delete(caso)
            db.session.commit()
            app.logger.info(f"Caso ID {caso.id} ('{caso.titulo}') deletado pelo usuário ID {user_id}.")
            return '', 204

    @casos_ns.route('/<int:caso_id>/atualizar-cnj')
    @casos_ns.param('caso_id', 'O ID do caso para o qual buscar e registrar atualizações do CNJ')
    class CasoAtualizarCNJAPI(Resource):
        @casos_ns.doc('atualizar_caso_via_cnj_endpoint', security='jsonWebToken',
                     description="Consulta a API do CNJ para um caso específico, buscando as últimas movimentações e atualizando o status do caso e registrando novas movimentações no sistema local.")
        @jwt_required()
        def post(self, caso_id): 
            user_id_atual = get_jwt_identity()
            caso_para_atualizar = db.session.get(Caso, caso_id)

            if not caso_para_atualizar:
                app.logger.info(f"API CNJ: Tentativa de atualizar caso inexistente ID {caso_id} por usuário {user_id_atual}")
                return {"message": f"Caso com ID {caso_id} não encontrado."}, 404
            
            if caso_para_atualizar.user_id != user_id_atual:
                app.logger.warning(f"API CNJ: Usuário {user_id_atual} tentou acesso não autorizado ao caso {caso_id} (pertence a user {caso_para_atualizar.user_id}).")
                return {"message": "Acesso não autorizado a este caso."}, 403
                
            if not caso_para_atualizar.numero_processo or not caso_para_atualizar.numero_processo.strip():
                app.logger.info(f"API CNJ: Caso {caso_id} não possui número de processo para consulta.")
                return {"message": "Este caso não possui um número de processo válido para consulta ao CNJ."}, 400

            app.logger.info(f"API CNJ: Iniciando atualização para caso ID {caso_id}, processo '{caso_para_atualizar.numero_processo}'. Solicitado por usuário {user_id_atual}.")
            dados_resposta_cnj, status_http_cnj = consultar_processo_cnj(caso_para_atualizar.numero_processo)

            if status_http_cnj >= 400:
                app.logger.error(f"API CNJ: Falha na consulta ao cnj_service para caso {caso_id}. Status: {status_http_cnj}. Erro: {dados_resposta_cnj.get('erro')}")
                response_status_api = status_http_cnj if status_http_cnj in [400, 401, 403, 404, 429, 500, 502, 503, 504] else 500
                return {
                    "message": "Falha ao consultar o serviço do CNJ.", 
                    "details": dados_resposta_cnj.get("erro", "Detalhes do erro indisponíveis."),
                    "cnj_service_response_details": dados_resposta_cnj.get("detalhes_servico_cnj")
                }, response_status_api

            try:
                hits_cnj_api = dados_resposta_cnj.get("hits", {}).get("hits", [])
                if not hits_cnj_api:
                    app.logger.info(f"API CNJ: Nenhum 'hit' encontrado para '{caso_para_atualizar.numero_processo}' (caso {caso_id}).")
                    caso_para_atualizar.data_ultima_verificacao_cnj = datetime.utcnow()
                    db.session.commit()
                    return {"message": "Nenhum dado de processo encontrado no CNJ para o número fornecido.", "cnj_raw_response": dados_resposta_cnj}, 200

                dados_processo_cnj = hits_cnj_api[0].get('_source', {})
                movimentos_api_cnj = dados_processo_cnj.get('movimentos', []) 
                if not isinstance(movimentos_api_cnj, list): movimentos_api_cnj = []

                if not movimentos_api_cnj:
                    app.logger.info(f"API CNJ: Processo '{caso_para_atualizar.numero_processo}' encontrado, mas sem lista 'movimentos'.")
                    caso_para_atualizar.data_ultima_verificacao_cnj = datetime.utcnow()
                    db.session.commit()
                    return {"message": "Processo encontrado no CNJ, mas sem detalhamento de movimentações."}, 200

                novas_movs_count = 0
                data_mov_recente_lote = None
                desc_mov_recente_lote = "Nenhuma nova movimentação significativa identificada."
                movimentos_api_cnj.sort(key=lambda m: m.get('dataHora', '1900-01-01T00:00:00Z'), reverse=True)

                for movimento_json in movimentos_api_cnj:
                    data_mov_str_api = movimento_json.get('dataHora') 
                    if not data_mov_str_api: continue
                    try: data_mov_obj_utc = datetime.fromisoformat(data_mov_str_api.replace('Z', '+00:00'))
                    except ValueError: 
                        app.logger.warning(f"API CNJ: Formato de 'dataHora' ('{data_mov_str_api}') inválido para caso {caso_id}. Ignorando.")
                        continue
                    
                    desc_parts = []
                    mov_nacional = movimento_json.get('movimentoNacional')
                    if mov_nacional and isinstance(mov_nacional, dict) and mov_nacional.get('descricao'):
                        desc_parts.append(mov_nacional['descricao'])
                    
                    mov_local = movimento_json.get('movimentoLocal')
                    if not desc_parts and mov_local and isinstance(mov_local, dict) and mov_local.get('descricao'):
                         desc_parts.append(mov_local['descricao'])

                    complementos_api = movimento_json.get('complementos', [])
                    if isinstance(complementos_api, list):
                        for comp_item in complementos_api:
                            if isinstance(comp_item, dict) and comp_item.get('descricao'):
                                desc_parts.append(comp_item['descricao'])
                    
                    descricao_db = " | ".join(filter(None, desc_parts))
                    if not descricao_db: 
                        descricao_db = movimento_json.get('descricao') or f"Movimento Cód: {movimento_json.get('codigoNacional', {}).get('codigo', 'N/A')}"

                    mov_existente = MovimentacaoCNJ.query.filter_by(
                        caso_id=caso_para_atualizar.id,
                        data_movimentacao=data_mov_obj_utc
                    ).filter(MovimentacaoCNJ.descricao.startswith(descricao_db[:150])).first()

                    if not mov_existente:
                        nova_mov = MovimentacaoCNJ(
                            caso_id=caso_para_atualizar.id,
                            data_movimentacao=data_mov_obj_utc,
                            descricao=descricao_db,
                            dados_integra_cnj=movimento_json
                        )
                        db.session.add(nova_mov)
                        novas_movs_count += 1
                        if data_mov_recente_lote is None or data_mov_obj_utc > data_mov_recente_lote:
                            data_mov_recente_lote = data_mov_obj_utc
                            desc_mov_recente_lote = descricao_db
                
                if novas_movs_count > 0 and data_mov_recente_lote:
                    caso_para_atualizar.status = desc_mov_recente_lote[:255] 
                    caso_para_atualizar.data_atualizacao = data_mov_recente_lote
                
                caso_para_atualizar.data_ultima_verificacao_cnj = datetime.utcnow()
                db.session.commit()

                msg_final = f"Caso atualizado. {novas_movs_count} nova(s) movimentação(ões) registrada(s)." if novas_movs_count > 0 else "Nenhuma nova movimentação encontrada para registrar."
                app.logger.info(f"API CNJ: Atualização para caso {caso_id} concluída. {msg_final}")
                return {
                    "message": msg_final, 
                    "novas_movimentacoes_registradas": novas_movs_count,
                    "descricao_ultima_movimentacao_nova": desc_mov_recente_lote if novas_movs_count > 0 else None
                }, 200

            except (KeyError, IndexError, TypeError, AttributeError) as e_proc:
                db.session.rollback()
                app.logger.error(f"API CNJ: Erro crítico ao processar dados da resposta CNJ para caso {caso_id}: {str(e_proc)}. Resposta CNJ (parcial): {str(dados_resposta_cnj)[:500]}", exc_info=True)
                return {"message": "Erro interno ao processar os dados recebidos do CNJ.", "error_details": str(e_proc)}, 500
            except Exception as e_geral:
                db.session.rollback()
                app.logger.critical(f"API CNJ: Erro geral INESPERADO no endpoint de atualização CNJ para caso {caso_id}: {str(e_geral)}", exc_info=True)
                return {"message": f"Ocorreu um erro geral e inesperado no sistema: {str(e_geral)}"}, 500

    @casos_ns.route('/<int:caso_id>/movimentacoes-cnj')
    @casos_ns.param('caso_id', 'O ID do caso para o qual listar as movimentações CNJ registradas no sistema')
    class CasoListarMovimentacoesCNJAPI(Resource):
        @casos_ns.doc('listar_movimentacoes_cnj_registradas_caso_endpoint', security='jsonWebToken')
        @casos_ns.marshal_list_with(movimentacao_cnj_output_model_dto)
        @jwt_required()
        def get(self, caso_id):
            user_id_atual = get_jwt_identity()
            caso_db = db.session.get(Caso, caso_id)
            if not caso_db: casos_ns.abort(404, message=f"Caso com ID {caso_id} não foi encontrado.")
            if caso_db.user_id != user_id_atual: casos_ns.abort(403, message="Acesso não autorizado.")
            movimentacoes = MovimentacaoCNJ.query.filter_by(caso_id=caso_db.id)\
                .order_by(MovimentacaoCNJ.data_movimentacao.desc(), MovimentacaoCNJ.id.desc())\
                .all()
            return movimentacoes, 200
            
    @eventos_ns.route('/')
    class EventoListAPI(Resource):
        @jwt_required()
        @eventos_ns.marshal_list_with(evento_model_dto)
        @eventos_ns.doc(security='jsonWebToken')
        def get(self):
            user_id = get_jwt_identity()
            eventos = get_list_query(EventoAgenda).order_by(EventoAgenda.data_inicio.asc()).all()
            return eventos

        @jwt_required()
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
                user_id=user_id
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
        @eventos_ns.marshal_with(evento_model_dto)
        @eventos_ns.doc(security='jsonWebToken')
        def get(self, evento_id_param):
            user_id = get_jwt_identity()
            evento = get_item_or_404(EventoAgenda, evento_id_param)
            return evento

        @jwt_required()
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
        @documentos_ns.marshal_list_with(documento_model_dto)
        @documentos_ns.doc(security='jsonWebToken', description="Lista documentos do usuário, com filtro opcional por 'caso_id'.")
        @documentos_ns.param('caso_id', 'ID do caso para filtrar os documentos (opcional)', type=int)
        def get(self):
            user_id = get_jwt_identity()
            caso_id_query_param = request.args.get('caso_id', type=int)
            query = Documento.query.filter_by(user_id=user_id)
            if caso_id_query_param is not None:
                query = query.filter_by(caso_id=caso_id_query_param)
            documentos = query.order_by(Documento.data_upload.desc()).all()
            return documentos

    @documentos_ns.route('/upload')
    class DocumentoUploadAPI(Resource):
        @jwt_required()
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
                        if not Caso.query.filter_by(id=db_caso_id, user_id=user_id).first():
                            os.remove(full_file_path_to_save)
                            return {'message': f'Caso com ID {db_caso_id} não encontrado ou não pertence ao usuário.'}, 400
                    except ValueError:
                        os.remove(full_file_path_to_save)
                        return {'message': 'O valor fornecido para "caso_id" é inválido.'}, 400
                novo_documento_db = Documento(
                    nome_arquivo=final_filename_to_save, path_arquivo=full_file_path_to_save, 
                    user_id=user_id, caso_id=db_caso_id
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
        @finance_access_required
        @despesas_ns.marshal_list_with(despesa_model_dto)
        @despesas_ns.doc(security='jsonWebToken')
        def get(self):
            user_id = get_jwt_identity()
            despesas = get_list_query(Despesa).order_by(Despesa.data_despesa.desc()).all()
            return despesas
        @jwt_required()
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
                if not Caso.query.filter_by(id=caso_id_val, user_id=user_id).first():
                    return {"message": f"Caso ID {caso_id_val} não encontrado."}, 404
            nova_despesa = Despesa(descricao=data['descricao'], valor=valor_decimal, data_despesa=data_despesa_obj, pago=data.get('pago', False), caso_id=caso_id_val, user_id=user_id)
            db.session.add(nova_despesa)
            db.session.commit()
            app.logger.info(f"Nova despesa ID {nova_despesa.id} criada para usuário ID {user_id}.")
            return nova_despesa, 201

    @despesas_ns.route('/<int:despesa_id_param>')
    @despesas_ns.response(404, 'Despesa não encontrada.')
    @despesas_ns.param('despesa_id_param', 'O ID da despesa')
    class DespesaDetailAPI(Resource):
        @jwt_required()
        @finance_access_required
        @despesas_ns.marshal_with(despesa_model_dto)
        @despesas_ns.doc(security='jsonWebToken')
        def get(self, despesa_id_param):
            user_id = get_jwt_identity()
            despesa = get_item_or_404(Despesa, despesa_id_param)
            return despesa
        @jwt_required()
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
                    if not Caso.query.filter_by(id=caso_id_val, user_id=user_id).first():
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
        @finance_access_required
        @recebimentos_ns.marshal_list_with(recebimento_model_dto)
        @recebimentos_ns.doc(security='jsonWebToken')
        def get(self):
            user_id = get_jwt_identity()
            recebimentos = get_list_query(Recebimento).order_by(Recebimento.data_recebimento.desc()).all()
            return recebimentos
        @jwt_required()
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
                if not Caso.query.filter_by(id=caso_id_val, user_id=user_id).first():
                    return {"message": f"Caso ID {caso_id_val} não encontrado."}, 404
            novo_recebimento = Recebimento(descricao=data['descricao'], valor=valor_decimal, data_recebimento=data_recebimento_obj, 
                                           recebido=data.get('recebido', False), caso_id=caso_id_val, user_id=user_id)
            db.session.add(novo_recebimento)
            db.session.commit()
            app.logger.info(f"Novo recebimento ID {novo_recebimento.id} criado para usuário ID {user_id}.")
            return novo_recebimento, 201

    @recebimentos_ns.route('/<int:recebimento_id_param>')
    @recebimentos_ns.response(404, 'Recebimento não encontrado.')
    @recebimentos_ns.param('recebimento_id_param', 'O ID do recebimento')
    class RecebimentoDetailAPI(Resource):
        @jwt_required()
        @finance_access_required
        @recebimentos_ns.marshal_with(recebimento_model_dto)
        @recebimentos_ns.doc(security='jsonWebToken')
        def get(self, recebimento_id_param):
            user_id = get_jwt_identity()
            recebimento = get_item_or_404(Recebimento, recebimento_id_param)
            return recebimento
        @jwt_required()
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
                    if not Caso.query.filter_by(id=caso_id_val, user_id=user_id).first():
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
        @recebimentos_ns.response(204, 'Recebimento deletado.')
        @recebimentos_ns.doc(security='jsonWebToken')
        def delete(self, recebimento_id_param):
            user_id = get_jwt_identity()
            recebimento = get_item_or_404(Recebimento, recebimento_id_param)
            db.session.delete(recebimento)
            db.session.commit()
            app.logger.info(f"Recebimento ID {recebimento.id} deletado pelo usuário ID {user_id}.")
            return '', 204

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
                        
                        # --- NOVO JOB DE E-MAILS DE ALERTA ---
                        job_alertas_id = 'VerificarAlertasPrazosJob'
                        if not scheduler.get_job(job_alertas_id):
                            from alertas_tasks import job_verificar_prazos
                            scheduler.add_job(
                                id=job_alertas_id, func=job_verificar_prazos, args=[app], trigger='cron',
                                hour=6, minute=0, replace_existing=True
                            )
                            app.logger.info(f"Job '{job_alertas_id}' agendado para rodar diariamente às 06:00.")
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
        @finance_access_required
        @contratos_ns.marshal_list_with(contrato_model_dto)
        @contratos_ns.doc(security='jsonWebToken')
        def get(self):
            contratos = get_list_query(ContratoHonorario).all()
            return contratos

        @jwt_required()
        @finance_access_required
        @contratos_ns.expect(contrato_input_model_dto)
        @contratos_ns.marshal_with(contrato_model_dto, code=201)
        @contratos_ns.doc(security='jsonWebToken')
        def post(self):
            user_id = get_jwt_identity()
            data = request.get_json()
            
            caso = Caso.query.filter_by(id=data['caso_id']).first()
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
                user_id=user_id
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
        @finance_access_required
        @contratos_ns.marshal_with(contrato_model_dto)
        @contratos_ns.doc(security='jsonWebToken')
        def get(self, id):
            contrato = get_item_or_404(ContratoHonorario, id)
            return contrato

        @jwt_required()
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

    return app

# No final de gestao_advocacia/app.py
if __name__ == '__main__':
   app = create_app()
   app.run(debug=(os.environ.get('FLASK_ENV') == 'development'),
           # Remova ou altere a linha abaixo se existir e estiver como port=5001
           # port=5000, # Garanta que seja 5000 ou remova para usar o padrão
           use_reloader=(os.environ.get('FLASK_ENV') == 'development' and os.environ.get('WERKZEUG_RUN_MAIN') != 'true'))