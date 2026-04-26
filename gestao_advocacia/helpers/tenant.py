from contextlib import contextmanager
from functools import wraps

from flask import current_app, g, request
from flask_jwt_extended import get_jwt_identity
from flask_restx import abort
from sqlalchemy import text

from extensions import db
from models import User
from utils.log_sanitizer import mask_user_id


def _session_has_open_transaction():
    in_transaction = getattr(db.session, "in_transaction", None)
    if callable(in_transaction):
        return bool(in_transaction())

    # Fallback defensivo para stacks legados (SQLAlchemy < 1.4).
    return getattr(db.session, "transaction", None) is not None


def set_current_tenant_id(tenant_id):
    """Define o tenant atual no contexto SQL da sessao.

    Usa set_config(name, value, is_local=true), que e equivalente
    semantico ao SET LOCAL e suporta bind parameters com seguranca.

    No-op em SQLite (dev local e suite de testes): set_config e funcao
    do Postgres e RLS so existe em Postgres. Risco 7.6 do plano.
    """
    if tenant_id is None:
        raise ValueError("tenant_id nao pode ser None")

    if db.engine.dialect.name == "sqlite":
        return

    params = {"tid": str(int(tenant_id))}
    statement = text("SELECT set_config('app.current_tenant_id', :tid, true)")
    db.session.execute(statement, params)


@contextmanager
def tenant_session(tenant_id):
    """Injeta tenant no contexto SQL via set_config (equivalente a SET LOCAL).

    Uso esperado em jobs/scripts (fora de request context):

        for oab in DjenOabMonitoramento.query.all():  # roda como app_admin
            with tenant_session(oab.tenant_id):
                processar_publicacoes(oab)             # respeita RLS

    Comportamento de transacao:
    - Se ja existe transacao aberta: usa a atual, sem commit no exit.
    - Se nao existe: abre via db.session.begin(), com commit/rollback
      automatico ao sair do bloco.
    """
    if tenant_id is None:
        raise ValueError("tenant_id nao pode ser None em tenant_session")

    if _session_has_open_transaction():
        set_current_tenant_id(tenant_id)
        yield
        return

    with db.session.begin():
        set_current_tenant_id(tenant_id)
        yield


def tenant_scoped(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        # Garante defesa em profundidade: toda rota protegida precisa de tenant válido.
        get_tenant_id()
        return fn(*args, **kwargs)

    return wrapper


def get_tenant_id():
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)
    if not user:
        abort(401, "Acesso Inválido. Usuário não encontrado no banco.")
    if user.tenant_id is None:
        abort(403, "Acesso Negado (LGPD): Usuário sem tenant atribuído.")
    g.user_id = user.id
    g.tenant_id = user.tenant_id
    return user.tenant_id


def query_for_tenant(model):
    # Helper único para queries com escopo de tenant e, quando existir, usuário.
    tenant_id = get_tenant_id()
    user_id = get_jwt_identity()

    query = model.query
    if hasattr(model, "tenant_id"):
        query = query.filter_by(tenant_id=tenant_id)
    if hasattr(model, "user_id"):
        query = query.filter_by(user_id=user_id)
    return query


def get_list_query(model):
    return query_for_tenant(model)


def get_item_or_404(model, item_id):
    tenant_id = get_tenant_id()
    user_id = get_jwt_identity()

    item = query_for_tenant(model).filter_by(id=item_id).first()
    if item:
        return item

    # Log de tentativa de acesso indevido sem vazar para o cliente.
    try:
        alvo = db.session.get(model, item_id)
        tenant_alvo = getattr(alvo, "tenant_id", None) if alvo is not None else None
        if hasattr(model, "tenant_id"):
            current_app.logger.warning(
                "cross_tenant_access_blocked",
                extra={
                    "event": "cross_tenant_access_blocked",
                    "user_id_hash": mask_user_id(user_id),
                    "current_tenant": tenant_id,
                    "target_tenant": tenant_alvo,
                    "endpoint": request.path,
                    "item_id": item_id,
                    "model": model.__name__,
                },
            )
        elif (
            alvo is not None
            and hasattr(alvo, "user_id")
            and int(getattr(alvo, "user_id", -1)) != int(user_id)
        ):
            current_app.logger.warning(
                "cross_user_access_blocked",
                extra={
                    "event": "cross_user_access_blocked",
                    "user_id_hash": mask_user_id(user_id),
                    "current_tenant": tenant_id,
                    "target_tenant": tenant_alvo,
                    "endpoint": request.path,
                    "item_id": item_id,
                    "model": model.__name__,
                },
            )
    except Exception:
        pass

    abort(404, "Registro não encontrado.")


def get_existing_item(model, **kwargs):
    return query_for_tenant(model).filter_by(**kwargs).first()
