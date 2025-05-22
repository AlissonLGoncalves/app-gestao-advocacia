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

# Inicialização das extensões
db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
scheduler = APScheduler()

# --- MODELOS SQLAlchemy ---
class User(db.Model):
    __tablename__ = 'user'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False) 
    email = db.Column(db.String(120), unique=True, nullable=False)
    
    casos = db.relationship('Caso', backref='responsavel_user', lazy='dynamic', foreign_keys='Caso.user_id')
    clientes = db.relationship('Cliente', backref='advogado_responsavel', lazy='dynamic', foreign_keys='Cliente.user_id')
    eventos_agenda = db.relationship('EventoAgenda', backref='criador_evento', lazy='dynamic', foreign_keys='EventoAgenda.user_id')
    documentos = db.relationship('Documento', backref='uploader_documento', lazy='dynamic', foreign_keys='Documento.user_id')
    despesas = db.relationship('Despesa', backref='registrador_despesa', lazy='dynamic', foreign_keys='Despesa.user_id')
    recebimentos = db.relationship('Recebimento', backref='registrador_recebimento', lazy='dynamic', foreign_keys='Recebimento.user_id')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {'id': self.id, 'username': self.username, 'email': self.email }

class Cliente(db.Model):
    __tablename__ = 'cliente'
    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=True)
    telefone = db.Column(db.String(20), nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id', name='fk_cliente_user_id'), nullable=False)
    
    casos = db.relationship('Caso', backref='cliente_associado', lazy='dynamic', cascade="all, delete-orphan")

    def to_dict(self):
        return {'id': self.id, 'nome': self.nome, 'email': self.email, 'telefone': self.telefone, 'user_id': self.user_id}

class Caso(db.Model):
    __tablename__ = 'caso'
    id = db.Column(db.Integer, primary_key=True)
    nome_caso = db.Column(db.String(150), nullable=False)
    numero_processo = db.Column(db.String(30), unique=False, nullable=True, index=True) 
    descricao = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(255), nullable=True) 
    data_criacao = db.Column(db.DateTime, default=datetime.utcnow)
    data_atualizacao = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    cliente_id = db.Column(db.Integer, db.ForeignKey('cliente.id', name='fk_caso_cliente_id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id', name='fk_caso_user_id'), nullable=False)
    
    data_ultima_verificacao_cnj = db.Column(db.DateTime, nullable=True)
    
    movimentacoes_cnj = db.relationship('MovimentacaoCNJ', backref='caso_cnj_associado', lazy='dynamic', cascade="all, delete-orphan")
    documentos_caso = db.relationship('Documento', backref='caso_documento_associado', lazy='dynamic', cascade="all, delete-orphan")
    despesas_caso = db.relationship('Despesa', backref='caso_despesa_associado', lazy='dynamic', cascade="all, delete-orphan")
    recebimentos_caso = db.relationship('Recebimento', backref='caso_recebimento_associado', lazy='dynamic', cascade="all, delete-orphan")

    def __repr__(self): return f'<Caso {self.id} - {self.nome_caso}>'
    def to_dict(self):
        return {
            'id': self.id, 'nome_caso': self.nome_caso, 'numero_processo': self.numero_processo,
            'descricao': self.descricao, 'status': self.status,
            'data_criacao': self.data_criacao.isoformat() if self.data_criacao else None,
            'data_atualizacao': self.data_atualizacao.isoformat() if self.data_atualizacao else None,
            'cliente_id': self.cliente_id,
            'nome_cliente': self.cliente_associado.nome if hasattr(self, 'cliente_associado') and self.cliente_associado else None,
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

class EventoAgenda(db.Model):
    __tablename__ = 'evento_agenda'
    id = db.Column(db.Integer, primary_key=True)
    titulo = db.Column(db.String(100), nullable=False)
    data_inicio = db.Column(db.DateTime, nullable=False)
    data_fim = db.Column(db.DateTime, nullable=True)
    descricao = db.Column(db.Text, nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id', name='fk_evento_user_id'), nullable=False)

    def to_dict(self):
        return {'id': self.id, 'title': self.titulo, 'start': self.data_inicio.isoformat(),
                'end': self.data_fim.isoformat() if self.data_fim else None,
                'description': self.descricao, 'user_id': self.user_id}

class Documento(db.Model):
    __tablename__ = 'documento'
    id = db.Column(db.Integer, primary_key=True)
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

class Despesa(db.Model):
    __tablename__ = 'despesa'
    id = db.Column(db.Integer, primary_key=True)
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
    descricao = db.Column(db.String(200), nullable=False)
    valor = db.Column(db.Numeric(10, 2), nullable=False)
    data_recebimento = db.Column(db.Date, nullable=False)
    recebido = db.Column(db.Boolean, default=False)
    caso_id = db.Column(db.Integer, db.ForeignKey('caso.id', name='fk_recebimento_caso_id'), nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id', name='fk_recebimento_user_id'), nullable=False)

    def to_dict(self):
        return {'id': self.id, 'descricao': self.descricao, 'valor': str(self.valor),
                'data_recebimento': self.data_recebimento.isoformat(), 'recebido': self.recebido,
                'caso_id': self.caso_id, 'user_id': self.user_id}
# --- FIM DOS MODELOS SQLAlchemy ---


# Factory Function para criar a aplicação Flask
def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

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

    api.add_namespace(auth_ns)
    api.add_namespace(clientes_ns)
    api.add_namespace(casos_ns)
    api.add_namespace(eventos_ns)
    api.add_namespace(documentos_ns)
    api.add_namespace(despesas_ns)
    api.add_namespace(recebimentos_ns)

    # --- DEFINIÇÃO DOS MODELOS DA API (DTOs - Data Transfer Objects) para Flask-RESTx ---
    user_model_dto = auth_ns.model('UserRegistration', {
        'username': fields.String(required=True, description='Nome de usuário único'),
        'email': fields.String(required=True, description='Email único do usuário', format='email'),
        'password': fields.String(required=True, description='Senha do usuário (mínimo 6 caracteres)', min_length=6)
    })
    login_model_dto = auth_ns.model('UserLogin', {
        'username_or_email': fields.String(required=True, description='Nome de usuário ou email para login'),
        'password': fields.String(required=True, description='Senha para login')
    })
    token_model_dto = auth_ns.model('Token', {
        'access_token': fields.String(description='Token de Acesso JWT gerado após login bem-sucedido')
    })
    user_output_model_dto = auth_ns.model('UserOutput', {
        'id': fields.Integer(readonly=True, description='ID único do usuário'),
        'username': fields.String(description='Nome de usuário'),
        'email': fields.String(description='Email do usuário')
    })

    cliente_input_model_dto = clientes_ns.model('ClienteInput', {
        'nome': fields.String(required=True, description='Nome completo do cliente'),
        'email': fields.String(description='Email do cliente (opcional, mas útil para contato)'),
        'telefone': fields.String(description='Telefone do cliente (opcional)')
    })
    cliente_model_dto = clientes_ns.model('ClienteOutput', {
        'id': fields.Integer(readonly=True, description='ID único do cliente'),
        'nome': fields.String(required=True, description='Nome do cliente'),
        'email': fields.String(description='Email do cliente'),
        'telefone': fields.String(description='Telefone do cliente'),
        'user_id': fields.Integer(description='ID do usuário advogado responsável')
    })

    caso_input_model_dto = casos_ns.model('CasoInput', {
        'nome_caso': fields.String(required=True, description='Título ou nome identificador do caso'),
        'numero_processo': fields.String(description='Número do processo no formato CNJ (ex: NNNNNNN-DD.AAAA.J.TR.OOOO)'),
        'descricao': fields.String(description='Descrição detalhada ou anotações sobre o caso'),
        'status': fields.String(description='Status atual do caso (ex: Em Andamento, Concluído, Suspenso)'),
        'cliente_id': fields.Integer(required=True, description='ID do cliente ao qual este caso está associado')
    })
    caso_model_dto = casos_ns.model('CasoOutput', {
        'id': fields.Integer(readonly=True),
        'nome_caso': fields.String,
        'numero_processo': fields.String,
        'descricao': fields.String,
        'status': fields.String,
        'data_criacao': fields.DateTime(dt_format='iso8601'),
        'data_atualizacao': fields.DateTime(dt_format='iso8601'),
        'cliente_id': fields.Integer,
        'nome_cliente': fields.String(attribute='cliente_associado.nome', description='Nome do cliente associado (se disponível e carregado)'),
        'user_id': fields.Integer,
        'data_ultima_verificacao_cnj': fields.DateTime(dt_format='iso8601', nullable=True, description='Data da última verificação de atualizações no CNJ'),
        'movimentacoes_cnj_count': fields.Integer(description='Quantidade de movimentações do CNJ registradas para este caso')
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
        'data_inicio': fields.DateTime(required=True, description='Data e hora de início do evento (formato ISO 8601)'),
        'data_fim': fields.DateTime(description='Data e hora de término do evento (formato ISO 8601, opcional)'),
        'descricao': fields.String(description='Descrição ou detalhes adicionais sobre o evento')
    })
    evento_model_dto = eventos_ns.model('EventoOutput', {
        'id': fields.Integer(readonly=True),
        'title': fields.String(attribute='titulo', description='Título do evento (compatível com FullCalendar)'), 
        'start': fields.DateTime(attribute='data_inicio', dt_format='iso8601', description='Início do evento (compatível com FullCalendar)'),
        'end': fields.DateTime(attribute='data_fim', dt_format='iso8601', nullable=True, description='Fim do evento (compatível com FullCalendar)'),
        'description': fields.String(attribute='descricao', nullable=True, description='Descrição do evento'),
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

            if not username or not email or not password:
                return {"message": "Todos os campos (username, email, password) são obrigatórios."}, 400
            if len(password) < 6:
                return {"message": "A senha deve ter no mínimo 6 caracteres."}, 400
            
            if User.query.filter_by(username=username).first():
                return {"message": "Nome de usuário já cadastrado."}, 409
            if User.query.filter_by(email=email).first():
                return {"message": "Email já cadastrado."}, 409
            
            new_user = User(username=username, email=email)
            new_user.set_password(password)
            db.session.add(new_user)
            db.session.commit()
            app.logger.info(f"Novo usuário registrado: {username} (ID: {new_user.id})")
            return {"message": "Usuário registrado com sucesso. Faça login para continuar."}, 201

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
                access_token = create_access_token(identity=user.id, expires_delta=expires)
                app.logger.info(f"Usuário {user.username} (ID: {user.id}) logado com sucesso.")
                return {'access_token': access_token}, 200
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

    @clientes_ns.route('/')
    class ClienteListAPI(Resource):
        @jwt_required()
        @clientes_ns.marshal_list_with(cliente_model_dto)
        @clientes_ns.doc(security='jsonWebToken', description="Lista todos os clientes do usuário autenticado.")
        def get(self):
            user_id = get_jwt_identity()
            clientes = Cliente.query.filter_by(user_id=user_id).order_by(Cliente.nome.asc()).all()
            return clientes

        @jwt_required()
        @clientes_ns.expect(cliente_input_model_dto)
        @clientes_ns.marshal_with(cliente_model_dto, code=201)
        @clientes_ns.doc(security='jsonWebToken', description="Cria um novo cliente para o usuário autenticado.")
        def post(self):
            user_id = get_jwt_identity()
            data = request.get_json()
            if not data.get('nome'): 
                return {"message": "O nome do cliente é um campo obrigatório."}, 400
            if data.get('email'):
                email_existente = Cliente.query.filter_by(user_id=user_id, email=data.get('email')).first()
                if email_existente:
                     return {"message": f"Um cliente com o email '{data.get('email')}' já está cadastrado."}, 409
            novo_cliente = Cliente(nome=data['nome'], email=data.get('email'), telefone=data.get('telefone'), user_id=user_id)
            db.session.add(novo_cliente)
            db.session.commit()
            app.logger.info(f"Novo cliente '{novo_cliente.nome}' (ID: {novo_cliente.id}) criado para usuário ID {user_id}.")
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
            cliente = Cliente.query.filter_by(id=cliente_id_param, user_id=user_id).first_or_404()
            return cliente

        @jwt_required()
        @clientes_ns.expect(cliente_input_model_dto)
        @clientes_ns.marshal_with(cliente_model_dto)
        @clientes_ns.doc(security='jsonWebToken', description="Atualiza os dados de um cliente existente.")
        def put(self, cliente_id_param):
            user_id = get_jwt_identity()
            cliente = Cliente.query.filter_by(id=cliente_id_param, user_id=user_id).first_or_404()
            data = request.get_json()
            if not data.get('nome'):
                return {"message": "O nome do cliente é obrigatório."}, 400
            novo_email = data.get('email')
            if novo_email and novo_email != cliente.email:
                if Cliente.query.filter(Cliente.user_id == user_id, Cliente.email == novo_email, Cliente.id != cliente_id_param).first():
                    return {"message": f"Outro cliente já utiliza o email '{novo_email}'."}, 409
            cliente.nome = data['nome']
            cliente.email = novo_email if novo_email is not None else cliente.email
            cliente.telefone = data.get('telefone', cliente.telefone)
            db.session.commit()
            app.logger.info(f"Cliente ID {cliente.id} atualizado pelo usuário ID {user_id}.")
            return cliente

        @jwt_required()
        @clientes_ns.response(204, 'Cliente deletado com sucesso.')
        @clientes_ns.response(400, 'Não é possível deletar cliente com casos associados.')
        @clientes_ns.doc(security='jsonWebToken', description="Deleta um cliente, se não houver casos associados.")
        def delete(self, cliente_id_param):
            user_id = get_jwt_identity()
            cliente = Cliente.query.filter_by(id=cliente_id_param, user_id=user_id).first_or_404()
            if cliente.casos.first():
                return {"message": "Não é possível deletar cliente com casos associados."}, 400
            db.session.delete(cliente)
            db.session.commit()
            app.logger.info(f"Cliente ID {cliente.id} ('{cliente.nome}') deletado pelo usuário ID {user_id}.")
            return '', 204

    @casos_ns.route('/')
    class CasoListAPI(Resource):
        @jwt_required()
        @casos_ns.marshal_list_with(caso_model_dto)
        @casos_ns.doc(security='jsonWebToken', description="Lista todos os casos jurídicos do usuário.")
        def get(self):
            user_id = get_jwt_identity()
            casos = Caso.query.filter_by(user_id=user_id).order_by(Caso.data_atualizacao.desc()).all()
            return casos

        @jwt_required()
        @casos_ns.expect(caso_input_model_dto)
        @casos_ns.marshal_with(caso_model_dto, code=201)
        @casos_ns.doc(security='jsonWebToken', description="Cria um novo caso jurídico.")
        def post(self):
            user_id = get_jwt_identity()
            data = request.get_json()
            if not data.get('nome_caso') or data.get('cliente_id') is None:
                return {"message": "Nome do caso e ID do cliente são obrigatórios."}, 400
            cliente = Cliente.query.filter_by(id=data['cliente_id'], user_id=user_id).first()
            if not cliente:
                return {"message": f"Cliente com ID {data['cliente_id']} não encontrado."}, 404
            num_proc_strip = data.get('numero_processo', '').strip() or None
            if num_proc_strip and Caso.query.filter_by(user_id=user_id, numero_processo=num_proc_strip).first():
                return {"message": f"Já existe um caso com o número de processo '{num_proc_strip}'."}, 409
            novo_caso = Caso(
                nome_caso=data['nome_caso'], numero_processo=num_proc_strip,
                descricao=data.get('descricao'), status=data.get('status', 'Aberto'),
                cliente_id=data['cliente_id'], user_id=user_id
            )
            db.session.add(novo_caso)
            db.session.commit()
            app.logger.info(f"Novo caso '{novo_caso.nome_caso}' (ID: {novo_caso.id}) criado para usuário ID {user_id}.")
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
            caso = Caso.query.filter_by(id=caso_id_param, user_id=user_id).first_or_404()
            return caso

        @jwt_required()
        @casos_ns.expect(caso_input_model_dto)
        @casos_ns.marshal_with(caso_model_dto)
        @casos_ns.doc(security='jsonWebToken', description="Atualiza um caso jurídico existente.")
        def put(self, caso_id_param):
            user_id = get_jwt_identity()
            caso = Caso.query.filter_by(id=caso_id_param, user_id=user_id).first_or_404()
            data = request.get_json()
            if not data.get('nome_caso') or data.get('cliente_id') is None:
                return {"message": "Nome do caso e ID do cliente são obrigatórios."}, 400
            novo_cliente_id = data.get('cliente_id')
            if novo_cliente_id != caso.cliente_id:
                if not Cliente.query.filter_by(id=novo_cliente_id, user_id=user_id).first():
                    return {"message": f"Novo cliente com ID {novo_cliente_id} não encontrado."}, 404
                caso.cliente_id = novo_cliente_id
            novo_numero_processo = data.get('numero_processo', '').strip() or None
            if novo_numero_processo and novo_numero_processo != caso.numero_processo:
                if Caso.query.filter(Caso.user_id == user_id, Caso.numero_processo == novo_numero_processo, Caso.id != caso_id_param).first():
                    return {"message": f"Outro caso já utiliza o número de processo '{novo_numero_processo}'."}, 409
            caso.nome_caso = data['nome_caso']
            caso.numero_processo = novo_numero_processo
            caso.descricao = data.get('descricao', caso.descricao)
            caso.status = data.get('status', caso.status)
            db.session.commit()
            app.logger.info(f"Caso ID {caso.id} atualizado pelo usuário ID {user_id}.")
            return caso

        @jwt_required()
        @casos_ns.response(204, 'Caso deletado com sucesso.')
        @casos_ns.doc(security='jsonWebToken', description="Deleta um caso jurídico.")
        def delete(self, caso_id_param):
            user_id = get_jwt_identity()
            caso = Caso.query.filter_by(id=caso_id_param, user_id=user_id).first_or_404()
            db.session.delete(caso)
            db.session.commit()
            app.logger.info(f"Caso ID {caso.id} ('{caso.nome_caso}') deletado pelo usuário ID {user_id}.")
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
            eventos = EventoAgenda.query.filter_by(user_id=user_id).order_by(EventoAgenda.data_inicio.asc()).all()
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
                descricao=data.get('descricao'), user_id=user_id
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
            evento = EventoAgenda.query.filter_by(id=evento_id_param, user_id=user_id).first_or_404()
            return evento

        @jwt_required()
        @eventos_ns.expect(evento_input_model_dto)
        @eventos_ns.marshal_with(evento_model_dto)
        @eventos_ns.doc(security='jsonWebToken')
        def put(self, evento_id_param):
            user_id = get_jwt_identity()
            evento = EventoAgenda.query.filter_by(id=evento_id_param, user_id=user_id).first_or_404()
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
            db.session.commit()
            app.logger.info(f"Evento ID {evento.id} atualizado pelo usuário ID {user_id}.")
            return evento

        @jwt_required()
        @eventos_ns.response(204, 'Evento deletado com sucesso.')
        @eventos_ns.doc(security='jsonWebToken')
        def delete(self, evento_id_param):
            user_id = get_jwt_identity()
            evento = EventoAgenda.query.filter_by(id=evento_id_param, user_id=user_id).first_or_404()
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
            documento_db = Documento.query.filter_by(id=doc_id_param, user_id=user_id).first_or_404()
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
            documento_db = Documento.query.filter_by(id=doc_id_param, user_id=user_id).first_or_404()
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
        @despesas_ns.marshal_list_with(despesa_model_dto)
        @despesas_ns.doc(security='jsonWebToken')
        def get(self):
            user_id = get_jwt_identity()
            despesas = Despesa.query.filter_by(user_id=user_id).order_by(Despesa.data_despesa.desc()).all()
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
        @despesas_ns.marshal_with(despesa_model_dto)
        @despesas_ns.doc(security='jsonWebToken')
        def get(self, despesa_id_param):
            user_id = get_jwt_identity()
            despesa = Despesa.query.filter_by(id=despesa_id_param, user_id=user_id).first_or_404()
            return despesa
        @jwt_required()
        @despesas_ns.expect(despesa_input_model_dto)
        @despesas_ns.marshal_with(despesa_model_dto)
        @despesas_ns.doc(security='jsonWebToken')
        def put(self, despesa_id_param):
            user_id = get_jwt_identity()
            despesa = Despesa.query.filter_by(id=despesa_id_param, user_id=user_id).first_or_404()
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
            despesa = Despesa.query.filter_by(id=despesa_id_param, user_id=user_id).first_or_404()
            db.session.delete(despesa)
            db.session.commit()
            app.logger.info(f"Despesa ID {despesa.id} deletada pelo usuário ID {user_id}.")
            return '', 204

    @recebimentos_ns.route('/')
    class RecebimentoListAPI(Resource):
        @jwt_required()
        @recebimentos_ns.marshal_list_with(recebimento_model_dto)
        @recebimentos_ns.doc(security='jsonWebToken')
        def get(self):
            user_id = get_jwt_identity()
            recebimentos = Recebimento.query.filter_by(user_id=user_id).order_by(Recebimento.data_recebimento.desc()).all()
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
        @recebimentos_ns.marshal_with(recebimento_model_dto)
        @recebimentos_ns.doc(security='jsonWebToken')
        def get(self, recebimento_id_param):
            user_id = get_jwt_identity()
            recebimento = Recebimento.query.filter_by(id=recebimento_id_param, user_id=user_id).first_or_404()
            return recebimento
        @jwt_required()
        @recebimentos_ns.expect(recebimento_input_model_dto)
        @recebimentos_ns.marshal_with(recebimento_model_dto)
        @recebimentos_ns.doc(security='jsonWebToken')
        def put(self, recebimento_id_param):
            user_id = get_jwt_identity()
            recebimento = Recebimento.query.filter_by(id=recebimento_id_param, user_id=user_id).first_or_404()
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
            recebimento = Recebimento.query.filter_by(id=recebimento_id_param, user_id=user_id).first_or_404()
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

    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_react_app(path):
        if static_folder_path and os.path.exists(static_folder_path):
            if path != "" and os.path.exists(os.path.join(static_folder_path, path)):
                return send_from_directory(static_folder_path, path)
            else:
                index_path = os.path.join(static_folder_path, 'index.html')
                if os.path.exists(index_path):
                    return send_from_directory(static_folder_path, 'index.html')
        app.logger.error(f"Frontend: Arquivo '{path if path else 'index.html'}' não encontrado em '{static_folder_path if static_folder_path else 'CAMINHO_NAO_DEFINIDO'}'.")
        return jsonify({"error": "Recurso do frontend não encontrado."}), 404
                
    return app

# Permite executar com 'python app.py' para desenvolvimento, se não estiver usando 'flask run'
if __name__ == '__main__':
   app = create_app()
   # O reloader do Flask pode iniciar o scheduler duas vezes se debug=True.
   # A lógica dentro de create_app com WERKZEUG_RUN_MAIN tenta mitigar isso.
   # Para produção, use um servidor WSGI como Gunicorn ou uWSGI.
   app.run(debug=(os.environ.get('FLASK_ENV') == 'development'), 
           use_reloader=(os.environ.get('FLASK_ENV') == 'development' and os.environ.get('WERKZEUG_RUN_MAIN') != 'true'))

