"""Acesso pontual ao DB com role app_admin (BYPASSRLS).

Usado em endpoints publicos pre-autenticacao (login, forgot-password,
reset-password, register-invite) que precisam consultar `user`,
`password_reset_token` ou outras tabelas auth-cluster antes de existir
um tenant_id na sessao. Sem esse escape, RLS restritivo na tabela user
(Batch 4) bloquearia todo lookup por email/username.

Padrao de uso:

    from helpers.admin_session import admin_session

    with admin_session() as s:
        user = s.query(User).filter_by(email=email).first()
        if user is None:
            return {"message": "..."}, 401
        # Capturar atributos AINDA dentro do with — apos sair do contexto
        # o objeto fica detached e atributos lazy-loaded falham.
        user_id = user.id
        user_tenant_id = user.tenant_id
        if not user.check_password(password):
            return {"message": "..."}, 401

    # Fora do with: usar user_id, user_tenant_id (snapshot) para gerar JWT.

Engine criada lazily na primeira chamada e mantida em cache de modulo.
Pool reusa conexoes — pool_pre_ping + pool_recycle replicam config do
runtime engine para evitar SSL closed apos sleep do Fly.

Idempotente em SQLite: se DATABASE_URL_ADMIN nao estiver setado, cai no
mesmo URL do runtime e funciona normalmente (RLS nao existe em SQLite).
"""

from contextlib import contextmanager

from flask import current_app
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_admin_engine = None
_AdminSession = None


def _get_admin_session_factory():
    global _admin_engine, _AdminSession
    if _admin_engine is None:
        admin_url = (
            current_app.config.get("SQLALCHEMY_DATABASE_URI_ADMIN")
            or current_app.config["SQLALCHEMY_DATABASE_URI"]
        )
        _admin_engine = create_engine(
            admin_url,
            pool_pre_ping=True,
            pool_recycle=280,
        )
        _AdminSession = sessionmaker(bind=_admin_engine, expire_on_commit=False)
    return _AdminSession


@contextmanager
def admin_session():
    """Context manager que abre uma sessao DB com role app_admin (BYPASSRLS).

    Use APENAS em endpoints publicos pre-autenticacao ou em scripts
    administrativos cross-tenant. Em request handlers autenticados,
    use `db.session` normal (RLS ja resolvido pelo hook).
    """
    Session = _get_admin_session_factory()
    s = Session()
    try:
        yield s
        s.commit()
    except Exception:
        s.rollback()
        raise
    finally:
        s.close()
