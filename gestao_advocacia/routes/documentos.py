import os

from flask import request, send_from_directory
from flask_jwt_extended import get_jwt_identity, jwt_required
from flask_restx import Resource
from werkzeug.utils import secure_filename

from extensions import db
from helpers import get_item_or_404, get_tenant_id, query_for_tenant, tenant_scoped
from models import Caso, Documento
from upload_validator import validar_upload


def register_documentos_routes(app, documentos_ns, documento_model_dto):
    @documentos_ns.route("/")
    class DocumentoListAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @documentos_ns.marshal_list_with(documento_model_dto)
        @documentos_ns.doc(
            security="jsonWebToken",
            description="Lista documentos do usuario, com filtro opcional por 'caso_id'.",
        )
        @documentos_ns.param(
            "caso_id", "ID do caso para filtrar os documentos (opcional)", type=int
        )
        def get(self):
            caso_id_query_param = request.args.get("caso_id", type=int)
            query = query_for_tenant(Documento)
            if caso_id_query_param is not None:
                query = query.filter_by(caso_id=caso_id_query_param)
            documentos = query.order_by(Documento.data_upload.desc()).all()
            return documentos

    @documentos_ns.route("/cliente/<int:cliente_id>")
    class DocumentoListByClienteAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @documentos_ns.marshal_list_with(documento_model_dto)
        @documentos_ns.doc(
            security="jsonWebToken",
            description="Lista documentos vinculados a casos de um cliente específico.",
        )
        def get(self, cliente_id):
            query = (
                query_for_tenant(Documento)
                .join(Caso, Documento.caso_id == Caso.id)
                .filter(Caso.cliente_id == cliente_id)
            )
            documentos = query.order_by(Documento.data_upload.desc()).all()
            return documentos

    @documentos_ns.route("/upload")
    class DocumentoUploadAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @documentos_ns.doc(
            security="jsonWebToken",
            description="Faz upload de um novo documento. Use 'multipart/form-data'. Campo 'file' para o arquivo e opcionalmente 'caso_id' no formulario.",
        )
        @documentos_ns.response(201, "Documento enviado com sucesso.", model=documento_model_dto)
        @documentos_ns.response(400, "Erro nos dados de entrada ou tipo de arquivo nao permitido.")
        def post(self):
            user_id = get_jwt_identity()
            if "file" not in request.files:
                return {
                    "message": 'Nenhum arquivo foi incluido na requisicao (campo "file" ausente).'
                }, 400
            file_storage = request.files["file"]
            if file_storage.filename == "":
                return {"message": "Nenhum arquivo foi selecionado para upload."}, 400
            ok, motivo = validar_upload(file_storage)
            if file_storage and ok:
                original_filename = secure_filename(file_storage.filename)
                user_upload_folder_path = os.path.join(app.config["UPLOAD_FOLDER"], str(user_id))
                os.makedirs(user_upload_folder_path, exist_ok=True)
                file_base, file_ext = os.path.splitext(original_filename)
                counter = 1
                final_filename_to_save = original_filename
                full_file_path_to_save = os.path.join(
                    user_upload_folder_path, final_filename_to_save
                )
                while os.path.exists(full_file_path_to_save):
                    final_filename_to_save = f"{file_base}_{counter}{file_ext}"
                    full_file_path_to_save = os.path.join(
                        user_upload_folder_path, final_filename_to_save
                    )
                    counter += 1
                file_storage.save(full_file_path_to_save)
                caso_id_from_form = request.form.get("caso_id")
                db_caso_id = None
                if caso_id_from_form:
                    try:
                        db_caso_id = int(caso_id_from_form)
                        if not query_for_tenant(Caso).filter_by(id=db_caso_id).first():
                            os.remove(full_file_path_to_save)
                            return {
                                "message": f"Caso com ID {db_caso_id} nao encontrado ou nao pertence ao usuario."
                            }, 400
                    except ValueError:
                        os.remove(full_file_path_to_save)
                        return {"message": 'O valor fornecido para "caso_id" e invalido.'}, 400
                novo_documento_db = Documento(
                    nome_arquivo=final_filename_to_save,
                    path_arquivo=full_file_path_to_save,
                    user_id=user_id,
                    caso_id=db_caso_id,
                    tenant_id=get_tenant_id(),
                )
                db.session.add(novo_documento_db)
                db.session.commit()
                app.logger.info(
                    f"Documento '{novo_documento_db.nome_arquivo}' (ID: {novo_documento_db.id}) salvo para usuario ID {user_id}."
                )
                doc_dict = novo_documento_db.to_dict()
                return doc_dict, 201
            return {"message": motivo or "Tipo de arquivo nao permitido."}, 400

    @documentos_ns.route("/download/<int:doc_id_param>")
    @documentos_ns.param("doc_id_param", "O ID do documento para realizar o download")
    class DocumentoDownloadAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @documentos_ns.doc(
            security="jsonWebToken", description="Permite o download de um documento especifico."
        )
        @documentos_ns.response(404, "Documento nao encontrado ou acesso negado.")
        @documentos_ns.response(500, "Erro no servidor ao tentar enviar o arquivo.")
        def get(self, doc_id_param):
            documento_db = get_item_or_404(Documento, doc_id_param)
            if not os.path.exists(documento_db.path_arquivo):
                app.logger.error(
                    f"Arquivo para Doc ID {doc_id_param} nao encontrado em '{documento_db.path_arquivo}'."
                )
                return {"message": "Arquivo nao encontrado no servidor."}, 500
            try:
                file_directory = os.path.dirname(documento_db.path_arquivo)
                file_name_on_disk = os.path.basename(documento_db.path_arquivo)
                return send_from_directory(
                    file_directory,
                    file_name_on_disk,
                    as_attachment=True,
                    download_name=documento_db.nome_arquivo,
                )
            except Exception as e_download:
                app.logger.error(
                    f"Erro ao enviar arquivo '{documento_db.path_arquivo}' (Doc ID: {doc_id_param}): {str(e_download)}"
                )
                return {"message": "Erro ao processar download."}, 500

    @documentos_ns.route("/<int:doc_id_param>")
    @documentos_ns.response(404, "Documento nao encontrado.")
    @documentos_ns.param("doc_id_param", "O ID do documento a ser deletado")
    class DocumentoDetailAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @documentos_ns.response(204, "Documento deletado com sucesso.")
        @documentos_ns.doc(security="jsonWebToken", description="Deleta um documento especifico.")
        def delete(self, doc_id_param):
            user_id = get_jwt_identity()
            documento_db = get_item_or_404(Documento, doc_id_param)
            file_path_on_disk = documento_db.path_arquivo
            document_name_log = documento_db.nome_arquivo
            try:
                if os.path.exists(file_path_on_disk):
                    os.remove(file_path_on_disk)
                else:
                    app.logger.warning(
                        f"Arquivo fisico '{file_path_on_disk}' para Doc ID {doc_id_param} nao encontrado durante exclusao."
                    )
            except Exception as e_delete_file:
                app.logger.error(
                    f"Erro ao deletar arquivo fisico '{file_path_on_disk}' para Doc ID {doc_id_param}: {str(e_delete_file)}"
                )
            db.session.delete(documento_db)
            db.session.commit()
            app.logger.info(
                f"Documento ID {doc_id_param} ('{document_name_log}') deletado pelo usuario ID {user_id}."
            )
            return "", 204
