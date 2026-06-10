"""Modelos SQLAlchemy do Patronus.

Issue #300 — o monólito de ~2.000 linhas foi fatiado por domínio.
Este __init__ re-exporta tudo: `from models import Caso` continua
funcionando em todo o código e nos imports do Alembic.
"""

from models.agenda import ItemAgenda, Notificacao
from models.auditoria import AuditLog, log_audit
from models.conta import (
    AccessRequest,
    AdminAuditLog,
    ConsentimentoUsuario,
    LoginAudit,
    PasswordResetToken,
    Tenant,
    TenantAnotacao,
    User,
)
from models.djen import DjenOabMonitoramento, DjenSyncJob, DjenVinculoDecisao, PublicacaoDJEN
from models.financeiro import (
    ConfigNFSe,
    ContratoHonorario,
    Despesa,
    EmissaoNFSe,
    Recebimento,
    RecorrenciaDespesa,
    RecorrenciaRecebimento,
)
from models.integracoes import ProjudiAgentToken, ProjudiSyncLog
from models.juridico import (
    Caso,
    Cliente,
    Documento,
    ModeloDocumento,
    MovimentacaoCNJ,
    ProcuracaoAnalise,
)

__all__ = [
    "AccessRequest",
    "AdminAuditLog",
    "AuditLog",
    "Caso",
    "Cliente",
    "ConfigNFSe",
    "ConsentimentoUsuario",
    "ContratoHonorario",
    "Despesa",
    "DjenOabMonitoramento",
    "DjenSyncJob",
    "DjenVinculoDecisao",
    "Documento",
    "EmissaoNFSe",
    "ItemAgenda",
    "LoginAudit",
    "ModeloDocumento",
    "MovimentacaoCNJ",
    "Notificacao",
    "PasswordResetToken",
    "ProcuracaoAnalise",
    "ProjudiAgentToken",
    "ProjudiSyncLog",
    "PublicacaoDJEN",
    "Recebimento",
    "RecorrenciaDespesa",
    "RecorrenciaRecebimento",
    "Tenant",
    "TenantAnotacao",
    "User",
    "log_audit",
]
