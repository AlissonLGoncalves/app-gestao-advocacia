"""Routes para emissao de NFS-e (Etapa 5 da feature Pagamentos Recebidos).

Endpoints expostos:
  GET  /api/v1/nfse/config        — config do tenant
  PUT  /api/v1/nfse/config        — atualiza config (cria se nao existe)
  POST /api/v1/nfse/emitir/<recebimento_id>  — dispara emissao on-demand
  GET  /api/v1/nfse/emissoes      — lista emissoes do tenant
  GET  /api/v1/nfse/emissoes/<id> — detalhe de uma emissao

Esta fase usa apenas o MockGateway — nenhuma nota real chega na Receita
ou prefeitura. Adapter real (Portal Nacional NFS-e) fica para PR
posterior, quando houver certificado A1 e ambiente de homologacao.
"""

from flask import request
from flask_jwt_extended import get_jwt_identity, jwt_required
from flask_restx import Resource

from extensions import db
from helpers import get_item_or_404, get_tenant_id, query_for_tenant, tenant_scoped
from models import ConfigNFSe, EmissaoNFSe, Recebimento
from nfse.service import emitir as nfse_emitir

GATEWAY_TIPOS_VALIDOS = {"mock", "portal_nacional", "focus_nfe", "plugnotas"}
AMBIENTES_VALIDOS = {"sandbox", "producao"}
STATUS_PAGO = "Pago"


def _ou_cria_config(tenant_id: int) -> ConfigNFSe:
    config = ConfigNFSe.query.filter_by(tenant_id=tenant_id).first()
    if config is None:
        config = ConfigNFSe(tenant_id=tenant_id)
        db.session.add(config)
        db.session.flush()
    return config


def register_nfse_routes(app, nfse_ns, finance_access_required):
    @nfse_ns.route("/config")
    class ConfigNFSeAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @finance_access_required
        @nfse_ns.doc(security="jsonWebToken")
        def get(self):
            tenant_id = get_tenant_id()
            config = ConfigNFSe.query.filter_by(tenant_id=tenant_id).first()
            if config is None:
                # Retorna esqueleto vazio pra UI mostrar form em branco.
                return {
                    "id": None,
                    "cnpj_emissor": None,
                    "inscricao_municipal": None,
                    "razao_social": None,
                    "municipio": None,
                    "uf": None,
                    "codigo_servico": None,
                    "regime_tributario": None,
                    "aliquota_iss": None,
                    "ambiente": "sandbox",
                    "gateway_tipo": "mock",
                    "tem_certificado": False,
                    "configurado": False,
                }, 200
            return config.to_dict(), 200

        @jwt_required()
        @tenant_scoped
        @finance_access_required
        @nfse_ns.doc(security="jsonWebToken")
        def put(self):
            tenant_id = get_tenant_id()
            data = request.get_json() or {}

            ambiente = data.get("ambiente", "sandbox")
            if ambiente not in AMBIENTES_VALIDOS:
                nfse_ns.abort(400, message=f"ambiente invalido. Use: {sorted(AMBIENTES_VALIDOS)}")

            gateway_tipo = data.get("gateway_tipo", "mock")
            if gateway_tipo not in GATEWAY_TIPOS_VALIDOS:
                nfse_ns.abort(
                    400, message=f"gateway_tipo invalido. Use: {sorted(GATEWAY_TIPOS_VALIDOS)}"
                )

            aliquota_raw = data.get("aliquota_iss")
            aliquota = None
            if aliquota_raw not in (None, ""):
                try:
                    aliquota = float(aliquota_raw)
                    if aliquota < 0 or aliquota > 100:
                        raise ValueError
                except (TypeError, ValueError):
                    nfse_ns.abort(400, message="aliquota_iss deve ser numero entre 0 e 100.")

            uf = (data.get("uf") or "").strip().upper()
            if uf and len(uf) != 2:
                nfse_ns.abort(400, message="uf deve ter 2 caracteres (ex: SP).")

            config = _ou_cria_config(tenant_id)
            config.cnpj_emissor = data.get("cnpj_emissor")
            config.inscricao_municipal = data.get("inscricao_municipal")
            config.razao_social = data.get("razao_social")
            config.municipio = data.get("municipio")
            config.uf = uf or None
            config.codigo_servico = data.get("codigo_servico")
            config.regime_tributario = data.get("regime_tributario")
            config.aliquota_iss = aliquota
            config.ambiente = ambiente
            config.gateway_tipo = gateway_tipo

            db.session.commit()
            app.logger.info(
                f"ConfigNFSe atualizada para tenant {tenant_id} (gateway={gateway_tipo})."
            )
            return config.to_dict(), 200

    @nfse_ns.route("/emitir/<int:recebimento_id>")
    @nfse_ns.param("recebimento_id", "ID do Recebimento a emitir nota")
    class EmitirNFSeAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @finance_access_required
        @nfse_ns.doc(security="jsonWebToken")
        def post(self, recebimento_id):
            user_id = get_jwt_identity()
            recebimento = query_for_tenant(Recebimento).filter_by(id=recebimento_id).first()
            if recebimento is None:
                nfse_ns.abort(404, message="Recebimento nao encontrado.")
            if recebimento.status != STATUS_PAGO:
                nfse_ns.abort(
                    400,
                    message=(
                        "Recebimento precisa estar com status 'Pago' para emitir NFS-e. "
                        f"Status atual: {recebimento.status!r}."
                    ),
                )

            tenant_id = get_tenant_id()
            config = ConfigNFSe.query.filter_by(tenant_id=tenant_id).first()
            # Service tolera config=None — o mock devolve Rejeitada com
            # mensagem clara. UI deve guiar pra Settings de NFS-e nesse caso.

            emissao = nfse_emitir(recebimento, config, user_id)
            app.logger.info(
                f"Emissao NFSe id={emissao.id} status={emissao.status} "
                f"recebimento={recebimento_id} gateway={emissao.gateway_tipo}"
            )
            status_code = 201 if emissao.status in ("Autorizada", "EmProcessamento") else 200
            return emissao.to_dict(), status_code

    @nfse_ns.route("/emissoes")
    class EmissaoNFSeListAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @finance_access_required
        @nfse_ns.doc(
            security="jsonWebToken",
            params={
                "recebimento_id": "Filtra emissoes de um recebimento (opcional)",
            },
        )
        def get(self):
            q = query_for_tenant(EmissaoNFSe)
            recebimento_id = request.args.get("recebimento_id")
            if recebimento_id:
                try:
                    q = q.filter_by(recebimento_id=int(recebimento_id))
                except (TypeError, ValueError):
                    nfse_ns.abort(400, message="recebimento_id invalido.")
            emissoes = q.order_by(EmissaoNFSe.created_at.desc()).limit(200).all()
            return [e.to_dict() for e in emissoes], 200

    @nfse_ns.route("/emissoes/<int:emissao_id>")
    class EmissaoNFSeDetailAPI(Resource):
        @jwt_required()
        @tenant_scoped
        @finance_access_required
        @nfse_ns.doc(security="jsonWebToken")
        def get(self, emissao_id):
            emissao = get_item_or_404(EmissaoNFSe, emissao_id)
            return emissao.to_dict(), 200
