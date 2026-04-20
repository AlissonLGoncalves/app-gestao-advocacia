import hashlib
import os
import re
import uuid
from datetime import datetime

from flask import g, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from flask_restx import Resource

from extensions import db
from helpers import tenant_scoped
from models import Caso, Cliente, ProcuracaoAnalise, log_audit
from procuracao_service import extrair_dados_procuracao, validar_extracao

ALLOWED_MIME_TYPES = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
}
MAX_FILE_SIZE = 10 * 1024 * 1024


def _upload_root(app):
    return app.config.get("PROCURACOES_UPLOAD_ROOT") or os.path.join(
        os.sep, "data", "uploads", "procuracoes"
    )


def _cnj_valido(numero_cnj):
    return bool(re.fullmatch(r"\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}", numero_cnj or ""))


def register_procuracoes_routes(app, procuracoes_ns, procuracao_model_dto):
    @procuracoes_ns.route("/analisar")
    class ProcuracaoAnaliseCreateAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @procuracoes_ns.doc(
            security="jsonWebToken",
            description="Recebe PDF ou DOCX de procuração e retorna a análise estruturada.",
        )
        @procuracoes_ns.marshal_with(procuracao_model_dto, code=201)
        def post(self):
            tenant_id = g.tenant_id
            user_id = get_jwt_identity()

            if "arquivo" not in request.files:
                procuracoes_ns.abort(400, 'Nenhum arquivo enviado no campo "arquivo".')

            arquivo = request.files["arquivo"]
            if not arquivo or not arquivo.filename:
                procuracoes_ns.abort(400, "Nenhum arquivo selecionado.")

            mime_type = (arquivo.mimetype or "").split(";")[0].strip().lower()
            if mime_type not in ALLOWED_MIME_TYPES:
                procuracoes_ns.abort(400, "Mime type inválido. Envie PDF ou DOCX.")

            payload = arquivo.read()
            if len(payload) > MAX_FILE_SIZE:
                return {"message": "Arquivo acima do limite de 10MB."}, 413

            arquivo_hash = hashlib.sha256(payload).hexdigest()
            extensao = ALLOWED_MIME_TYPES[mime_type]
            base_dir = os.path.join(_upload_root(app), str(tenant_id))
            os.makedirs(base_dir, exist_ok=True)
            arquivo_path = os.path.join(base_dir, f"{uuid.uuid4().hex}{extensao}")

            with open(arquivo_path, "wb") as handler:
                handler.write(payload)

            analise = ProcuracaoAnalise(
                tenant_id=tenant_id,
                user_id=user_id,
                arquivo_path=arquivo_path,
                arquivo_hash=arquivo_hash,
                status="processing",
            )
            db.session.add(analise)
            db.session.commit()

            try:
                dados_extraidos = extrair_dados_procuracao(arquivo_path, mime_type)
                _, avisos_validacao = validar_extracao(dados_extraidos)

                analise.status = "done"
                analise.dados_extraidos = dados_extraidos
                analise.erro = None
                analise.processado_em = datetime.utcnow()
                log_audit("CREATE", "ProcuracaoAnalise", analise.id, "Procuração analisada.")
                db.session.commit()

                app.logger.info(
                    "procuracao_analisada",
                    extra={
                        "event": "procuracao_analisada",
                        "user_id": user_id,
                        "tenant_id": tenant_id,
                        "procuracao_id": analise.id,
                        "arquivo_hash": arquivo_hash,
                    },
                )

                response_payload = analise.to_dict()
                response_payload["avisos_validacao"] = avisos_validacao
                return response_payload, 201
            except Exception as exc:
                analise.status = "failed"
                analise.erro = str(exc)
                analise.processado_em = datetime.utcnow()
                db.session.commit()

                return {
                    "id": analise.id,
                    "status": analise.status,
                    "dados_extraidos": analise.dados_extraidos,
                    "avisos_validacao": [],
                    "erro": analise.erro,
                    "arquivo_hash": analise.arquivo_hash,
                    "criado_em": analise.criado_em.isoformat() if analise.criado_em else None,
                    "processado_em": (
                        analise.processado_em.isoformat() if analise.processado_em else None
                    ),
                }, 500

    @procuracoes_ns.route("/<int:analise_id>")
    class ProcuracaoAnaliseDetailAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @procuracoes_ns.doc(
            security="jsonWebToken",
            description="Retorna uma análise de procuração já processada.",
        )
        @procuracoes_ns.marshal_with(procuracao_model_dto)
        def get(self, analise_id):
            analise = db.session.get(ProcuracaoAnalise, analise_id)
            if not analise:
                procuracoes_ns.abort(404, "Análise de procuração não encontrada.")
            if analise.tenant_id != g.tenant_id:
                procuracoes_ns.abort(403, "Acesso negado a análise de outro tenant.")

            _, avisos_validacao = validar_extracao(analise.dados_extraidos or {})
            response_payload = analise.to_dict()
            response_payload["avisos_validacao"] = avisos_validacao
            return response_payload

    @procuracoes_ns.route("/<int:analise_id>/criar-caso")
    class ProcuracaoCriarCasoAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @procuracoes_ns.doc(
            security="jsonWebToken",
            description="Cria caso a partir dos dados de processo extraídos da procuração.",
        )
        def post(self, analise_id):
            payload = request.get_json() or {}
            cliente_id = payload.get("cliente_id")
            if not cliente_id:
                procuracoes_ns.abort(400, "cliente_id é obrigatório.")

            analise = db.session.get(ProcuracaoAnalise, analise_id)
            if not analise:
                procuracoes_ns.abort(404, "Análise de procuração não encontrada.")
            if analise.tenant_id != g.tenant_id:
                procuracoes_ns.abort(403, "Acesso negado a análise de outro tenant.")

            cliente = (
                Cliente.query.filter_by(id=cliente_id, tenant_id=g.tenant_id).first()
                if cliente_id
                else None
            )
            if not cliente:
                procuracoes_ns.abort(404, "Cliente não encontrado no tenant atual.")

            processo = (analise.dados_extraidos or {}).get("processo") or {}
            numero_cnj = (processo.get("numero_cnj") or "").strip()
            tribunal = (processo.get("tribunal") or "").strip()
            vara = (processo.get("vara") or "").strip()

            if not _cnj_valido(numero_cnj):
                procuracoes_ns.abort(400, "Número CNJ inválido para criação de caso.")
            if not tribunal:
                procuracoes_ns.abort(400, "Tribunal ausente na extração da procuração.")
            if not vara:
                procuracoes_ns.abort(400, "Vara ausente na extração da procuração.")

            caso_existente = Caso.query.filter_by(
                tenant_id=g.tenant_id,
                numero_processo=numero_cnj,
            ).first()
            if caso_existente:
                procuracoes_ns.abort(409, "Já existe caso com esse número CNJ no tenant.")

            user_id = get_jwt_identity()
            caso = Caso(
                titulo=f"Processo {numero_cnj}",
                numero_processo=numero_cnj,
                vara_juizo=vara,
                comarca=tribunal,
                cliente_id=cliente.id,
                user_id=user_id,
                tenant_id=g.tenant_id,
            )
            db.session.add(caso)
            db.session.flush()
            log_audit(
                "CREATE",
                "Caso",
                caso.id,
                f"Caso criado via procuração {analise.id} para cliente {cliente.id}.",
            )
            db.session.commit()
            return caso.to_dict(), 201
