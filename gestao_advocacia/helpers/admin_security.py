"""admin-fase0: helpers do backoffice super-admin.

Contem:
- superadmin_required: decorator que valida claim role + IP allowlist opcional
- redact_sensitive: redaction de chaves sensiveis no before/after_json do audit log
- registrar_admin_audit: persiste AdminAuditLog na sessao corrente (commit responsabilidade do caller)
- ip_allowlist_check: validacao standalone do allowlist (testavel)
"""

import ipaddress
import json
import logging
import os
from functools import wraps

from flask import request
from flask_jwt_extended import get_jwt, get_jwt_identity
from flask_restx import abort

from extensions import db
from models import AdminAuditLog

logger = logging.getLogger(__name__)

# Lista deny de chaves sensiveis. Comparacao case-insensitive contra chaves do dict.
_REDACT_KEYS = frozenset(
    {
        "password",
        "senha",
        "token",
        "access_token",
        "refresh_token",
        "cpf",
        "secret",
        "api_key",
        "password_hash",
    }
)


def _client_ip(req):
    """IP real do cliente respeitando X-Forwarded-For (primeiro hop)."""
    xff = (req.headers.get("X-Forwarded-For") or "").split(",")[0].strip()
    return xff or req.remote_addr or ""


def _user_agent(req):
    return (req.headers.get("User-Agent") or "")[:500]


def _parse_allowlist(env_value):
    """CSV de IPs ou CIDRs -> lista de objetos ipaddress.

    Entradas invalidas sao logadas e ignoradas (nao quebram o app).
    """
    if not env_value:
        return []
    nets = []
    for raw in env_value.split(","):
        raw = raw.strip()
        if not raw:
            continue
        try:
            if "/" in raw:
                nets.append(ipaddress.ip_network(raw, strict=False))
            else:
                nets.append(ipaddress.ip_network(f"{raw}/32", strict=False))
        except ValueError:
            logger.warning("admin_ip_allowlist_entry_invalida", extra={"entry": raw})
    return nets


def ip_allowlist_check(client_ip_str, env_value):
    """True se permitido. Se allowlist vazia -> permitido (feature opt-in)."""
    nets = _parse_allowlist(env_value)
    if not nets:
        return True
    if not client_ip_str:
        return False
    try:
        ip = ipaddress.ip_address(client_ip_str)
    except ValueError:
        return False
    return any(ip in net for net in nets)


def superadmin_required(fn):
    """Exige claim role=='superadmin' no JWT e (se configurado) IP em ADMIN_IP_ALLOWLIST.

    Mensagem 403 generica para nao revelar existencia de recurso ou identidade.
    Aplicar SEMPRE em conjunto com @jwt_required() (que precede).
    """

    @wraps(fn)
    def wrapper(*args, **kwargs):
        claims = get_jwt()
        if claims.get("role", "") != "superadmin":
            abort(403, "Acesso negado.")

        env_value = os.environ.get("ADMIN_IP_ALLOWLIST", "")
        if env_value and not ip_allowlist_check(_client_ip(request), env_value):
            logger.warning(
                "admin_ip_allowlist_block",
                extra={"event": "admin_ip_allowlist_block", "ip": _client_ip(request)},
            )
            abort(403, "Acesso negado.")

        return fn(*args, **kwargs)

    return wrapper


def redact_sensitive(data):
    """Remove valores de chaves sensiveis recursivamente, preservando estrutura.

    Aceita dict, list ou primitivo. Retorna copia segura para serializar.
    """
    if isinstance(data, dict):
        return {
            k: ("***REDACTED***" if k.lower() in _REDACT_KEYS else redact_sensitive(v))
            for k, v in data.items()
        }
    if isinstance(data, list):
        return [redact_sensitive(item) for item in data]
    return data


def _safe_json_dumps(data):
    if data is None:
        return None
    try:
        return json.dumps(redact_sensitive(data), ensure_ascii=False, default=str)
    except (TypeError, ValueError):
        return json.dumps({"_serialization_error": True}, ensure_ascii=False)


def registrar_admin_audit(
    *,
    action,
    target_type,
    target_id=None,
    target_tenant_id=None,
    before=None,
    after=None,
):
    """Adiciona AdminAuditLog na sessao corrente (NAO faz commit).

    O caller deve chamar db.session.commit() para fechar a transacao atomicamente
    com a acao auditada. Em caso de exception aqui, propaga para o caller fazer
    rollback — auditoria e atomica com a acao por contrato.
    """
    admin_user_id = get_jwt_identity()
    log = AdminAuditLog(
        admin_user_id=int(admin_user_id) if admin_user_id is not None else None,
        action=action[:60],
        target_type=target_type[:40],
        target_id=target_id,
        target_tenant_id=target_tenant_id,
        before_json=_safe_json_dumps(before),
        after_json=_safe_json_dumps(after),
        ip=_client_ip(request)[:45] if request else None,
        user_agent=_user_agent(request) if request else None,
    )
    db.session.add(log)
    return log
