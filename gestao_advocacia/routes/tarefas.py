from datetime import datetime

from flask import request
from flask_jwt_extended import get_jwt_identity, jwt_required
from flask_restx import Resource

from extensions import db
from helpers import get_item_or_404, get_list_query, get_tenant_id, tenant_scoped
from models import TarefaPrazo


def register_tarefas_routes(tarefas_ns, tarefa_input_model_dto, tarefa_model_dto):
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
                if dv == '':
                    tarefa.data_vencimento = None
                else:
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
