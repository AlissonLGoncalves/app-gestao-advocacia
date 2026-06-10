"""Trilha de auditoria da aplicação.

Issue #300 — extraído do models/__init__.py monolítico.
"""

from datetime import datetime

from extensions import db
from models.conta import User


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
