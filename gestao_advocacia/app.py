# app.py
# Backend Flask para a aplicação de Gestão de Advocacia
# v3: Corrigido DeprecationWarning para datetime.utcnow().

from flask import Flask, jsonify, request, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS 
import config 
import os
from datetime import datetime, date, timezone # Adicionado timezone
from sqlalchemy import or_, asc, desc, func 
from werkzeug.utils import secure_filename

# Inicialização da Aplicação Flask
app = Flask(__name__)
app.config.from_object(config.Config) 

# Configuração para Upload de Arquivos
UPLOAD_FOLDER = os.path.join(app.root_path, 'uploads')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'}

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

CORS(app) 

db = SQLAlchemy(app) 
migrate = Migrate(app, db) 

# --- Modelos do Banco de Dados (SQLAlchemy Models) ---
class Cliente(db.Model):
    __tablename__ = 'clientes'
    id = db.Column(db.Integer, primary_key=True)
    nome_razao_social = db.Column(db.String(255), nullable=False)
    cpf_cnpj = db.Column(db.String(18), nullable=False, unique=True)
    tipo_pessoa = db.Column(db.String(2), nullable=False) 
    rg = db.Column(db.String(20), nullable=True)
    orgao_emissor = db.Column(db.String(50), nullable=True)
    data_nascimento = db.Column(db.Date, nullable=True)
    estado_civil = db.Column(db.String(50), nullable=True)
    profissao = db.Column(db.String(100), nullable=True)
    nacionalidade = db.Column(db.String(100), nullable=True)
    nome_fantasia = db.Column(db.String(255), nullable=True)
    nire = db.Column(db.String(50), nullable=True)
    inscricao_estadual = db.Column(db.String(50), nullable=True)
    inscricao_municipal = db.Column(db.String(50), nullable=True)
    cep = db.Column(db.String(9), nullable=True)
    rua = db.Column(db.String(255), nullable=True)
    numero = db.Column(db.String(20), nullable=True)
    bairro = db.Column(db.String(100), nullable=True)
    cidade = db.Column(db.String(100), nullable=True)
    estado = db.Column(db.String(2), nullable=True)
    pais = db.Column(db.String(50), default='Brasil', nullable=True)
    telefone = db.Column(db.String(20), nullable=True)
    email = db.Column(db.String(255), nullable=True)
    notas_gerais = db.Column(db.Text, nullable=True)
    data_criacao = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc)) # Corrigido
    data_atualizacao = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)) # Corrigido
    
    casos = db.relationship('Caso', backref='cliente', lazy=True, cascade="all, delete-orphan")
    recebimentos = db.relationship('Recebimento', backref='cliente_ref', lazy='dynamic', cascade="all, delete-orphan")
    documentos = db.relationship('Documento', backref='cliente_ref_doc', lazy='dynamic', cascade="all, delete-orphan")

    def __repr__(self): return f'<Cliente {self.id}: {self.nome_razao_social}>'
    
    def to_dict(self):
        return {
            'id': self.id, 'nome_razao_social': self.nome_razao_social, 'cpf_cnpj': self.cpf_cnpj,
            'tipo_pessoa': self.tipo_pessoa, 'rg': self.rg, 'orgao_emissor': self.orgao_emissor,
            'data_nascimento': self.data_nascimento.isoformat() if self.data_nascimento else None,
            'estado_civil': self.estado_civil, 'profissao': self.profissao, 'nacionalidade': self.nacionalidade,
            'nome_fantasia': self.nome_fantasia, 'nire': self.nire, 'inscricao_estadual': self.inscricao_estadual,
            'inscricao_municipal': self.inscricao_municipal, 'cep': self.cep, 'rua': self.rua, 'numero': self.numero,
            'bairro': self.bairro, 'cidade': self.cidade, 'estado': self.estado, 'pais': self.pais,
            'telefone': self.telefone, 'email': self.email, 'notas_gerais': self.notas_gerais,
            'data_criacao': self.data_criacao.isoformat() if self.data_criacao else None,
            'data_atualizacao': self.data_atualizacao.isoformat() if self.data_atualizacao else None
        }

class Caso(db.Model):
    __tablename__ = 'casos'
    id = db.Column(db.Integer, primary_key=True)
    cliente_id = db.Column(db.Integer, db.ForeignKey('clientes.id'), nullable=False) 
    titulo = db.Column(db.String(255), nullable=False)
    numero_processo = db.Column(db.String(30), unique=True, nullable=True)
    status = db.Column(db.String(50), nullable=False)
    parte_contraria = db.Column(db.String(255), nullable=True)
    adv_parte_contraria = db.Column(db.String(255), nullable=True)
    tipo_acao = db.Column(db.String(100), nullable=True)
    vara_juizo = db.Column(db.String(100), nullable=True)
    comarca = db.Column(db.String(100), nullable=True)
    instancia = db.Column(db.String(50), nullable=True)
    valor_causa = db.Column(db.Numeric(15, 2), nullable=True) 
    data_distribuicao = db.Column(db.Date, nullable=True)
    notas_caso = db.Column(db.Text, nullable=True)
    data_criacao = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc)) # Corrigido
    data_atualizacao = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)) # Corrigido
    
    recebimentos = db.relationship('Recebimento', backref='caso_ref', lazy='dynamic', cascade="all, delete-orphan")
    despesas = db.relationship('Despesa', backref='caso_ref', lazy='dynamic', cascade="all, delete-orphan")
    eventos = db.relationship('EventoAgenda', backref='caso_ref', lazy='dynamic', cascade="all, delete-orphan")
    documentos = db.relationship('Documento', backref='caso_ref_doc', lazy='dynamic', cascade="all, delete-orphan")
    
    def __repr__(self): return f'<Caso {self.id}: {self.titulo}>'
    
    def to_dict(self):
        cliente_info = self.cliente.to_dict() if self.cliente else None 
        return {
            'id': self.id, 'cliente_id': self.cliente_id, 'titulo': self.titulo, 
            'numero_processo': self.numero_processo, 'status': self.status, 
            'parte_contraria': self.parte_contraria, 'adv_parte_contraria': self.adv_parte_contraria, 
            'tipo_acao': self.tipo_acao, 'vara_juizo': self.vara_juizo, 'comarca': self.comarca, 
            'instancia': self.instancia, 
            'valor_causa': str(self.valor_causa) if self.valor_causa is not None else None, 
            'data_distribuicao': self.data_distribuicao.isoformat() if self.data_distribuicao else None,
            'notas_caso': self.notas_caso, 
            'data_criacao': self.data_criacao.isoformat() if self.data_criacao else None, 
            'data_atualizacao': self.data_atualizacao.isoformat() if self.data_atualizacao else None,
            'cliente': cliente_info 
        }

class Recebimento(db.Model):
    __tablename__ = 'recebimentos'
    id = db.Column(db.Integer, primary_key=True)
    caso_id = db.Column(db.Integer, db.ForeignKey('casos.id'), nullable=False)
    cliente_id = db.Column(db.Integer, db.ForeignKey('clientes.id'), nullable=False) 
    data_recebimento = db.Column(db.Date, nullable=True) 
    data_vencimento = db.Column(db.Date, nullable=False) 
    descricao = db.Column(db.String(255), nullable=False)
    categoria = db.Column(db.String(100), nullable=False)
    valor = db.Column(db.Numeric(15, 2), nullable=False)
    status = db.Column(db.String(50), nullable=False)
    forma_pagamento = db.Column(db.String(50), nullable=True)
    notas = db.Column(db.Text, nullable=True)
    data_criacao = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc)) # Corrigido
    data_atualizacao = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)) # Corrigido

    def __repr__(self): return f'<Recebimento {self.id}: {self.descricao} - {self.valor}>'
    
    def to_dict(self):
        return {
            'id': self.id, 'caso_id': self.caso_id, 'cliente_id': self.cliente_id, 
            'data_recebimento': self.data_recebimento.isoformat() if self.data_recebimento else None,
            'data_vencimento': self.data_vencimento.isoformat() if self.data_vencimento else None, 
            'descricao': self.descricao, 'categoria': self.categoria, 
            'valor': str(self.valor) if self.valor is not None else None, 
            'status': self.status, 'forma_pagamento': self.forma_pagamento, 'notas': self.notas,
            'data_criacao': self.data_criacao.isoformat() if self.data_criacao else None,
            'data_atualizacao': self.data_atualizacao.isoformat() if self.data_atualizacao else None,
            'cliente_nome': self.cliente_ref.nome_razao_social if self.cliente_ref else None, 
            'caso_titulo': self.caso_ref.titulo if self.caso_ref else None 
        }

class Despesa(db.Model):
    __tablename__ = 'despesas'
    id = db.Column(db.Integer, primary_key=True)
    caso_id = db.Column(db.Integer, db.ForeignKey('casos.id'), nullable=True) 
    data_despesa = db.Column(db.Date, nullable=True) 
    data_vencimento = db.Column(db.Date, nullable=False) 
    descricao = db.Column(db.String(255), nullable=False)
    categoria = db.Column(db.String(100), nullable=False)
    valor = db.Column(db.Numeric(15, 2), nullable=False)
    status = db.Column(db.String(50), nullable=False)
    forma_pagamento = db.Column(db.String(50), nullable=True)
    notas = db.Column(db.Text, nullable=True)
    data_criacao = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc)) # Corrigido
    data_atualizacao = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)) # Corrigido

    def __repr__(self): return f'<Despesa {self.id}: {self.descricao} - {self.valor}>'
    
    def to_dict(self):
        return {
            'id': self.id, 'caso_id': self.caso_id, 
            'data_despesa': self.data_despesa.isoformat() if self.data_despesa else None,
            'data_vencimento': self.data_vencimento.isoformat() if self.data_vencimento else None, 
            'descricao': self.descricao, 'categoria': self.categoria, 
            'valor': str(self.valor) if self.valor is not None else None, 
            'status': self.status, 'forma_pagamento': self.forma_pagamento, 'notas': self.notas,
            'data_criacao': self.data_criacao.isoformat() if self.data_criacao else None,
            'data_atualizacao': self.data_atualizacao.isoformat() if self.data_atualizacao else None,
            'caso_titulo': self.caso_ref.titulo if self.caso_ref else "Despesa Geral" 
        }

class EventoAgenda(db.Model):
    __tablename__ = 'eventos_agenda'
    id = db.Column(db.Integer, primary_key=True)
    caso_id = db.Column(db.Integer, db.ForeignKey('casos.id'), nullable=True) 
    tipo_evento = db.Column(db.String(50), nullable=False) 
    titulo = db.Column(db.String(255), nullable=False)
    descricao = db.Column(db.Text, nullable=True)
    data_inicio = db.Column(db.DateTime, nullable=False) 
    data_fim = db.Column(db.DateTime, nullable=True) 
    local = db.Column(db.String(255), nullable=True)
    concluido = db.Column(db.Boolean, default=False)
    data_criacao = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc)) # Corrigido
    data_atualizacao = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)) # Corrigido

    def __repr__(self): return f'<EventoAgenda {self.id}: {self.tipo_evento} - {self.titulo}>'
    
    def to_dict(self):
        return {
            'id': self.id, 'caso_id': self.caso_id, 'tipo_evento': self.tipo_evento, 
            'titulo': self.titulo, 'descricao': self.descricao, 
            'data_inicio': self.data_inicio.isoformat() if self.data_inicio else None,
            'data_fim': self.data_fim.isoformat() if self.data_fim else None,
            'local': self.local, 'concluido': self.concluido,
            'data_criacao': self.data_criacao.isoformat() if self.data_criacao else None,
            'data_atualizacao': self.data_atualizacao.isoformat() if self.data_atualizacao else None,
            'caso_titulo': self.caso_ref.titulo if self.caso_ref else None 
        }

class Documento(db.Model):
    __tablename__ = 'documentos'
    id = db.Column(db.Integer, primary_key=True)
    cliente_id = db.Column(db.Integer, db.ForeignKey('clientes.id'), nullable=True)
    caso_id = db.Column(db.Integer, db.ForeignKey('casos.id'), nullable=True)
    nome_original_arquivo = db.Column(db.String(255), nullable=False)
    nome_armazenado = db.Column(db.String(255), nullable=False, unique=True) 
    tipo_mime = db.Column(db.String(100), nullable=True)
    tamanho_bytes = db.Column(db.BigInteger, nullable=True)
    descricao = db.Column(db.Text, nullable=True)
    data_upload = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc)) # Corrigido
    
    def __repr__(self): return f'<Documento {self.id}: {self.nome_original_arquivo}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'cliente_id': self.cliente_id,
            'caso_id': self.caso_id,
            'nome_original_arquivo': self.nome_original_arquivo,
            'nome_armazenado': self.nome_armazenado, 
            'tipo_mime': self.tipo_mime,
            'tamanho_bytes': self.tamanho_bytes,
            'descricao': self.descricao,
            'data_upload': self.data_upload.isoformat() if self.data_upload else None,
            'cliente_nome': self.cliente_ref_doc.nome_razao_social if self.cliente_ref_doc else None,
            'caso_titulo': self.caso_ref_doc.titulo if self.caso_ref_doc else None
        }

# --- Funções Auxiliares ---
def parse_date(date_string):
    if not date_string: return None
    try: return date.fromisoformat(date_string)
    except (ValueError, TypeError): return None

def parse_datetime(datetime_string):
    if not datetime_string: return None
    try: 
        dt_str = datetime_string.replace('Z', '') 
        if '.' in dt_str: # Verifica se tem microsegundos
            # Tenta parsear com microsegundos, mas se falhar, tenta sem.
            try:
                return datetime.fromisoformat(dt_str)
            except ValueError:
                return datetime.strptime(dt_str.split('.')[0], '%Y-%m-%dT%H:%M:%S')
        else:
            return datetime.strptime(dt_str, '%Y-%m-%dT%H:%M:%S')
    except (ValueError, TypeError): 
        try: 
            return datetime.strptime(datetime_string, '%Y-%m-%d') 
        except (ValueError, TypeError):
            print(f"Alerta: Falha ao parsear datetime: {datetime_string}")
            return None

# --- Rotas da API (Endpoints) ---
# ... (As rotas GET, POST, PUT, DELETE para Clientes, Casos, Recebimentos, Despesas, Eventos, Documentos, Relatórios permanecem as mesmas da versão anterior - app_py_filtros_completos_001)
# A única alteração é nos modelos para usar datetime.now(timezone.utc) nos defaults e onupdate.
# As lógicas de filtro e ordenação nas rotas GET já foram implementadas anteriormente.

# --- Rotas para Clientes ---
@app.route('/api/clientes', methods=['GET'])
def get_clientes():
    try: 
        search_term = request.args.get('search', None, type=str)
        tipo_pessoa_filter = request.args.get('tipo_pessoa', None, type=str)
        sort_by = request.args.get('sort_by', 'nome_razao_social', type=str) 
        sort_order = request.args.get('sort_order', 'asc', type=str)
        count_only = request.args.get('count_only', 'false', type=str).lower() == 'true'

        query = Cliente.query

        if tipo_pessoa_filter and tipo_pessoa_filter in ['PF', 'PJ']:
            query = query.filter(Cliente.tipo_pessoa == tipo_pessoa_filter)
        
        if search_term:
            search_like = f"%{search_term}%"
            query = query.filter(or_(func.lower(Cliente.nome_razao_social).ilike(func.lower(search_like)), 
                                     func.lower(Cliente.cpf_cnpj).ilike(func.lower(search_like))))
        
        if count_only:
            total_clientes = query.count()
            return jsonify({"total_clientes": total_clientes}), 200

        colunas_ordenaveis_cliente = ['nome_razao_social', 'cpf_cnpj', 'tipo_pessoa', 'cidade', 'data_criacao', 'data_atualizacao']
        if sort_by in colunas_ordenaveis_cliente and hasattr(Cliente, sort_by): 
            coluna_ordenacao = getattr(Cliente, sort_by)
            if sort_order.lower() == 'desc':
                query = query.order_by(desc(coluna_ordenacao))
            else:
                query = query.order_by(asc(coluna_ordenacao))
        else: 
            query = query.order_by(Cliente.nome_razao_social.asc())
        
        todos_clientes = query.all()
        return jsonify({"clientes": [c.to_dict() for c in todos_clientes]}), 200
    except Exception as e: 
        print(f"Erro ao buscar clientes: {e}")
        return jsonify({"erro": "Erro ao buscar clientes"}), 500

@app.route('/api/clientes', methods=['POST'])
def create_cliente():
    dados = request.get_json()
    if not dados or not dados.get('nome_razao_social') or not dados.get('cpf_cnpj') or not dados.get('tipo_pessoa'):
        return jsonify({"erro": "Dados incompletos (nome, cpf/cnpj, tipo são obrigatórios)"}), 400
    
    cpf_cnpj_formatado = dados['cpf_cnpj'] 
    cliente_existente = Cliente.query.filter_by(cpf_cnpj=cpf_cnpj_formatado).first() 
    if cliente_existente:
        return jsonify({"erro": f"Cliente com CPF/CNPJ {cpf_cnpj_formatado} já existe."}), 409
    
    novo_cliente = Cliente(
        nome_razao_social=dados['nome_razao_social'], cpf_cnpj=cpf_cnpj_formatado, tipo_pessoa=dados['tipo_pessoa'],
        rg=dados.get('rg'), orgao_emissor=dados.get('orgao_emissor'), data_nascimento=parse_date(dados.get('data_nascimento')),
        estado_civil=dados.get('estado_civil'), profissao=dados.get('profissao'), nacionalidade=dados.get('nacionalidade'),
        nome_fantasia=dados.get('nome_fantasia'), nire=dados.get('nire'), inscricao_estadual=dados.get('inscricao_estadual'),
        inscricao_municipal=dados.get('inscricao_municipal'), cep=dados.get('cep'), rua=dados.get('rua'), numero=dados.get('numero'),
        bairro=dados.get('bairro'), cidade=dados.get('cidade'), estado=dados.get('estado'), pais=dados.get('pais', 'Brasil'),
        telefone=dados.get('telefone'), email=dados.get('email'), notas_gerais=dados.get('notas_gerais')
    )
    try: 
        db.session.add(novo_cliente)
        db.session.commit()
        return jsonify(novo_cliente.to_dict()), 201
    except Exception as e: 
        db.session.rollback()
        print(f"Erro ao criar cliente: {e}")
        return jsonify({"erro": "Erro ao salvar cliente no banco de dados"}), 500

@app.route('/api/clientes/<int:id>', methods=['GET'])
def get_cliente(id):
    try:
        cliente = db.session.get(Cliente, id) 
        if cliente is None:
            return jsonify({"erro": "Cliente não encontrado"}), 404
        return jsonify(cliente.to_dict()), 200
    except Exception as e:
        print(f"Erro ao buscar cliente {id}: {e}")
        return jsonify({"erro": "Erro interno ao buscar cliente"}), 500

@app.route('/api/clientes/<int:id>', methods=['PUT'])
def update_cliente(id):
    dados = request.get_json()
    if not dados: return jsonify({"erro": "Nenhum dado fornecido para atualização"}), 400
    try:
        cliente = db.session.get(Cliente, id)
        if cliente is None:
            return jsonify({"erro": "Cliente não encontrado para atualizar"}), 404
        
        cliente.nome_razao_social = dados.get('nome_razao_social', cliente.nome_razao_social)
        cliente.rg = dados.get('rg', cliente.rg); cliente.orgao_emissor = dados.get('orgao_emissor', cliente.orgao_emissor)
        cliente.data_nascimento = parse_date(dados.get('data_nascimento')) if 'data_nascimento' in dados else cliente.data_nascimento
        cliente.estado_civil = dados.get('estado_civil', cliente.estado_civil); cliente.profissao = dados.get('profissao', cliente.profissao); cliente.nacionalidade = dados.get('nacionalidade', cliente.nacionalidade)
        cliente.nome_fantasia = dados.get('nome_fantasia', cliente.nome_fantasia); cliente.nire = dados.get('nire', cliente.nire); cliente.inscricao_estadual = dados.get('inscricao_estadual', cliente.inscricao_estadual); cliente.inscricao_municipal = dados.get('inscricao_municipal', cliente.inscricao_municipal)
        cliente.cep = dados.get('cep', cliente.cep); cliente.rua = dados.get('rua', cliente.rua); cliente.numero = dados.get('numero', cliente.numero); cliente.bairro = dados.get('bairro', cliente.bairro); cliente.cidade = dados.get('cidade', cliente.cidade); cliente.estado = dados.get('estado', cliente.estado); cliente.pais = dados.get('pais', cliente.pais)
        cliente.telefone = dados.get('telefone', cliente.telefone); cliente.email = dados.get('email', cliente.email); cliente.notas_gerais = dados.get('notas_gerais', cliente.notas_gerais)
        # data_atualizacao é atualizada automaticamente pelo onupdate
        
        db.session.commit()
        return jsonify(cliente.to_dict()), 200 
    except Exception as e:
        db.session.rollback()
        print(f"Erro ao atualizar cliente {id}: {e}")
        return jsonify({"erro": "Erro ao atualizar cliente"}), 500

@app.route('/api/clientes/<int:id>', methods=['DELETE'])
def delete_cliente(id):
    try: 
        cliente = db.session.get(Cliente, id)
        if cliente is None: 
            return jsonify({"erro": "Cliente não encontrado para deletar"}), 404
        db.session.delete(cliente)
        db.session.commit()
        return jsonify({"mensagem": f"Cliente {id} deletado com sucesso"}), 200 
    except Exception as e: 
        db.session.rollback()
        print(f"Erro ao deletar cliente {id}: {e}")
        if "violates foreign key constraint" in str(e).lower():
             return jsonify({"erro": "Não é possível deletar o cliente pois existem registros (casos, recebimentos, etc.) associados a ele."}), 409
        return jsonify({"erro": "Erro ao deletar cliente."}), 500

# --- Rotas para Casos ---
@app.route('/api/casos', methods=['GET'])
def get_casos():
    try:
        cliente_id_filtro = request.args.get('cliente_id', None, type=int)
        status_filtro = request.args.get('status', None, type=str)
        search_term = request.args.get('search', None, type=str)
        data_criacao_inicio_str = request.args.get('data_criacao_inicio', None, type=str)
        data_criacao_fim_str = request.args.get('data_criacao_fim', None, type=str)
        data_atualizacao_inicio_str = request.args.get('data_atualizacao_inicio', None, type=str)
        data_atualizacao_fim_str = request.args.get('data_atualizacao_fim', None, type=str)
        
        sort_by = request.args.get('sort_by', 'data_atualizacao', type=str) 
        sort_order = request.args.get('sort_order', 'desc', type=str) 
        count_only = request.args.get('count_only', 'false', type=str).lower() == 'true'

        query = Caso.query.join(Cliente, Caso.cliente_id == Cliente.id)

        if cliente_id_filtro:
            query = query.filter(Caso.cliente_id == cliente_id_filtro)
        if status_filtro:
            query = query.filter(Caso.status == status_filtro)
        if search_term:
            search_like = f"%{search_term}%"
            query = query.filter(
                or_(
                    func.lower(Caso.titulo).ilike(func.lower(search_like)),
                    func.lower(Caso.numero_processo).ilike(func.lower(search_like)),
                    func.lower(Caso.parte_contraria).ilike(func.lower(search_like)),
                    func.lower(Caso.tipo_acao).ilike(func.lower(search_like)),
                    func.lower(Cliente.nome_razao_social).ilike(func.lower(search_like))
                )
            )
        if data_criacao_inicio_str:
            dt_inicio = parse_date(data_criacao_inicio_str)
            if dt_inicio: query = query.filter(Caso.data_criacao >= datetime.combine(dt_inicio, datetime.min.time()))
        if data_criacao_fim_str:
            dt_fim = parse_date(data_criacao_fim_str)
            if dt_fim: query = query.filter(Caso.data_criacao <= datetime.combine(dt_fim, datetime.max.time()))
        if data_atualizacao_inicio_str:
            dt_inicio = parse_date(data_atualizacao_inicio_str)
            if dt_inicio: query = query.filter(Caso.data_atualizacao >= datetime.combine(dt_inicio, datetime.min.time()))
        if data_atualizacao_fim_str:
            dt_fim = parse_date(data_atualizacao_fim_str)
            if dt_fim: query = query.filter(Caso.data_atualizacao <= datetime.combine(dt_fim, datetime.max.time()))

        if count_only:
            total_casos = query.count()
            return jsonify({"total_casos": total_casos}), 200

        colunas_ordenaveis_caso = {
            'titulo': Caso.titulo, 'cliente_nome': Cliente.nome_razao_social, 
            'numero_processo': Caso.numero_processo, 'status': Caso.status, 
            'data_criacao': Caso.data_criacao, 'data_atualizacao': Caso.data_atualizacao, 
            'data_distribuicao': Caso.data_distribuicao, 'valor_causa': Caso.valor_causa
        }
        if sort_by in colunas_ordenaveis_caso:
            coluna_ordenacao = colunas_ordenaveis_caso[sort_by]
            if sort_order.lower() == 'desc':
                query = query.order_by(desc(coluna_ordenacao))
            else:
                query = query.order_by(asc(coluna_ordenacao))
        else:
            query = query.order_by(Caso.data_atualizacao.desc()) 

        todos_casos = query.all()
        return jsonify({"casos": [c.to_dict() for c in todos_casos]}), 200
    except Exception as e: 
        print(f"Erro ao buscar casos: {e}")
        return jsonify({"erro": "Erro ao buscar casos"}), 500

@app.route('/api/casos', methods=['POST'])
def create_caso():
    dados = request.get_json()
    if not dados or not dados.get('titulo') or not dados.get('cliente_id') or not dados.get('status'):
        return jsonify({"erro": "Dados incompletos (titulo, cliente_id, status são obrigatórios)"}), 400
    
    cliente = db.session.get(Cliente, dados['cliente_id'])
    if not cliente:
        return jsonify({"erro": f"Cliente com ID {dados['cliente_id']} não encontrado."}), 404

    novo_caso = Caso(
        cliente_id=dados['cliente_id'], titulo=dados['titulo'], status=dados['status'], 
        numero_processo=dados.get('numero_processo'), parte_contraria=dados.get('parte_contraria'), 
        adv_parte_contraria=dados.get('adv_parte_contraria'), tipo_acao=dados.get('tipo_acao'),
        vara_juizo=dados.get('vara_juizo'), comarca=dados.get('comarca'), instancia=dados.get('instancia'), 
        valor_causa=dados.get('valor_causa'), data_distribuicao=parse_date(dados.get('data_distribuicao')), 
        notas_caso=dados.get('notas_caso')
    )
    try: 
        db.session.add(novo_caso)
        db.session.commit()
        return jsonify(novo_caso.to_dict()), 201
    except Exception as e: 
        db.session.rollback()
        print(f"Erro ao criar caso: {e}")
        return jsonify({"erro": "Erro ao salvar caso"}), 500

@app.route('/api/casos/<int:id>', methods=['GET'])
def get_caso(id):
    try:
        caso = db.session.get(Caso, id)
        if caso is None:
            return jsonify({"erro": "Caso não encontrado"}), 404
        return jsonify(caso.to_dict()), 200
    except Exception as e:
        print(f"Erro ao buscar caso {id}: {e}")
        return jsonify({"erro": "Erro ao buscar caso"}), 500

@app.route('/api/casos/<int:id>', methods=['PUT'])
def update_caso(id):
    dados = request.get_json()
    if not dados: return jsonify({"erro": "Nenhum dado fornecido"}), 400
    try:
        caso = db.session.get(Caso, id)
        if caso is None:
            return jsonify({"erro": "Caso não encontrado para atualizar"}), 404
        
        caso.titulo = dados.get('titulo', caso.titulo)
        caso.status = dados.get('status', caso.status)
        caso.numero_processo = dados.get('numero_processo', caso.numero_processo)
        caso.parte_contraria = dados.get('parte_contraria', caso.parte_contraria)
        caso.adv_parte_contraria = dados.get('adv_parte_contraria', caso.adv_parte_contraria)
        caso.tipo_acao = dados.get('tipo_acao', caso.tipo_acao)
        caso.vara_juizo = dados.get('vara_juizo', caso.vara_juizo)
        caso.comarca = dados.get('comarca', caso.comarca)
        caso.instancia = dados.get('instancia', caso.instancia)
        caso.valor_causa = dados.get('valor_causa', caso.valor_causa) 
        caso.data_distribuicao = parse_date(dados.get('data_distribuicao')) if 'data_distribuicao' in dados else caso.data_distribuicao
        caso.notas_caso = dados.get('notas_caso', caso.notas_caso)
        # data_atualizacao é atualizada automaticamente
        
        db.session.commit()
        return jsonify(caso.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        print(f"Erro ao atualizar caso {id}: {e}")
        return jsonify({"erro": "Erro ao atualizar caso"}), 500

@app.route('/api/casos/<int:id>', methods=['DELETE'])
def delete_caso(id):
    try:
        caso = db.session.get(Caso, id)
        if caso is None:
            return jsonify({"erro": "Caso não encontrado para deletar"}), 404
        db.session.delete(caso)
        db.session.commit()
        return jsonify({"mensagem": f"Caso {id} deletado com sucesso"}), 200
    except Exception as e:
        db.session.rollback()
        print(f"Erro ao deletar caso {id}: {e}")
        return jsonify({"erro": "Erro ao deletar caso."}), 500

# --- Rotas para Recebimentos ---
@app.route('/api/recebimentos', methods=['GET'])
def get_recebimentos():
    try:
        cliente_id_filtro = request.args.get('cliente_id', type=int)
        caso_id_filtro = request.args.get('caso_id', type=int)
        status_filtro = request.args.get('status', type=str)
        search_term = request.args.get('search', None, type=str)
        data_vencimento_inicio_str = request.args.get('data_vencimento_inicio', None, type=str)
        data_vencimento_fim_str = request.args.get('data_vencimento_fim', None, type=str)
        data_recebimento_inicio_str = request.args.get('data_recebimento_inicio', None, type=str)
        data_recebimento_fim_str = request.args.get('data_recebimento_fim', None, type=str)
        sort_by = request.args.get('sort_by', 'data_vencimento', type=str)
        sort_order = request.args.get('sort_order', 'desc', type=str)

        query = Recebimento.query.join(Cliente, Recebimento.cliente_id == Cliente.id)\
                                 .join(Caso, Recebimento.caso_id == Caso.id)

        if cliente_id_filtro:
            query = query.filter(Recebimento.cliente_id == cliente_id_filtro)
        if caso_id_filtro:
            query = query.filter(Recebimento.caso_id == caso_id_filtro)
        if status_filtro:
            query = query.filter(Recebimento.status == status_filtro)
        if search_term:
            search_like = f"%{search_term}%"
            query = query.filter(or_(
                func.lower(Recebimento.descricao).ilike(func.lower(search_like)),
                func.lower(Recebimento.categoria).ilike(func.lower(search_like))
            ))
        if data_vencimento_inicio_str:
            dt_inicio = parse_date(data_vencimento_inicio_str)
            if dt_inicio: query = query.filter(Recebimento.data_vencimento >= dt_inicio)
        if data_vencimento_fim_str:
            dt_fim = parse_date(data_vencimento_fim_str)
            if dt_fim: query = query.filter(Recebimento.data_vencimento <= dt_fim)
        if data_recebimento_inicio_str:
            dt_inicio = parse_date(data_recebimento_inicio_str)
            if dt_inicio: query = query.filter(Recebimento.data_recebimento >= dt_inicio)
        if data_recebimento_fim_str:
            dt_fim = parse_date(data_recebimento_fim_str)
            if dt_fim: query = query.filter(Recebimento.data_recebimento <= dt_fim)

        colunas_ordenaveis_recebimento = {
            'descricao': Recebimento.descricao, 'cliente_nome': Cliente.nome_razao_social, 
            'caso_titulo': Caso.titulo, 'valor': Recebimento.valor, 
            'data_vencimento': Recebimento.data_vencimento, 'data_recebimento': Recebimento.data_recebimento,
            'status': Recebimento.status, 'categoria': Recebimento.categoria
        }
        if sort_by in colunas_ordenaveis_recebimento:
            coluna_ordenacao = colunas_ordenaveis_recebimento[sort_by]
            if sort_order.lower() == 'desc':
                query = query.order_by(desc(coluna_ordenacao))
            else:
                query = query.order_by(asc(coluna_ordenacao))
        else:
            query = query.order_by(Recebimento.data_vencimento.desc())

        todos_recebimentos = query.all()
        return jsonify({"recebimentos": [r.to_dict() for r in todos_recebimentos]}), 200
    except Exception as e: 
        print(f"Erro ao buscar recebimentos: {e}")
        return jsonify({"erro": "Erro ao buscar recebimentos"}), 500

@app.route('/api/recebimentos', methods=['POST'])
def create_recebimento():
    dados = request.get_json()
    if not dados or not dados.get('caso_id') or not dados.get('cliente_id') or not dados.get('data_vencimento') \
       or not dados.get('descricao') or not dados.get('categoria') or dados.get('valor') is None or not dados.get('status'):
        return jsonify({"erro": "Dados incompletos (caso_id, cliente_id, data_vencimento, descricao, categoria, valor, status são obrigatórios)"}), 400

    if not db.session.get(Caso, dados['caso_id']): 
        return jsonify({"erro": f"Caso com ID {dados['caso_id']} não encontrado."}), 404
    if not db.session.get(Cliente, dados['cliente_id']): 
        return jsonify({"erro": f"Cliente com ID {dados['cliente_id']} não encontrado."}), 404
        
    novo_recebimento = Recebimento(
        caso_id=dados['caso_id'], cliente_id=dados['cliente_id'], 
        data_recebimento=parse_date(dados.get('data_recebimento')), 
        data_vencimento=parse_date(dados['data_vencimento']), 
        descricao=dados['descricao'], categoria=dados['categoria'],
        valor=dados['valor'], status=dados['status'], 
        forma_pagamento=dados.get('forma_pagamento'), notas=dados.get('notas')
    )
    try: 
        db.session.add(novo_recebimento)
        db.session.commit()
        return jsonify(novo_recebimento.to_dict()), 201
    except Exception as e: 
        db.session.rollback()
        print(f"Erro ao criar recebimento: {e}")
        return jsonify({"erro": "Erro ao salvar recebimento"}), 500

@app.route('/api/recebimentos/<int:id>', methods=['GET'])
def get_recebimento(id):
    try:
        recebimento = db.session.get(Recebimento, id)
        if recebimento is None: 
            return jsonify({"erro": "Recebimento não encontrado"}), 404
        return jsonify(recebimento.to_dict()), 200
    except Exception as e: 
        print(f"Erro ao buscar recebimento {id}: {e}")
        return jsonify({"erro": "Erro ao buscar recebimento"}), 500

@app.route('/api/recebimentos/<int:id>', methods=['PUT'])
def update_recebimento(id):
    dados = request.get_json()
    if not dados: return jsonify({"erro": "Nenhum dado fornecido"}), 400
    try:
        recebimento = db.session.get(Recebimento, id)
        if recebimento is None: 
            return jsonify({"erro": "Recebimento não encontrado para atualizar"}), 404
        
        recebimento.data_recebimento = parse_date(dados.get('data_recebimento')) if 'data_recebimento' in dados else recebimento.data_recebimento
        recebimento.data_vencimento = parse_date(dados.get('data_vencimento')) if 'data_vencimento' in dados else recebimento.data_vencimento
        recebimento.descricao = dados.get('descricao', recebimento.descricao)
        recebimento.categoria = dados.get('categoria', recebimento.categoria)
        recebimento.valor = dados.get('valor', recebimento.valor)
        recebimento.status = dados.get('status', recebimento.status)
        recebimento.forma_pagamento = dados.get('forma_pagamento', recebimento.forma_pagamento)
        recebimento.notas = dados.get('notas', recebimento.notas)
        # data_atualizacao é atualizada automaticamente
        
        db.session.commit()
        return jsonify(recebimento.to_dict()), 200
    except Exception as e: 
        db.session.rollback()
        print(f"Erro ao atualizar recebimento {id}: {e}")
        return jsonify({"erro": "Erro ao atualizar recebimento"}), 500

@app.route('/api/recebimentos/<int:id>', methods=['DELETE'])
def delete_recebimento(id):
    try:
        recebimento = db.session.get(Recebimento, id)
        if recebimento is None: 
            return jsonify({"erro": "Recebimento não encontrado para deletar"}), 404
        db.session.delete(recebimento)
        db.session.commit()
        return jsonify({"mensagem": f"Recebimento {id} deletado com sucesso"}), 200
    except Exception as e: 
        db.session.rollback()
        print(f"Erro ao deletar recebimento {id}: {e}")
        return jsonify({"erro": "Erro ao deletar recebimento."}), 500

# --- Rotas para Despesas ---
@app.route('/api/despesas', methods=['GET'])
def get_despesas():
    try:
        cliente_id_filtro = request.args.get('cliente_id', type=int)
        caso_id_filtro = request.args.get('caso_id', type=int)
        status_filtro = request.args.get('status', type=str)
        search_term = request.args.get('search', None, type=str)
        data_vencimento_inicio_str = request.args.get('data_vencimento_inicio', None, type=str)
        data_vencimento_fim_str = request.args.get('data_vencimento_fim', None, type=str)
        data_despesa_inicio_str = request.args.get('data_despesa_inicio', None, type=str)
        data_despesa_fim_str = request.args.get('data_despesa_fim', None, type=str)
        sort_by = request.args.get('sort_by', 'data_vencimento', type=str)
        sort_order = request.args.get('sort_order', 'desc', type=str)

        query = Despesa.query.outerjoin(Caso, Despesa.caso_id == Caso.id)\
                             .outerjoin(Cliente, Caso.cliente_id == Cliente.id)

        if cliente_id_filtro:
            query = query.filter(Caso.cliente_id == cliente_id_filtro)
        if caso_id_filtro:
            if caso_id_filtro == -1: # Identificador para despesas gerais (sem caso)
                query = query.filter(Despesa.caso_id.is_(None))
            else:
                query = query.filter(Despesa.caso_id == caso_id_filtro)
        if status_filtro:
            query = query.filter(Despesa.status == status_filtro)
        if search_term:
            search_like = f"%{search_term}%"
            query = query.filter(or_(
                func.lower(Despesa.descricao).ilike(func.lower(search_like)),
                func.lower(Despesa.categoria).ilike(func.lower(search_like))
            ))
        if data_vencimento_inicio_str:
            dt_inicio = parse_date(data_vencimento_inicio_str)
            if dt_inicio: query = query.filter(Despesa.data_vencimento >= dt_inicio)
        if data_vencimento_fim_str:
            dt_fim = parse_date(data_vencimento_fim_str)
            if dt_fim: query = query.filter(Despesa.data_vencimento <= dt_fim)
        if data_despesa_inicio_str:
            dt_inicio = parse_date(data_despesa_inicio_str)
            if dt_inicio: query = query.filter(Despesa.data_despesa >= dt_inicio)
        if data_despesa_fim_str:
            dt_fim = parse_date(data_despesa_fim_str)
            if dt_fim: query = query.filter(Despesa.data_despesa <= dt_fim)
        
        colunas_ordenaveis_despesa = {
            'descricao': Despesa.descricao, 'caso_titulo': Caso.titulo, 
            'valor': Despesa.valor, 'data_vencimento': Despesa.data_vencimento, 
            'data_despesa': Despesa.data_despesa, 'status': Despesa.status, 
            'categoria': Despesa.categoria
        }
        if sort_by in colunas_ordenaveis_despesa:
            coluna_ordenacao = colunas_ordenaveis_despesa[sort_by]
            if sort_order.lower() == 'desc':
                query = query.order_by(desc(coluna_ordenacao))
            else:
                query = query.order_by(asc(coluna_ordenacao))
        else:
            query = query.order_by(Despesa.data_vencimento.desc())

        todas_despesas = query.all()
        return jsonify({"despesas": [d.to_dict() for d in todas_despesas]}), 200
    except Exception as e: 
        print(f"Erro ao buscar despesas: {e}")
        return jsonify({"erro": "Erro ao buscar despesas"}), 500

@app.route('/api/despesas', methods=['POST'])
def create_despesa():
    dados = request.get_json()
    if not dados or not dados.get('data_vencimento') or not dados.get('descricao') \
       or not dados.get('categoria') or dados.get('valor') is None or not dados.get('status'):
        return jsonify({"erro": "Dados incompletos (data_vencimento, descricao, categoria, valor, status são obrigatórios)"}), 400
    
    caso_id = dados.get('caso_id')
    if caso_id and not db.session.get(Caso, caso_id):
        return jsonify({"erro": f"Caso com ID {caso_id} não encontrado."}), 404

    nova_despesa = Despesa(
        caso_id=caso_id if caso_id else None, 
        data_despesa=parse_date(dados.get('data_despesa')), 
        data_vencimento=parse_date(dados['data_vencimento']), 
        descricao=dados['descricao'], categoria=dados['categoria'], valor=dados['valor'], status=dados['status'],
        forma_pagamento=dados.get('forma_pagamento'), notas=dados.get('notas')
    )
    try: 
        db.session.add(nova_despesa)
        db.session.commit()
        return jsonify(nova_despesa.to_dict()), 201
    except Exception as e: 
        db.session.rollback()
        print(f"Erro ao criar despesa: {e}")
        return jsonify({"erro": "Erro ao salvar despesa"}), 500

@app.route('/api/despesas/<int:id>', methods=['GET'])
def get_despesa(id):
    try:
        despesa = db.session.get(Despesa, id)
        if despesa is None: 
            return jsonify({"erro": "Despesa não encontrada"}), 404
        return jsonify(despesa.to_dict()), 200
    except Exception as e: 
        print(f"Erro ao buscar despesa {id}: {e}")
        return jsonify({"erro": "Erro ao buscar despesa"}), 500

@app.route('/api/despesas/<int:id>', methods=['PUT'])
def update_despesa(id):
    dados = request.get_json()
    if not dados: return jsonify({"erro": "Nenhum dado fornecido"}), 400
    try:
        despesa = db.session.get(Despesa, id)
        if despesa is None: 
            return jsonify({"erro": "Despesa não encontrada para atualizar"}), 404
        
        despesa.caso_id = dados.get('caso_id', despesa.caso_id) 
        despesa.data_despesa = parse_date(dados.get('data_despesa')) if 'data_despesa' in dados else despesa.data_despesa
        despesa.data_vencimento = parse_date(dados.get('data_vencimento')) if 'data_vencimento' in dados else despesa.data_vencimento
        despesa.descricao = dados.get('descricao', despesa.descricao)
        despesa.categoria = dados.get('categoria', despesa.categoria)
        despesa.valor = dados.get('valor', despesa.valor)
        despesa.status = dados.get('status', despesa.status)
        despesa.forma_pagamento = dados.get('forma_pagamento', despesa.forma_pagamento)
        despesa.notas = dados.get('notas', despesa.notas)
        # data_atualizacao é atualizada automaticamente
        
        db.session.commit()
        return jsonify(despesa.to_dict()), 200
    except Exception as e: 
        db.session.rollback()
        print(f"Erro ao atualizar despesa {id}: {e}")
        return jsonify({"erro": "Erro ao atualizar despesa"}), 500

@app.route('/api/despesas/<int:id>', methods=['DELETE'])
def delete_despesa(id):
    try:
        despesa = db.session.get(Despesa, id)
        if despesa is None: 
            return jsonify({"erro": "Despesa não encontrada para deletar"}), 404
        db.session.delete(despesa)
        db.session.commit()
        return jsonify({"mensagem": f"Despesa {id} deletada com sucesso"}), 200
    except Exception as e: 
        db.session.rollback()
        print(f"Erro ao deletar despesa {id}: {e}")
        return jsonify({"erro": "Erro ao deletar despesa."}), 500

# --- Rotas para Eventos da Agenda ---
@app.route('/api/eventos', methods=['GET'])
def get_eventos():
    try:
        cliente_id_filtro = request.args.get('cliente_id', type=int)
        caso_id_filtro = request.args.get('caso_id', type=int)
        data_inicio_filtro_str = request.args.get('start')
        data_fim_filtro_str = request.args.get('end')     
        status_concluido_str = request.args.get('concluido', type=str) 
        tipo_evento_filtro = request.args.get('tipo_evento', type=str)
        search_term = request.args.get('search', None, type=str)

        limit = request.args.get('limit', type=int)          
        sort_by = request.args.get('sort_by', 'data_inicio', type=str)
        sort_order = request.args.get('sort_order', 'asc', type=str)

        query = EventoAgenda.query.outerjoin(Caso, EventoAgenda.caso_id == Caso.id)\
                                 .outerjoin(Cliente, Caso.cliente_id == Cliente.id)

        if cliente_id_filtro:
             query = query.filter(Caso.cliente_id == cliente_id_filtro)
        if caso_id_filtro: 
            if caso_id_filtro == -1: # Para eventos sem caso associado
                 query = query.filter(EventoAgenda.caso_id.is_(None))
            else:
                query = query.filter(EventoAgenda.caso_id == caso_id_filtro)
        if tipo_evento_filtro:
            query = query.filter(EventoAgenda.tipo_evento == tipo_evento_filtro)
        if status_concluido_str is not None:
            if status_concluido_str.lower() == 'true':
                query = query.filter(EventoAgenda.concluido == True)
            elif status_concluido_str.lower() == 'false':
                 query = query.filter(EventoAgenda.concluido == False)
        if search_term:
            search_like = f"%{search_term}%"
            query = query.filter(or_(
                func.lower(EventoAgenda.titulo).ilike(func.lower(search_like)),
                func.lower(EventoAgenda.descricao).ilike(func.lower(search_like))
            ))
        if data_inicio_filtro_str: 
            dt_inicio = parse_datetime(data_inicio_filtro_str)
            if dt_inicio: query = query.filter(EventoAgenda.data_inicio >= dt_inicio)
        if data_fim_filtro_str: 
            dt_fim = parse_datetime(data_fim_filtro_str)
            if dt_fim: query = query.filter(EventoAgenda.data_inicio <= dt_fim) 
        
        colunas_ordenaveis_evento = {
            'data_inicio': EventoAgenda.data_inicio, 'titulo': EventoAgenda.titulo,
            'tipo_evento': EventoAgenda.tipo_evento, 'concluido': EventoAgenda.concluido,
            'caso_titulo': Caso.titulo, 'cliente_nome': Cliente.nome_razao_social
        }
        if sort_by in colunas_ordenaveis_evento:
            coluna_ordenacao = colunas_ordenaveis_evento[sort_by]
            if sort_order.lower() == 'desc':
                query = query.order_by(desc(coluna_ordenacao))
            else:
                query = query.order_by(asc(coluna_ordenacao))
        else:
            query = query.order_by(EventoAgenda.data_inicio.asc())
        
        if limit: 
            query = query.limit(limit)
            
        todos_eventos = query.all()
        return jsonify({"eventos": [e.to_dict() for e in todos_eventos]}), 200
    except Exception as e: 
        print(f"Erro ao buscar eventos: {e}")
        return jsonify({"erro": "Erro ao buscar eventos"}), 500

@app.route('/api/eventos', methods=['POST'])
def create_evento():
    dados = request.get_json()
    if not dados or not dados.get('tipo_evento') or not dados.get('titulo') or not dados.get('data_inicio'):
        return jsonify({"erro": "Dados incompletos (tipo_evento, titulo, data_inicio são obrigatórios)"}), 400
    
    caso_id = dados.get('caso_id')
    if caso_id and not db.session.get(Caso, caso_id):
        return jsonify({"erro": f"Caso com ID {caso_id} não encontrado."}), 404

    data_inicio_dt = parse_datetime(dados['data_inicio'])
    data_fim_dt = parse_datetime(dados.get('data_fim'))

    if not data_inicio_dt:
        return jsonify({"erro": "Formato inválido para data_inicio (use ISO 8601)"}), 400
    if dados.get('data_fim') and not data_fim_dt: 
        return jsonify({"erro": "Formato inválido para data_fim (use ISO 8601)"}), 400

    novo_evento = EventoAgenda(
        caso_id=caso_id if caso_id else None, 
        tipo_evento=dados['tipo_evento'], 
        titulo=dados['titulo'],
        descricao=dados.get('descricao'), 
        data_inicio=data_inicio_dt, 
        data_fim=data_fim_dt,
        local=dados.get('local'), 
        concluido=dados.get('concluido', False)
    )
    try: 
        db.session.add(novo_evento)
        db.session.commit()
        return jsonify(novo_evento.to_dict()), 201
    except Exception as e: 
        db.session.rollback()
        print(f"Erro ao criar evento: {e}")
        return jsonify({"erro": "Erro ao salvar evento"}), 500

@app.route('/api/eventos/<int:id>', methods=['GET'])
def get_evento(id):
    try:
        evento = db.session.get(EventoAgenda, id)
        if evento is None: 
            return jsonify({"erro": "Evento não encontrado"}), 404
        return jsonify(evento.to_dict()), 200
    except Exception as e: 
        print(f"Erro ao buscar evento {id}: {e}")
        return jsonify({"erro": "Erro ao buscar evento"}), 500

@app.route('/api/eventos/<int:id>', methods=['PUT'])
def update_evento(id):
    dados = request.get_json()
    if not dados: return jsonify({"erro": "Nenhum dado fornecido"}), 400
    try:
        evento = db.session.get(EventoAgenda, id)
        if evento is None: 
            return jsonify({"erro": "Evento não encontrado para atualizar"}), 404
        
        data_inicio_dt = parse_datetime(dados.get('data_inicio')) if 'data_inicio' in dados else evento.data_inicio
        data_fim_dt = parse_datetime(dados.get('data_fim')) if 'data_fim' in dados else evento.data_fim
        
        if 'data_inicio' in dados and not data_inicio_dt: return jsonify({"erro": "Formato inválido para data_inicio"}), 400
        if 'data_fim' in dados and dados.get('data_fim') and not data_fim_dt: return jsonify({"erro": "Formato inválido para data_fim"}), 400

        evento.caso_id = dados.get('caso_id', evento.caso_id) 
        evento.tipo_evento = dados.get('tipo_evento', evento.tipo_evento)
        evento.titulo = dados.get('titulo', evento.titulo)
        evento.descricao = dados.get('descricao', evento.descricao)
        evento.data_inicio = data_inicio_dt
        evento.data_fim = data_fim_dt
        evento.local = dados.get('local', evento.local)
        evento.concluido = dados.get('concluido', evento.concluido)
        # data_atualizacao é atualizada automaticamente
        
        db.session.commit()
        return jsonify(evento.to_dict()), 200
    except Exception as e: 
        db.session.rollback()
        print(f"Erro ao atualizar evento {id}: {e}")
        return jsonify({"erro": "Erro ao atualizar evento"}), 500

@app.route('/api/eventos/<int:id>', methods=['DELETE'])
def delete_evento(id):
    try:
        evento = db.session.get(EventoAgenda, id)
        if evento is None: 
            return jsonify({"erro": "Evento não encontrado para deletar"}), 404
        db.session.delete(evento)
        db.session.commit()
        return jsonify({"mensagem": f"Evento {id} deletado com sucesso"}), 200
    except Exception as e: 
        db.session.rollback()
        print(f"Erro ao deletar evento {id}: {e}")
        return jsonify({"erro": "Erro ao deletar evento."}), 500

# --- ROTAS DE RELATÓRIOS ---
@app.route('/api/relatorios/contas-a-receber', methods=['GET'])
def get_contas_a_receber():
    try:
        contas = Recebimento.query.filter(
            or_(Recebimento.status == 'Pendente', Recebimento.status == 'Vencido')
        ).order_by(Recebimento.data_vencimento.asc()).all()
        
        resultado = [r.to_dict() for r in contas]
        total_geral = sum(float(r['valor']) for r in resultado if r['valor'] is not None)

        return jsonify({ "items": resultado, "total_geral": total_geral, "quantidade_items": len(resultado) }), 200
    except Exception as e:
        print(f"Erro ao buscar contas a receber: {e}")
        return jsonify({"erro": "Erro ao buscar contas a receber"}), 500

@app.route('/api/relatorios/contas-a-pagar', methods=['GET'])
def get_contas_a_pagar():
    try:
        contas = Despesa.query.filter(
            or_(Despesa.status == 'A Pagar', Despesa.status == 'Vencida')
        ).order_by(Despesa.data_vencimento.asc()).all()
        
        resultado = [d.to_dict() for d in contas]
        total_geral = sum(float(d['valor']) for d in resultado if d['valor'] is not None)

        return jsonify({ "items": resultado, "total_geral": total_geral, "quantidade_items": len(resultado) }), 200
    except Exception as e:
        print(f"Erro ao buscar contas a pagar: {e}")
        return jsonify({"erro": "Erro ao buscar contas a pagar"}), 500

# --- ROTAS PARA DOCUMENTOS ---
def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/api/documentos/upload', methods=['POST'])
def upload_documento():
    if 'file' not in request.files:
        return jsonify({"erro": "Nenhum arquivo enviado"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"erro": "Nenhum arquivo selecionado"}), 400

    if file and allowed_file(file.filename):
        filename_original = secure_filename(file.filename)
        timestamp = datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f') # Corrigido
        filename_armazenado = f"{timestamp}_{filename_original}"
        caminho_arquivo = os.path.join(app.config['UPLOAD_FOLDER'], filename_armazenado)
        
        try:
            file.save(caminho_arquivo)
            cliente_id = request.form.get('cliente_id', type=int)
            caso_id = request.form.get('caso_id', type=int)
            descricao = request.form.get('descricao', '')

            novo_documento = Documento(
                cliente_id=cliente_id if cliente_id else None,
                caso_id=caso_id if caso_id else None,
                nome_original_arquivo=filename_original,
                nome_armazenado=filename_armazenado,
                tipo_mime=file.mimetype,
                tamanho_bytes=os.path.getsize(caminho_arquivo),
                descricao=descricao
            )
            db.session.add(novo_documento)
            db.session.commit()
            return jsonify(novo_documento.to_dict()), 201
        except Exception as e:
            db.session.rollback()
            if os.path.exists(caminho_arquivo):
                os.remove(caminho_arquivo)
            print(f"Erro ao salvar documento: {e}")
            return jsonify({"erro": "Erro ao salvar documento"}), 500
    else:
        return jsonify({"erro": "Tipo de arquivo não permitido"}), 400

@app.route('/api/documentos', methods=['GET'])
def get_documentos():
    try:
        cliente_id_filtro = request.args.get('cliente_id', type=int)
        caso_id_filtro = request.args.get('caso_id', type=int)
        search_term = request.args.get('search', None, type=str)
        sort_by = request.args.get('sort_by', 'data_upload', type=str)
        sort_order = request.args.get('sort_order', 'desc', type=str)
        
        query = Documento.query.outerjoin(Cliente, Documento.cliente_id == Cliente.id)\
                               .outerjoin(Caso, Documento.caso_id == Caso.id)
        if cliente_id_filtro:
            query = query.filter(Documento.cliente_id == cliente_id_filtro)
        if caso_id_filtro:
            if caso_id_filtro == -1: # Para documentos sem caso
                query = query.filter(Documento.caso_id.is_(None))
            else:
                query = query.filter(Documento.caso_id == caso_id_filtro)

        if search_term:
            search_like = f"%{search_term}%"
            query = query.filter(or_(
                func.lower(Documento.nome_original_arquivo).ilike(func.lower(search_like)),
                func.lower(Documento.descricao).ilike(func.lower(search_like))
            ))
        
        colunas_ordenaveis_doc = {
            'nome_original_arquivo': Documento.nome_original_arquivo,
            'descricao': Documento.descricao,
            'data_upload': Documento.data_upload,
            'tamanho_bytes': Documento.tamanho_bytes,
            'cliente_nome': Cliente.nome_razao_social, 
            'caso_titulo': Caso.titulo 
        }

        coluna_ordenacao_obj = None
        if sort_by in colunas_ordenaveis_doc:
            coluna_ordenacao_obj = colunas_ordenaveis_doc[sort_by]
        elif hasattr(Documento, sort_by): 
             coluna_ordenacao_obj = getattr(Documento, sort_by)

        if coluna_ordenacao_obj is not None:
            if sort_order.lower() == 'desc':
                query = query.order_by(desc(coluna_ordenacao_obj))
            else:
                query = query.order_by(asc(coluna_ordenacao_obj))
        else:
             query = query.order_by(Documento.data_upload.desc())
        
        todos_documentos = query.all()
        return jsonify({"documentos": [d.to_dict() for d in todos_documentos]}), 200
    except Exception as e:
        print(f"Erro ao buscar documentos: {e}")
        return jsonify({"erro": "Erro ao buscar documentos"}), 500

@app.route('/api/documentos/download/<path:nome_armazenado>', methods=['GET'])
def download_documento(nome_armazenado):
    try:
        safe_nome_armazenado = secure_filename(nome_armazenado)
        if safe_nome_armazenado != nome_armazenado:
             return jsonify({"erro": "Nome de arquivo inválido"}), 400

        doc_metadata = Documento.query.filter_by(nome_armazenado=safe_nome_armazenado).first()
        if not doc_metadata:
            return jsonify({"erro": "Metadados do documento não encontrados"}), 404
        
        caminho_completo = os.path.join(app.config['UPLOAD_FOLDER'], safe_nome_armazenado)
        if not os.path.exists(caminho_completo):
            return jsonify({"erro": "Arquivo físico não encontrado no servidor"}), 404
            
        return send_from_directory(
            directory=app.config['UPLOAD_FOLDER'], 
            path=safe_nome_armazenado, 
            as_attachment=True, 
            download_name=doc_metadata.nome_original_arquivo
        )
    except Exception as e:
        print(f"Erro ao baixar documento {nome_armazenado}: {e}")
        return jsonify({"erro": "Erro ao baixar documento"}), 500

@app.route('/api/documentos/<int:id>', methods=['PUT']) 
def update_documento_metadados(id):
    dados = request.get_json()
    if not dados:
        return jsonify({"erro": "Nenhum dado fornecido para atualização"}), 400
    try:
        documento = db.session.get(Documento, id)
        if not documento:
            return jsonify({"erro": "Documento não encontrado"}), 404

        documento.descricao = dados.get('descricao', documento.descricao)
        documento.cliente_id = dados.get('cliente_id') if 'cliente_id' in dados else documento.cliente_id 
        documento.caso_id = dados.get('caso_id') if 'caso_id' in dados else documento.caso_id 
        
        if documento.cliente_id and not db.session.get(Cliente, documento.cliente_id):
            return jsonify({"erro": f"Cliente com ID {documento.cliente_id} não encontrado."}), 404
        if documento.caso_id and not db.session.get(Caso, documento.caso_id):
            return jsonify({"erro": f"Caso com ID {documento.caso_id} não encontrado."}), 404

        # data_atualizacao não existe no modelo Documento, mas data_upload é default=utcnow
        db.session.commit()
        return jsonify(documento.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        print(f"Erro ao atualizar metadados do documento {id}: {e}")
        return jsonify({"erro": "Erro ao atualizar metadados do documento"}), 500


@app.route('/api/documentos/<int:id>', methods=['DELETE'])
def delete_documento(id):
    try:
        documento = db.session.get(Documento, id)
        if not documento:
            return jsonify({"erro": "Documento não encontrado"}), 404
        
        caminho_arquivo = os.path.join(app.config['UPLOAD_FOLDER'], documento.nome_armazenado)
        
        db.session.delete(documento) 
        
        if os.path.exists(caminho_arquivo):
            try:
                os.remove(caminho_arquivo)
            except Exception as e_file:
                print(f"Erro ao deletar arquivo físico {documento.nome_armazenado}: {e_file}")
        
        db.session.commit()
        return jsonify({"mensagem": f"Documento ID {id} e arquivo associado deletados com sucesso"}), 200
    except Exception as e:
        db.session.rollback()
        print(f"Erro ao deletar documento {id}: {e}")
        return jsonify({"erro": "Erro ao deletar registro do documento"}), 500

# --- Ponto de Entrada ---
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000)) 
    app.run(host='0.0.0.0', port=port, debug=True)
