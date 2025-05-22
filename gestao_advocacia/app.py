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
if not os.path.exists(app.config['UPLOAD_FOLDER']):
    try:
        os.makedirs(app.config['UPLOAD_FOLDER'])
        print(f"Pasta de uploads criada em: {app.config['UPLOAD_FOLDER']}")
    except Exception as e:
        print(f"Erro ao criar pasta de uploads {app.config['UPLOAD_FOLDER']}: {e}")

CORS(app, resources={r"/api/*": {"origins": "*"}})
db = SQLAlchemy(app)
migrate = Migrate(app, db)

# --- Modelos do Banco de Dados (SQLAlchemy Models) ---

class Cliente(db.Model):
    __tablename__ = 'clientes'
    id = db.Column(db.Integer, primary_key=True)
    nome_razao_social = db.Column(db.String(255), nullable=False)
    cpf_cnpj = db.Column(db.String(18), nullable=False, unique=True) # CNPJ/CPF Principal
    tipo_pessoa = db.Column(db.String(2), nullable=False)
    
    # Campos para Pessoa Física
    rg = db.Column(db.String(20), nullable=True)
    orgao_emissor = db.Column(db.String(50), nullable=True)
    data_nascimento = db.Column(db.Date, nullable=True)
    estado_civil = db.Column(db.String(50), nullable=True)
    profissao = db.Column(db.String(100), nullable=True)
    nacionalidade = db.Column(db.String(100), nullable=True)
    
    # Campos para Pessoa Jurídica
    nome_fantasia = db.Column(db.String(255), nullable=True)
    nire = db.Column(db.String(50), nullable=True)
    inscricao_estadual = db.Column(db.String(50), nullable=True)
    inscricao_municipal = db.Column(db.String(50), nullable=True)

    # Novos campos para CNPJs adicionais (Opção B)
    cnpj_secundario = db.Column(db.String(18), nullable=True, unique=True)
    descricao_cnpj_secundario = db.Column(db.String(255), nullable=True)
    cnpj_terciario = db.Column(db.String(18), nullable=True, unique=True)
    descricao_cnpj_terciario = db.Column(db.String(255), nullable=True)
    
    # Endereço
    cep = db.Column(db.String(9), nullable=True)
    rua = db.Column(db.String(255), nullable=True)
    numero = db.Column(db.String(20), nullable=True)
    bairro = db.Column(db.String(100), nullable=True)
    cidade = db.Column(db.String(100), nullable=True)
    estado = db.Column(db.String(2), nullable=True)
    pais = db.Column(db.String(50), default='Brasil', nullable=True)
    
    # Contato e Notas
    telefone = db.Column(db.String(20), nullable=True)
    email = db.Column(db.String(255), nullable=True)
    notas_gerais = db.Column(db.Text, nullable=True)
    
    # Timestamps
    data_criacao = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    data_atualizacao = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relacionamentos
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
            'nome_fantasia': self.nome_fantasia, 'nire': self.nire, 
            'inscricao_estadual': self.inscricao_estadual, 'inscricao_municipal': self.inscricao_municipal,
            # Inclusão dos novos campos de CNPJ
            'cnpj_secundario': self.cnpj_secundario,
            'descricao_cnpj_secundario': self.descricao_cnpj_secundario,
            'cnpj_terciario': self.cnpj_terciario,
            'descricao_cnpj_terciario': self.descricao_cnpj_terciario,
            # Restante dos campos
            'cep': self.cep, 'rua': self.rua, 'numero': self.numero,
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
        cliente_info = self.cliente.to_dict() if self.cliente else None # Evita erro se cliente for None
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
            'cliente': cliente_info # Retorna o objeto cliente completo
        }

# ... (Restante dos seus modelos: Recebimento, Despesa, EventoAgenda, Documento) ...
# Mantenha os outros modelos como estão por enquanto.

class Recebimento(db.Model):
    __tablename__ = 'recebimentos'
    id = db.Column(db.Integer, primary_key=True)
    caso_id = db.Column(db.Integer, db.ForeignKey('casos.id'), nullable=False)
    cliente_id = db.Column(db.Integer, db.ForeignKey('clientes.id'), nullable=False) # Adicionado para referência direta
    data_recebimento = db.Column(db.Date, nullable=True)
    data_vencimento = db.Column(db.Date, nullable=False)
    descricao = db.Column(db.String(255), nullable=False)
    categoria = db.Column(db.String(100), nullable=False)
    valor = db.Column(db.Numeric(15, 2), nullable=False)
    status = db.Column(db.String(50), nullable=False) # Ex: Pendente, Pago, Vencido
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
    caso_id = db.Column(db.Integer, db.ForeignKey('casos.id'), nullable=True) # Pode ser uma despesa geral do escritório
    data_despesa = db.Column(db.Date, nullable=True) # Data em que a despesa ocorreu ou foi paga
    data_vencimento = db.Column(db.Date, nullable=False)
    descricao = db.Column(db.String(255), nullable=False)
    categoria = db.Column(db.String(100), nullable=False)
    valor = db.Column(db.Numeric(15, 2), nullable=False)
    status = db.Column(db.String(50), nullable=False) # Ex: A Pagar, Paga, Vencida
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
            'caso_titulo': self.caso_ref.titulo if self.caso_ref else "Despesa Geral" # Adiciona título do caso
        }

class EventoAgenda(db.Model):
    __tablename__ = 'eventos_agenda'
    id = db.Column(db.Integer, primary_key=True)
    caso_id = db.Column(db.Integer, db.ForeignKey('casos.id'), nullable=True) # Evento pode ser geral
    tipo_evento = db.Column(db.String(50), nullable=False) # Ex: Prazo, Audiência, Reunião, Lembrete
    titulo = db.Column(db.String(255), nullable=False)
    descricao = db.Column(db.Text, nullable=True)
    data_inicio = db.Column(db.DateTime, nullable=False) # Usar DateTime para incluir hora
    data_fim = db.Column(db.DateTime, nullable=True)    # Usar DateTime para incluir hora
    local = db.Column(db.String(255), nullable=True)
    concluido = db.Column(db.Boolean, default=False)
    data_criacao = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    data_atualizacao = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def __repr__(self): return f'<EventoAgenda {self.id}: {self.tipo_evento} - {self.titulo}>'
    
    def to_dict(self):
        return {
            'id': self.id, 'caso_id': self.caso_id, 'tipo_evento': self.tipo_evento,
            'titulo': self.titulo, 'descricao': self.descricao,
            'data_inicio': self.data_inicio.isoformat() if self.data_inicio else None, # Enviar em formato ISO
            'data_fim': self.data_fim.isoformat() if self.data_fim else None,         # Enviar em formato ISO
            'local': self.local, 'concluido': self.concluido,
            'data_criacao': self.data_criacao.isoformat() if self.data_criacao else None,
            'data_atualizacao': self.data_atualizacao.isoformat() if self.data_atualizacao else None,
            'caso_titulo': self.caso_ref.titulo if self.caso_ref else None # Adiciona título do caso
        }

class Documento(db.Model):
    __tablename__ = 'documentos'
    id = db.Column(db.Integer, primary_key=True)
    cliente_id = db.Column(db.Integer, db.ForeignKey('clientes.id'), nullable=True) # Opcional
    caso_id = db.Column(db.Integer, db.ForeignKey('casos.id'), nullable=True)       # Opcional
    nome_original_arquivo = db.Column(db.String(255), nullable=False)
    nome_armazenado = db.Column(db.String(255), nullable=False, unique=True) # Nome seguro no servidor
    tipo_mime = db.Column(db.String(100), nullable=True)
    tamanho_bytes = db.Column(db.BigInteger, nullable=True)
    descricao = db.Column(db.Text, nullable=True) # Descrição/notas sobre o documento
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
    if not date_string: return None
    try: return date.fromisoformat(date_string)
    except (ValueError, TypeError): return None

def parse_datetime(datetime_string):
    if not datetime_string: return None
    try:
        dt_str = datetime_string.replace('Z', '+00:00') if isinstance(datetime_string, str) else datetime_string
        dt_obj = datetime.fromisoformat(dt_str)
        return dt_obj.astimezone(timezone.utc) if dt_obj.tzinfo else dt_obj.replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        for fmt in ('%Y-%m-%dT%H:%M:%S.%f', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S', '%Y-%m-%d'):
            try:
                dt_obj = datetime.strptime(str(datetime_string), fmt)
                return dt_obj.replace(tzinfo=timezone.utc) if dt_obj.tzinfo is None else dt_obj.astimezone(timezone.utc)
            except (ValueError, TypeError):
                continue
        app.logger.warning(f"Falha ao parsear datetime: {datetime_string}")
        return None

# --- Rotas da API (Endpoints) ---
@app.route('/')
def index():
    return jsonify({"message": "API de Gestão para Advocacia está no ar!"})

# --- Rotas para Clientes ---
@app.route('/api/clientes', methods=['GET'])
def get_clientes():
    # ... (código existente para GET /api/clientes) ...
    # Nenhuma alteração necessária aqui para os CNPJs adicionais,
    # pois o to_dict() já os inclui.
    # A lógica de busca precisará ser atualizada se quiser buscar por CNPJs adicionais.
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
            query = query.filter(or_(
                Cliente.nome_razao_social.ilike(search_like),
                Cliente.cpf_cnpj.ilike(search_like),
                # Adicionar busca nos CNPJs adicionais se desejado
                Cliente.cnpj_secundario.ilike(search_like),
                Cliente.cnpj_terciario.ilike(search_like),
                Cliente.email.ilike(search_like) # Exemplo
            ))
        
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
        app.logger.error(f"Erro em get_clientes: {e}", exc_info=True)
        return jsonify({"erro": "Erro ao buscar clientes"}), 500


@app.route('/api/clientes', methods=['POST'])
def create_cliente():
    dados = request.get_json()
    if not dados or not dados.get('nome_razao_social') or not dados.get('cpf_cnpj') or not dados.get('tipo_pessoa'):
        return jsonify({"erro": "Dados incompletos (nome_razao_social, cpf_cnpj, tipo_pessoa são obrigatórios)"}), 400
    
    # Verifica duplicidade para o CNPJ/CPF principal
    if Cliente.query.filter_by(cpf_cnpj=dados['cpf_cnpj']).first():
        return jsonify({"erro": f"Cliente com CPF/CNPJ {dados['cpf_cnpj']} já existe."}), 409

    # Verifica duplicidade para CNPJs adicionais, se fornecidos e não vazios
    if dados.get('cnpj_secundario') and Cliente.query.filter(or_(Cliente.cpf_cnpj == dados['cnpj_secundario'], Cliente.cnpj_secundario == dados['cnpj_secundario'], Cliente.cnpj_terciario == dados['cnpj_secundario'])).first():
        return jsonify({"erro": f"CNPJ secundário {dados['cnpj_secundario']} já está em uso."}), 409
    if dados.get('cnpj_terciario') and Cliente.query.filter(or_(Cliente.cpf_cnpj == dados['cnpj_terciario'], Cliente.cnpj_secundario == dados['cnpj_terciario'], Cliente.cnpj_terciario == dados['cnpj_terciario'])).first():
        return jsonify({"erro": f"CNPJ terciário {dados['cnpj_terciario']} já está em uso."}), 409
    if dados.get('cnpj_secundario') and dados.get('cnpj_terciario') and dados['cnpj_secundario'] == dados['cnpj_terciario']:
        return jsonify({"erro": "CNPJ secundário e terciário não podem ser iguais."}), 400


    try:
        novo_cliente = Cliente(
            nome_razao_social=dados['nome_razao_social'],
            cpf_cnpj=dados['cpf_cnpj'],
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
            # Novos campos de CNPJ
            cnpj_secundario=dados.get('cnpj_secundario') if dados.get('tipo_pessoa') == 'PJ' else None,
            descricao_cnpj_secundario=dados.get('descricao_cnpj_secundario') if dados.get('tipo_pessoa') == 'PJ' else None,
            cnpj_terciario=dados.get('cnpj_terciario') if dados.get('tipo_pessoa') == 'PJ' else None,
            descricao_cnpj_terciario=dados.get('descricao_cnpj_terciario') if dados.get('tipo_pessoa') == 'PJ' else None,
            # Restante dos campos
            cep=dados.get('cep'), rua=dados.get('rua'), numero=dados.get('numero'),
            bairro=dados.get('bairro'), cidade=dados.get('cidade'), estado=dados.get('estado'),
            pais=dados.get('pais', 'Brasil'), telefone=dados.get('telefone'),
            email=dados.get('email'), notas_gerais=dados.get('notas_gerais')
        )
        db.session.add(novo_cliente)
        db.session.commit()
        return jsonify(novo_cliente.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Erro em create_cliente: {e}", exc_info=True)
        return jsonify({"erro": "Erro interno ao salvar cliente."}), 500

@app.route('/api/clientes/<int:id>', methods=['GET'])
def get_cliente(id):
    # ... (código existente para GET /api/clientes/:id) ...
    # Nenhuma alteração necessária aqui, pois to_dict() já inclui os novos campos.
    try:
        cliente = db.session.get(Cliente, id)
        if cliente is None:
            return jsonify({"erro": "Cliente não encontrado"}), 404
        return jsonify(cliente.to_dict()), 200
    except Exception as e:
        app.logger.error(f"Erro em get_cliente(id={id}): {e}", exc_info=True)
        return jsonify({"erro": "Erro ao buscar cliente"}), 500

@app.route('/api/clientes/<int:id>', methods=['PUT'])
def update_cliente(id):
    dados = request.get_json()
    if not dados: return jsonify({"erro": "Nenhum dado fornecido para atualização"}), 400
    
    cliente = db.session.get(Cliente, id)
    if cliente is None:
        return jsonify({"erro": "Cliente não encontrado para atualizar"}), 404

    # Validação de duplicidade para CNPJs adicionais, se estiverem a ser alterados
    # e forem diferentes do CNPJ principal do cliente atual ou de outros clientes
    if 'cnpj_secundario' in dados and dados['cnpj_secundario'] and dados['cnpj_secundario'] != cliente.cnpj_secundario:
        if Cliente.query.filter(Cliente.id != id, or_(Cliente.cpf_cnpj == dados['cnpj_secundario'], Cliente.cnpj_secundario == dados['cnpj_secundario'], Cliente.cnpj_terciario == dados['cnpj_secundario'])).first():
            return jsonify({"erro": f"CNPJ secundário {dados['cnpj_secundario']} já está em uso por outro cliente."}), 409
    if 'cnpj_terciario' in dados and dados['cnpj_terciario'] and dados['cnpj_terciario'] != cliente.cnpj_terciario:
        if Cliente.query.filter(Cliente.id != id, or_(Cliente.cpf_cnpj == dados['cnpj_terciario'], Cliente.cnpj_secundario == dados['cnpj_terciario'], Cliente.cnpj_terciario == dados['cnpj_terciario'])).first():
            return jsonify({"erro": f"CNPJ terciário {dados['cnpj_terciario']} já está em uso por outro cliente."}), 409
    
    # Validação para não permitir que os CNPJs adicionais sejam iguais entre si ou ao principal (dentro do mesmo cliente)
    cnpj_principal_atual = dados.get('cpf_cnpj', cliente.cpf_cnpj) # Pega o novo ou o existente
    cnpj_sec_atual = dados.get('cnpj_secundario', cliente.cnpj_secundario)
    cnpj_ter_atual = dados.get('cnpj_terciario', cliente.cnpj_terciario)

    if cnpj_sec_atual and cnpj_sec_atual == cnpj_principal_atual:
        return jsonify({"erro": "CNPJ secundário não pode ser igual ao CNPJ principal."}), 400
    if cnpj_ter_atual and cnpj_ter_atual == cnpj_principal_atual:
        return jsonify({"erro": "CNPJ terciário não pode ser igual ao CNPJ principal."}), 400
    if cnpj_sec_atual and cnpj_ter_atual and cnpj_sec_atual == cnpj_ter_atual:
        return jsonify({"erro": "CNPJ secundário e terciário não podem ser iguais."}), 400


    try:
        for key, value in dados.items():
            if hasattr(cliente, key):
                if key == 'data_nascimento':
                    setattr(cliente, key, parse_date(value))
                elif key in ['cnpj_secundario', 'cnpj_terciario'] and cliente.tipo_pessoa != 'PJ':
                    # Ignora CNPJs adicionais se o tipo não for PJ
                    continue
                else:
                    setattr(cliente, key, value)
        
        # Se o tipo de pessoa for mudado de PJ para PF, limpar os campos de CNPJ adicionais
        if 'tipo_pessoa' in dados and dados['tipo_pessoa'] == 'PF':
            cliente.cnpj_secundario = None
            cliente.descricao_cnpj_secundario = None
            cliente.cnpj_terciario = None
            cliente.descricao_cnpj_terciario = None
            # Também limpar campos específicos de PJ como nome_fantasia, nire, etc.
            cliente.nome_fantasia = None
            cliente.nire = None
            cliente.inscricao_estadual = None
            cliente.inscricao_municipal = None


        db.session.commit()
        return jsonify(cliente.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Erro em update_cliente(id={id}): {e}", exc_info=True)
        return jsonify({"erro": "Erro ao atualizar cliente."}), 500

# ... (Restante das suas rotas: /api/clientes/:id DELETE, /api/casos, etc.) ...
# Mantenha as outras rotas como estão por enquanto.

@app.route('/api/clientes/<int:id>', methods=['DELETE'])
def delete_cliente(id):
    try:
        cliente = db.session.get(Cliente, id)
        if cliente is None:
            return jsonify({"erro": "Cliente não encontrado para deletar"}), 404
        
        # Verificar se há casos associados
        if cliente.casos: # Se a lista não estiver vazia
             return jsonify({"erro": "Não é possível deletar o cliente pois existem casos associados a ele. Remova ou desassocie os casos primeiro."}), 409

        db.session.delete(cliente)
        db.session.commit()
        return jsonify({"mensagem": f"Cliente {id} deletado com sucesso"}), 200
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Erro em delete_cliente(id={id}): {e}", exc_info=True)
        if "violates foreign key constraint" in str(e).lower() or "FOREIGN KEY constraint failed" in str(e):
            return jsonify({"erro": "Não é possível deletar o cliente pois existem registos (casos, recebimentos, etc.) associados a ele."}), 409
        return jsonify({"erro": "Erro ao deletar cliente."}), 500


# --- ROTAS PARA CASOS ---
@app.route('/api/casos', methods=['GET'])
def get_casos():
    try:
        cliente_id_filtro = request.args.get('cliente_id', type=int)
        status_filtro = request.args.get('status', type=str)
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
                    Caso.titulo.ilike(search_like),
                    Caso.numero_processo.ilike(search_like),
                    Caso.parte_contraria.ilike(search_like),
                    Caso.tipo_acao.ilike(search_like),
                    Cliente.nome_razao_social.ilike(search_like) 
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
        
        # Não permitir alterar cliente_id de um caso existente via este endpoint
        # Se precisar mudar o cliente de um caso, seria uma operação mais complexa.
        if 'cliente_id' in dados and dados['cliente_id'] != caso.cliente_id:
            return jsonify({"erro": "Não é permitido alterar o cliente de um caso existente por esta rota."}), 400

        for key, value in dados.items():
            if hasattr(caso, key) and key != 'cliente_id': # Ignora cliente_id
                if key == 'data_distribuicao':
                    setattr(caso, key, parse_date(value))
                else:
                    setattr(caso, key, value)
        
        db.session.commit()
        return jsonify(caso.to_dict()), 200
    except Exception as e:
        db.session.rollback()
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
        app.logger.error(f"Erro em delete_caso(id={id}): {e}", exc_info=True)
        return jsonify({"erro": "Erro ao deletar caso."}), 500


# --- ROTAS PARA RECEBIMENTOS ---
@app.route('/api/recebimentos', methods=['GET'])
def get_recebimentos():
    try:
        cliente_id_filtro = request.args.get('cliente_id', type=int)
        caso_id_filtro = request.args.get('caso_id', type=int)
        status_filtro = request.args.get('status', type=str)
        search_term = request.args.get('search', None, type=str)
        data_vencimento_inicio = request.args.get('data_vencimento_inicio', type=str)
        data_vencimento_fim = request.args.get('data_vencimento_fim', type=str)
        data_recebimento_inicio = request.args.get('data_recebimento_inicio', type=str)
        data_recebimento_fim = request.args.get('data_recebimento_fim', type=str)

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
                Recebimento.descricao.ilike(search_like),
                Recebimento.categoria.ilike(search_like)
            ))
        if data_vencimento_inicio:
            dt = parse_date(data_vencimento_inicio)
            if dt: query = query.filter(Recebimento.data_vencimento >= dt)
        if data_vencimento_fim:
            dt = parse_date(data_vencimento_fim)
            if dt: query = query.filter(Recebimento.data_vencimento <= dt)
        if data_recebimento_inicio:
            dt = parse_date(data_recebimento_inicio)
            if dt: query = query.filter(Recebimento.data_recebimento >= dt)
        if data_recebimento_fim:
            dt = parse_date(data_recebimento_fim)
            if dt: query = query.filter(Recebimento.data_recebimento <= dt)


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
        app.logger.error(f"Erro em create_recebimento: {e}", exc_info=True)
        return jsonify({"erro": "Erro ao salvar recebimento"}), 500

@app.route('/api/recebimentos/<int:id>', methods=['GET'])
def get_recebimento(id):
    try:
        recebimento = db.session.get(Recebimento, id)
        if recebimento is None:
            return jsonify({"erro": "Recebimento não encontrado"}), 404
        return jsonify(recebimento.to_dict()), 200
    except Exception as e:
        app.logger.error(f"Erro em get_recebimento(id={id}): {e}", exc_info=True)
        return jsonify({"erro": "Erro ao buscar recebimento"}), 500


@app.route('/api/recebimentos/<int:id>', methods=['PUT'])
def update_recebimento(id):
    dados = request.get_json()
    if not dados: return jsonify({"erro": "Nenhum dado fornecido"}), 400
    try:
        recebimento = db.session.get(Recebimento, id)
        if recebimento is None: 
            return jsonify({"erro": "Recebimento não encontrado para atualizar"}), 404
        
        # Não permitir alterar cliente_id e caso_id diretamente aqui para simplificar
        # Se precisar mudar, seria uma operação mais controlada.
        if 'cliente_id' in dados and dados['cliente_id'] != recebimento.cliente_id:
            return jsonify({"erro": "Alteração de cliente_id não permitida nesta rota."}), 400
        if 'caso_id' in dados and dados['caso_id'] != recebimento.caso_id:
            return jsonify({"erro": "Alteração de caso_id não permitida nesta rota."}), 400

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
        app.logger.error(f"Erro em delete_recebimento(id={id}): {e}", exc_info=True)
        return jsonify({"erro": "Erro ao deletar recebimento."}), 500


# --- ROTAS PARA DESPESAS ---
@app.route('/api/despesas', methods=['GET'])
def get_despesas():
    try:
        # cliente_id_filtro = request.args.get('cliente_id', type=int) # Para filtrar casos de um cliente
        caso_id_filtro = request.args.get('caso_id', type=int) # -1 para despesas gerais
        status_filtro = request.args.get('status', type=str)
        search_term = request.args.get('search', None, type=str)
        data_vencimento_inicio = request.args.get('data_vencimento_inicio', type=str)
        data_vencimento_fim = request.args.get('data_vencimento_fim', type=str)
        data_despesa_inicio = request.args.get('data_despesa_inicio', type=str)
        data_despesa_fim = request.args.get('data_despesa_fim', type=str)

        sort_by = request.args.get('sort_by', 'data_vencimento', type=str)
        sort_order = request.args.get('sort_order', 'desc', type=str)

        query = Despesa.query.outerjoin(Caso, Despesa.caso_id == Caso.id)\
                             .outerjoin(Cliente, Caso.cliente_id == Cliente.id) # Para ordenar por nome de cliente/caso

        if caso_id_filtro == -1: 
            query = query.filter(Despesa.caso_id.is_(None))
        elif caso_id_filtro:
            query = query.filter(Despesa.caso_id == caso_id_filtro)
        
        # Se precisar filtrar por cliente diretamente (despesas de todos os casos de um cliente + gerais)
        # if cliente_id_filtro:
        #     query = query.filter(or_(Caso.cliente_id == cliente_id_filtro, Despesa.caso_id.is_(None)))


        if status_filtro:
            query = query.filter(Despesa.status == status_filtro)
        if search_term:
            search_like = f"%{search_term}%"
            query = query.filter(or_(
                Despesa.descricao.ilike(search_like),
                Despesa.categoria.ilike(search_like)
            ))
        if data_vencimento_inicio:
            dt = parse_date(data_vencimento_inicio)
            if dt: query = query.filter(Despesa.data_vencimento >= dt)
        if data_vencimento_fim:
            dt = parse_date(data_vencimento_fim)
            if dt: query = query.filter(Despesa.data_vencimento <= dt)
        if data_despesa_inicio:
            dt = parse_date(data_despesa_inicio)
            if dt: query = query.filter(Despesa.data_despesa >= dt)
        if data_despesa_fim:
            dt = parse_date(data_despesa_fim)
            if dt: query = query.filter(Despesa.data_despesa <= dt)


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
        app.logger.error(f"Erro em create_despesa: {e}", exc_info=True)
        return jsonify({"erro": "Erro ao salvar despesa"}), 500

@app.route('/api/despesas/<int:id>', methods=['GET'])
def get_despesa(id):
    try:
        despesa = db.session.get(Despesa, id)
        if despesa is None:
            return jsonify({"erro": "Despesa não encontrada"}), 404
        return jsonify(despesa.to_dict()), 200
    except Exception as e:
        app.logger.error(f"Erro em get_despesa(id={id}): {e}", exc_info=True)
        return jsonify({"erro": "Erro ao buscar despesa"}), 500

@app.route('/api/despesas/<int:id>', methods=['PUT'])
def update_despesa(id):
    dados = request.get_json()
    if not dados: return jsonify({"erro": "Nenhum dado fornecido"}), 400
    try:
        despesa = db.session.get(Despesa, id)
        if despesa is None: 
            return jsonify({"erro": "Despesa não encontrada para atualizar"}), 404
        
        new_caso_id = dados.get('caso_id')
        if 'caso_id' in dados: # Permite desassociar ou associar
            if new_caso_id and not db.session.get(Caso, new_caso_id):
                return jsonify({"erro": f"Novo Caso com ID {new_caso_id} não encontrado."}), 404
            despesa.caso_id = new_caso_id if new_caso_id else None


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
        app.logger.error(f"Erro em delete_despesa(id={id}): {e}", exc_info=True)
        return jsonify({"erro": "Erro ao deletar despesa."}), 500

# --- ROTAS PARA EVENTOS DA AGENDA ---
@app.route('/api/eventos', methods=['GET'])
def get_eventos():
    try:
        caso_id_filtro = request.args.get('caso_id', type=int) # -1 para eventos gerais
        data_inicio_gte_str = request.args.get('data_inicio_gte', type=str) # Para filtros de range
        data_inicio_lte_str = request.args.get('data_inicio_lte', type=str) # Para filtros de range
        status_concluido_str = request.args.get('concluido', type=str) 
        tipo_evento_filtro = request.args.get('tipo_evento', type=str)
        search_term = request.args.get('search', None, type=str)
        limit = request.args.get('limit', type=int)       
        sort_by = request.args.get('sort_by', 'data_inicio', type=str)
        sort_order = request.args.get('sort_order', 'asc', type=str)

        query = EventoAgenda.query.outerjoin(Caso, EventoAgenda.caso_id == Caso.id)\
                                 .outerjoin(Cliente, Caso.cliente_id == Cliente.id)

        if caso_id_filtro == -1: 
            query = query.filter(EventoAgenda.caso_id.is_(None))
        elif caso_id_filtro:
            query = query.filter(EventoAgenda.caso_id == caso_id_filtro)
        
        if tipo_evento_filtro:
            query = query.filter(EventoAgenda.tipo_evento == tipo_evento_filtro)
        
        if status_concluido_str is not None:
            concluido_bool = status_concluido_str.lower() == 'true'
            query = query.filter(EventoAgenda.concluido == concluido_bool)
        
        if search_term:
            search_like = f"%{search_term}%"
            query = query.filter(or_(
                EventoAgenda.titulo.ilike(search_like),
                EventoAgenda.descricao.ilike(search_like)
            ))
        
        if data_inicio_gte_str: 
            dt_inicio = parse_datetime(data_inicio_gte_str) # Use parse_datetime para campos de data e hora
            if dt_inicio: query = query.filter(EventoAgenda.data_inicio >= dt_inicio)
        if data_inicio_lte_str: 
            dt_fim = parse_datetime(data_inicio_lte_str)
            if dt_fim: query = query.filter(EventoAgenda.data_inicio <= dt_fim)
        
        colunas_ordenaveis = {
            'data_inicio': EventoAgenda.data_inicio, 'titulo': EventoAgenda.titulo,
            'tipo_evento': EventoAgenda.tipo_evento, 'concluido': EventoAgenda.concluido,
            'caso_titulo': Caso.titulo # Assumindo que Caso.titulo existe e é ordenável
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
        app.logger.error(f"Erro em get_eventos: {e}", exc_info=True)
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
        app.logger.error(f"Erro em create_evento: {e}", exc_info=True)
        return jsonify({"erro": "Erro ao salvar evento"}), 500

@app.route('/api/eventos/<int:id>', methods=['GET'])
def get_evento(id):
    try:
        evento = db.session.get(EventoAgenda, id)
        if evento is None:
            return jsonify({"erro": "Evento não encontrado"}), 404
        return jsonify(evento.to_dict()), 200
    except Exception as e:
        app.logger.error(f"Erro em get_evento(id={id}): {e}", exc_info=True)
        return jsonify({"erro": "Erro ao buscar evento"}), 500


@app.route('/api/eventos/<int:id>', methods=['PUT'])
def update_evento(id):
    dados = request.get_json()
    if not dados: return jsonify({"erro": "Nenhum dado fornecido"}), 400
    
    evento = db.session.get(EventoAgenda, id)
    if evento is None: 
        return jsonify({"erro": "Evento não encontrado para atualizar"}), 404
    
    try:
        data_inicio_dt = parse_datetime(dados.get('data_inicio', evento.data_inicio.isoformat()))
        data_fim_dt = parse_datetime(dados.get('data_fim', evento.data_fim.isoformat() if evento.data_fim else None))
        
        if 'data_inicio' in dados and not data_inicio_dt: return jsonify({"erro": "Formato inválido para data_inicio"}), 400
        if 'data_fim' in dados and dados.get('data_fim') and not data_fim_dt: return jsonify({"erro": "Formato inválido para data_fim"}), 400
        
        new_caso_id = dados.get('caso_id')
        if 'caso_id' in dados: # Permite desassociar ou associar
            if new_caso_id and not db.session.get(Caso, new_caso_id):
                return jsonify({"erro": f"Novo Caso com ID {new_caso_id} não encontrado."}), 404
            evento.caso_id = new_caso_id if new_caso_id else None
        
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
        app.logger.error(f"Erro em delete_evento(id={id}): {e}", exc_info=True)
        return jsonify({"erro": "Erro ao deletar evento."}), 500

# --- ROTAS PARA DOCUMENTOS ---
def allowed_file(filename):
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
        timestamp = datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')
        filename_armazenado = f"{timestamp}_{filename_original}"
        caminho_arquivo = os.path.join(app.config['UPLOAD_FOLDER'], filename_armazenado)
        
        try:
            file.save(caminho_arquivo)
            
            cliente_id_str = request.form.get('cliente_id')
            caso_id_str = request.form.get('caso_id')
            descricao = request.form.get('descricao', '')

            cliente_id = int(cliente_id_str) if cliente_id_str and cliente_id_str != 'null' and cliente_id_str.isdigit() else None
            caso_id = int(caso_id_str) if caso_id_str and caso_id_str != 'null' and caso_id_str.isdigit() else None

            if cliente_id and not db.session.get(Cliente, cliente_id):
                 os.remove(caminho_arquivo)
                 return jsonify({"erro": f"Cliente com ID {cliente_id} não encontrado."}), 404
            if caso_id and not db.session.get(Caso, caso_id):
                 os.remove(caminho_arquivo)
                 return jsonify({"erro": f"Caso com ID {caso_id} não encontrado."}), 404

            novo_documento = Documento(
                cliente_id=cliente_id, caso_id=caso_id,
                nome_original_arquivo=filename_original, nome_armazenado=filename_armazenado,
                tipo_mime=file.mimetype, tamanho_bytes=os.path.getsize(caminho_arquivo),
                descricao=descricao
            )
            db.session.add(novo_documento)
            db.session.commit()
            return jsonify(novo_documento.to_dict()), 201
        except Exception as e:
            db.session.rollback()
            if os.path.exists(caminho_arquivo): os.remove(caminho_arquivo)
            app.logger.error(f"Erro em upload_documento: {e}", exc_info=True)
            return jsonify({"erro": "Erro ao salvar documento"}), 500
    else:
        return jsonify({"erro": "Tipo de arquivo não permitido"}), 400

@app.route('/api/documentos', methods=['GET'])
def get_documentos():
    try:
        cliente_id_filtro = request.args.get('cliente_id', type=int)
        caso_id_filtro = request.args.get('caso_id', type=int) # -1 para docs gerais do cliente
        sem_caso_filtro = request.args.get('sem_caso', type=str, default='false').lower() == 'true'

        search_term = request.args.get('search', None, type=str)
        sort_by = request.args.get('sort_by', 'data_upload', type=str)
        sort_order = request.args.get('sort_order', 'desc', type=str)
        
        query = Documento.query.outerjoin(Cliente, Documento.cliente_id == Cliente.id)\
                               .outerjoin(Caso, Documento.caso_id == Caso.id)
        
        if cliente_id_filtro:
            if sem_caso_filtro: # Documentos do cliente, mas sem caso específico
                query = query.filter(Documento.cliente_id == cliente_id_filtro, Documento.caso_id.is_(None))
            else: # Documentos do cliente (pode ou não ter caso, a menos que caso_id_filtro também seja usado)
                query = query.filter(Documento.cliente_id == cliente_id_filtro)
        
        if caso_id_filtro: # Se caso_id_filtro é fornecido, ele tem precedência para filtrar por caso
             query = query.filter(Documento.caso_id == caso_id_filtro)


        if search_term:
            search_like = f"%{search_term}%"
            query = query.filter(or_(
                Documento.nome_original_arquivo.ilike(search_like),
                Documento.descricao.ilike(search_like)
            ))
        
        colunas_ordenaveis = {
            'nome_original_arquivo': Documento.nome_original_arquivo, 'descricao': Documento.descricao,
            'data_upload': Documento.data_upload, 'tamanho_bytes': Documento.tamanho_bytes,
            'cliente_nome': Cliente.nome_razao_social, 'caso_titulo': Caso.titulo
        }
        coluna_ordenacao_obj = None
        if sort_by in colunas_ordenaveis:
            coluna_ordenacao_obj = colunas_ordenaveis[sort_by]
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
        app.logger.error(f"Erro em get_documentos: {e}", exc_info=True)
        return jsonify({"erro": "Erro ao buscar documentos"}), 500

@app.route('/api/documentos/download/<path:nome_armazenado>', methods=['GET'])
def download_documento(nome_armazenado):
    try:
        safe_nome_armazenado = secure_filename(nome_armazenado)
        if safe_nome_armazenado != nome_armazenado:
            return jsonify({"erro": "Nome de arquivo inválido"}), 400

        doc_metadata = Documento.query.filter_by(nome_armazenado=safe_nome_armazenado).first()
        if not doc_metadata:
            return jsonify({"erro": "Metadados do documento não encontrados ou nome de arquivo inválido"}), 404
        
        caminho_completo = os.path.join(app.config['UPLOAD_FOLDER'], safe_nome_armazenado)
        if not os.path.isfile(caminho_completo): # Verifica se é um arquivo
            app.logger.error(f"Tentativa de download de caminho que não é arquivo ou não existe: {caminho_completo}")
            return jsonify({"erro": "Arquivo físico não encontrado no servidor"}), 404
            
        return send_from_directory(
            directory=app.config['UPLOAD_FOLDER'], 
            path=safe_nome_armazenado, 
            as_attachment=True, 
            download_name=doc_metadata.nome_original_arquivo
        )
    except Exception as e:
        app.logger.error(f"Erro em download_documento (nome_armazenado={nome_armazenado}): {e}", exc_info=True)
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
        
        new_cliente_id = dados.get('cliente_id')
        new_caso_id = dados.get('caso_id')

        if 'cliente_id' in dados:
            if new_cliente_id:
                if not db.session.get(Cliente, new_cliente_id):
                    return jsonify({"erro": f"Cliente com ID {new_cliente_id} não encontrado."}), 404
                documento.cliente_id = new_cliente_id
            else:
                documento.cliente_id = None # Permite desassociar
        
        if 'caso_id' in dados:
            if new_caso_id:
                if not db.session.get(Caso, new_caso_id):
                    return jsonify({"erro": f"Caso com ID {new_caso_id} não encontrado."}), 404
                documento.caso_id = new_caso_id
            else:
                documento.caso_id = None # Permite desassociar
        
        db.session.commit()
        return jsonify(documento.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Erro em update_documento_metadados(id={id}): {e}", exc_info=True)
        return jsonify({"erro": "Erro ao atualizar metadados do documento"}), 500


@app.route('/api/documentos/<int:id>', methods=['DELETE'])
def delete_documento(id):
    try:
        documento = db.session.get(Documento, id)
        if not documento:
            return jsonify({"erro": "Documento não encontrado"}), 404
        
        caminho_arquivo = os.path.join(app.config['UPLOAD_FOLDER'], documento.nome_armazenado)
        
        db.session.delete(documento) 
        
        if os.path.exists(caminho_arquivo) and os.path.isfile(caminho_arquivo):
            try:
                os.remove(caminho_arquivo)
            except Exception as e_file:
                app.logger.warning(f"Erro ao deletar arquivo físico {documento.nome_armazenado} durante a exclusão do registo ID {id}: {e_file}")
        
        db.session.commit()
        return jsonify({"mensagem": f"Documento ID {id} e arquivo associado (se existia) deletados com sucesso"}), 200
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Erro em delete_documento(id={id}): {e}", exc_info=True)
        return jsonify({"erro": "Erro ao deletar registo do documento"}), 500

# --- ROTAS DE RELATÓRIOS ---
@app.route('/api/relatorios/contas-a-receber', methods=['GET'])
def get_contas_a_receber():
    try:
        contas = Recebimento.query.filter(
            or_(Recebimento.status == 'Pendente', Recebimento.status == 'Vencido')
        ).order_by(Recebimento.data_vencimento.asc()).all()
        
        resultado = [r.to_dict() for r in contas]
        total_geral = sum(r.valor for r in contas if r.valor is not None)

        return jsonify({ "items": resultado, "total_geral": str(total_geral) if total_geral is not None else "0.00", "quantidade_items": len(resultado) }), 200
    except Exception as e:
        app.logger.error(f"Erro em get_contas_a_receber: {e}", exc_info=True)
        return jsonify({"erro": "Erro ao buscar contas a receber"}), 500

@app.route('/api/relatorios/contas-a-pagar', methods=['GET'])
def get_contas_a_pagar():
    try:
        contas = Despesa.query.filter(
            or_(Despesa.status == 'A Pagar', Despesa.status == 'Vencida')
        ).order_by(Despesa.data_vencimento.asc()).all()
        
        resultado = [d.to_dict() for d in contas]
        total_geral = sum(d.valor for d in contas if d.valor is not None)

        return jsonify({ "items": resultado, "total_geral": str(total_geral) if total_geral is not None else "0.00", "quantidade_items": len(resultado) }), 200
    except Exception as e:
        app.logger.error(f"Erro em get_contas_a_pagar: {e}", exc_info=True)
        return jsonify({"erro": "Erro ao buscar contas a pagar"}), 500


# --- Ponto de Entrada ---
if __name__ == '__main__':
    if not app.debug:
        import logging
        stream_handler = logging.StreamHandler()
        stream_handler.setLevel(logging.INFO)
        app.logger.addHandler(stream_handler)
        app.logger.setLevel(logging.INFO)
        app.logger.info('Aplicação de Gestão Advocacia iniciada')

    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=app.config.get("DEBUG", True))

