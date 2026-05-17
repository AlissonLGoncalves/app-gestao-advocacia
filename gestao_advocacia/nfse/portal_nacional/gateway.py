"""PortalNacionalGateway — adapter pro Portal Nacional NFS-e (gov.br).

Etapa 5.6.3 (esta) — adapter completo:
- emitir(): monta DPS XML, assina XMLDSIG, GZip+Base64, POST mTLS,
  parseia resposta.
- consultar_status(): GET por chave de acesso.
- cancelar(): POST de evento de cancelamento.

Implementacao usa MockGateway-style de retorno (EmissaoResultado) pra
o service nao precisar saber detalhes do Portal.

Pre-condicoes obrigatorias (validadas em _pre_validar):
- ConfigNFSe.tem_certificado == True
- CNPJ emissor, codigo servico, codigo IBGE preenchidos
- valor > 0

Quando alguma falta, retorna Rejeitada com mensagem clara em vez de
levantar exception — UI mostra direto pro usuario.
"""

from __future__ import annotations

import json
import logging

from ..gateway import EmissaoPayload, EmissaoResultado, NFSeGatewayBase
from .dps_builder import comprimir_e_codificar, montar_dps_xml
from .http_client import (
    PortalNacionalHTTPError,
    request_com_mtls,
    resolver_base_url,
)
from .signer import assinar_dps, carregar_pfx, descriptografar

logger = logging.getLogger(__name__)


class PortalNacionalGateway(NFSeGatewayBase):
    tipo = "portal_nacional"

    def __init__(self, config=None):
        self.config = config

    # ===================== Validacoes =====================

    def _pre_validar(self, payload: EmissaoPayload) -> str | None:
        if not payload.cnpj_emissor:
            return "CNPJ do emissor obrigatorio. Configure em Settings."
        if not payload.codigo_servico:
            return (
                "Codigo de servico municipal obrigatorio (ex: 17.06). "
                "Configure em Settings."
            )
        if not self.config or not self.config.codigo_municipio_ibge:
            return (
                "Codigo IBGE do municipio obrigatorio para Portal Nacional. "
                "Configure em Settings."
            )
        if payload.valor <= 0:
            return "Valor do servico deve ser positivo."
        if not self.config or not getattr(self.config, "tem_certificado", False):
            return (
                "Certificado A1 ainda nao foi enviado. Faca upload em Settings > "
                "NFS-e antes de tentar emitir."
            )
        if not getattr(self.config, "certificado_pfx_encrypted", None):
            return "Certificado A1 nao encontrado no banco. Reenvie em Settings."
        return None

    # ===================== Auxiliares de cert =====================

    def _carregar_cert_pem(self) -> tuple[bytes, bytes]:
        """Descriptografa e converte pfx em (key_pem, cert_pem)."""
        pfx_bytes = descriptografar(self.config.certificado_pfx_encrypted)
        senha = descriptografar(self.config.certificado_senha_encrypted).decode("utf-8")
        return carregar_pfx(pfx_bytes, senha)

    def _proximo_numero(self) -> int:
        """Numero sequencial da DPS. Atualiza o config — caller faz commit."""
        atual = self.config.nfse_numero_atual or 0
        return atual + 1

    # ===================== Emissao =====================

    def emitir(self, payload: EmissaoPayload) -> EmissaoResultado:
        erro = self._pre_validar(payload)
        if erro:
            return EmissaoResultado(status="Rejeitada", mensagem_erro=erro)

        serie = self.config.nfse_serie_atual or 1
        numero = self._proximo_numero()

        # 1. Monta DPS XML
        xml = montar_dps_xml(payload, self.config, serie=serie, numero=numero)

        # 2. Assina XMLDSIG
        try:
            key_pem, cert_pem = self._carregar_cert_pem()
            xml_assinado = assinar_dps(xml, cert_pem=cert_pem, key_pem=key_pem)
        except Exception as exc:
            logger.exception("Falha ao assinar DPS")
            return EmissaoResultado(
                status="Rejeitada",
                mensagem_erro=f"Falha ao assinar DPS: {exc!s}",
            )

        # 3. GZip + Base64
        dps_b64 = comprimir_e_codificar(xml_assinado)

        # 4. POST com mTLS
        base_url = resolver_base_url(self.config)
        url = f"{base_url}/nfse"
        try:
            resp = request_com_mtls(
                "POST",
                url,
                cert_pem=cert_pem,
                key_pem=key_pem,
                json_body={"dpsXmlGZipB64": dps_b64},
            )
        except PortalNacionalHTTPError as exc:
            return EmissaoResultado(
                status="Rejeitada",
                mensagem_erro=f"Portal rejeitou ({exc.status_code}): {exc.body[:300]}",
            )
        except Exception as exc:
            logger.exception("Falha de rede ao emitir DPS")
            return EmissaoResultado(
                status="Rejeitada",
                mensagem_erro=f"Erro de comunicacao com o Portal: {exc!s}",
            )

        # 5. Parsear resposta. Estrutura segue o Swagger oficial. Manual
        # nao expoe schema fechado ainda, entao tolerar variacoes.
        try:
            body = resp.json()
        except (ValueError, json.JSONDecodeError):
            return EmissaoResultado(
                status="Rejeitada",
                mensagem_erro="Portal retornou resposta nao-JSON.",
            )

        # Campos esperados (nomes do Swagger contribuintesissqn):
        chave = body.get("chaveAcesso") or body.get("chave_acesso")
        numero_nfse = body.get("nNFSe") or body.get("numero")
        serie_nfse = body.get("serie") or str(serie)
        codigo_verif = body.get("codVerif") or body.get("codigo_verificacao")
        # URLs do XML/PDF — manual sugere campos `linkXmlNfse` e
        # `linkDanfse` mas pode variar.
        xml_url = body.get("linkXmlNfse") or body.get("xml_url")
        pdf_url = body.get("linkDanfse") or body.get("pdf_url")

        # Status: presenca de chave de acesso indica autorizada.
        if chave:
            # Incrementa numero atual no config (commit do caller).
            self.config.nfse_numero_atual = numero
            return EmissaoResultado(
                status="Autorizada",
                gateway_id=str(chave),
                numero_nfse=str(numero_nfse) if numero_nfse else None,
                serie=str(serie_nfse) if serie_nfse else None,
                codigo_verificacao=str(codigo_verif) if codigo_verif else None,
                xml_url=xml_url,
                pdf_url=pdf_url,
            )

        # Sem chave -> portal aceitou em processamento assincrono ou
        # rejeitou. Mensagens de erro tipicamente em `mensagens` ou `erros`.
        mensagens = body.get("mensagens") or body.get("erros") or []
        if mensagens:
            erro_txt = "; ".join(
                str(m.get("descricao") or m.get("mensagem") or m) for m in mensagens[:5]
            )
            return EmissaoResultado(
                status="Rejeitada",
                mensagem_erro=erro_txt[:1000],
            )

        # Caso de processamento async (raro no Portal Nacional, mas possivel).
        protocolo = body.get("protocolo") or body.get("idProcessamento")
        if protocolo:
            return EmissaoResultado(
                status="EmProcessamento",
                gateway_id=str(protocolo),
            )

        return EmissaoResultado(
            status="Rejeitada",
            mensagem_erro=f"Resposta do Portal inesperada: {str(body)[:300]}",
        )

    # ===================== Consulta =====================

    def consultar_status(self, gateway_id: str) -> EmissaoResultado:
        if not self.config or not getattr(self.config, "tem_certificado", False):
            return EmissaoResultado(
                status="Rejeitada", mensagem_erro="Sem certificado para consultar."
            )
        try:
            key_pem, cert_pem = self._carregar_cert_pem()
        except Exception as exc:
            return EmissaoResultado(
                status="Rejeitada", mensagem_erro=f"Falha ao carregar cert: {exc!s}"
            )

        url = f"{resolver_base_url(self.config)}/nfse/{gateway_id}"
        try:
            resp = request_com_mtls("GET", url, cert_pem=cert_pem, key_pem=key_pem)
        except PortalNacionalHTTPError as exc:
            if exc.status_code == 404:
                return EmissaoResultado(
                    status="Rejeitada",
                    mensagem_erro="NFS-e nao encontrada no Portal (404).",
                )
            return EmissaoResultado(
                status="Rejeitada",
                mensagem_erro=f"Portal {exc.status_code}: {exc.body[:300]}",
            )
        except Exception as exc:
            return EmissaoResultado(
                status="Rejeitada", mensagem_erro=f"Erro de rede: {exc!s}"
            )

        # Resposta e XML em GZip+Base64 OU JSON com metadados — tolerar.
        try:
            body = resp.json()
            status = body.get("status") or "Autorizada"
            return EmissaoResultado(status=status, gateway_id=gateway_id)
        except (ValueError, json.JSONDecodeError):
            # Era XML mesmo — sucesso (significa nota autorizada).
            return EmissaoResultado(status="Autorizada", gateway_id=gateway_id)

    # ===================== Cancelamento =====================

    def cancelar(self, gateway_id: str, motivo: str) -> EmissaoResultado:
        if not self.config or not getattr(self.config, "tem_certificado", False):
            return EmissaoResultado(
                status="Rejeitada", mensagem_erro="Sem certificado para cancelar."
            )
        if not motivo or len(motivo.strip()) < 15:
            return EmissaoResultado(
                status="Rejeitada",
                mensagem_erro="Motivo do cancelamento precisa ter ao menos 15 caracteres.",
            )
        try:
            key_pem, cert_pem = self._carregar_cert_pem()
        except Exception as exc:
            return EmissaoResultado(
                status="Rejeitada", mensagem_erro=f"Falha ao carregar cert: {exc!s}"
            )

        url = f"{resolver_base_url(self.config)}/nfse/{gateway_id}/eventos"
        try:
            resp = request_com_mtls(
                "POST",
                url,
                cert_pem=cert_pem,
                key_pem=key_pem,
                json_body={
                    "tipoEvento": "cancelamento",
                    "motivo": motivo.strip()[:300],
                },
            )
        except PortalNacionalHTTPError as exc:
            return EmissaoResultado(
                status="Rejeitada",
                mensagem_erro=f"Portal {exc.status_code}: {exc.body[:300]}",
            )
        except Exception as exc:
            return EmissaoResultado(
                status="Rejeitada", mensagem_erro=f"Erro de rede: {exc!s}"
            )

        if 200 <= resp.status_code < 300:
            return EmissaoResultado(status="Cancelada", gateway_id=gateway_id)
        return EmissaoResultado(
            status="Rejeitada",
            mensagem_erro=f"Cancelamento rejeitado: status {resp.status_code}",
        )
