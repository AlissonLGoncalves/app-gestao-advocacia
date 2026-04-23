from flask_jwt_extended import get_jwt_identity, jwt_required
from flask_jwt_extended.exceptions import JWTExtendedException, NoAuthorizationError
from flask_restx import Namespace, fields

from extensions import db
from models import Caso, DjenOabMonitoramento, PublicacaoDJEN

from .auditoria import register_auditoria_routes
from .auth import register_auth_routes
from .casos import register_casos_routes
from .clientes import register_clientes_routes
from .dashboard import register_dashboard_routes
from .documentos import register_documentos_routes
from .eventos import register_eventos_routes
from .financeiro_registry import register_financeiro_api
from .portal import register_portal_routes
from .procuracoes import register_procuracoes_routes
from .relatorios import register_relatorios_routes
from .tarefas import register_tarefas_routes
from .tenant import register_tenant_routes


def register_api_routes(app, api, finance_access_required):
    @api.errorhandler(NoAuthorizationError)
    def handle_no_authorization(error):
        return {"message": str(error)}, 401

    @api.errorhandler(JWTExtendedException)
    def handle_jwt_errors(error):
        return {"message": str(error)}, 422

    auth_ns = Namespace("auth", description="Operacoes de Autenticacao")
    clientes_ns = Namespace("clientes", description="Operacoes de Clientes")
    casos_ns = Namespace("casos", description="Operacoes de Casos Juridicos")
    eventos_ns = Namespace("eventos", description="Operacoes de Eventos da Agenda")
    documentos_ns = Namespace("documentos", description="Operacoes de Documentos")
    dashboard_ns = Namespace("dashboard", description="Dados agregados para o Dashboard")
    audit_ns = Namespace("auditoria", description="Trilhas de Auditoria e Logs (LGPD)")
    tarefas_ns = Namespace("tarefas", description="Operacoes de Prazos e Tarefas")
    djen_ns = Namespace("djen", description="Publicacoes DJEN")
    procuracoes_ns = Namespace("procuracoes", description="Analise de procuracoes via Gemini")
    tenant_ns = Namespace("tenant", description="Dados do Escritorio (Tenant)")
    relatorios_ns = Namespace("relatorios", description="Relatorios Gerenciais")
    portal_ns = Namespace("portal", description="Portal do Cliente (acesso simplificado)")

    api.add_namespace(auth_ns)
    api.add_namespace(clientes_ns)
    api.add_namespace(casos_ns)
    api.add_namespace(eventos_ns)
    api.add_namespace(documentos_ns)
    api.add_namespace(dashboard_ns)
    api.add_namespace(audit_ns)
    api.add_namespace(tarefas_ns)
    api.add_namespace(djen_ns)
    api.add_namespace(procuracoes_ns)
    api.add_namespace(tenant_ns)
    api.add_namespace(relatorios_ns)
    api.add_namespace(portal_ns)

    user_model_dto = auth_ns.model(
        "UserRegistration",
        {
            "username": fields.String(required=True, description="Nome de usuario unico"),
            "nome_completo": fields.String(description="Nome completo do advogado (PF)"),
            "razao_social": fields.String(description="Razao social do escritorio (PJ)"),
            "email": fields.String(required=True, description="Email unico", format="email"),
            "password": fields.String(required=True, description="Senha", min_length=6),
            "role": fields.String(
                description="Papel do usuario",
                default="admin",
                enum=["admin", "advogado", "assistente"],
            ),
            "documento_identificacao": fields.String(description="CPF ou CNPJ"),
            "tipo_pessoa": fields.String(description="PF ou PJ"),
            "cpf": fields.String(description="CPF do advogado (PF)"),
            "oab": fields.String(description="Registro OAB"),
            "sigla_oab_tribunal": fields.String(description="UF da OAB"),
            "aceite_termos": fields.Boolean(required=True),
            "aceite_lgpd": fields.Boolean(required=True),
            "versao_termos": fields.String(required=True, example="v1.0"),
            "versao_lgpd": fields.String(required=True, example="v1.0"),
            "hash_termos_uso": fields.String(required=False),
            "hash_lgpd": fields.String(required=False),
        },
    )
    login_model_dto = auth_ns.model(
        "UserLogin",
        {
            "username_or_email": fields.String(required=True, description="Usuario ou email"),
            "password": fields.String(required=True, description="Senha"),
        },
    )
    user_output_model_dto = auth_ns.model(
        "UserOutput",
        {
            "id": fields.Integer(readonly=True, description="ID unico do usuario"),
            "username": fields.String(description="Nome de usuario"),
            "email": fields.String(description="Email"),
            "role": fields.String(description="Papel"),
            "nome_completo": fields.String(description="Nome completo"),
            "numero_oab": fields.String(description="Numero da OAB"),
            "sigla_oab_tribunal": fields.String(description="UF da OAB"),
            "tipo_pessoa": fields.String(description="Tipo de pessoa"),
            "cpf": fields.String(description="CPF"),
            "portal_cliente_id": fields.Integer(
                description="ID do cliente vinculado ao portal", nullable=True
            ),
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
            "invite_token": fields.String(required=True, description="Token Magico JWT"),
            "username": fields.String(required=True, description="Nome do convidado"),
            "password": fields.String(required=True, description="Senha"),
            "aceite_termos": fields.Boolean(required=True),
            "aceite_lgpd": fields.Boolean(required=True),
            "versao_termos": fields.String(required=True, example="v1.0"),
            "versao_lgpd": fields.String(required=True, example="v1.0"),
            "hash_termos_uso": fields.String(required=False),
            "hash_lgpd": fields.String(required=False),
        },
    )
    token_model_dto = auth_ns.model(
        "Token",
        {
            "access_token": fields.String(description="Token JWT"),
            "user": fields.Nested(
                user_output_model_dto, description="Dados do usuario", skip_none=True
            ),
        },
    )

    auth_ns.model(
        "ForgotPasswordRequest",
        {"email": fields.String(required=True, description="Email cadastrado", format="email")},
    )
    auth_ns.model(
        "ResetPasswordRequest",
        {
            "token": fields.String(required=True, description="Token recebido por email"),
            "password": fields.String(required=True, description="Nova senha (min 10 chars)"),
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
                required=True, description="Nome completo ou Razao Social"
            ),
            "cpf_cnpj": fields.String(required=True, description="CPF ou CNPJ principal"),
            "tipo_pessoa": fields.String(required=True, description="PF ou PJ", enum=["PF", "PJ"]),
            "processo_cnj": fields.String(
                description="Número CNJ opcional para sugestão/vinculação de caso"
            ),
            "email": fields.String(description="Email do cliente"),
            "telefone": fields.String(description="Telefone do cliente"),
            "rg": fields.String(description="RG (PF)"),
            "orgao_emissor": fields.String(description="Orgao emissor do RG"),
            "data_nascimento": fields.String(description="Data de nascimento (YYYY-MM-DD)"),
            "estado_civil": fields.String(description="Estado civil"),
            "profissao": fields.String(description="Profissao"),
            "nacionalidade": fields.String(description="Nacionalidade"),
            "nome_fantasia": fields.String(description="Nome Fantasia (PJ)"),
            "nire": fields.String(description="NIRE (PJ)"),
            "inscricao_estadual": fields.String(description="Inscricao Estadual (PJ)"),
            "inscricao_municipal": fields.String(description="Inscricao Municipal (PJ)"),
            "cnpj_secundario": fields.String(description="CNPJ Secundario (PJ)"),
            "descricao_cnpj_secundario": fields.String(description="Descricao do CNPJ Secundario"),
            "cnpj_terciario": fields.String(description="CNPJ Terciario (PJ)"),
            "descricao_cnpj_terciario": fields.String(description="Descricao do CNPJ Terciario"),
            "cep": fields.String(description="CEP"),
            "rua": fields.String(description="Rua/Logradouro"),
            "numero": fields.String(description="Numero"),
            "bairro": fields.String(description="Bairro"),
            "cidade": fields.String(description="Cidade"),
            "estado": fields.String(description="Estado (UF)"),
            "pais": fields.String(description="Pais"),
            "notas_gerais": fields.String(description="Notas gerais"),
        },
    )
    cliente_model_dto = clientes_ns.model(
        "ClienteOutput",
        {
            "id": fields.Integer(readonly=True, description="ID unico do cliente"),
            "nome_razao_social": fields.String(description="Nome completo ou Razao Social"),
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
            "user_id": fields.Integer(description="ID do usuario responsavel"),
        },
    )

    register_clientes_routes(app, clientes_ns, cliente_input_model_dto, cliente_model_dto)

    caso_input_model_dto = casos_ns.model(
        "CasoInput",
        {
            "titulo": fields.String(required=True, description="Titulo do caso"),
            "numero_processo": fields.String(description="Numero do processo CNJ"),
            "status": fields.String(description="Status"),
            "tipo_acao": fields.String(description="Tipo de acao"),
            "area_direito": fields.String(description="Area do direito"),
            "fase_processual": fields.String(description="Fase processual"),
            "vara_juizo": fields.String(description="Vara/Juizo"),
            "comarca": fields.String(description="Comarca"),
            "instancia": fields.String(description="Instancia"),
            "parte_contraria": fields.String(description="Parte contraria"),
            "adv_parte_contraria": fields.String(description="Advogado da parte contraria"),
            "valor_causa": fields.Float(description="Valor da causa em R$"),
            "data_distribuicao": fields.String(description="Data de distribuicao (YYYY-MM-DD)"),
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
            "id": fields.Integer(readonly=True, description="ID da movimentacao no sistema local"),
            "data_movimentacao": fields.DateTime(
                dt_format="iso8601", description="Data/hora da movimentacao no CNJ"
            ),
            "descricao": fields.String(required=True, description="Descricao da movimentacao"),
            "dados_integra_cnj": fields.Raw(description="JSON original completo do CNJ"),
            "data_registro_sistema": fields.DateTime(
                dt_format="iso8601", description="Data/hora de registro no sistema local"
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
            "titulo": fields.String(required=True, description="Titulo do evento"),
            "data_inicio": fields.DateTime(
                required=True, description="Data/hora inicio (ISO 8601)"
            ),
            "data_fim": fields.DateTime(description="Data/hora fim (ISO 8601)"),
            "descricao": fields.String(description="Descricao extra"),
            "tipo_evento": fields.String(description="Prazo, Audiencia, Reuniao, Outros"),
            "prioridade": fields.String(description="Baixa, Normal, Alta, Urgente"),
            "status_evento": fields.String(description="Pendente, Concluido, Cancelado"),
        },
    )
    evento_model_dto = eventos_ns.model(
        "EventoOutput",
        {
            "id": fields.Integer(readonly=True),
            "title": fields.String(attribute="titulo", description="Titulo (FullCalendar)"),
            "start": fields.DateTime(attribute="data_inicio", dt_format="iso8601"),
            "end": fields.DateTime(attribute="data_fim", dt_format="iso8601", nullable=True),
            "description": fields.String(attribute="descricao", nullable=True),
            "tipo_evento": fields.String,
            "prioridade": fields.String,
            "status_evento": fields.String,
            "notificacoes_enviadas": fields.Raw(description="Controle de notificacoes"),
            "user_id": fields.Integer(description="ID do usuario criador"),
        },
    )

    documento_model_dto = documentos_ns.model(
        "DocumentoOutput",
        {
            "id": fields.Integer(readonly=True),
            "nome_arquivo": fields.String(description="Nome original do arquivo"),
            "data_upload": fields.DateTime(dt_format="iso8601", description="Data do upload"),
            "caso_id": fields.Integer(nullable=True, description="ID do caso associado"),
            "user_id": fields.Integer(description="ID do usuario que enviou"),
            "url_download": fields.String(description="URL para download"),
        },
    )

    procuracao_model_dto = procuracoes_ns.model(
        "ProcuracaoAnaliseOutput",
        {
            "id": fields.Integer(readonly=True),
            "status": fields.String(description="pending|processing|done|failed"),
            "dados_extraidos": fields.Raw(description="JSON estruturado extraído via Gemini"),
            "avisos_validacao": fields.List(fields.String, description="Avisos de validação"),
            "erro": fields.String(description="Mensagem de erro quando status=failed"),
            "arquivo_hash": fields.String(description="SHA256 do arquivo"),
            "criado_em": fields.DateTime(dt_format="iso8601"),
            "processado_em": fields.DateTime(dt_format="iso8601", nullable=True),
        },
    )

    tarefa_input_model_dto = tarefas_ns.model(
        "TarefaInput",
        {
            "titulo": fields.String(required=True, description="Titulo abreviado"),
            "descricao": fields.String(description="Detalhes"),
            "status": fields.String(
                description="Status da tarefa",
                default="A Fazer",
                enum=["A Fazer", "Fazendo", "Concluido"],
            ),
            "prioridade": fields.String(
                description="Prioridade",
                default="Normal",
                enum=["Baixa", "Normal", "Alta", "Urgente"],
            ),
            "data_vencimento": fields.DateTime(description="Data fatal/vencimento (ISO 8601)"),
            "tipo_tarefa": fields.String(description="Tipo"),
            "origem_id": fields.String(description="ID na integracao"),
            "caso_id": fields.Integer(description="ID do caso associado"),
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
    register_eventos_routes(app, eventos_ns, evento_input_model_dto, evento_model_dto)
    register_documentos_routes(app, documentos_ns, documento_model_dto)
    register_procuracoes_routes(app, procuracoes_ns, procuracao_model_dto)
    register_financeiro_api(app, api, finance_access_required)

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
        app.logger.warning(f"Rotas DJEN nao carregadas: {e_djen}")

    register_auditoria_routes(audit_ns, audit_log_model_dto)
    register_tarefas_routes(tarefas_ns, tarefa_input_model_dto, tarefa_model_dto)
    register_tenant_routes(tenant_ns)
    register_relatorios_routes(relatorios_ns, finance_access_required)
    register_portal_routes(portal_ns)
