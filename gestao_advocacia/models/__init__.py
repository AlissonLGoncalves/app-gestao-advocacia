from datetime import datetime

from werkzeug.security import check_password_hash, generate_password_hash

from extensions import db


class Tenant(db.Model):
    __tablename__ = "tenant"
    id = db.Column(db.Integer, primary_key=True)
    nome_escritorio = db.Column(db.String(250), nullable=False)
    documento = db.Column(db.String(20), nullable=True)  # CNPJ ou CPF
    email_contato = db.Column(db.String(120), nullable=True)
    telefone = db.Column(db.String(30), nullable=True)
    numero_oab_escritorio = db.Column(db.String(30), nullable=True)
    sigla_oab_escritorio = db.Column(db.String(10), nullable=True)
    endereco = db.Column(db.String(300), nullable=True)
    # admin-fase0: status do tenant para suspensao via backoffice (ativo|suspenso|cancelado)
    status = db.Column(db.String(20), nullable=False, default="ativo", server_default="ativo")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    # onboarding-wizard: NULL para tenants novos que ainda nao completaram o wizard pos-signup.
    onboarding_completed_at = db.Column(db.DateTime, nullable=True)
    users = db.relationship("User", backref="tenant", lazy="dynamic")

    def to_dict(self):
        return {
            "id": self.id,
            "nome_escritorio": self.nome_escritorio,
            "documento": self.documento,
            "email_contato": self.email_contato,
            "telefone": self.telefone,
            "numero_oab_escritorio": self.numero_oab_escritorio,
            "sigla_oab_escritorio": self.sigla_oab_escritorio,
            "endereco": self.endereco,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "onboarding_completed_at": (
                self.onboarding_completed_at.isoformat() if self.onboarding_completed_at else None
            ),
        }


class User(db.Model):
    __tablename__ = "user"
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(
        db.Integer, db.ForeignKey("tenant.id", name="fk_user_tenant_id"), nullable=True
    )
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    role = db.Column(
        db.String(20), nullable=False, default="admin"
    )  # admin, advogado, assistente, cliente, superadmin (admin-fase0)
    nome_completo = db.Column(db.String(200), nullable=True)
    cpf = db.Column(db.String(14), nullable=True)
    tipo_pessoa = db.Column(db.String(2), nullable=True)
    numero_oab = db.Column(db.String(30), nullable=True)
    sigla_oab_tribunal = db.Column(db.String(10), nullable=True)
    djen_monitoramento_ativo = db.Column(db.Boolean, nullable=True, default=True)
    portal_cliente_id = db.Column(
        db.Integer, db.ForeignKey("cliente.id", name="fk_user_portal_cliente_id"), nullable=True
    )

    casos = db.relationship(
        "Caso", backref="responsavel_user", lazy="dynamic", foreign_keys="Caso.user_id"
    )
    clientes = db.relationship(
        "Cliente", backref="advogado_responsavel", lazy="dynamic", foreign_keys="Cliente.user_id"
    )
    eventos_agenda = db.relationship(
        "EventoAgenda",
        backref="criador_evento",
        lazy="dynamic",
        foreign_keys="EventoAgenda.user_id",
    )
    documentos = db.relationship(
        "Documento", backref="uploader_documento", lazy="dynamic", foreign_keys="Documento.user_id"
    )
    despesas = db.relationship(
        "Despesa", backref="registrador_despesa", lazy="dynamic", foreign_keys="Despesa.user_id"
    )
    recebimentos = db.relationship(
        "Recebimento",
        backref="registrador_recebimento",
        lazy="dynamic",
        foreign_keys="Recebimento.user_id",
    )
    contratos = db.relationship(
        "ContratoHonorario",
        backref="responsavel_contrato",
        lazy="dynamic",
        foreign_keys="ContratoHonorario.user_id",
    )
    tarefas_prazo = db.relationship(
        "TarefaPrazo",
        backref="responsavel_tarefa",
        lazy="dynamic",
        foreign_keys="TarefaPrazo.user_id",
    )

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "role": self.role,
            "nome_completo": self.nome_completo,
            "numero_oab": self.numero_oab,
            "sigla_oab_tribunal": self.sigla_oab_tribunal,
            "tipo_pessoa": self.tipo_pessoa,
            "cpf": self.cpf,
            "portal_cliente_id": self.portal_cliente_id,
        }


class Cliente(db.Model):
    __tablename__ = "cliente"
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(
        db.Integer, db.ForeignKey("tenant.id", name="fk_cliente_tenant_id"), nullable=True
    )
    # Dados principais
    nome_razao_social = db.Column(db.String(200), nullable=False)
    cpf_cnpj = db.Column(db.String(20), nullable=False)
    tipo_pessoa = db.Column(db.String(2), nullable=False, default="PF")  # PF ou PJ
    email = db.Column(db.String(120), nullable=True)
    telefone = db.Column(db.String(20), nullable=True)
    # Campos PF
    rg = db.Column(db.String(20), nullable=True)
    orgao_emissor = db.Column(db.String(20), nullable=True)
    data_nascimento = db.Column(db.Date, nullable=True)
    estado_civil = db.Column(db.String(30), nullable=True)
    profissao = db.Column(db.String(100), nullable=True)
    nacionalidade = db.Column(db.String(60), nullable=True, default="Brasileiro(a)")
    # Campos PJ
    nome_fantasia = db.Column(db.String(200), nullable=True)
    nire = db.Column(db.String(30), nullable=True)
    inscricao_estadual = db.Column(db.String(30), nullable=True)
    inscricao_municipal = db.Column(db.String(30), nullable=True)
    cnpj_secundario = db.Column(db.String(20), nullable=True)
    descricao_cnpj_secundario = db.Column(db.String(200), nullable=True)
    cnpj_terciario = db.Column(db.String(20), nullable=True)
    descricao_cnpj_terciario = db.Column(db.String(200), nullable=True)
    # Endereço
    cep = db.Column(db.String(10), nullable=True)
    rua = db.Column(db.String(200), nullable=True)
    numero = db.Column(db.String(20), nullable=True)
    bairro = db.Column(db.String(100), nullable=True)
    cidade = db.Column(db.String(100), nullable=True)
    estado = db.Column(db.String(2), nullable=True)
    pais = db.Column(db.String(60), nullable=True, default="Brasil")
    # Outros
    notas_gerais = db.Column(db.Text, nullable=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("user.id", name="fk_cliente_user_id"), nullable=False
    )

    casos = db.relationship(
        "Caso", backref="cliente_associado", lazy="dynamic", cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "nome_razao_social": self.nome_razao_social,
            "cpf_cnpj": self.cpf_cnpj,
            "tipo_pessoa": self.tipo_pessoa,
            "email": self.email,
            "telefone": self.telefone,
            "rg": self.rg,
            "orgao_emissor": self.orgao_emissor,
            "data_nascimento": self.data_nascimento.isoformat() if self.data_nascimento else None,
            "estado_civil": self.estado_civil,
            "profissao": self.profissao,
            "nacionalidade": self.nacionalidade,
            "nome_fantasia": self.nome_fantasia,
            "nire": self.nire,
            "inscricao_estadual": self.inscricao_estadual,
            "inscricao_municipal": self.inscricao_municipal,
            "cnpj_secundario": self.cnpj_secundario,
            "descricao_cnpj_secundario": self.descricao_cnpj_secundario,
            "cnpj_terciario": self.cnpj_terciario,
            "descricao_cnpj_terciario": self.descricao_cnpj_terciario,
            "cep": self.cep,
            "rua": self.rua,
            "numero": self.numero,
            "bairro": self.bairro,
            "cidade": self.cidade,
            "estado": self.estado,
            "pais": self.pais,
            "notas_gerais": self.notas_gerais,
            "user_id": self.user_id,
        }


class Caso(db.Model):
    __tablename__ = "caso"
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(
        db.Integer, db.ForeignKey("tenant.id", name="fk_caso_tenant_id"), nullable=True
    )
    titulo = db.Column(db.String(200), nullable=False)
    numero_processo = db.Column(db.String(30), unique=False, nullable=True, index=True)
    status = db.Column(db.String(50), nullable=True, default="Ativo")
    # Dados processuais
    tipo_acao = db.Column(db.String(100), nullable=True)
    area_direito = db.Column(db.String(80), nullable=True)
    fase_processual = db.Column(db.String(80), nullable=True)
    vara_juizo = db.Column(db.String(100), nullable=True)
    comarca = db.Column(db.String(100), nullable=True)
    instancia = db.Column(db.String(50), nullable=True)
    # Partes
    parte_contraria = db.Column(db.String(200), nullable=True)
    adv_parte_contraria = db.Column(db.String(200), nullable=True)
    # Valores e datas
    valor_causa = db.Column(db.Numeric(14, 2), nullable=True)
    data_distribuicao = db.Column(db.Date, nullable=True)
    notas_caso = db.Column(db.Text, nullable=True)
    # Timestamps e relações
    data_criacao = db.Column(db.DateTime, default=datetime.utcnow)
    data_atualizacao = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    cliente_id = db.Column(
        db.Integer, db.ForeignKey("cliente.id", name="fk_caso_cliente_id"), nullable=False
    )
    user_id = db.Column(
        db.Integer, db.ForeignKey("user.id", name="fk_caso_user_id"), nullable=False
    )
    data_ultima_verificacao_cnj = db.Column(db.DateTime, nullable=True)
    data_ultima_verificacao_djen = db.Column(db.DateTime, nullable=True)

    movimentacoes_cnj = db.relationship(
        "MovimentacaoCNJ",
        backref="caso_cnj_associado",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )
    documentos_caso = db.relationship(
        "Documento",
        backref="caso_documento_associado",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )
    despesas_caso = db.relationship(
        "Despesa", backref="caso_despesa_associado", lazy="dynamic", cascade="all, delete-orphan"
    )
    recebimentos_caso = db.relationship(
        "Recebimento",
        backref="caso_recebimento_associado",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )
    contratos_caso = db.relationship(
        "ContratoHonorario",
        backref="caso_contrato_associado",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )
    tarefas_caso = db.relationship(
        "TarefaPrazo", backref="caso_tarefa_associado", lazy="dynamic", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Caso {self.id} - {self.titulo}>"

    def to_dict(self):
        cliente_obj = self.cliente_associado if hasattr(self, "cliente_associado") else None
        return {
            "id": self.id,
            "titulo": self.titulo,
            "numero_processo": self.numero_processo,
            "status": self.status,
            "tipo_acao": self.tipo_acao,
            "area_direito": self.area_direito,
            "fase_processual": self.fase_processual,
            "vara_juizo": self.vara_juizo,
            "comarca": self.comarca,
            "instancia": self.instancia,
            "parte_contraria": self.parte_contraria,
            "adv_parte_contraria": self.adv_parte_contraria,
            "valor_causa": str(self.valor_causa) if self.valor_causa else None,
            "data_distribuicao": (
                self.data_distribuicao.isoformat() if self.data_distribuicao else None
            ),
            "notas_caso": self.notas_caso,
            "data_criacao": self.data_criacao.isoformat() if self.data_criacao else None,
            "data_atualizacao": (
                self.data_atualizacao.isoformat() if self.data_atualizacao else None
            ),
            "cliente_id": self.cliente_id,
            "cliente": (
                {"id": cliente_obj.id, "nome_razao_social": cliente_obj.nome_razao_social}
                if cliente_obj
                else None
            ),
            "user_id": self.user_id,
            "data_ultima_verificacao_cnj": (
                self.data_ultima_verificacao_cnj.isoformat()
                if self.data_ultima_verificacao_cnj
                else None
            ),
            "movimentacoes_cnj_count": self.movimentacoes_cnj.count(),
        }


class MovimentacaoCNJ(db.Model):
    __tablename__ = "movimentacao_cnj"
    id = db.Column(db.Integer, primary_key=True)
    # tenant_id denormalizado (Onda 3.1 Fase 4 Batch 1, decisao #1 do plano):
    # categoria B no design original — tenant resolvido via FK caso_id.
    # Denormalizado para evitar subquery por linha em policy RLS no hot-path
    # de ingestao DJEN/CNJ. Sempre populado a partir do caso pai.
    tenant_id = db.Column(
        db.Integer,
        db.ForeignKey("tenant.id", name="fk_movimentacao_cnj_tenant_id"),
        nullable=False,
    )
    caso_id = db.Column(
        db.Integer,
        db.ForeignKey("caso.id", name="fk_movimentacao_cnj_caso_id"),
        nullable=False,
        index=True,
    )
    data_movimentacao = db.Column(db.DateTime, nullable=False, index=True)
    descricao = db.Column(db.Text, nullable=False)
    dados_integra_cnj = db.Column(db.JSON, nullable=True)
    data_registro_sistema = db.Column(db.DateTime, default=datetime.utcnow)
    __table_args__ = (
        db.Index(
            "ix_movimentacao_cnj_tenant_data_registro",
            "tenant_id",
            "data_registro_sistema",
        ),
    )

    def __repr__(self):
        return f'<MovimentacaoCNJ id={self.id} caso_id={self.caso_id} data="{self.data_movimentacao.strftime("%Y-%m-%d %H:%M")}">'

    def to_dict(self):
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "caso_id": self.caso_id,
            "data_movimentacao": (
                self.data_movimentacao.isoformat() if self.data_movimentacao else None
            ),
            "descricao": self.descricao,
            "dados_integra_cnj": self.dados_integra_cnj,
            "data_registro_sistema": (
                self.data_registro_sistema.isoformat() if self.data_registro_sistema else None
            ),
        }


class AuditLog(db.Model):
    __tablename__ = "audit_log"
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(
        db.Integer,
        db.ForeignKey("tenant.id", name="fk_auditlog_tenant_id"),
        nullable=False,
        index=True,
    )
    user_id = db.Column(
        db.Integer, db.ForeignKey("user.id", name="fk_auditlog_user_id"), nullable=False
    )
    acao = db.Column(db.String(50), nullable=False)
    tabela_afetada = db.Column(db.String(50), nullable=False)
    registro_id = db.Column(db.Integer, nullable=True)
    detalhes = db.Column(db.Text, nullable=True)
    data_hora = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    __table_args__ = (db.Index("ix_audit_log_tenant_created", "tenant_id", "data_hora"),)

    usuario = db.relationship("User", foreign_keys=[user_id])

    def to_dict(self):
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "user_id": self.user_id,
            "username": self.usuario.username if self.usuario else "Sistema",
            "acao": self.acao,
            "tabela_afetada": self.tabela_afetada,
            "registro_id": self.registro_id,
            "detalhes": self.detalhes,
            "data_hora": self.data_hora.isoformat() if self.data_hora else None,
        }


class LoginAudit(db.Model):
    __tablename__ = "login_audit"
    id = db.Column(db.Integer, primary_key=True)
    # tenant_id denormalizado (Batch 4) — NULLABLE porque tentativas falhas
    # em email inexistente nao tem tenant resolvido. Esses registros so
    # sao visiveis via admin_session (RLS policy 'tenant_id = current_setting'
    # exclui NULL naturalmente).
    tenant_id = db.Column(
        db.Integer,
        db.ForeignKey("tenant.id", name="fk_login_audit_tenant_id"),
        nullable=True,
    )
    user_id = db.Column(
        db.Integer, db.ForeignKey("user.id", name="fk_login_audit_user_id"), nullable=True
    )
    email_tentativa = db.Column(db.String(120), nullable=False)
    sucesso = db.Column(db.Boolean, nullable=False, default=False)
    ip = db.Column(db.String(45), nullable=True)
    user_agent = db.Column(db.String(500), nullable=True)
    motivo_falha = db.Column(db.String(50), nullable=True)
    criado_em = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    __table_args__ = (db.Index("ix_login_audit_tenant_criado", "tenant_id", "criado_em"),)

    usuario = db.relationship("User", foreign_keys=[user_id])

    def to_dict(self):
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "user_id": self.user_id,
            "email_tentativa": self.email_tentativa,
            "sucesso": self.sucesso,
            "ip": self.ip,
            "user_agent": self.user_agent,
            "motivo_falha": self.motivo_falha,
            "criado_em": self.criado_em.isoformat() if self.criado_em else None,
        }


def log_audit(acao, tabela_afetada, registro_id=None, detalhes=""):
    """
    Registra silenciosamente na tabela de auditoria a ação executada por quem está logado.
    ATENÇÃO: Deve ser chamado ANTES do db.session.commit() da transação principal se quiser atrelar na mesma.
    Se não, dê commit.
    """
    try:
        from flask_jwt_extended import get_jwt_identity

        user_id = get_jwt_identity()
        if not user_id:
            return
        user = db.session.get(User, user_id)
        if not user or not user.tenant_id:
            return

        novo_log = AuditLog(
            tenant_id=user.tenant_id,
            user_id=user.id,
            acao=acao,
            tabela_afetada=tabela_afetada,
            registro_id=registro_id,
            detalhes=detalhes,
        )
        db.session.add(novo_log)
    except Exception as e:
        import logging

        logging.getLogger(__name__).warning(f"Falha ao registrar AuditLog: {str(e)}")


class EventoAgenda(db.Model):
    __tablename__ = "evento_agenda"
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(
        db.Integer, db.ForeignKey("tenant.id", name="fk_evento_tenant_id"), nullable=True
    )
    titulo = db.Column(db.String(100), nullable=False)
    data_inicio = db.Column(db.DateTime, nullable=False)
    data_fim = db.Column(db.DateTime, nullable=True)
    descricao = db.Column(db.Text, nullable=True)

    # NOVAS COLUNAS PARA ALERTAS AUTOMÁTICOS
    tipo_evento = db.Column(
        db.String(50), nullable=True, default="Outros"
    )  # Prazo, Audiência, Reunião, Outros
    prioridade = db.Column(
        db.String(30), nullable=True, default="Normal"
    )  # Baixa, Normal, Alta, Urgente
    status_evento = db.Column(
        db.String(30), nullable=True, default="Pendente"
    )  # Pendente, Concluído, Cancelado
    notificacoes_enviadas = db.Column(
        db.JSON, nullable=True, default=dict
    )  # Guarda estado {"7d": True, "3d": False}

    user_id = db.Column(
        db.Integer, db.ForeignKey("user.id", name="fk_evento_user_id"), nullable=False
    )
    __table_args__ = (db.Index("ix_evento_agenda_tenant_created", "tenant_id", "data_inicio"),)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.titulo,
            "start": self.data_inicio.isoformat(),
            "end": self.data_fim.isoformat() if self.data_fim else None,
            "description": self.descricao,
            "tipo_evento": self.tipo_evento,
            "prioridade": self.prioridade,
            "status_evento": self.status_evento,
            "notificacoes_enviadas": self.notificacoes_enviadas,
            "user_id": self.user_id,
        }


class Documento(db.Model):
    __tablename__ = "documento"
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(
        db.Integer, db.ForeignKey("tenant.id", name="fk_documento_tenant_id"), nullable=True
    )
    nome_arquivo = db.Column(db.String(255), nullable=False)
    path_arquivo = db.Column(db.String(500), nullable=False)
    data_upload = db.Column(db.DateTime, default=datetime.utcnow)
    caso_id = db.Column(
        db.Integer, db.ForeignKey("caso.id", name="fk_documento_caso_id"), nullable=True
    )
    user_id = db.Column(
        db.Integer, db.ForeignKey("user.id", name="fk_documento_user_id"), nullable=False
    )
    __table_args__ = (db.Index("ix_documento_tenant_created", "tenant_id", "data_upload"),)

    def to_dict(self):
        return {
            "id": self.id,
            "nome_arquivo": self.nome_arquivo,
            "data_upload": self.data_upload.isoformat(),
            "caso_id": self.caso_id,
            "user_id": self.user_id,
            "url_download": f"/api/documentos/download/{self.id}",
        }


class ProcuracaoAnalise(db.Model):
    __tablename__ = "procuracao_analise"

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(
        db.Integer,
        db.ForeignKey("tenant.id", name="fk_procuracao_analise_tenant_id"),
        nullable=False,
    )
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("user.id", name="fk_procuracao_analise_user_id"),
        nullable=False,
    )
    arquivo_path = db.Column(db.String(500), nullable=False)
    arquivo_hash = db.Column(db.String(64), nullable=False)
    status = db.Column(
        db.Enum("pending", "processing", "done", "failed", name="procuracao_analise_status"),
        nullable=False,
        default="pending",
    )
    dados_extraidos = db.Column(db.JSON, nullable=True)
    erro = db.Column(db.Text, nullable=True)
    criado_em = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    processado_em = db.Column(db.DateTime, nullable=True)

    __table_args__ = (db.Index("ix_procuracao_analise_tenant_status", "tenant_id", "status"),)

    def to_dict(self):
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "user_id": self.user_id,
            "arquivo_path": self.arquivo_path,
            "arquivo_hash": self.arquivo_hash,
            "status": self.status,
            "dados_extraidos": self.dados_extraidos,
            "erro": self.erro,
            "criado_em": self.criado_em.isoformat() if self.criado_em else None,
            "processado_em": self.processado_em.isoformat() if self.processado_em else None,
        }


class ContratoHonorario(db.Model):
    __tablename__ = "contrato_honorario"
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(
        db.Integer, db.ForeignKey("tenant.id", name="fk_contrato_tenant_id"), nullable=True
    )
    tipo_honorario = db.Column(db.String(50), nullable=False)  # Fixo, Êxito, Mensal, Horas
    valor_total = db.Column(db.Numeric(14, 2), nullable=True)
    percentual_exito = db.Column(db.Numeric(5, 2), nullable=True)
    data_assinatura = db.Column(db.Date, nullable=True)
    status = db.Column(db.String(30), nullable=True, default="Ativo")
    notas_condicoes = db.Column(db.Text, nullable=True)

    caso_id = db.Column(
        db.Integer, db.ForeignKey("caso.id", name="fk_contrato_caso_id"), nullable=False
    )
    cliente_id = db.Column(
        db.Integer, db.ForeignKey("cliente.id", name="fk_contrato_cliente_id"), nullable=False
    )
    user_id = db.Column(
        db.Integer, db.ForeignKey("user.id", name="fk_contrato_user_id"), nullable=False
    )

    recebimentos_contrato = db.relationship(
        "Recebimento",
        backref="contrato_recebimento_associado",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )

    def to_dict(self):
        return {
            "id": self.id,
            "tipo_honorario": self.tipo_honorario,
            "valor_total": str(self.valor_total) if self.valor_total else None,
            "percentual_exito": str(self.percentual_exito) if self.percentual_exito else None,
            "data_assinatura": self.data_assinatura.isoformat() if self.data_assinatura else None,
            "status": self.status,
            "notas_condicoes": self.notas_condicoes,
            "caso_id": self.caso_id,
            "cliente_id": self.cliente_id,
            "user_id": self.user_id,
        }


class Despesa(db.Model):
    __tablename__ = "despesa"
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(
        db.Integer, db.ForeignKey("tenant.id", name="fk_despesa_tenant_id"), nullable=True
    )
    descricao = db.Column(db.String(200), nullable=False)
    valor = db.Column(db.Numeric(10, 2), nullable=False)
    data_despesa = db.Column(db.Date, nullable=False)
    pago = db.Column(db.Boolean, default=False)
    caso_id = db.Column(
        db.Integer, db.ForeignKey("caso.id", name="fk_despesa_caso_id"), nullable=True
    )
    user_id = db.Column(
        db.Integer, db.ForeignKey("user.id", name="fk_despesa_user_id"), nullable=False
    )
    __table_args__ = (db.Index("ix_despesa_tenant_created", "tenant_id", "data_despesa"),)

    def to_dict(self):
        return {
            "id": self.id,
            "descricao": self.descricao,
            "valor": str(self.valor),
            "data_despesa": self.data_despesa.isoformat(),
            "pago": self.pago,
            "caso_id": self.caso_id,
            "user_id": self.user_id,
        }


class Recebimento(db.Model):
    __tablename__ = "recebimento"
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(
        db.Integer, db.ForeignKey("tenant.id", name="fk_recebimento_tenant_id"), nullable=True
    )
    descricao = db.Column(db.String(200), nullable=False)
    valor = db.Column(db.Numeric(10, 2), nullable=False)
    data_recebimento = db.Column(db.Date, nullable=False)
    recebido = db.Column(db.Boolean, default=False)
    caso_id = db.Column(
        db.Integer, db.ForeignKey("caso.id", name="fk_recebimento_caso_id"), nullable=True
    )
    user_id = db.Column(
        db.Integer, db.ForeignKey("user.id", name="fk_recebimento_user_id"), nullable=False
    )
    contrato_id = db.Column(
        db.Integer,
        db.ForeignKey("contrato_honorario.id", name="fk_recebimento_contrato_id"),
        nullable=True,
    )
    __table_args__ = (db.Index("ix_recebimento_tenant_created", "tenant_id", "data_recebimento"),)

    def to_dict(self):
        return {
            "id": self.id,
            "descricao": self.descricao,
            "valor": str(self.valor),
            "data_recebimento": self.data_recebimento.isoformat(),
            "recebido": self.recebido,
            "caso_id": self.caso_id,
            "user_id": self.user_id,
            "contrato_id": self.contrato_id,
        }


class TarefaPrazo(db.Model):
    __tablename__ = "tarefa_prazo"
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(
        db.Integer, db.ForeignKey("tenant.id", name="fk_tarefaprazo_tenant_id"), nullable=True
    )
    titulo = db.Column(db.String(250), nullable=False)
    descricao = db.Column(db.Text, nullable=True)
    status = db.Column(
        db.String(50), nullable=True, default="A Fazer"
    )  # A Fazer, Fazendo, Concluído
    prioridade = db.Column(
        db.String(50), nullable=True, default="Normal"
    )  # Baixa, Normal, Alta, Urgente
    data_vencimento = db.Column(db.DateTime, nullable=True)
    tipo_tarefa = db.Column(
        db.String(50), nullable=True, default="Prazo"
    )  # Prazo, Peticionamento, Reunião, Ligação, Outros
    origem_id = db.Column(db.String(100), nullable=True)  # Ex: ID do MNI
    data_criacao = db.Column(db.DateTime, default=datetime.utcnow)
    posicao = db.Column(db.Integer, nullable=True, default=0)

    user_id = db.Column(
        db.Integer, db.ForeignKey("user.id", name="fk_tarefaprazo_user_id"), nullable=False
    )
    caso_id = db.Column(
        db.Integer, db.ForeignKey("caso.id", name="fk_tarefaprazo_caso_id"), nullable=True
    )
    __table_args__ = (
        db.Index("ix_tarefa_prazo_tenant_created", "tenant_id", "data_criacao"),
        db.Index("ix_tarefa_prazo_tenant_status_posicao", "tenant_id", "status", "posicao"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "titulo": self.titulo,
            "descricao": self.descricao,
            "status": self.status,
            "prioridade": self.prioridade,
            "data_vencimento": self.data_vencimento.isoformat() if self.data_vencimento else None,
            "tipo_tarefa": self.tipo_tarefa,
            "origem_id": self.origem_id,
            "posicao": self.posicao,
            "user_id": self.user_id,
            "caso_id": self.caso_id,
            "data_criacao": self.data_criacao.isoformat() if self.data_criacao else None,
        }


class DjenOabMonitoramento(db.Model):
    """OABs configuradas para monitoramento automático de publicações DJEN."""

    __tablename__ = "djen_oab_monitoramento"
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(
        db.Integer, db.ForeignKey("tenant.id", name="fk_djen_oab_tenant_id"), nullable=True
    )
    user_id = db.Column(
        db.Integer, db.ForeignKey("user.id", name="fk_djen_oab_user_id"), nullable=False
    )
    numero_oab = db.Column(db.String(30), nullable=False)
    uf_oab = db.Column(db.String(2), nullable=True)
    sigla_tribunal = db.Column(db.String(120), nullable=True)
    nome_advogado = db.Column(db.String(200), nullable=True)
    ativo = db.Column(db.Boolean, default=True)
    ultima_sincronizacao = db.Column(db.DateTime, nullable=True)
    data_criacao = db.Column(db.DateTime, default=datetime.utcnow)
    __table_args__ = (
        db.UniqueConstraint("tenant_id", "numero_oab", "uf_oab", name="uq_djen_oab_tenant"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "tenant_id": self.tenant_id,
            "numero_oab": self.numero_oab,
            "uf_oab": self.uf_oab,
            "sigla_tribunal": self.sigla_tribunal,
            "nome_advogado": self.nome_advogado,
            "ativo": self.ativo,
            "ultima_sincronizacao": (
                self.ultima_sincronizacao.isoformat() if self.ultima_sincronizacao else None
            ),
            "data_criacao": self.data_criacao.isoformat() if self.data_criacao else None,
        }


class PublicacaoDJEN(db.Model):
    """Publicações do Diário de Justiça Eletrônico capturadas via ComunicaAPI."""

    __tablename__ = "publicacao_djen"
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(
        db.Integer, db.ForeignKey("tenant.id", name="fk_pub_djen_tenant_id"), nullable=True
    )
    user_id = db.Column(
        db.Integer, db.ForeignKey("user.id", name="fk_pub_djen_user_id"), nullable=False
    )
    caso_id = db.Column(
        db.Integer, db.ForeignKey("caso.id", name="fk_pub_djen_caso_id"), nullable=True
    )
    djen_id = db.Column(db.BigInteger, nullable=True, index=True)
    hash_comunicacao = db.Column(db.String(100), nullable=True, index=True)
    numero_comunicacao = db.Column(db.Integer, nullable=True)
    numero_processo = db.Column(db.String(50), nullable=True, index=True)
    numero_processo_mascara = db.Column(db.String(50), nullable=True)
    sigla_tribunal = db.Column(db.String(20), nullable=True, index=True)
    nome_orgao = db.Column(db.String(200), nullable=True)
    tipo_comunicacao = db.Column(db.String(100), nullable=True)
    tipo_documento = db.Column(db.String(100), nullable=True)
    nome_classe = db.Column(db.String(200), nullable=True)
    data_disponibilizacao = db.Column(db.Date, nullable=True, index=True)
    texto = db.Column(db.Text, nullable=True)
    link = db.Column(db.Text, nullable=True)
    meio = db.Column(db.String(1), nullable=True)
    ativo = db.Column(db.Boolean, default=True)
    origem_busca = db.Column(db.String(20), nullable=True)  # 'oab' ou 'processo'
    status_origem = db.Column(
        db.String(40), nullable=True, index=True
    )  # pendente, criado_automaticamente, revisado_manual, ignorado
    lida = db.Column(db.Boolean, default=False, index=True)
    triagem_ignorada = db.Column(db.Boolean, default=False, index=True)
    notas = db.Column(db.Text, nullable=True)
    polo_ativo = db.Column(db.Text, nullable=True)
    polo_passivo = db.Column(db.Text, nullable=True)
    nome_juiz = db.Column(db.String(200), nullable=True)
    raw_json = db.Column(db.JSON, nullable=True)
    data_captura = db.Column(db.DateTime, default=datetime.utcnow)
    __table_args__ = (
        db.UniqueConstraint("tenant_id", "djen_id", name="uq_pub_djen_tenant_djenid"),
        db.Index("ix_publicacao_djen_tenant_created", "tenant_id", "data_captura"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "tenant_id": self.tenant_id,
            "caso_id": self.caso_id,
            "djen_id": self.djen_id,
            "hash_comunicacao": self.hash_comunicacao,
            "numero_processo": self.numero_processo,
            "numero_processo_mascara": self.numero_processo_mascara,
            "sigla_tribunal": self.sigla_tribunal,
            "nome_orgao": self.nome_orgao,
            "tipo_comunicacao": self.tipo_comunicacao,
            "tipo_documento": self.tipo_documento,
            "nome_classe": self.nome_classe,
            "data_disponibilizacao": (
                self.data_disponibilizacao.isoformat() if self.data_disponibilizacao else None
            ),
            "texto": self.texto,
            "link": self.link,
            "meio": self.meio,
            "ativo": self.ativo,
            "origem_busca": self.origem_busca,
            "status_origem": self.status_origem,
            "triagem_ignorada": self.triagem_ignorada,
            "lida": self.lida,
            "notas": self.notas,
            "polo_ativo": self.polo_ativo,
            "polo_passivo": self.polo_passivo,
            "nome_juiz": self.nome_juiz,
            "data_captura": self.data_captura.isoformat() if self.data_captura else None,
        }


class DjenVinculoDecisao(db.Model):
    """Trilha auditável de decisões humanas/automáticas da triagem DJEN."""

    __tablename__ = "djen_vinculo_decisao"
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(
        db.Integer,
        db.ForeignKey("tenant.id", name="fk_djen_decisao_tenant_id"),
        nullable=True,
        index=True,
    )
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("user.id", name="fk_djen_decisao_user_id"),
        nullable=False,
        index=True,
    )
    publicacao_id = db.Column(
        db.Integer,
        db.ForeignKey("publicacao_djen.id", name="fk_djen_decisao_publicacao_id"),
        nullable=False,
        index=True,
    )
    acao = db.Column(db.String(30), nullable=False, index=True)  # criar, mesclar, ignorar
    origem_acao = db.Column(db.String(20), nullable=False, default="manual")  # manual ou automatica
    cliente_id = db.Column(
        db.Integer, db.ForeignKey("cliente.id", name="fk_djen_decisao_cliente_id"), nullable=True
    )
    caso_id = db.Column(
        db.Integer, db.ForeignKey("caso.id", name="fk_djen_decisao_caso_id"), nullable=True
    )
    confianca = db.Column(db.Float, nullable=True)
    motivo = db.Column(db.String(255), nullable=True)
    payload = db.Column(db.JSON, nullable=True)
    data_decisao = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)

    def to_dict(self):
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "user_id": self.user_id,
            "publicacao_id": self.publicacao_id,
            "acao": self.acao,
            "origem_acao": self.origem_acao,
            "cliente_id": self.cliente_id,
            "caso_id": self.caso_id,
            "confianca": self.confianca,
            "motivo": self.motivo,
            "payload": self.payload,
            "data_decisao": self.data_decisao.isoformat() if self.data_decisao else None,
        }


class PasswordResetToken(db.Model):
    """Token de uso único para recuperação de senha.

    Armazenamos apenas o SHA-256 do token (nunca o plaintext) para que um
    eventual vazamento do banco não permita reset imediato. O token plaintext
    só existe no email enviado ao usuário.
    """

    __tablename__ = "password_reset_token"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("user.id", name="fk_password_reset_user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash = db.Column(db.String(64), nullable=False, unique=True, index=True)
    expires_at = db.Column(db.DateTime, nullable=False)
    used_at = db.Column(db.DateTime, nullable=True)
    requested_ip = db.Column(db.String(45), nullable=True)
    requested_user_agent = db.Column(db.String(500), nullable=True)
    criado_em = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    user = db.relationship("User", foreign_keys=[user_id])


class DjenSyncJob(db.Model):
    """Fila persistente de jobs de sincronizacao DJEN (B1 do roteiro 2026-05-01).

    Endpoint POST /djen/sync enfileira aqui (status=pending) e retorna 202.
    Processo djen-worker poll a cada 5s, pega job FOR UPDATE SKIP LOCKED, marca
    running, executa job_monitorar_djen, marca done/failed com resumo.

    Categoria C (sem RLS): worker e cross-tenant; tenant_id e dado da linha,
    nao filtro de policy. Filtragem por tenant na leitura via /djen/sync/<id>
    e na camada de aplicacao (endpoint exige user.tenant_id == job.tenant_id).
    """

    __tablename__ = "djen_sync_job"
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(
        db.Integer,
        db.ForeignKey("tenant.id", name="fk_djen_sync_job_tenant_id"),
        nullable=False,
        index=True,
    )
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("user.id", name="fk_djen_sync_job_user_id"),
        nullable=False,
    )
    # status: pending | running | done | failed
    status = db.Column(
        db.String(20), nullable=False, default="pending", server_default="pending", index=True
    )
    lookback_days = db.Column(db.Integer, nullable=False, default=30)
    resumo = db.Column(db.JSON, nullable=True)
    erro = db.Column(db.Text, nullable=True)
    criado_em = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    iniciado_em = db.Column(db.DateTime, nullable=True)
    concluido_em = db.Column(db.DateTime, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "user_id": self.user_id,
            "status": self.status,
            "lookback_days": self.lookback_days,
            "resumo": self.resumo,
            "erro": self.erro,
            "criado_em": self.criado_em.isoformat() if self.criado_em else None,
            "iniciado_em": self.iniciado_em.isoformat() if self.iniciado_em else None,
            "concluido_em": self.concluido_em.isoformat() if self.concluido_em else None,
        }


class AccessRequest(db.Model):
    """Solicitacao de acesso a beta privada (issue #112 v2).

    Coleta lead pre-comercial via /api/v1/auth/access-request publico.
    Superadmin revisa em /admin/v1/access-requests e aprova ou rejeita.
    Categoria C — sem tenant_id, sem RLS, acesso so via admin_session
    ou superadmin endpoint.
    """

    __tablename__ = "access_request"
    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(200), nullable=False)
    email = db.Column(db.String(120), nullable=False, index=True)
    oab = db.Column(db.String(30), nullable=True)
    sigla_oab = db.Column(db.String(10), nullable=True)
    telefone = db.Column(db.String(30), nullable=True)
    escritorio = db.Column(db.String(200), nullable=True)
    mensagem = db.Column(db.Text, nullable=True)
    status = db.Column(
        db.String(20), nullable=False, default="pending", server_default="pending", index=True
    )
    motivo_rejeicao = db.Column(db.String(500), nullable=True)
    ip = db.Column(db.String(45), nullable=True)
    user_agent = db.Column(db.String(500), nullable=True)
    criado_em = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    processado_em = db.Column(db.DateTime, nullable=True)
    processado_por_user_id = db.Column(
        db.Integer,
        db.ForeignKey("user.id", name="fk_access_request_processado_por_user_id"),
        nullable=True,
    )

    def to_dict(self):
        return {
            "id": self.id,
            "nome": self.nome,
            "email": self.email,
            "oab": self.oab,
            "sigla_oab": self.sigla_oab,
            "telefone": self.telefone,
            "escritorio": self.escritorio,
            "mensagem": self.mensagem,
            "status": self.status,
            "motivo_rejeicao": self.motivo_rejeicao,
            "criado_em": self.criado_em.isoformat() if self.criado_em else None,
            "processado_em": self.processado_em.isoformat() if self.processado_em else None,
            "processado_por_user_id": self.processado_por_user_id,
        }


# admin-fase0: auditoria das acoes do super-admin (across tenants)
class AdminAuditLog(db.Model):
    __tablename__ = "admin_audit_log"
    id = db.Column(db.Integer, primary_key=True)
    admin_user_id = db.Column(
        db.Integer,
        db.ForeignKey("user.id", name="fk_admin_audit_user_id"),
        nullable=False,
        index=True,
    )
    action = db.Column(db.String(60), nullable=False, index=True)
    target_type = db.Column(db.String(40), nullable=False)
    target_id = db.Column(db.Integer, nullable=True)
    target_tenant_id = db.Column(
        db.Integer,
        db.ForeignKey("tenant.id", name="fk_admin_audit_target_tenant_id"),
        nullable=True,
        index=True,
    )
    before_json = db.Column(db.Text, nullable=True)
    after_json = db.Column(db.Text, nullable=True)
    ip = db.Column(db.String(45), nullable=True)
    user_agent = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)

    __table_args__ = (
        db.Index("ix_admin_audit_target_tenant_created", "target_tenant_id", "created_at"),
    )

    admin_user = db.relationship("User", foreign_keys=[admin_user_id])

    def to_dict(self):
        return {
            "id": self.id,
            "admin_user_id": self.admin_user_id,
            "admin_username": self.admin_user.username if self.admin_user else None,
            "action": self.action,
            "target_type": self.target_type,
            "target_id": self.target_id,
            "target_tenant_id": self.target_tenant_id,
            "before_json": self.before_json,
            "after_json": self.after_json,
            "ip": self.ip,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# admin-fase0: anotacoes internas do super-admin sobre tenants
class TenantAnotacao(db.Model):
    __tablename__ = "tenant_anotacao"
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(
        db.Integer,
        db.ForeignKey("tenant.id", name="fk_tenant_anotacao_tenant_id"),
        nullable=False,
        index=True,
    )
    admin_user_id = db.Column(
        db.Integer,
        db.ForeignKey("user.id", name="fk_tenant_anotacao_admin_user_id"),
        nullable=False,
    )
    texto = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)

    admin_user = db.relationship("User", foreign_keys=[admin_user_id])

    def to_dict(self):
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "admin_user_id": self.admin_user_id,
            "admin_username": self.admin_user.username if self.admin_user else None,
            "texto": self.texto,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class ConsentimentoUsuario(db.Model):
    __tablename__ = "consentimento_usuario"
    id = db.Column(db.Integer, primary_key=True)
    # tenant_id denormalizado (Batch 4) — NOT NULL. Decisao Opcao C do plano
    # NOTA da decisao #2: policy por tenant_id consistente com resto do schema;
    # compliance LGPD individual continua na camada de aplicacao
    # (filter por user_id em /me/consentimentos).
    tenant_id = db.Column(
        db.Integer,
        db.ForeignKey("tenant.id", name="fk_consentimento_tenant_id"),
        nullable=False,
    )
    user_id = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="CASCADE"), nullable=False)
    tipo = db.Column(db.String(32), nullable=False)  # "termos_uso" | "lgpd"
    versao = db.Column(db.String(16), nullable=False)  # ex: "v1.0"
    aceito_em = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    ip = db.Column(db.String(45))  # IPv6-safe
    user_agent = db.Column(db.String(500))
    hash_documento = db.Column(db.String(64))  # SHA-256 opcional

    __table_args__ = (
        db.UniqueConstraint("user_id", "tipo", "versao", name="uq_consentimento_user_tipo_versao"),
        db.Index("ix_consentimento_user_tipo", "user_id", "tipo"),
        db.Index("ix_consentimento_tenant_user", "tenant_id", "user_id"),
    )

    user = db.relationship(
        "User",
        backref=db.backref("consentimentos", lazy="dynamic", cascade="all, delete-orphan"),
    )
