# gestao_advocacia/routes/caso_routes.py
from flask import Blueprint
from flask_restx import Api, Resource, fields
from flask_jwt_extended import jwt_required

# Importa db e modelos do app principal (ou de um futuro models.py)
from app import db, Caso, get_list_query, get_item_or_404 # Assumindo que Caso, db e helpers estão em app.py

# Cria um Blueprint para as rotas de casos
caso_bp = Blueprint('casos_api', __name__, url_prefix='/api/casos')
api_caso = Api(caso_bp, doc='/doc', title='Casos API', description='Operações relacionadas a casos')

# Define o namespace para casos
caso_ns = api_caso.namespace('casos', description='Operações relacionadas a casos')

# Modelo de Caso para documentação e serialização
caso_model = caso_ns.model('Caso', {
    'id': fields.Integer(readOnly=True, description='Identificador único do caso'),
    'numero_processo': fields.String(description='Número do processo CNJ'),
    'titulo': fields.String(required=True, description='Título do caso'),
    'status': fields.String(description='Status atual do caso'),
    'data_abertura': fields.DateTime(description='Data de abertura do caso'),
    # Adicione outros campos do seu modelo Caso aqui
})

@caso_ns.route('/')
class CasoList(Resource):
    @api_caso.doc('list_casos')
    @api_caso.marshal_list_with(caso_model)
    @jwt_required()
    def get(self):
        """Lista todos os casos."""
        # Exemplo de como usar get_list_query, assumindo que ele está em app.py
        casos = get_list_query(Caso).all()
        return casos

    @api_caso.doc('create_caso')
    @api_caso.expect(caso_model)
    @api_caso.marshal_with(caso_model, code=201)
    @jwt_required()
    def post(self):
        """Cria um novo caso."""
        novo_caso = Caso(**caso_ns.payload)
        db.session.add(novo_caso)
        db.session.commit()
        return novo_caso, 201

# Adicione aqui as rotas para CasoResource (GET, PUT, DELETE por ID)