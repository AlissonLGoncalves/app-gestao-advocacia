import os
from datetime import date, datetime

from dateutil.relativedelta import relativedelta
from flask import request, send_from_directory
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
from flask_restx import Resource

from extensions import db
from helpers import get_item_or_404, get_list_query, get_tenant_id, tenant_scoped
from models import Caso, ContratoHonorario, Recebimento, User


def register_contratos_routes(
    app, contratos_ns, contrato_input_model_dto, contrato_model_dto, finance_access_required
):
    @contratos_ns.route("/")
    class ContratoListAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @finance_access_required
        @contratos_ns.marshal_list_with(contrato_model_dto)
        @contratos_ns.doc(security="jsonWebToken")
        def get(self):
            contratos = get_list_query(ContratoHonorario).all()
            return contratos

        @jwt_required()
        @tenant_scoped
        @finance_access_required
        @contratos_ns.expect(contrato_input_model_dto)
        @contratos_ns.marshal_with(contrato_model_dto, code=201)
        @contratos_ns.doc(security="jsonWebToken")
        def post(self):
            user_id = get_jwt_identity()
            data = request.get_json()

            user = User.query.get(int(user_id))
            if not user:
                contratos_ns.abort(401)

            caso = Caso.query.filter_by(id=data["caso_id"], tenant_id=user.tenant_id).first()
            if not caso:
                contratos_ns.abort(404, "Caso não encontrado.")

            if get_jwt().get("role") == "advogado" and caso.user_id != user_id:
                return {"message": "Acesso negado ao caso informado."}, 403

            vt = data.get("valor_total")
            pe = data.get("percentual_exito")
            da = data.get("data_assinatura")

            novo_contrato = ContratoHonorario(
                tipo_honorario=data["tipo_honorario"],
                valor_total=float(vt) if vt is not None else None,
                percentual_exito=float(pe) if pe is not None else None,
                status=data.get("status", "Ativo"),
                notas_condicoes=data.get("notas_condicoes"),
                caso_id=data["caso_id"],
                cliente_id=data["cliente_id"],
                user_id=user_id,
                tenant_id=get_tenant_id(),
            )

            if da:
                novo_contrato.data_assinatura = datetime.strptime(da, "%Y-%m-%d").date()

            db.session.add(novo_contrato)
            db.session.commit()
            return novo_contrato, 201

    @contratos_ns.route("/<int:id>")
    class ContratoDetailAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @finance_access_required
        @contratos_ns.marshal_with(contrato_model_dto)
        @contratos_ns.doc(security="jsonWebToken")
        def get(self, id):
            contrato = get_item_or_404(ContratoHonorario, id)
            return contrato

        @jwt_required()
        @tenant_scoped
        @finance_access_required
        @contratos_ns.expect(contrato_input_model_dto)
        @contratos_ns.marshal_with(contrato_model_dto)
        @contratos_ns.doc(security="jsonWebToken")
        def put(self, id):
            contrato = get_item_or_404(ContratoHonorario, id)
            data = request.get_json()
            contrato.tipo_honorario = data.get("tipo_honorario", contrato.tipo_honorario)
            vt = data.get("valor_total")
            contrato.valor_total = float(vt) if vt is not None else None
            pe = data.get("percentual_exito")
            contrato.percentual_exito = float(pe) if pe is not None else None
            da = data.get("data_assinatura")
            if da:
                contrato.data_assinatura = datetime.strptime(da, "%Y-%m-%d").date()
            contrato.status = data.get("status", contrato.status)
            contrato.notas_condicoes = data.get("notas_condicoes", contrato.notas_condicoes)
            db.session.commit()
            return contrato

        @jwt_required()
        @tenant_scoped
        @finance_access_required
        @contratos_ns.response(204, "Deletado com sucesso")
        @contratos_ns.doc(security="jsonWebToken")
        def delete(self, id):
            contrato = get_item_or_404(ContratoHonorario, id)
            db.session.delete(contrato)
            db.session.commit()
            return "", 204

    @contratos_ns.route("/<int:id>/arquivo")
    class ContratoArquivoAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @contratos_ns.doc(
            security="jsonWebToken",
            description="Baixa o arquivo PDF original do contrato. Retorna 404 se ainda nao foi anexado.",
        )
        def get(self, id):
            contrato = get_item_or_404(ContratoHonorario, id)
            if not contrato.arquivo_path or not os.path.exists(contrato.arquivo_path):
                return {
                    "message": "PDF original nao disponivel. Faca novo upload se desejar.",
                    "code": "pdf_unavailable",
                }, 404

            as_attachment = request.args.get("download", "0") == "1"
            file_directory = os.path.dirname(contrato.arquivo_path)
            file_name_on_disk = os.path.basename(contrato.arquivo_path)
            download_name = contrato.arquivo_nome or file_name_on_disk
            return send_from_directory(
                file_directory,
                file_name_on_disk,
                as_attachment=as_attachment,
                download_name=download_name,
            )

    @contratos_ns.route("/<int:id>/gerar-parcelas")
    class ContratoGerarParcelasAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @finance_access_required
        @contratos_ns.doc(security="jsonWebToken")
        def post(self, id):
            user_id = get_jwt_identity()
            contrato = get_item_or_404(ContratoHonorario, id)
            data = request.get_json() or {}
            qtd_parcelas = int(data.get("quantidade_parcelas", 1))
            primeiro_vencimento = data.get("primeiro_vencimento")

            if qtd_parcelas <= 0:
                return {"message": "Quantidade deve ser maior que zero."}, 400

            if not contrato.valor_total:
                return {"message": "O contrato deve ter um valor total para parcelar."}, 400

            valor_parcela = round(float(contrato.valor_total) / qtd_parcelas, 2)

            if primeiro_vencimento:
                data_base = datetime.strptime(primeiro_vencimento, "%Y-%m-%d").date()
            else:
                data_base = date.today()

            novos_recebimentos = []
            for i in range(qtd_parcelas):
                desc = f"Parcela {i+1}/{qtd_parcelas} - Cód. contrato {id}"
                venc = data_base + relativedelta(months=i)

                novo_rec = Recebimento(
                    descricao=desc,
                    valor=valor_parcela,
                    data_recebimento=venc,
                    recebido=False,
                    caso_id=contrato.caso_id,
                    # Fase 1 (auditoria UX): parcelas nasciam SEM tenant_id e
                    # sem cliente_id — com RLS no Postgres elas sumiam das
                    # listagens e não apareciam no financeiro do cliente.
                    cliente_id=contrato.cliente_id,
                    tenant_id=get_tenant_id(),
                    user_id=user_id,
                    contrato_id=id,
                )
                db.session.add(novo_rec)
                novos_recebimentos.append(novo_rec)

            db.session.commit()
            return {"message": f"{qtd_parcelas} parcelas geradas com sucesso!"}, 201
