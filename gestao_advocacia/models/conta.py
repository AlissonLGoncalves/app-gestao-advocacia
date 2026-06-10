"""Conta e acesso: tenant, usuários, auth e administração.

Issue #300 — extraído do models/__init__.py monolítico.
"""

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
    # N3 Notificacoes: opt-in de e-mail pros avisos de vencimento (recebimentos/
    # despesas). Default True; usuario pode desligar em /perfil. As notificacoes
    # in-app (sino) continuam independente desta flag.
    notif_email_vencimentos = db.Column(db.Boolean, nullable=False, default=True)
    portal_cliente_id = db.Column(
        db.Integer, db.ForeignKey("cliente.id", name="fk_user_portal_cliente_id"), nullable=True
    )

    casos = db.relationship(
        "Caso", backref="responsavel_user", lazy="dynamic", foreign_keys="Caso.user_id"
    )
    clientes = db.relationship(
        "Cliente", backref="advogado_responsavel", lazy="dynamic", foreign_keys="Cliente.user_id"
    )
    # PR D4.4 — relacionamentos eventos_agenda e tarefas_prazo removidos
    # junto com os models legados. ItemAgenda eh agora a fonte unica.
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
            "notif_email_vencimentos": (
                self.notif_email_vencimentos if self.notif_email_vencimentos is not None else True
            ),
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
