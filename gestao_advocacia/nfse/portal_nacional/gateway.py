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
from .dps_builder import (
    comprimir_e_codificar,
    decodificar_e_descomprimir,
    extrair_dados_nfse,
    gerar_id_dps,
    montar_dps_xml,
)
from .http_client import (
    PortalNacionalHTTPError,
    request_com_mtls,
    resolver_base_url,
)
from .signer import assinar_dps, carregar_pfx, descriptografar


# Chave de acesso da NFS-e tem **50 posicoes** segundo o Swagger oficial.
CHAVE_ACESSO_LENGTH = 50


def _formatar_mensagens(mensagens: list) -> str:
    """Formata lista de MensagemProcessamento ({codigo, descricao, complemento})
    do Swagger oficial em string legivel."""
    if not mensagens:
        return ""
    partes = []
    for m in mensagens[:5]:
        if not isinstance(m, dict):
            partes.append(str(m))
            continue
        codigo = m.get("codigo") or ""
        desc = m.get("descricao") or m.get("mensagem") or ""
        comp = m.get("complemento") or ""
        formatado = f"[{codigo}] {desc}" if codigo else desc
        if comp:
            formatado += f" ({comp})"
        partes.append(formatado.strip())
    return " | ".join(p for p in partes if p)


def _danfse_url(chave: str, ambiente: str) -> str:
    """URL do PDF/DANFSe no ADN (servico separado do SEFIN).

    Baseado em https://adn.{producaorestrita}?.nfse.gov.br/danfse/...
    Formato exato pode variar; chave eh o suficiente pra o usuario
    consultar via portal web caso o link nao funcione direto.
    """
    sub = "producaorestrita." if ambiente != "producao" else ""
    return f"https://adn.{sub}nfse.gov.br/danfse/{chave}"

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

        # 5. Parsear resposta. Schema oficial do Swagger:
        # Sucesso (201): NFSePostResponseSucesso = {
        #   tipoAmbiente, versaoAplicativo, dataHoraProcessamento,
        #   idDps, chaveAcesso, nfseXmlGZipB64, alertas[]
        # }
        # Erro (400/403/500): NFSePostResponseErro = {
        #   tipoAmbiente, versaoAplicativo, dataHoraProcessamento,
        #   idDPS, erros[] (MensagemProcessamento)
        # }
        try:
            body = resp.json()
        except (ValueError, json.JSONDecodeError):
            return EmissaoResultado(
                status="Rejeitada",
                mensagem_erro="Portal retornou resposta nao-JSON.",
            )

        chave = body.get("chaveAcesso")
        if chave:
            # Sucesso. Descompactar nfseXmlGZipB64 e extrair numero/
            # serie/codverif do XML autorizado (Swagger nao publica
            # esses campos no JSON da resposta).
            self.config.nfse_numero_atual = numero
            nfse_xml_b64 = body.get("nfseXmlGZipB64") or ""
            dados_extras = {}
            if nfse_xml_b64:
                try:
                    nfse_xml = decodificar_e_descomprimir(nfse_xml_b64)
                    dados_extras = extrair_dados_nfse(nfse_xml)
                except Exception as exc:
                    logger.warning("Falha ao descompactar NFS-e retornada: %s", exc)

            alertas = body.get("alertas") or []
            mensagem_alerta = _formatar_mensagens(alertas) if alertas else None

            return EmissaoResultado(
                status="Autorizada",
                gateway_id=str(chave),
                numero_nfse=dados_extras.get("numero_nfse"),
                serie=dados_extras.get("serie") or str(serie),
                codigo_verificacao=dados_extras.get("codigo_verificacao"),
                # XML inline (nao e URL). UI pode armazenar e regerar
                # se quiser, mas linkamos pro DANFSe que e o PDF.
                xml_url=None,
                pdf_url=_danfse_url(str(chave), self.config.ambiente or "sandbox"),
                # Alertas nao impedem autorizacao, mas viajam pro caller
                # via mensagem_erro pra ficarem visiveis (UI decide se
                # exibe como warning).
                mensagem_erro=mensagem_alerta,
            )

        # Resposta de erro estruturada
        erros = body.get("erros") or []
        if erros:
            return EmissaoResultado(
                status="Rejeitada",
                mensagem_erro=_formatar_mensagens(erros)[:1000],
            )

        return EmissaoResultado(
            status="Rejeitada",
            mensagem_erro=f"Resposta do Portal inesperada: {str(body)[:300]}",
        )

    # ===================== Consulta =====================

    def _validar_chave_acesso(self, chave: str) -> str | None:
        """Swagger: 'A chave de acesso consultada deve conter 50 numeros'."""
        if not chave:
            return "Chave de acesso vazia."
        digitos = "".join(c for c in chave if c.isdigit())
        if len(digitos) != CHAVE_ACESSO_LENGTH:
            return (
                f"Chave de acesso deve ter {CHAVE_ACESSO_LENGTH} digitos "
                f"(recebido: {len(digitos)})."
            )
        return None

    def consultar_status(self, gateway_id: str) -> EmissaoResultado:
        if not self.config or not getattr(self.config, "tem_certificado", False):
            return EmissaoResultado(
                status="Rejeitada", mensagem_erro="Sem certificado para consultar."
            )
        # Valida formato da chave antes de bater no portal
        erro_chave = self._validar_chave_acesso(gateway_id)
        if erro_chave:
            return EmissaoResultado(status="Rejeitada", mensagem_erro=erro_chave)

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
            # Tenta extrair erros estruturados do body
            try:
                body = json.loads(exc.body)
                erro_struct = body.get("erro")
                if isinstance(erro_struct, dict):
                    msg = _formatar_mensagens([erro_struct])
                    if msg:
                        return EmissaoResultado(
                            status="Rejeitada",
                            mensagem_erro=f"Portal {exc.status_code}: {msg}",
                        )
            except (json.JSONDecodeError, AttributeError):
                pass
            return EmissaoResultado(
                status="Rejeitada",
                mensagem_erro=f"Portal {exc.status_code}: {exc.body[:300]}",
            )
        except Exception as exc:
            return EmissaoResultado(
                status="Rejeitada", mensagem_erro=f"Erro de rede: {exc!s}"
            )

        # Sucesso (200): NFSeGetResponseSucesso = {tipoAmbiente,
        # versaoAplicativo, dataHoraProcessamento, chaveAcesso,
        # nfseXmlGZipB64}. Se temos chaveAcesso, nota foi autorizada.
        try:
            body = resp.json()
            if body.get("chaveAcesso"):
                return EmissaoResultado(status="Autorizada", gateway_id=gateway_id)
            return EmissaoResultado(
                status="Rejeitada",
                mensagem_erro="Resposta sem chaveAcesso.",
            )
        except (ValueError, json.JSONDecodeError):
            return EmissaoResultado(status="Autorizada", gateway_id=gateway_id)

    # ===================== Idempotencia via DPS (Swagger HEAD/GET /dps/{id}) =====================

    def dps_ja_processada(self, id_dps: str) -> bool | None:
        """HEAD /dps/{id} — confirma se uma DPS ja foi recebida pelo Portal.

        Util pra idempotencia: antes de re-enviar uma DPS apos timeout,
        checar se o Portal ja a processou.

        Returns:
            True  — DPS encontrada (200)
            False — DPS nao encontrada (404)
            None  — erro de rede ou cert; nao foi possivel determinar
        """
        if not self.config or not getattr(self.config, "tem_certificado", False):
            return None
        try:
            key_pem, cert_pem = self._carregar_cert_pem()
        except Exception:
            return None
        url = f"{resolver_base_url(self.config)}/dps/{id_dps}"
        try:
            request_com_mtls("HEAD", url, cert_pem=cert_pem, key_pem=key_pem)
            return True
        except PortalNacionalHTTPError as exc:
            if exc.status_code == 404:
                return False
            return None
        except Exception:
            return None

    def consultar_dps(self, id_dps: str) -> EmissaoResultado:
        """GET /dps/{id} — devolve a chave de acesso da NFS-e gerada por
        uma DPS. Util pra recuperar dados quando o POST /nfse timeout
        mas a DPS ja foi processada.

        Schema da resposta: DpsGetResponse = {tipoAmbiente,
        versaoAplicativo, dataHoraProcessamento, idDps, chaveAcesso}.
        """
        if not self.config or not getattr(self.config, "tem_certificado", False):
            return EmissaoResultado(
                status="Rejeitada", mensagem_erro="Sem certificado para consultar DPS."
            )
        try:
            key_pem, cert_pem = self._carregar_cert_pem()
        except Exception as exc:
            return EmissaoResultado(
                status="Rejeitada", mensagem_erro=f"Falha ao carregar cert: {exc!s}"
            )
        url = f"{resolver_base_url(self.config)}/dps/{id_dps}"
        try:
            resp = request_com_mtls("GET", url, cert_pem=cert_pem, key_pem=key_pem)
        except PortalNacionalHTTPError as exc:
            if exc.status_code == 404:
                return EmissaoResultado(
                    status="Rejeitada",
                    mensagem_erro="DPS nao encontrada no Portal (404). "
                    "Provavelmente nao foi enviada ainda.",
                )
            return EmissaoResultado(
                status="Rejeitada",
                mensagem_erro=f"Portal {exc.status_code}: {exc.body[:300]}",
            )
        except Exception as exc:
            return EmissaoResultado(
                status="Rejeitada", mensagem_erro=f"Erro de rede: {exc!s}"
            )

        try:
            body = resp.json()
        except (ValueError, json.JSONDecodeError):
            return EmissaoResultado(
                status="Rejeitada", mensagem_erro="Resposta nao-JSON do Portal."
            )
        chave = body.get("chaveAcesso")
        if chave:
            return EmissaoResultado(
                status="Autorizada",
                gateway_id=str(chave),
                pdf_url=_danfse_url(str(chave), self.config.ambiente or "sandbox"),
            )
        return EmissaoResultado(
            status="Rejeitada",
            mensagem_erro="Resposta sem chaveAcesso.",
        )

    # ===================== Cancelamento =====================

    def cancelar(self, gateway_id: str, motivo: str) -> EmissaoResultado:
        if not self.config or not getattr(self.config, "tem_certificado", False):
            return EmissaoResultado(
                status="Rejeitada", mensagem_erro="Sem certificado para cancelar."
            )
        erro_chave = self._validar_chave_acesso(gateway_id)
        if erro_chave:
            return EmissaoResultado(status="Rejeitada", mensagem_erro=erro_chave)
        if not motivo or len(motivo.strip()) < 15:
            return EmissaoResultado(
                status="Rejeitada",
                mensagem_erro="Motivo do cancelamento precisa ter ao menos 15 caracteres.",
            )
        # NOTA 5.6.6.2 (pendente): o Swagger oficial exige body
        # `pedidoRegistroEventoXmlGZipB64` (XML de evento assinado),
        # nao o JSON {tipoEvento, motivo} que usamos abaixo. Quando o
        # event_builder for implementado, trocar o body aqui.
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
