"""Rotas /api/projudi/* — integracao com o projudi-agent (scraper local).

Fase 1: gestao de tokens API (gerar, listar, revogar) + endpoint /me
para o agent confirmar autenticacao.

Fases 2-4 (a vir): /processos, /movimentacoes, /pecas.
"""

import hashlib
import secrets
from datetime import datetime

from flask import g, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from flask_restx import Resource

from extensions import db
from helpers import projudi_agent_required, tenant_scoped
from models import ProjudiAgentToken, User


def register_projudi_routes(app, projudi_ns):
    @projudi_ns.route("/auth/me")
    class ProjudiAuthMe(Resource):
        @projudi_ns.doc(
            description=(
                "Endpoint de teste pro agent confirmar que o token esta valido. "
                "Retorna info do tenant/user vinculado ao token."
            ),
        )
        @projudi_agent_required
        def get(self):
            user = User.query.get(g.user_id)
            return {
                "tenant_id": g.tenant_id,
                "user_id": g.user_id,
                "user_email": user.email if user else None,
                "token_id": g.projudi_token_id,
            }, 200

    @projudi_ns.route("/auth/tokens")
    class ProjudiTokenList(Resource):
        @jwt_required()
        @tenant_scoped
        @projudi_ns.doc(
            security="jsonWebToken",
            description=(
                "Lista os tokens API do projudi-agent do tenant atual. "
                "Nao revela o valor cru — so metadados."
            ),
        )
        def get(self):
            tokens = (
                ProjudiAgentToken.query.filter_by(tenant_id=g.tenant_id)
                .order_by(ProjudiAgentToken.created_at.desc())
                .all()
            )
            return [t.to_dict() for t in tokens], 200

        @jwt_required()
        @tenant_scoped
        @projudi_ns.doc(
            security="jsonWebToken",
            description=(
                "Gera novo token API. Retorna o valor cru UMA UNICA VEZ — "
                "depois so o hash fica no banco. Use no .env do projudi-agent."
            ),
        )
        def post(self):
            payload = request.get_json(silent=True) or {}
            nome = (payload.get("nome") or "").strip()[:100] or None

            # 32 bytes urlsafe ~ 43 chars base64
            token_raw = secrets.token_urlsafe(32)
            token_hash = hashlib.sha256(token_raw.encode("utf-8")).hexdigest()

            token = ProjudiAgentToken(
                tenant_id=g.tenant_id,
                user_id=get_jwt_identity(),
                token_hash=token_hash,
                nome=nome,
                ativo=True,
            )
            db.session.add(token)
            db.session.commit()

            return {
                "token": token_raw,  # so aqui — depois nao volta mais
                "info": token.to_dict(),
                "aviso": (
                    "Guarde este token — ele nao sera exibido de novo. "
                    "Configure no .env do projudi-agent como APP_GESTAO_API_TOKEN."
                ),
            }, 201

    @projudi_ns.route("/auth/tokens/<int:token_id>")
    class ProjudiTokenItem(Resource):
        @jwt_required()
        @tenant_scoped
        @projudi_ns.doc(
            security="jsonWebToken",
            description="Revoga um token API (corte de acesso imediato pro agent).",
        )
        def delete(self, token_id):
            token = ProjudiAgentToken.query.filter_by(id=token_id, tenant_id=g.tenant_id).first()
            if not token:
                return {"message": "Token nao encontrado neste tenant."}, 404
            token.ativo = False
            token.revoked_at = datetime.utcnow()
            db.session.commit()
            return {"message": "Token revogado.", "info": token.to_dict()}, 200
