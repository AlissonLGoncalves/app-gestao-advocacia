# gestao_advocacia/routes/cliente_routes.py
from flask import Blueprint
from flask_restx import Api, Resource, fields
from flask_jwt_extended import jwt_required

# Importa db e modelos do app principal (ou de um futuro models.py)
from app import db, Cliente, get_list_query, get_item_or_404 # Assumindo que Cliente, db e helpers estão em app.py

# Cria um Blueprint para as rotas de clientes
cliente_bp = Blueprint('clientes_api', __name__, url_prefix='/api/clientes')
api_cliente = Api(cliente_bp, doc='/doc', title='Clientes API', description='Operações relacionadas a clientes')

# Define o namespace para clientes
cliente_ns = api_cliente.namespace('clientes', description='Operações relacionadas a clientes')

# Modelo de Cliente para documentação e serialização
cliente_model = cliente_ns.model('Cliente', {
    'id': fields.Integer(readOnly=True, description='Identificador único do cliente'),
    'nome': fields.String(required=True, description='Nome completo do cliente'),
    'cpf_cnpj': fields.String(description='CPF ou CNPJ do cliente'),
    'email': fields.String(description='Email do cliente'),
    'telefone': fields.String(description='Telefone do cliente'),
    'data_cadastro': fields.DateTime(readOnly=True, description='Data de cadastro do cliente'),
    # Adicione outros campos do seu modelo Cliente aqui
})

@cliente_ns.route('/')
class ClienteList(Resource):
    @api_cliente.doc('list_clientes')
    @api_cliente.marshal_list_with(cliente_model)
    @jwt_required()
    def get(self):
        """Lista todos os clientes."""
        # Exemplo de como usar get_list_query, assumindo que ele está em app.py
        clientes = get_list_query(Cliente).all()
        return clientes

    @api_cliente.doc('create_cliente')
    @api_cliente.expect(cliente_model)
    @api_cliente.marshal_with(cliente_model, code=201)
    @jwt_required()
    def post(self):
        """Cria um novo cliente."""
        novo_cliente = Cliente(**cliente_ns.payload)
        db.session.add(novo_cliente)
        db.session.commit()
        return novo_cliente, 201

# Adicione aqui as rotas para ClienteResource (GET, PUT, DELETE por ID)