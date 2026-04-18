from functools import wraps

from flask import current_app, g, request
from flask_jwt_extended import get_jwt_identity
from flask_restx import abort

from extensions import db
from models import User


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
                    "user_id": user_id,
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
                    "user_id": user_id,
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
