import os
import re

APP_PY_PATH = 'gestao_advocacia/app.py'

with open(APP_PY_PATH, 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Namespaces
if "contratos_ns =" not in code:
    code = code.replace("dashboard_ns = Namespace('dashboard', description='Dados agregados para o Dashboard')", 
                        "dashboard_ns = Namespace('dashboard', description='Dados agregados para o Dashboard')\n    contratos_ns = Namespace('contratos', description='Operações relacionadas aos Contratos de Honorários')")
    
if "api.add_namespace(contratos_ns)" not in code:
    code = code.replace("api.add_namespace(dashboard_ns)",
                        "api.add_namespace(dashboard_ns)\n    api.add_namespace(contratos_ns)")

# 2. DTO
dto_str = """
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
"""

if "ContratoOutput" not in code:
    code = code.replace("    # --- ENDPOINT DO DASHBOARD ---", dto_str + "\n    # --- ENDPOINT DO DASHBOARD ---")

api_classes_str = """
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
"""

# Find end of create_app (before return app)
if "class ContratoGerarParcelasAPI(Resource):" not in code:
    code = code.replace("    return app\n", api_classes_str + "\n    return app\n")

with open(APP_PY_PATH, 'w', encoding='utf-8') as f:
    f.write(code)

print("Patch executado com sucesso.")
