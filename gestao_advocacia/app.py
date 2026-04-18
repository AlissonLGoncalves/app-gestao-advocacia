# ==============================================================================
# ARQUIVO: gestao_advocacia/app.py (COMPLETO)
# Contém a factory function create_app, definições de modelos,
# namespaces da API, rotas e inicialização do APScheduler.
# ==============================================================================
import os
import re
import uuid

# Definições base
from dotenv import load_dotenv
from flask import Blueprint, Flask, g, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import get_jwt_identity, jwt_required
from flask_restx import Api, Namespace, fields
from werkzeug.exceptions import HTTPException

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads_documentos")
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# Importe suas configurações, o serviço CNJ e a nova task
# Assumindo que config.py, cnj_service.py, tasks.py estão no mesmo diretório (gestao_advocacia)
from functools import wraps

from flask_jwt_extended import get_jwt
from flask_restx import abort

from config import Config
from extensions import db, jwt, migrate, scheduler
from logging_config import configure_json_logging
from openapi_docs import register_openapi_docs
from routes import (
    register_auditoria_routes,
    register_auth_routes,
    register_casos_routes,
    register_clientes_routes,
    register_dashboard_routes,
    register_documentos_routes,
    register_eventos_routes,
    register_tarefas_routes,
)
from routes.financeiro_registry import register_financeiro_api
from tasks import job_verificar_processos_cnj


def finance_access_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        claims = get_jwt()
        if claims.get("role", "") == "assistente":
            abort(403, "Acesso negado: Perfil 'assistente' não tem acesso a dados financeiros.")
        return fn(*args, **kwargs)

    return wrapper


from models import (
    Caso,
    Cliente,
    Despesa,
    DjenVinculoDecisao,
    DjenOabMonitoramento,
    PublicacaoDJEN,
    Recebimento,
    Tenant,
    User,
)
from helpers import get_item_or_404  # noqa: F401


# Factory Function para criar a aplicação Flask
def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
    app.url_map.strict_slashes = False

    configure_json_logging(app)
    app.logger.info(
        "app_startup",
        extra={
            "event": "app_startup",
            "app_version": app.config.get("APP_VERSION"),
            "log_level": app.config.get("LOG_LEVEL"),
        },
    )

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    # Restrict CORS to known frontend origins instead of allowing all domains
    allowed_origins = [
        os.environ.get("FRONTEND_URL", "http://localhost:5173"),
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "https://app-gestao-advocacia.vercel.app",
        re.compile(r"https://.*\.vercel\.app$"),
    ]
    # Allow additional origins via comma-separated env var
    extra_origins = os.environ.get("CORS_ALLOWED_ORIGINS", "")
    if extra_origins:
        allowed_origins.extend([o.strip() for o in extra_origins.split(",") if o.strip()])
    CORS(app, origins=allowed_origins)

    @app.before_request
    def set_request_context():
        incoming_request_id = request.headers.get("X-Request-ID")
        g.request_id = incoming_request_id if incoming_request_id else str(uuid.uuid4())

    @app.after_request
    def add_request_id_header(response):
        response.headers["X-Request-ID"] = getattr(g, "request_id", "-")
        return response

    @app.errorhandler(Exception)
    def handle_unhandled_exception(error):
        if isinstance(error, HTTPException) and error.code < 500:
            return error

        status_code = error.code if isinstance(error, HTTPException) else 500
        app.logger.exception(
            "server_error",
            extra={
                "event": "server_error",
                "endpoint": request.path,
                "method": request.method,
                "status_code": status_code,
            },
        )

        if isinstance(error, HTTPException):
            return error
        return jsonify({"message": "Erro interno do servidor."}), 500

    api_bp = Blueprint("api", __name__, url_prefix="/api")
    # Disable Swagger UI in production to avoid exposing the full API surface
    swagger_doc_path = "/api/docs" if os.environ.get("FLASK_ENV") != "production" else False
    api = Api(
        api_bp,
        version="1.0",
        title="API Gestão Advocacia",
        description="API para gerenciar informações de um escritório de advocacia.",
        doc=swagger_doc_path,
        authorizations={
            "jsonWebToken": {
                "type": "apiKey",
                "in": "header",
                "name": "Authorization",
                "description": "Token JWT no formato 'Bearer <token>'. Ex: \"Bearer ey...\"",
            }
        },
        security="jsonWebToken",
    )

    # --- NAMESPACES DA API ---
    auth_ns = Namespace("auth", description="Operações de Autenticação")
    clientes_ns = Namespace("clientes", description="Operações de Clientes")
    casos_ns = Namespace("casos", description="Operações de Casos Jurídicos")
    eventos_ns = Namespace("eventos", description="Operações de Eventos da Agenda")
    documentos_ns = Namespace("documentos", description="Operações de Documentos")
    dashboard_ns = Namespace("dashboard", description="Dados agregados para o Dashboard")
    audit_ns = Namespace("auditoria", description="Trilhas de Auditoria e Logs (LGPD)")
    tarefas_ns = Namespace("tarefas", description="Operações de Prazos e Tarefas")
    djen_ns = Namespace(
        "djen", description="Publicações DJEN — Diário de Justiça Eletrônico Nacional"
    )

    api.add_namespace(auth_ns)
    api.add_namespace(clientes_ns)
    api.add_namespace(casos_ns)
    api.add_namespace(eventos_ns)
    api.add_namespace(documentos_ns)
    api.add_namespace(dashboard_ns)
    api.add_namespace(audit_ns)
    api.add_namespace(tarefas_ns)
    api.add_namespace(djen_ns)

    # --- DEFINIÇÃO DOS MODELOS DA API (DTOs - Data Transfer Objects) para Flask-RESTx ---
    user_model_dto = auth_ns.model(
        "UserRegistration",
        {
            "username": fields.String(required=True, description="Nome de usuário único"),
            "email": fields.String(
                required=True, description="Email único do usuário", format="email"
            ),
            "password": fields.String(
                required=True, description="Senha do usuário (mínimo 6 caracteres)", min_length=6
            ),
            "role": fields.String(
                description="Papel do usuário (admin, advogado, assistente)",
                default="admin",
                enum=["admin", "advogado", "assistente"],
            ),
            "documento_identificacao": fields.String(
                description="CPF ou CNPJ preenchido no cadastro (SaaS)"
            ),
            "tipo_pessoa": fields.String(description="PF ou PJ"),
            "oab": fields.String(description="Registro OAB (se houver)"),
        },
    )
    login_model_dto = auth_ns.model(
        "UserLogin",
        {
            "username_or_email": fields.String(
                required=True, description="Nome de usuário ou email para login"
            ),
            "password": fields.String(required=True, description="Senha para login"),
        },
    )
    user_output_model_dto = auth_ns.model(
        "UserOutput",
        {
            "id": fields.Integer(readonly=True, description="ID único do usuário"),
            "username": fields.String(description="Nome de usuário"),
            "email": fields.String(description="Email do usuário"),
            "role": fields.String(description="Papel do usuário no sistema"),
        },
    )

    audit_log_model_dto = audit_ns.model(
        "AuditLogOutput",
        {
            "id": fields.Integer(readonly=True),
            "username": fields.String(),
            "acao": fields.String(),
            "tabela_afetada": fields.String(),
            "registro_id": fields.Integer(),
            "detalhes": fields.String(),
            "data_hora": fields.String(),
        },
    )

    user_invite_dto = auth_ns.model(
        "UserInvite",
        {
            "email": fields.String(required=True, description="Email do convidado", format="email"),
            "role": fields.String(
                description="Papel do convidado",
                default="advogado",
                enum=["advogado", "assistente"],
            ),
        },
    )

    user_register_invite_dto = auth_ns.model(
        "UserRegisterInvite",
        {
            "invite_token": fields.String(required=True, description="Token Mágico JWT"),
            "username": fields.String(required=True, description="Nome Completo do Convidado"),
            "password": fields.String(required=True, description="Senha para a conta"),
        },
    )
    token_model_dto = auth_ns.model(
        "Token",
        {
            "access_token": fields.String(
                description="Token de Acesso JWT gerado após login bem-sucedido"
            ),
            "user": fields.Nested(
                user_output_model_dto, description="Dados do usuário", skip_none=True
            ),
        },
    )

    register_auth_routes(
        app,
        auth_ns,
        user_model_dto,
        user_invite_dto,
        user_register_invite_dto,
        login_model_dto,
        token_model_dto,
        user_output_model_dto,
    )

    cliente_input_model_dto = clientes_ns.model(
        "ClienteInput",
        {
            "nome_razao_social": fields.String(
                required=True, description="Nome completo ou Razão Social"
            ),
            "cpf_cnpj": fields.String(required=True, description="CPF ou CNPJ principal"),
            "tipo_pessoa": fields.String(required=True, description="PF ou PJ", enum=["PF", "PJ"]),
            "email": fields.String(description="Email do cliente"),
            "telefone": fields.String(description="Telefone do cliente"),
            "rg": fields.String(description="RG (PF)"),
            "orgao_emissor": fields.String(description="Órgão emissor do RG"),
            "data_nascimento": fields.String(description="Data de nascimento (YYYY-MM-DD)"),
            "estado_civil": fields.String(description="Estado civil"),
            "profissao": fields.String(description="Profissão"),
            "nacionalidade": fields.String(description="Nacionalidade"),
            "nome_fantasia": fields.String(description="Nome Fantasia (PJ)"),
            "nire": fields.String(description="NIRE (PJ)"),
            "inscricao_estadual": fields.String(description="Inscrição Estadual (PJ)"),
            "inscricao_municipal": fields.String(description="Inscrição Municipal (PJ)"),
            "cnpj_secundario": fields.String(description="CNPJ Secundário (PJ)"),
            "descricao_cnpj_secundario": fields.String(description="Descrição do CNPJ Secundário"),
            "cnpj_terciario": fields.String(description="CNPJ Terciário (PJ)"),
            "descricao_cnpj_terciario": fields.String(description="Descrição do CNPJ Terciário"),
            "cep": fields.String(description="CEP"),
            "rua": fields.String(description="Rua/Logradouro"),
            "numero": fields.String(description="Número"),
            "bairro": fields.String(description="Bairro"),
            "cidade": fields.String(description="Cidade"),
            "estado": fields.String(description="Estado (UF)"),
            "pais": fields.String(description="País"),
            "notas_gerais": fields.String(description="Notas gerais sobre o cliente"),
        },
    )
    cliente_model_dto = clientes_ns.model(
        "ClienteOutput",
        {
            "id": fields.Integer(readonly=True, description="ID único do cliente"),
            "nome_razao_social": fields.String(description="Nome completo ou Razão Social"),
            "cpf_cnpj": fields.String(description="CPF ou CNPJ principal"),
            "tipo_pessoa": fields.String(description="PF ou PJ"),
            "email": fields.String(description="Email do cliente"),
            "telefone": fields.String(description="Telefone do cliente"),
            "rg": fields.String,
            "orgao_emissor": fields.String,
            "data_nascimento": fields.String,
            "estado_civil": fields.String,
            "profissao": fields.String,
            "nacionalidade": fields.String,
            "nome_fantasia": fields.String,
            "nire": fields.String,
            "inscricao_estadual": fields.String,
            "inscricao_municipal": fields.String,
            "cnpj_secundario": fields.String,
            "descricao_cnpj_secundario": fields.String,
            "cnpj_terciario": fields.String,
            "descricao_cnpj_terciario": fields.String,
            "cep": fields.String,
            "rua": fields.String,
            "numero": fields.String,
            "bairro": fields.String,
            "cidade": fields.String,
            "estado": fields.String,
            "pais": fields.String,
            "notas_gerais": fields.String,
            "user_id": fields.Integer(description="ID do usuário advogado responsável"),
        },
    )

    register_clientes_routes(
        app,
        clientes_ns,
        cliente_input_model_dto,
        cliente_model_dto,
    )

    caso_input_model_dto = casos_ns.model(
        "CasoInput",
        {
            "titulo": fields.String(required=True, description="Título do caso"),
            "numero_processo": fields.String(description="Número do processo CNJ"),
            "status": fields.String(description="Status (Ativo, Suspenso, Encerrado, Arquivado)"),
            "tipo_acao": fields.String(description="Tipo de ação"),
            "area_direito": fields.String(description="Área do direito"),
            "fase_processual": fields.String(description="Fase processual"),
            "vara_juizo": fields.String(description="Vara/Juízo"),
            "comarca": fields.String(description="Comarca"),
            "instancia": fields.String(description="Instância"),
            "parte_contraria": fields.String(description="Parte contrária"),
            "adv_parte_contraria": fields.String(description="Advogado da parte contrária"),
            "valor_causa": fields.Float(description="Valor da causa em R$"),
            "data_distribuicao": fields.String(description="Data de distribuição (YYYY-MM-DD)"),
            "notas_caso": fields.String(description="Notas sobre o caso"),
            "cliente_id": fields.Integer(required=True, description="ID do cliente associado"),
        },
    )
    caso_model_dto = casos_ns.model(
        "CasoOutput",
        {
            "id": fields.Integer(readonly=True),
            "titulo": fields.String,
            "numero_processo": fields.String,
            "status": fields.String,
            "tipo_acao": fields.String,
            "area_direito": fields.String,
            "fase_processual": fields.String,
            "vara_juizo": fields.String,
            "comarca": fields.String,
            "instancia": fields.String,
            "parte_contraria": fields.String,
            "adv_parte_contraria": fields.String,
            "valor_causa": fields.String,
            "data_distribuicao": fields.String,
            "notas_caso": fields.String,
            "data_criacao": fields.DateTime(dt_format="iso8601"),
            "data_atualizacao": fields.DateTime(dt_format="iso8601"),
            "cliente_id": fields.Integer,
            "cliente": fields.Raw(description="Objeto cliente {id, nome_razao_social}"),
            "user_id": fields.Integer,
            "data_ultima_verificacao_cnj": fields.DateTime(dt_format="iso8601", nullable=True),
            "movimentacoes_cnj_count": fields.Integer,
        },
    )

    movimentacao_cnj_output_model_dto = casos_ns.model(
        "MovimentacaoCNJOutput",
        {
            "id": fields.Integer(readonly=True, description="ID da movimentação no sistema local"),
            "data_movimentacao": fields.DateTime(
                dt_format="iso8601",
                description="Data/hora da movimentação conforme consta no processo CNJ",
            ),
            "descricao": fields.String(
                required=True, description="Descrição da movimentação processual"
            ),
            "dados_integra_cnj": fields.Raw(
                description="JSON original completo da movimentação como recebido da API do CNJ (pode ser extenso e técnico)"
            ),
            "data_registro_sistema": fields.DateTime(
                dt_format="iso8601",
                description="Data/hora em que esta movimentação foi registrada no sistema local",
            ),
        },
    )

    register_casos_routes(
        app,
        casos_ns,
        caso_input_model_dto,
        caso_model_dto,
        movimentacao_cnj_output_model_dto,
    )

    evento_input_model_dto = eventos_ns.model(
        "EventoInput",
        {
            "titulo": fields.String(required=True, description="Título do evento da agenda"),
            "data_inicio": fields.DateTime(
                required=True, description="Data e hora de início (formato ISO 8601)"
            ),
            "data_fim": fields.DateTime(description="Data e hora de término (formato ISO 8601)"),
            "descricao": fields.String(description="Descrição extra"),
            "tipo_evento": fields.String(description="Prazo, Audiência, Reunião, Outros"),
            "prioridade": fields.String(description="Baixa, Normal, Alta, Urgente"),
            "status_evento": fields.String(description="Pendente, Concluído, Cancelado"),
        },
    )
    evento_model_dto = eventos_ns.model(
        "EventoOutput",
        {
            "id": fields.Integer(readonly=True),
            "title": fields.String(
                attribute="titulo", description="Título do evento (compatível com FullCalendar)"
            ),
            "start": fields.DateTime(
                attribute="data_inicio",
                dt_format="iso8601",
                description="Início do evento (compatível com FullCalendar)",
            ),
            "end": fields.DateTime(
                attribute="data_fim",
                dt_format="iso8601",
                nullable=True,
                description="Fim do evento (compatível com FullCalendar)",
            ),
            "description": fields.String(
                attribute="descricao", nullable=True, description="Descrição do evento"
            ),
            "tipo_evento": fields.String,
            "prioridade": fields.String,
            "status_evento": fields.String,
            "notificacoes_enviadas": fields.Raw(
                description="Dicionário controlando as notificações já enviadas"
            ),
            "user_id": fields.Integer(description="ID do usuário criador do evento"),
        },
    )

    documento_model_dto = documentos_ns.model(
        "DocumentoOutput",
        {
            "id": fields.Integer(readonly=True),
            "nome_arquivo": fields.String(description="Nome original do arquivo enviado"),
            "data_upload": fields.DateTime(
                dt_format="iso8601", description="Data do upload do arquivo"
            ),
            "caso_id": fields.Integer(
                nullable=True,
                description="ID do caso ao qual o documento está associado (se houver)",
            ),
            "user_id": fields.Integer(description="ID do usuário que fez o upload"),
            "url_download": fields.String(
                description="URL para baixar o documento (gerada dinamicamente pela API)"
            ),
        },
    )

    tarefa_input_model_dto = tarefas_ns.model(
        "TarefaInput",
        {
            "titulo": fields.String(required=True, description="Título abreviado da tarefa"),
            "descricao": fields.String(description="Detalhes"),
            "status": fields.String(
                description="Status da tarefa",
                default="A Fazer",
                enum=["A Fazer", "Fazendo", "Concluído"],
            ),
            "prioridade": fields.String(
                description="Prioridade",
                default="Normal",
                enum=["Baixa", "Normal", "Alta", "Urgente"],
            ),
            "data_vencimento": fields.DateTime(description="Data fatal/vencimento (ISO 8601)"),
            "tipo_tarefa": fields.String(description="Tipo (Prazo, Reunião, etc)"),
            "origem_id": fields.String(description="ID na integração (MNI, etc)"),
            "caso_id": fields.Integer(
                description="ID do Caso associado (opcional mas recomendado)"
            ),
        },
    )

    tarefa_model_dto = tarefas_ns.model(
        "TarefaOutput",
        {
            "id": fields.Integer(readonly=True),
            "titulo": fields.String,
            "descricao": fields.String,
            "status": fields.String,
            "prioridade": fields.String,
            "data_vencimento": fields.DateTime(dt_format="iso8601"),
            "tipo_tarefa": fields.String,
            "origem_id": fields.String,
            "data_criacao": fields.DateTime(dt_format="iso8601"),
            "user_id": fields.Integer,
            "caso_id": fields.Integer,
        },
    )
    register_dashboard_routes(app, dashboard_ns)

    register_eventos_routes(
        app,
        eventos_ns,
        evento_input_model_dto,
        evento_model_dto,
    )

    register_documentos_routes(
        app,
        documentos_ns,
        documento_model_dto,
    )

    register_financeiro_api(app, api, finance_access_required)

    # --- REGISTRO DAS ROTAS DJEN ---
    try:
        from djen_routes import registrar_rotas_djen

        registrar_rotas_djen(
            djen_ns,
            db,
            DjenOabMonitoramento,
            PublicacaoDJEN,
            Caso,
            jwt_required,
            get_jwt_identity,
            app.logger,
        )
    except Exception as e_djen:
        app.logger.warning(f"Rotas DJEN não carregadas: {e_djen}")

    app.register_blueprint(api_bp)

    # --- INICIALIZAÇÃO DO APSCHEDULER ---
    if app.config.get("CNJ_JOB_ENABLED", False):
        if not app.config.get("TESTING", False):
            scheduler.init_app(app)
            if not app.debug or os.environ.get("WERKZEUG_RUN_MAIN") == "true":
                job_id = "VerificarProcessosCNJJob"
                if not scheduler.get_job(job_id):
                    try:
                        interval_hours = app.config.get("CNJ_JOB_INTERVAL_HOURS", 12)
                        interval_minutes = app.config.get("CNJ_JOB_INTERVAL_MINUTES", 0)
                        scheduler.add_job(
                            id=job_id,
                            func=job_verificar_processos_cnj,
                            trigger="interval",
                            hours=interval_hours,
                            minutes=interval_minutes,
                            replace_existing=True,
                        )
                        app.logger.info(
                            f"Job '{job_id}' agendado: {interval_hours}h{interval_minutes}m."
                        )

                        # --- JOB DE ALERTAS DE PRAZOS ---
                        job_alertas_id = "VerificarAlertasPrazosJob"
                        if not scheduler.get_job(job_alertas_id):
                            from alertas_tasks import job_verificar_prazos

                            scheduler.add_job(
                                id=job_alertas_id,
                                func=job_verificar_prazos,
                                args=[app],
                                trigger="cron",
                                hour=6,
                                minute=0,
                                replace_existing=True,
                            )
                            app.logger.info(
                                f"Job '{job_alertas_id}' agendado para rodar diariamente às 06:00."
                            )

                        # --- JOB DE MONITORAMENTO DJEN ---
                        if app.config.get("DJEN_JOB_ENABLED", False):
                            djen_job_id = "SincronizarDJENJob"
                            if not scheduler.get_job(djen_job_id):
                                from djen_tasks import job_monitorar_djen

                                djen_hour = app.config.get("DJEN_JOB_HOUR", 4)
                                djen_minute = app.config.get("DJEN_JOB_MINUTE", 0)
                                scheduler.add_job(
                                    id=djen_job_id,
                                    func=job_monitorar_djen,
                                    args=[app],
                                    trigger="cron",
                                    hour=djen_hour,
                                    minute=djen_minute,
                                    replace_existing=True,
                                )
                                app.logger.info(
                                    f"Job '{djen_job_id}' agendado às {djen_hour:02d}:{djen_minute:02d}."
                                )
                    except Exception as e_add_job:
                        app.logger.error(f"Falha ao adicionar job '{job_id}': {str(e_add_job)}")
                if not scheduler.running:
                    try:
                        scheduler.start(paused=False)
                        app.logger.info("APScheduler iniciado com sucesso.")
                    except Exception as e_start_scheduler:
                        app.logger.error(f"Falha ao iniciar APScheduler: {str(e_start_scheduler)}")
                else:
                    app.logger.info("APScheduler já está em execução.")
            else:
                app.logger.info("APScheduler não iniciado (Werkzeug reloader ou debug).")
        else:
            app.logger.info("APScheduler não iniciado (TESTING=True).")
    else:
        app.logger.info("Job CNJ (CNJ_JOB_ENABLED) está DESABILITADO.")
    # --- FIM DA INICIALIZAÇÃO DO APSCHEDULER ---

    static_folder_path = os.path.join(app.root_path, "..", "gestao_advocacia_vite", "dist")
    if not os.path.exists(static_folder_path):
        static_folder_path_alt = os.path.join(app.root_path, "static_frontend")
        if os.path.exists(static_folder_path_alt):
            static_folder_path = static_folder_path_alt
        else:
            app.logger.warning(
                f"Pasta de build do frontend não encontrada em '{static_folder_path}' nem em '{static_folder_path_alt}'."
            )
            static_folder_path = None

    @app.route("/")
    def serve_api_status():
        return (
            jsonify(
                {
                    "status": "online",
                    "message": "API Patronus (Servidor Backend) operando com sucesso. Utilize o Front-end Vercel para acessar a Interface.",
                }
            ),
            200,
        )

    register_auditoria_routes(
        audit_ns,
        audit_log_model_dto,
    )

    register_tarefas_routes(
        tarefas_ns,
        tarefa_input_model_dto,
        tarefa_model_dto,
    )

    # OpenAPI/Swagger gerado automaticamente com base nas rotas registradas.
    register_openapi_docs(app)

    return app


# No final de gestao_advocacia/app.py
if __name__ == "__main__":
    app = create_app()
    app.run(
        debug=(os.environ.get("FLASK_ENV") == "development"),
        # Remova ou altere a linha abaixo se existir e estiver como port=5001
        # port=5000, # Garanta que seja 5000 ou remova para usar o padrão
        use_reloader=(
            os.environ.get("FLASK_ENV") == "development"
            and os.environ.get("WERKZEUG_RUN_MAIN") != "true"
        ),
    )
