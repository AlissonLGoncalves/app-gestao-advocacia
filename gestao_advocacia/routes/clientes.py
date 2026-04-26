import os
import re
from datetime import datetime

from flask import g, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from flask_restx import Resource
from werkzeug.datastructures import FileStorage

from extensions import db
from helpers import (
    get_existing_item,
    get_item_or_404,
    get_tenant_id,
    query_for_tenant,
    tenant_scoped,
)
from models import Caso, Cliente, log_audit


def register_clientes_routes(app, clientes_ns, cliente_input_model_dto, cliente_model_dto):
    def _cnj_digits(value):
        return re.sub(r"\D", "", value or "")

    def _find_caso_por_cnj_no_tenant(tenant_id, numero_cnj):
        target_digits = _cnj_digits(numero_cnj)
        if not target_digits:
            return None

        casos_tenant = Caso.query.filter(
            Caso.tenant_id == tenant_id,
            Caso.numero_processo.isnot(None),
        ).all()
        for caso in casos_tenant:
            if _cnj_digits(caso.numero_processo) == target_digits:
                return caso
        return None

    def _preencher_cliente_from_data(cliente, data):
        """Helper para preencher campos do cliente a partir dos dados recebidos."""
        cliente.nome_razao_social = data.get("nome_razao_social", cliente.nome_razao_social)
        cliente.tipo_pessoa = data.get("tipo_pessoa", cliente.tipo_pessoa)
        cliente.email = data.get("email", cliente.email)
        cliente.telefone = data.get("telefone", cliente.telefone)
        # Campos PF
        cliente.rg = data.get("rg", cliente.rg)
        cliente.orgao_emissor = data.get("orgao_emissor", cliente.orgao_emissor)
        dn = data.get("data_nascimento")
        if dn:
            try:
                cliente.data_nascimento = datetime.strptime(dn, "%Y-%m-%d").date()
            except (ValueError, TypeError):
                pass
        elif dn == "" or dn is None:
            cliente.data_nascimento = None
        cliente.estado_civil = data.get("estado_civil", cliente.estado_civil)
        cliente.profissao = data.get("profissao", cliente.profissao)
        cliente.nacionalidade = data.get("nacionalidade", cliente.nacionalidade)
        # Campos PJ
        cliente.nome_fantasia = data.get("nome_fantasia", cliente.nome_fantasia)
        cliente.nire = data.get("nire", cliente.nire)
        cliente.inscricao_estadual = data.get("inscricao_estadual", cliente.inscricao_estadual)
        cliente.inscricao_municipal = data.get("inscricao_municipal", cliente.inscricao_municipal)
        cliente.cnpj_secundario = data.get("cnpj_secundario", cliente.cnpj_secundario)
        cliente.descricao_cnpj_secundario = data.get(
            "descricao_cnpj_secundario", cliente.descricao_cnpj_secundario
        )
        cliente.cnpj_terciario = data.get("cnpj_terciario", cliente.cnpj_terciario)
        cliente.descricao_cnpj_terciario = data.get(
            "descricao_cnpj_terciario", cliente.descricao_cnpj_terciario
        )
        # Endereço
        cliente.cep = data.get("cep", cliente.cep)
        cliente.rua = data.get("rua", cliente.rua)
        cliente.numero = data.get("numero", cliente.numero)
        cliente.bairro = data.get("bairro", cliente.bairro)
        cliente.cidade = data.get("cidade", cliente.cidade)
        cliente.estado = data.get("estado", cliente.estado)
        cliente.pais = data.get("pais", cliente.pais)
        # Outros
        cliente.notas_gerais = data.get("notas_gerais", cliente.notas_gerais)
        return cliente

    upload_parser = clientes_ns.parser()
    upload_parser.add_argument(
        "documentos",
        location="files",
        type=FileStorage,
        required=True,
        action="append",
        help="Arquivos para OCR Biométrico (Até 100MB)",
    )

    @clientes_ns.route("/extrair-dados-doc")
    class ClienteExtrairDadosAPI(Resource):
        @jwt_required()
        @clientes_ns.doc(
            security="jsonWebToken",
            description="Processa um Lote de Documentos com OCR nativo para extração de dados.",
        )
        def post(self):
            user_id = get_jwt_identity()
            files = []
            if "documentos" in request.files:
                files = request.files.getlist("documentos")
            elif "documento" in request.files:
                # Compatibilidade para upload singular (ex.: procuração em PDF)
                files = [request.files["documento"]]
            else:
                return {
                    "message": "Nenhum arquivo enviado. Use o campo 'documentos' (lote) ou 'documento' (único)."
                }, 400

            if not files or files[0].filename == "":
                return {"message": "Nenhum arquivo selecionado."}, 400

            PERMITIDOS = [".pdf", ".txt", ".docx", ".xlsx", ".xls", ".jpg", ".jpeg", ".png"]

            try:
                from ocr_service import extract_client_data_from_file

                combined_data = {}

                for file in files:
                    extensao = (
                        "." + file.filename.split(".")[-1].lower() if "." in file.filename else ""
                    )
                    if extensao not in PERMITIDOS:
                        continue

                    dados = extract_client_data_from_file(file.stream, file.filename)
                    file.stream.seek(0)

                    if "error" not in dados:
                        for k, v in dados.items():
                            if v and not combined_data.get(k):
                                combined_data[k] = v

                if not combined_data:
                    return {
                        "message": "Motor finalizado sem identificar Biometrias visíveis nesta bateria de arquivos."
                    }, 422

                app.logger.info(f"Dados OCR LOTE extraídos com sucesso para usuário {user_id}.")
                return combined_data, 200
            except Exception as e:
                app.logger.error(f"Erro Crítico de OCR: {str(e)}")
                return {"message": "Erro interno de processamento dos arquivos."}, 500

    @clientes_ns.route("/")
    class ClienteListAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @clientes_ns.marshal_list_with(cliente_model_dto)
        @clientes_ns.doc(
            security="jsonWebToken", description="Lista todos os clientes do usuário autenticado."
        )
        def get(self):
            search = request.args.get("search", "").strip()
            tipo_pessoa = request.args.get("tipo_pessoa", "").strip()
            cidade = request.args.get("cidade", "").strip()
            estado = request.args.get("estado", "").strip().upper()
            profissao = request.args.get("profissao", "").strip()
            sort_by = request.args.get("sort_by", "nome_razao_social")
            sort_order = request.args.get("sort_order", "asc")
            query = query_for_tenant(Cliente)

            if search:
                like = f"%{search}%"
                query = query.filter(
                    db.or_(
                        Cliente.nome_razao_social.ilike(like),
                        Cliente.cpf_cnpj.ilike(like),
                        Cliente.email.ilike(like),
                    )
                )
            if tipo_pessoa:
                query = query.filter_by(tipo_pessoa=tipo_pessoa)
            if cidade:
                query = query.filter(Cliente.cidade.ilike(f"%{cidade}%"))
            if estado:
                query = query.filter(Cliente.estado == estado)
            if profissao:
                query = query.filter(Cliente.profissao.ilike(f"%{profissao}%"))
            ALLOWED_CLIENTE_SORT_FIELDS = {
                "nome_razao_social",
                "cpf_cnpj",
                "email",
                "tipo_pessoa",
                "id",
            }
            if sort_by not in ALLOWED_CLIENTE_SORT_FIELDS:
                sort_by = "nome_razao_social"
            col = getattr(Cliente, sort_by, Cliente.nome_razao_social)
            query = query.order_by(col.desc() if sort_order == "desc" else col.asc())
            return query.all()

        @jwt_required()
        @tenant_scoped
        @clientes_ns.expect(cliente_input_model_dto)
        @clientes_ns.doc(
            security="jsonWebToken", description="Cria um novo cliente para o usuário autenticado."
        )
        def post(self):
            user_id = get_jwt_identity()
            data = request.get_json()
            processo_cnj = (data or {}).pop("processo_cnj", None)
            if (
                not data.get("nome_razao_social")
                or not data.get("cpf_cnpj")
                or not data.get("tipo_pessoa")
            ):
                return {
                    "message": "Nome/Razão Social, CPF/CNPJ e Tipo de Pessoa são obrigatórios."
                }, 400
            if data["tipo_pessoa"] not in ("PF", "PJ"):
                return {"message": "Tipo de pessoa deve ser 'PF' ou 'PJ'."}, 400
            cpf_cnpj_limpo = data["cpf_cnpj"].strip()
            existente = get_existing_item(Cliente, cpf_cnpj=cpf_cnpj_limpo)
            if existente:
                return {"message": f"Já existe um cliente com o CPF/CNPJ '{cpf_cnpj_limpo}'."}, 409
            novo_cliente = Cliente(
                cpf_cnpj=cpf_cnpj_limpo, user_id=user_id, tenant_id=get_tenant_id()
            )
            _preencher_cliente_from_data(novo_cliente, data)
            db.session.add(novo_cliente)
            db.session.flush()
            log_audit(
                "CREATE", "Cliente", novo_cliente.id, f"Cliente {novo_cliente.cpf_cnpj} cadastrado."
            )

            if processo_cnj:
                tenant_id = g.tenant_id
                caso_existente = _find_caso_por_cnj_no_tenant(tenant_id, processo_cnj)

                if (
                    caso_existente
                    and getattr(caso_existente, "cliente_id", None) == novo_cliente.id
                ):
                    db.session.commit()
                    return {
                        "cliente": novo_cliente.to_dict(),
                        "caso_existente": True,
                        "caso_id": caso_existente.id,
                    }, 201

                if caso_existente:
                    db.session.commit()
                    return {
                        "cliente": novo_cliente.to_dict(),
                        "caso_existente": True,
                        "caso_id": caso_existente.id,
                    }, 201

                db.session.commit()
                return {
                    "cliente": novo_cliente.to_dict(),
                    "caso_existente": False,
                    "numero_cnj_sugerido": processo_cnj,
                }, 201

            db.session.commit()
            app.logger.info(
                f"Novo cliente '{novo_cliente.nome_razao_social}' (ID: {novo_cliente.id}) criado para usuário ID {user_id}."
            )
            return novo_cliente.to_dict(), 201

    @clientes_ns.route("/<int:cliente_id_param>")
    @clientes_ns.response(404, "Cliente não encontrado ou não pertence ao usuário.")
    @clientes_ns.param("cliente_id_param", "O ID único do cliente")
    class ClienteDetailAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @clientes_ns.marshal_with(cliente_model_dto)
        @clientes_ns.doc(
            security="jsonWebToken", description="Obtém os detalhes de um cliente específico."
        )
        def get(self, cliente_id_param):
            cliente = get_item_or_404(Cliente, cliente_id_param)
            return cliente

        @jwt_required()
        @tenant_scoped
        @clientes_ns.expect(cliente_input_model_dto)
        @clientes_ns.marshal_with(cliente_model_dto)
        @clientes_ns.doc(
            security="jsonWebToken", description="Atualiza os dados de um cliente existente."
        )
        def put(self, cliente_id_param):
            user_id = get_jwt_identity()
            cliente = get_item_or_404(Cliente, cliente_id_param)
            data = request.get_json()
            if not data.get("nome_razao_social"):
                return {"message": "Nome/Razão Social é obrigatório."}, 400
            _preencher_cliente_from_data(cliente, data)
            log_audit("UPDATE", "Cliente", cliente.id, "Atualização de dados cadastrais.")
            db.session.commit()
            app.logger.info(f"Cliente ID {cliente.id} atualizado pelo usuário ID {user_id}.")
            return cliente

        @jwt_required()
        @tenant_scoped
        @clientes_ns.response(204, "Cliente deletado com sucesso.")
        @clientes_ns.response(400, "Não é possível deletar cliente com casos associados.")
        @clientes_ns.doc(
            security="jsonWebToken",
            description="Deleta um cliente, se não houver casos associados.",
        )
        def delete(self, cliente_id_param):
            user_id = get_jwt_identity()
            cliente = get_item_or_404(Cliente, cliente_id_param)
            if cliente.casos.first():
                return {
                    "message": "Não é possível deletar cliente com casos associados. Utilize a funcionalidade Anonimizar."
                }, 400
            log_audit("DELETE", "Cliente", cliente.id, f"Exclusão do cliente ({cliente.cpf_cnpj}).")
            db.session.delete(cliente)
            db.session.commit()
            app.logger.info(
                f"Cliente ID {cliente.id} ('{cliente.nome_razao_social}') deletado pelo usuário ID {user_id}."
            )
            return "", 204

    @clientes_ns.route("/<int:cliente_id_param>/anonimizar")
    @clientes_ns.response(404, "Cliente não encontrado.")
    @clientes_ns.param("cliente_id_param", "O ID único do cliente")
    class ClienteAnonimizarAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @clientes_ns.doc(
            security="jsonWebToken",
            description="Executa o Direito ao Esquecimento (Art. 18 LGPD). Mascara os dados pessoais e exclui documentos associados.",
        )
        def post(self, cliente_id_param):
            user_id = get_jwt_identity()
            cliente = get_item_or_404(Cliente, cliente_id_param)

            for caso in cliente.casos:
                for doc in caso.documentos_caso:
                    try:
                        if os.path.exists(doc.path_arquivo):
                            os.remove(doc.path_arquivo)
                    except Exception as e:
                        app.logger.error(f"Erro ao deletar arquivo físico {doc.path_arquivo}: {e}")
                    db.session.delete(doc)

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
            cliente.notas_gerais = (
                "Dados originais destruídos a pedido do titular (Direito ao Esquecimento - LGPD)."
            )

            log_audit(
                "UPDATE",
                "Cliente",
                cliente.id,
                f"Tratamento de Exclusão/Anonimização LGPD executado no cliente ({cliente_original_nome}).",
            )
            db.session.commit()

            app.logger.info(
                f"Cliente ID {cliente.id} anonimizado pelo usuário ID {user_id}. Todos os documentos associados foram purgados."
            )
            return {
                "message": "Direito ao esquecimento executado. Dados mascarados e documentos apagados."
            }, 200
