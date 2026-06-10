"""Integrações externas (projudi-agent).

Issue #300 — extraído do models/__init__.py monolítico.
"""

from datetime import datetime

from extensions import db


class ProjudiSyncLog(db.Model):
    """Registra cada execucao bem-sucedida do projudi-agent.

    Usado pelo Dashboard pra mostrar 'sync ha X minutos' e na tela de
    Integracoes pra trackear historico recente.
    """

    __tablename__ = "projudi_sync_log"
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(
        db.Integer,
        db.ForeignKey("tenant.id", name="fk_projudi_sync_log_tenant_id"),
        nullable=False,
    )
    token_id = db.Column(
        db.Integer,
        db.ForeignKey("projudi_agent_token.id", name="fk_projudi_sync_log_token_id"),
        nullable=True,
    )
    tipo = db.Column(db.String(20), nullable=False)  # 'processos'|'movimentacoes'|'pecas'
    counts = db.Column(db.JSON, nullable=True)  # estatisticas do request
    duracao_ms = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        db.Index("ix_projudi_sync_log_tenant_tipo_created", "tenant_id", "tipo", "created_at"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "tipo": self.tipo,
            "counts": self.counts,
            "duracao_ms": self.duracao_ms,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class ProjudiAgentToken(db.Model):
    """Token de API para o projudi-agent (scraper local) autenticar no Patronus.

    Não usa JWT do usuário (que expira em horas). Token é tenant-scoped,
    longo-vivo e revogável. O valor cru só é exibido UMA vez no momento da
    criação — o banco guarda só o hash sha256.
    """

    __tablename__ = "projudi_agent_token"
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(
        db.Integer,
        db.ForeignKey("tenant.id", name="fk_projudi_token_tenant_id"),
        nullable=False,
    )
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("user.id", name="fk_projudi_token_user_id"),
        nullable=False,
    )
    token_hash = db.Column(db.String(64), nullable=False, unique=True, index=True)
    nome = db.Column(db.String(100), nullable=True)  # apelido livre, ex: 'Notebook escritorio'
    ativo = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    last_used_at = db.Column(db.DateTime, nullable=True)
    revoked_at = db.Column(db.DateTime, nullable=True)

    __table_args__ = (db.Index("ix_projudi_token_tenant_ativo", "tenant_id", "ativo"),)

    def to_dict(self):
        return {
            "id": self.id,
            "nome": self.nome,
            "ativo": self.ativo,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_used_at": self.last_used_at.isoformat() if self.last_used_at else None,
            "revoked_at": self.revoked_at.isoformat() if self.revoked_at else None,
        }
