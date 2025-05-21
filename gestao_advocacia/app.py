# CAMINHO: gestao_advocacia/app.py
# Backend Flask para a aplicação de Gestão de Advocacia

from flask import Flask, jsonify, request, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
import config # Importa as configurações de config.py
import os
from datetime import datetime, date, timezone # Importa timezone para datetime objects conscientes
from sqlalchemy import or_, asc, desc, func # Utilitários do SQLAlchemy
from werkzeug.utils import secure_filename # Para segurança no nome de arquivos de upload

# Inicialização da Aplicação Flask
app = Flask(__name__)
# Carrega as configurações da classe Config dentro do arquivo config.py
app.config.from_object(config.Config)

# Configuração para Upload de Arquivos
# UPLOAD_FOLDER já é definido em config.Config e carregado acima.
# A criação da pasta é melhor feita aqui para garantir que 'app.root_path' está correto.
if not os.path.exists(app.config['UPLOAD_FOLDER']):
    try:
        os.makedirs(app.config['UPLOAD_FOLDER'])
        print(f"Pasta de uploads criada em: {app.config['UPLOAD_FOLDER']}")
    except Exception as e:
        print(f"Erro ao criar pasta de uploads {app.config['UPLOAD_FOLDER']}: {e}")

# Habilita CORS para permitir requisições do frontend (React/Vite)
CORS(app, resources={r"/api/*": {"origins": "*"}}) # Permite todas as origens para /api/* em desenvolvimento. Ajuste para produção.

# Inicializa o SQLAlchemy para interação com o banco de dados
db = SQLAlchemy(app)
# Inicializa o Flask-Migrate para gerenciar as migrações do banco de dados
migrate = Migrate(app, db)

# --- Modelos do Banco de Dados (SQLAlchemy Models) ---
# (Os modelos que você forneceu estão aqui. Eles parecem corretos.)

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
    data_criacao = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    data_atualizacao = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
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
    data_criacao = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    data_atualizacao = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
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
    data_criacao = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    data_atualizacao = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

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
    data_criacao = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    data_atualizacao = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

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
    data_criacao = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    data_atualizacao = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

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
    data_upload = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    
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
    """Converte uma string de data ISO para um objeto date."""
    if not date_string: return None
    try: return date.fromisoformat(date_string)
    except (ValueError, TypeError): return None

def parse_datetime(datetime_string):
    """Converte uma string de datetime ISO (com ou sem Z/offset) para um objeto datetime."""
    if not datetime_string: return None
    try:
        # Remove 'Z' e trata como UTC se presente, ou lida com outros formatos ISO
        dt_str = datetime_string.replace('Z', '+00:00')
        return datetime.fromisoformat(dt_str)
    except (ValueError, TypeError):
        # Tenta formatos alternativos se fromisoformat falhar
        for fmt in ('%Y-%m-%dT%H:%M:%S.%f', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S', '%Y-%m-%d'):
            try:
                dt_obj = datetime.strptime(datetime_string, fmt)
                # Se for apenas data, converte para datetime com hora 00:00:00 e torna timezone-aware (UTC)
                if fmt == '%Y-%m-%d':
                    return datetime.combine(dt_obj.date(), datetime.min.time(), tzinfo=timezone.utc)
                # Se for datetime sem timezone, assume UTC
                if dt_obj.tzinfo is None:
                    return dt_obj.replace(tzinfo=timezone.utc)
                return dt_obj
            except (ValueError, TypeError):
                continue
        print(f"Alerta: Falha ao parsear datetime: {datetime_string} com formatos conhecidos.")
        return None

# --- Rotas da API (Endpoints) ---
@app.route('/')
def index():
    return jsonify({"message": "API de Gestão para Advocacia está no ar!"})

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
            # Usar func.lower para busca case-insensitive no PostgreSQL
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
        app.logger.error(f"Erro em get_clientes: {e}", exc_info=True)
        return jsonify({"erro": "Erro ao buscar clientes"}), 500

@app.route('/api/clientes', methods=['POST'])
def create_cliente():
    dados = request.get_json()
    if not dados:
        return jsonify({"erro": "Nenhum dado recebido"}), 400

    # Validação de campos obrigatórios
    campos_obrigatorios = ['nome_razao_social', 'cpf_cnpj', 'tipo_pessoa']
    for campo in campos_obrigatorios:
        if not dados.get(campo):
            return jsonify({"erro": f"Campo '{campo}' é obrigatório."}), 400
    
    cpf_cnpj_formatado = dados['cpf_cnpj'] # Assumindo que o frontend já envia formatado ou sem formatação
    
    # Verifica se o CPF/CNPJ já existe (case-insensitive para evitar duplicidade por formatação)
    cliente_existente = Cliente.query.filter(func.lower(Cliente.cpf_cnpj) == func.lower(cpf_cnpj_formatado)).first()
    if cliente_existente:
        return jsonify({"erro": f"Cliente com CPF/CNPJ {cpf_cnpj_formatado} já existe."}), 409 # 409 Conflict
    
    try:
        novo_cliente = Cliente(
            nome_razao_social=dados['nome_razao_social'],
            cpf_cnpj=cpf_cnpj_formatado,
            tipo_pessoa=dados['tipo_pessoa'],
            rg=dados.get('rg'),
            orgao_emissor=dados.get('orgao_emissor'),
            data_nascimento=parse_date(dados.get('data_nascimento')),
            estado_civil=dados.get('estado_civil'),
            profissao=dados.get('profissao'),
            nacionalidade=dados.get('nacionalidade'),
            nome_fantasia=dados.get('nome_fantasia'),
            nire=dados.get('nire'),
            inscricao_estadual=dados.get('inscricao_estadual'),
            inscricao_municipal=dados.get('inscricao_municipal'),
            cep=dados.get('cep'),
            rua=dados.get('rua'),
            numero=dados.get('numero'),
            bairro=dados.get('bairro'),
            cidade=dados.get('cidade'),
            estado=dados.get('estado'),
            pais=dados.get('pais', 'Brasil'),
            telefone=dados.get('telefone'),
            email=dados.get('email'),
            notas_gerais=dados.get('notas_gerais')
            # data_criacao e data_atualizacao são definidos por default/onupdate
        )
        db.session.add(novo_cliente)
        db.session.commit()
        return jsonify(novo_cliente.to_dict()), 201 # 201 Created
    except Exception as e:
        db.session.rollback()
        print(f"Erro ao criar cliente: {e}")
        app.logger.error(f"Erro em create_cliente: {e}", exc_info=True)
        return jsonify({"erro": "Erro interno ao salvar cliente no banco de dados."}), 500

@app.route('/api/clientes/<int:id>', methods=['GET'])
def get_cliente(id):
    try:
        cliente = db.session.get(Cliente, id)
        if cliente is None:
            return jsonify({"erro": "Cliente não encontrado"}), 404
        return jsonify(cliente.to_dict()), 200
    except Exception as e:
        print(f"Erro ao buscar cliente {id}: {e}")
        app.logger.error(f"Erro em get_cliente(id={id}): {e}", exc_info=True)
        return jsonify({"erro": "Erro interno ao buscar cliente"}), 500

@app.route('/api/clientes/<int:id>', methods=['PUT'])
def update_cliente(id):
    dados = request.get_json()
    if not dados: return jsonify({"erro": "Nenhum dado fornecido para atualização"}), 400
    try:
        cliente = db.session.get(Cliente, id)
        if cliente is None:
            return jsonify({"erro": "Cliente não encontrado para atualizar"}), 404
        
        # Atualiza os campos fornecidos
        for key, value in dados.items():
            if hasattr(cliente, key):
                if key == 'data_nascimento':
                    setattr(cliente, key, parse_date(value))
                # Adicionar parse para outros campos de data/datetime se necessário
                else:
                    setattr(cliente, key, value)
        
        # data_atualizacao é atualizada automaticamente pelo onupdate no modelo
        db.session.commit()
        return jsonify(cliente.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        print(f"Erro ao atualizar cliente {id}: {e}")
        app.logger.error(f"Erro em update_cliente(id={id}): {e}", exc_info=True)
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
        app.logger.error(f"Erro em delete_cliente(id={id}): {e}", exc_info=True)
        # Verifica se o erro é de violação de chave estrangeira (ex: cliente tem casos)
        if "violates foreign key constraint" in str(e).lower() or "FOREIGN KEY constraint failed" in str(e): # SQLite usa outra msg
            return jsonify({"erro": "Não é possível deletar o cliente pois existem registros (casos, recebimentos, etc.) associados a ele."}), 409 # 409 Conflict
        return jsonify({"erro": "Erro ao deletar cliente."}), 500

# --- Rotas para Casos ---
# (As rotas de Casos, Recebimentos, Despesas, Eventos, Documentos, Relatórios seguem o mesmo padrão)
# (O código completo para elas está no app.py que você forneceu anteriormente)
# Vou incluir a rota GET /api/casos como exemplo de como as outras devem ser
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

        query = Caso.query.join(Cliente, Caso.cliente_id == Cliente.id) # Join para poder ordenar/filtrar por nome do cliente

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
                    func.lower(Cliente.nome_razao_social).ilike(func.lower(search_like)) # Busca no nome do cliente
                )
            )
        if data_criacao_inicio_str:
            dt_inicio = parse_date(data_criacao_inicio_str)
            if dt_inicio: query = query.filter(Caso.data_criacao >= datetime.combine(dt_inicio, datetime.min.time(), tzinfo=timezone.utc))
        if data_criacao_fim_str:
            dt_fim = parse_date(data_criacao_fim_str)
            if dt_fim: query = query.filter(Caso.data_criacao <= datetime.combine(dt_fim, datetime.max.time(), tzinfo=timezone.utc))
        if data_atualizacao_inicio_str:
            dt_inicio = parse_date(data_atualizacao_inicio_str)
            if dt_inicio: query = query.filter(Caso.data_atualizacao >= datetime.combine(dt_inicio, datetime.min.time(), tzinfo=timezone.utc))
        if data_atualizacao_fim_str:
            dt_fim = parse_date(data_atualizacao_fim_str)
            if dt_fim: query = query.filter(Caso.data_atualizacao <= datetime.combine(dt_fim, datetime.max.time(), tzinfo=timezone.utc))

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
        app.logger.error(f"Erro em get_casos: {e}", exc_info=True)
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
        app.logger.error(f"Erro em create_caso: {e}", exc_info=True)
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
        app.logger.error(f"Erro em get_caso(id={id}): {e}", exc_info=True)
        return jsonify({"erro": "Erro ao buscar caso"}), 500

@app.route('/api/casos/<int:id>', methods=['PUT'])
def update_caso(id):
    dados = request.get_json()
    if not dados: return jsonify({"erro": "Nenhum dado fornecido"}), 400
    try:
        caso = db.session.get(Caso, id)
        if caso is None:
            return jsonify({"erro": "Caso não encontrado para atualizar"}), 404
        
        for key, value in dados.items():
            if hasattr(caso, key):
                if key == 'data_distribuicao':
                    setattr(caso, key, parse_date(value))
                # Adicionar parse para outros campos de data/datetime se necessário
                else:
                    setattr(caso, key, value)
        
        db.session.commit()
        return jsonify(caso.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        print(f"Erro ao atualizar caso {id}: {e}")
        app.logger.error(f"Erro em update_caso(id={id}): {e}", exc_info=True)
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
        app.logger.error(f"Erro em delete_caso(id={id}): {e}", exc_info=True)
        return jsonify({"erro": "Erro ao deletar caso."}), 500

# --- Rotas para Recebimentos ---
# (As rotas para Recebimentos, Despesas, Eventos, Documentos, Relatórios
#  seguem o mesmo padrão das rotas de Clientes e Casos,
#  com as devidas adaptações para os campos e filtros específicos de cada modelo.
#  O código completo que você forneceu anteriormente para estas rotas está correto
#  e deve ser mantido aqui.)

# Exemplo para Recebimentos (GET) - As outras (POST, PUT, DELETE) seriam similares
@app.route('/api/recebimentos', methods=['GET'])
def get_recebimentos():
    try:
        cliente_id_filtro = request.args.get('cliente_id', type=int)
        caso_id_filtro = request.args.get('caso_id', type=int)
        status_filtro = request.args.get('status', type=str)
        search_term = request.args.get('search', None, type=str)
        # Adicionar filtros de data se necessário
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
        # Adicionar lógica de filtro por data aqui

        colunas_ordenaveis = {
            'descricao': Recebimento.descricao, 'cliente_nome': Cliente.nome_razao_social, 
            'caso_titulo': Caso.titulo, 'valor': Recebimento.valor, 
            'data_vencimento': Recebimento.data_vencimento, 'data_recebimento': Recebimento.data_recebimento,
            'status': Recebimento.status, 'categoria': Recebimento.categoria
        }
        if sort_by in colunas_ordenaveis:
            coluna_ordenacao = colunas_ordenaveis[sort_by]
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
        app.logger.error(f"Erro em get_recebimentos: {e}", exc_info=True)
        return jsonify({"erro": "Erro ao buscar recebimentos"}), 500

@app.route('/api/recebimentos', methods=['POST'])
def create_recebimento():
    dados = request.get_json()
    if not dados or not dados.get('caso_id') or not dados.get('cliente_id') or not dados.get('data_vencimento') \
       or not dados.get('descricao') or not dados.get('categoria') or dados.get('valor') is None or not dados.get('status'):
        return jsonify({"erro": "Dados incompletos"}), 400

    if not db.session.get(Cliente, dados['cliente_id']): 
        return jsonify({"erro": f"Cliente com ID {dados['cliente_id']} não encontrado."}), 404
    if not db.session.get(Caso, dados['caso_id']): 
        return jsonify({"erro": f"Caso com ID {dados['caso_id']} não encontrado."}), 404
            
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
        app.logger.error(f"Erro em create_recebimento: {e}", exc_info=True)
        return jsonify({"erro": "Erro ao salvar recebimento"}), 500

# ... (Implementar PUT e DELETE para Recebimentos de forma similar)
@app.route('/api/recebimentos/<int:id>', methods=['PUT'])
def update_recebimento(id):
    dados = request.get_json()
    if not dados: return jsonify({"erro": "Nenhum dado fornecido"}), 400
    try:
        recebimento = db.session.get(Recebimento, id)
        if recebimento is None: 
            return jsonify({"erro": "Recebimento não encontrado para atualizar"}), 404
        
        # Validações de FKs se forem alteradas
        if 'cliente_id' in dados and dados['cliente_id'] != recebimento.cliente_id:
            if not db.session.get(Cliente, dados['cliente_id']):
                return jsonify({"erro": f"Novo Cliente com ID {dados['cliente_id']} não encontrado."}), 404
            recebimento.cliente_id = dados['cliente_id']
        
        if 'caso_id' in dados and dados['caso_id'] != recebimento.caso_id:
            if not db.session.get(Caso, dados['caso_id']):
                return jsonify({"erro": f"Novo Caso com ID {dados['caso_id']} não encontrado."}), 404
            recebimento.caso_id = dados['caso_id']

        recebimento.data_recebimento = parse_date(dados.get('data_recebimento', str(recebimento.data_recebimento) if recebimento.data_recebimento else None))
        recebimento.data_vencimento = parse_date(dados.get('data_vencimento', str(recebimento.data_vencimento)))
        recebimento.descricao = dados.get('descricao', recebimento.descricao)
        recebimento.categoria = dados.get('categoria', recebimento.categoria)
        recebimento.valor = dados.get('valor', recebimento.valor)
        recebimento.status = dados.get('status', recebimento.status)
        recebimento.forma_pagamento = dados.get('forma_pagamento', recebimento.forma_pagamento)
        recebimento.notas = dados.get('notas', recebimento.notas)
        
        db.session.commit()
        return jsonify(recebimento.to_dict()), 200
    except Exception as e: 
        db.session.rollback()
        print(f"Erro ao atualizar recebimento {id}: {e}")
        app.logger.error(f"Erro em update_recebimento(id={id}): {e}", exc_info=True)
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
        app.logger.error(f"Erro em delete_recebimento(id={id}): {e}", exc_info=True)
        return jsonify({"erro": "Erro ao deletar recebimento."}), 500


# --- Rotas para Despesas ---
@app.route('/api/despesas', methods=['GET'])
def get_despesas():
    try:
        cliente_id_filtro = request.args.get('cliente_id', type=int)
        caso_id_filtro = request.args.get('caso_id', type=int)
        status_filtro = request.args.get('status', type=str)
        search_term = request.args.get('search', None, type=str)
        # Adicionar filtros de data se necessário
        sort_by = request.args.get('sort_by', 'data_vencimento', type=str)
        sort_order = request.args.get('sort_order', 'desc', type=str)

        query = Despesa.query.outerjoin(Caso, Despesa.caso_id == Caso.id)\
                             .outerjoin(Cliente, Caso.cliente_id == Cliente.id)

        if cliente_id_filtro:
            query = query.filter(Caso.cliente_id == cliente_id_filtro)
        if caso_id_filtro == -1: # Para despesas gerais (sem caso)
            query = query.filter(Despesa.caso_id.is_(None))
        elif caso_id_filtro:
            query = query.filter(Despesa.caso_id == caso_id_filtro)
        if status_filtro:
            query = query.filter(Despesa.status == status_filtro)
        if search_term:
            search_like = f"%{search_term}%"
            query = query.filter(or_(
                func.lower(Despesa.descricao).ilike(func.lower(search_like)),
                func.lower(Despesa.categoria).ilike(func.lower(search_like))
            ))
        # Adicionar lógica de filtro por data aqui

        colunas_ordenaveis = {
            'descricao': Despesa.descricao, 'caso_titulo': Caso.titulo, 
            'valor': Despesa.valor, 'data_vencimento': Despesa.data_vencimento, 
            'data_despesa': Despesa.data_despesa, 'status': Despesa.status, 
            'categoria': Despesa.categoria
        }
        if sort_by in colunas_ordenaveis:
            coluna_ordenacao = colunas_ordenaveis[sort_by]
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
        app.logger.error(f"Erro em get_despesas: {e}", exc_info=True)
        return jsonify({"erro": "Erro ao buscar despesas"}), 500

@app.route('/api/despesas', methods=['POST'])
def create_despesa():
    dados = request.get_json()
    if not dados or not dados.get('data_vencimento') or not dados.get('descricao') \
       or not dados.get('categoria') or dados.get('valor') is None or not dados.get('status'):
        return jsonify({"erro": "Dados incompletos"}), 400
    
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
        app.logger.error(f"Erro em create_despesa: {e}", exc_info=True)
        return jsonify({"erro": "Erro ao salvar despesa"}), 500

# ... (Implementar PUT e DELETE para Despesas de forma similar)
@app.route('/api/despesas/<int:id>', methods=['PUT'])
def update_despesa(id):
    dados = request.get_json()
    if not dados: return jsonify({"erro": "Nenhum dado fornecido"}), 400
    try:
        despesa = db.session.get(Despesa, id)
        if despesa is None: 
            return jsonify({"erro": "Despesa não encontrada para atualizar"}), 404
        
        despesa.caso_id = dados.get('caso_id', despesa.caso_id) 
        if 'caso_id' in dados and dados['caso_id'] and not db.session.get(Caso, dados['caso_id']):
             return jsonify({"erro": f"Novo Caso com ID {dados['caso_id']} não encontrado."}), 404

        despesa.data_despesa = parse_date(dados.get('data_despesa', str(despesa.data_despesa) if despesa.data_despesa else None))
        despesa.data_vencimento = parse_date(dados.get('data_vencimento', str(despesa.data_vencimento)))
        despesa.descricao = dados.get('descricao', despesa.descricao)
        despesa.categoria = dados.get('categoria', despesa.categoria)
        despesa.valor = dados.get('valor', despesa.valor)
        despesa.status = dados.get('status', despesa.status)
        despesa.forma_pagamento = dados.get('forma_pagamento', despesa.forma_pagamento)
        despesa.notas = dados.get('notas', despesa.notas)
        
        db.session.commit()
        return jsonify(despesa.to_dict()), 200
    except Exception as e: 
        db.session.rollback()
        print(f"Erro ao atualizar despesa {id}: {e}")
        app.logger.error(f"Erro em update_despesa(id={id}): {e}", exc_info=True)
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
        app.logger.error(f"Erro em delete_despesa(id={id}): {e}", exc_info=True)
        return jsonify({"erro": "Erro ao deletar despesa."}), 500

# --- Rotas para Eventos da Agenda ---
@app.route('/api/eventos', methods=['GET'])
def get_eventos():
    try:
        cliente_id_filtro = request.args.get('cliente_id', type=int)
        caso_id_filtro = request.args.get('caso_id', type=int)
        data_inicio_filtro_str = request.args.get('start') # Usado por FullCalendar
        data_fim_filtro_str = request.args.get('end')     # Usado por FullCalendar
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
        if caso_id_filtro == -1: # Para eventos gerais (sem caso)
            query = query.filter(EventoAgenda.caso_id.is_(None))
        elif caso_id_filtro:
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
        
        # Filtro de período para FullCalendar e listas
        if data_inicio_filtro_str: 
            dt_inicio = parse_datetime(data_inicio_filtro_str)
            if dt_inicio: query = query.filter(EventoAgenda.data_fim >= dt_inicio if EventoAgenda.data_fim else EventoAgenda.data_inicio >= dt_inicio)
        if data_fim_filtro_str: 
            dt_fim = parse_datetime(data_fim_filtro_str)
            if dt_fim: query = query.filter(EventoAgenda.data_inicio <= dt_fim)
        
        colunas_ordenaveis = {
            'data_inicio': EventoAgenda.data_inicio, 'titulo': EventoAgenda.titulo,
            'tipo_evento': EventoAgenda.tipo_evento, 'concluido': EventoAgenda.concluido,
            'caso_titulo': Caso.titulo, 'cliente_nome': Cliente.nome_razao_social
        }
        if sort_by in colunas_ordenaveis:
            coluna_ordenacao = colunas_ordenaveis[sort_by]
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
        app.logger.error(f"Erro em get_eventos: {e}", exc_info=True)
        return jsonify({"erro": "Erro ao buscar eventos"}), 500

@app.route('/api/eventos', methods=['POST'])
def create_evento():
    dados = request.get_json()
    if not dados or not dados.get('tipo_evento') or not dados.get('titulo') or not dados.get('data_inicio'):
        return jsonify({"erro": "Dados incompletos"}), 400
    
    caso_id = dados.get('caso_id')
    if caso_id and not db.session.get(Caso, caso_id):
        return jsonify({"erro": f"Caso com ID {caso_id} não encontrado."}), 404

    data_inicio_dt = parse_datetime(dados['data_inicio'])
    data_fim_dt = parse_datetime(dados.get('data_fim'))

    if not data_inicio_dt:
        return jsonify({"erro": "Formato inválido para data_inicio"}), 400
    if dados.get('data_fim') and not data_fim_dt: 
        return jsonify({"erro": "Formato inválido para data_fim"}), 400

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
        app.logger.error(f"Erro em create_evento: {e}", exc_info=True)
        return jsonify({"erro": "Erro ao salvar evento"}), 500

# ... (Implementar PUT e DELETE para Eventos de forma similar)
@app.route('/api/eventos/<int:id>', methods=['PUT'])
def update_evento(id):
    dados = request.get_json()
    if not dados: return jsonify({"erro": "Nenhum dado fornecido"}), 400
    try:
        evento = db.session.get(EventoAgenda, id)
        if evento is None: 
            return jsonify({"erro": "Evento não encontrado para atualizar"}), 404
        
        data_inicio_dt = parse_datetime(dados.get('data_inicio', str(evento.data_inicio)))
        data_fim_dt = parse_datetime(dados.get('data_fim', str(evento.data_fim) if evento.data_fim else None))
        
        if 'data_inicio' in dados and not data_inicio_dt: return jsonify({"erro": "Formato inválido para data_inicio"}), 400
        if 'data_fim' in dados and dados.get('data_fim') and not data_fim_dt: return jsonify({"erro": "Formato inválido para data_fim"}), 400
        
        if 'caso_id' in dados and dados['caso_id'] and not db.session.get(Caso, dados['caso_id']):
            return jsonify({"erro": f"Novo Caso com ID {dados['caso_id']} não encontrado."}), 404
        
        evento.caso_id = dados.get('caso_id', evento.caso_id) 
        evento.tipo_evento = dados.get('tipo_evento', evento.tipo_evento)
        evento.titulo = dados.get('titulo', evento.titulo)
        evento.descricao = dados.get('descricao', evento.descricao)
        evento.data_inicio = data_inicio_dt
        evento.data_fim = data_fim_dt
        evento.local = dados.get('local', evento.local)
        evento.concluido = dados.get('concluido', evento.concluido)
        
        db.session.commit()
        return jsonify(evento.to_dict()), 200
    except Exception as e: 
        db.session.rollback()
        print(f"Erro ao atualizar evento {id}: {e}")
        app.logger.error(f"Erro em update_evento(id={id}): {e}", exc_info=True)
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
        app.logger.error(f"Erro em delete_evento(id={id}): {e}", exc_info=True)
        return jsonify({"erro": "Erro ao deletar evento."}), 500


# --- ROTAS PARA DOCUMENTOS ---
def allowed_file(filename):
    """Verifica se a extensão do arquivo é permitida."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

@app.route('/api/documentos/upload', methods=['POST'])
def upload_documento():
    if 'file' not in request.files:
        return jsonify({"erro": "Nenhum arquivo enviado"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"erro": "Nenhum arquivo selecionado"}), 400

    if file and allowed_file(file.filename):
        filename_original = secure_filename(file.filename)
        # Cria um nome de arquivo único para armazenamento para evitar colisões
        timestamp = datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')
        filename_armazenado = f"{timestamp}_{filename_original}"
        caminho_arquivo = os.path.join(app.config['UPLOAD_FOLDER'], filename_armazenado)
        
        try:
            file.save(caminho_arquivo)
            
            cliente_id_str = request.form.get('cliente_id')
            caso_id_str = request.form.get('caso_id')
            descricao = request.form.get('descricao', '')

            cliente_id = int(cliente_id_str) if cliente_id_str and cliente_id_str != 'null' else None
            caso_id = int(caso_id_str) if caso_id_str and caso_id_str != 'null' else None

            # Validações de FK
            if cliente_id and not db.session.get(Cliente, cliente_id):
                 os.remove(caminho_arquivo) # Remove o arquivo se o cliente não for válido
                 return jsonify({"erro": f"Cliente com ID {cliente_id} não encontrado."}), 404
            if caso_id and not db.session.get(Caso, caso_id):
                 os.remove(caminho_arquivo) # Remove o arquivo se o caso não for válido
                 return jsonify({"erro": f"Caso com ID {caso_id} não encontrado."}), 404

            novo_documento = Documento(
                cliente_id=cliente_id,
                caso_id=caso_id,
                nome_original_arquivo=filename_original,
                nome_armazenado=filename_armazenado, # Salva o nome único
                tipo_mime=file.mimetype,
                tamanho_bytes=os.path.getsize(caminho_arquivo),
                descricao=descricao
            )
            db.session.add(novo_documento)
            db.session.commit()
            return jsonify(novo_documento.to_dict()), 201
        except Exception as e:
            db.session.rollback()
            # Se o arquivo foi salvo mas houve erro no BD, remove o arquivo
            if os.path.exists(caminho_arquivo):
                os.remove(caminho_arquivo)
            print(f"Erro ao salvar documento: {e}")
            app.logger.error(f"Erro em upload_documento: {e}", exc_info=True)
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
        
        if caso_id_filtro == -1: # Documentos gerais (sem caso específico)
             query = query.filter(Documento.caso_id.is_(None))
        elif caso_id_filtro:
            query = query.filter(Documento.caso_id == caso_id_filtro)

        if search_term:
            search_like = f"%{search_term}%"
            query = query.filter(or_(
                func.lower(Documento.nome_original_arquivo).ilike(func.lower(search_like)),
                func.lower(Documento.descricao).ilike(func.lower(search_like))
            ))
        
        colunas_ordenaveis = {
            'nome_original_arquivo': Documento.nome_original_arquivo, 'descricao': Documento.descricao,
            'data_upload': Documento.data_upload, 'tamanho_bytes': Documento.tamanho_bytes,
            'cliente_nome': Cliente.nome_razao_social, 'caso_titulo': Caso.titulo
        }
        coluna_ordenacao_obj = None
        if sort_by in colunas_ordenaveis:
            coluna_ordenacao_obj = colunas_ordenaveis[sort_by]
        elif hasattr(Documento, sort_by): # Fallback para campos diretos do modelo Documento
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
        app.logger.error(f"Erro em get_documentos: {e}", exc_info=True)
        return jsonify({"erro": "Erro ao buscar documentos"}), 500

@app.route('/api/documentos/download/<path:nome_armazenado>', methods=['GET'])
def download_documento(nome_armazenado):
    try:
        # Sanitize o nome do arquivo para evitar path traversal
        safe_nome_armazenado = secure_filename(nome_armazenado)
        if safe_nome_armazenado != nome_armazenado: # Se secure_filename alterou, pode ser malicioso
            return jsonify({"erro": "Nome de arquivo inválido"}), 400

        doc_metadata = Documento.query.filter_by(nome_armazenado=safe_nome_armazenado).first()
        if not doc_metadata:
            return jsonify({"erro": "Metadados do documento não encontrados ou nome de arquivo inválido"}), 404
        
        caminho_completo = os.path.join(app.config['UPLOAD_FOLDER'], safe_nome_armazenado)
        if not os.path.exists(caminho_completo):
            return jsonify({"erro": "Arquivo físico não encontrado no servidor"}), 404
            
        return send_from_directory(
            directory=app.config['UPLOAD_FOLDER'], 
            path=safe_nome_armazenado, 
            as_attachment=True, 
            download_name=doc_metadata.nome_original_arquivo # Usa o nome original para o download
        )
    except Exception as e:
        print(f"Erro ao baixar documento {nome_armazenado}: {e}")
        app.logger.error(f"Erro em download_documento (nome_armazenado={nome_armazenado}): {e}", exc_info=True)
        return jsonify({"erro": "Erro ao baixar documento"}), 500

@app.route('/api/documentos/<int:id>', methods=['PUT']) # Para atualizar metadados
def update_documento_metadados(id):
    dados = request.get_json()
    if not dados:
        return jsonify({"erro": "Nenhum dado fornecido para atualização"}), 400
    try:
        documento = db.session.get(Documento, id)
        if not documento:
            return jsonify({"erro": "Documento não encontrado"}), 404

        documento.descricao = dados.get('descricao', documento.descricao)
        
        # Atualizar cliente_id e caso_id se fornecidos e válidos
        new_cliente_id = dados.get('cliente_id')
        new_caso_id = dados.get('caso_id')

        if 'cliente_id' in dados: # Permite desassociar passando null ou ""
            if new_cliente_id:
                if not db.session.get(Cliente, new_cliente_id):
                    return jsonify({"erro": f"Cliente com ID {new_cliente_id} não encontrado."}), 404
                documento.cliente_id = new_cliente_id
            else:
                documento.cliente_id = None
        
        if 'caso_id' in dados: # Permite desassociar passando null ou ""
            if new_caso_id:
                if not db.session.get(Caso, new_caso_id):
                    return jsonify({"erro": f"Caso com ID {new_caso_id} não encontrado."}), 404
                documento.caso_id = new_caso_id
            else:
                documento.caso_id = None
        
        # Não se altera o arquivo em si aqui, apenas metadados
        db.session.commit()
        return jsonify(documento.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        print(f"Erro ao atualizar metadados do documento {id}: {e}")
        app.logger.error(f"Erro em update_documento_metadados(id={id}): {e}", exc_info=True)
        return jsonify({"erro": "Erro ao atualizar metadados do documento"}), 500


@app.route('/api/documentos/<int:id>', methods=['DELETE'])
def delete_documento(id):
    try:
        documento = db.session.get(Documento, id)
        if not documento:
            return jsonify({"erro": "Documento não encontrado"}), 404
        
        caminho_arquivo = os.path.join(app.config['UPLOAD_FOLDER'], documento.nome_armazenado)
        
        db.session.delete(documento) # Deleta o registro do BD primeiro
        
        # Tenta deletar o arquivo físico
        if os.path.exists(caminho_arquivo):
            try:
                os.remove(caminho_arquivo)
            except Exception as e_file:
                # Loga o erro, mas não impede a resposta de sucesso se o registro do BD foi deletado
                print(f"Aviso: Erro ao deletar arquivo físico {documento.nome_armazenado} durante a exclusão do registro ID {id}: {e_file}")
                app.logger.warning(f"Erro ao deletar arquivo físico {documento.nome_armazenado}: {e_file}")
        
        db.session.commit()
        return jsonify({"mensagem": f"Documento ID {id} e arquivo associado (se existia) deletados com sucesso"}), 200
    except Exception as e:
        db.session.rollback()
        print(f"Erro ao deletar documento {id}: {e}")
        app.logger.error(f"Erro em delete_documento(id={id}): {e}", exc_info=True)
        return jsonify({"erro": "Erro ao deletar registro do documento"}), 500

# --- ROTAS DE RELATÓRIOS ---
@app.route('/api/relatorios/contas-a-receber', methods=['GET'])
def get_contas_a_receber():
    try:
        contas = Recebimento.query.filter(
            or_(Recebimento.status == 'Pendente', Recebimento.status == 'Vencido')
        ).order_by(Recebimento.data_vencimento.asc()).all()
        
        resultado = [r.to_dict() for r in contas]
        total_geral = sum(r.valor for r in contas if r.valor is not None) # Soma direta de Decimal

        return jsonify({ "items": resultado, "total_geral": str(total_geral) if total_geral is not None else "0.00", "quantidade_items": len(resultado) }), 200
    except Exception as e:
        print(f"Erro ao buscar contas a receber: {e}")
        app.logger.error(f"Erro em get_contas_a_receber: {e}", exc_info=True)
        return jsonify({"erro": "Erro ao buscar contas a receber"}), 500

@app.route('/api/relatorios/contas-a-pagar', methods=['GET'])
def get_contas_a_pagar():
    try:
        contas = Despesa.query.filter(
            or_(Despesa.status == 'A Pagar', Despesa.status == 'Vencida')
        ).order_by(Despesa.data_vencimento.asc()).all()
        
        resultado = [d.to_dict() for d in contas]
        total_geral = sum(d.valor for d in contas if d.valor is not None) # Soma direta de Decimal

        return jsonify({ "items": resultado, "total_geral": str(total_geral) if total_geral is not None else "0.00", "quantidade_items": len(resultado) }), 200
    except Exception as e:
        print(f"Erro ao buscar contas a pagar: {e}")
        app.logger.error(f"Erro em get_contas_a_pagar: {e}", exc_info=True)
        return jsonify({"erro": "Erro ao buscar contas a pagar"}), 500

# --- Ponto de Entrada ---
if __name__ == '__main__':
    # Configuração de logging básico para Flask
    if not app.debug: # Não configurar logging se o debug do Flask já estiver ativo e configurando
        import logging
        # Log para stdout (útil para Heroku e outros ambientes de container)
        stream_handler = logging.StreamHandler()
        stream_handler.setLevel(logging.INFO)
        app.logger.addHandler(stream_handler)
        # Você também pode configurar para logar em arquivo:
        # file_handler = logging.FileHandler('flask_app.log')
        # file_handler.setLevel(logging.INFO)
        # app.logger.addHandler(file_handler)
        app.logger.setLevel(logging.INFO)
        app.logger.info('Aplicação de Gestão Advocacia iniciada')

    port = int(os.environ.get('PORT', 5000)) # Porta padrão 5000, mas pode ser definida por variável de ambiente
    app.run(host='0.0.0.0', port=port, debug=app.config.get("DEBUG", True)) # Usa DEBUG de config.Config
