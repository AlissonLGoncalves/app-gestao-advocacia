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
    montar_dps_xml,
)
from .event_builder import (
    montar_pedido_cancelamento,
    montar_pedido_cancelamento_por_substituicao,
)
from .http_client import (
    PortalNacionalHTTPError,
    request_com_mtls,
    resolver_adn_url,
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


def _danfse_url(chave: str, config) -> str:
    """URL do PDF/DANFSe no ADN.

    Endpoint oficial confirmado pelo Swagger ADN DANFSe v1:
    `GET /danfse/{chaveAcesso}` (sem mTLS — publico, basta ter a chave).
    Resolve homologacao vs producao via resolver_adn_url.
    """
    return f"{resolver_adn_url(config)}/danfse/{chave}"


def _http_error_para_resultado(
    exc: PortalNacionalHTTPError, contexto: str = ""
) -> EmissaoResultado:
    """Converte PortalNacionalHTTPError em EmissaoResultado com mensagem
    adaptada ao codigo. Centraliza tratamento de 401/403/404."""
    prefixo = f"{contexto} " if contexto else ""
    # Tentar extrair MensagemProcessamento do body (Swagger oficial).
    erro_struct = None
    try:
        body = json.loads(exc.body)
        erro_struct = body.get("erro")
        if isinstance(erro_struct, dict):
            erro_struct = _formatar_mensagens([erro_struct])
    except (json.JSONDecodeError, AttributeError):
        pass

    if exc.status_code == 401:
        msg = (
            f"{prefixo}Nao autorizado pelo Portal. Pode ser certificado A1 "
            f"invalido/expirado, ou usuario sem permissao na NFS-e/evento. "
            f"Verifique a validade do cert em Settings."
        )
        if erro_struct:
            msg += f" Detalhe: {erro_struct}"
        return EmissaoResultado(status="Rejeitada", mensagem_erro=msg)
    if exc.status_code == 403:
        msg = (
            f"{prefixo}Acesso negado (403). Geralmente: certificado nao bate "
            f"com o CNPJ/CPF cadastrado no Portal, ou consulta nao permitida "
            f"pra este usuario."
        )
        if erro_struct:
            msg += f" Detalhe: {erro_struct}"
        return EmissaoResultado(status="Rejeitada", mensagem_erro=msg)
    if exc.status_code == 404:
        return EmissaoResultado(
            status="Rejeitada",
            mensagem_erro=f"{prefixo}Nao encontrado no Portal (404).",
        )
    if exc.status_code == 422:
        msg = f"{prefixo}Regra de negocio violada (422)."
        if erro_struct:
            msg += f" Detalhe: {erro_struct}"
        return EmissaoResultado(status="Rejeitada", mensagem_erro=msg)
    return EmissaoResultado(
        status="Rejeitada",
        mensagem_erro=f"{prefixo}Portal {exc.status_code}: {exc.body[:300]}",
    )

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
                pdf_url=_danfse_url(str(chave), self.config),
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
            return _http_error_para_resultado(exc, contexto="Consulta NFS-e:")
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
            return _http_error_para_resultado(exc, contexto="Consulta DPS:")
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
                pdf_url=_danfse_url(str(chave), self.config),
            )
        return EmissaoResultado(
            status="Rejeitada",
            mensagem_erro="Resposta sem chaveAcesso.",
        )

    # ===================== Eventos (Etapa 5.6.6.3) =====================

    def _proximo_n_ped_reg(self) -> int:
        """Numero sequencial do pedido de registro de evento (1-999).
        Caller eh responsavel por commit da config apos sucesso."""
        atual = self.config.nfse_num_evento_atual or 0
        return atual + 1

    def _enviar_evento(
        self, chave_acesso: str, xml_pedido: str, contexto: str
    ) -> EmissaoResultado:
        """Logica compartilhada de envio de evento: assina, comprime,
        POST com body correto. Retorna EmissaoResultado."""
        try:
            key_pem, cert_pem = self._carregar_cert_pem()
            xml_assinado = assinar_dps(xml_pedido, cert_pem=cert_pem, key_pem=key_pem)
        except Exception as exc:
            logger.exception("Falha ao assinar evento")
            return EmissaoResultado(
                status="Rejeitada",
                mensagem_erro=f"Falha ao assinar evento: {exc!s}",
            )

        pedido_b64 = comprimir_e_codificar(xml_assinado)
        url = f"{resolver_base_url(self.config)}/nfse/{chave_acesso}/eventos"

        try:
            resp = request_com_mtls(
                "POST",
                url,
                cert_pem=cert_pem,
                key_pem=key_pem,
                # Schema Swagger oficial: body == {pedidoRegistroEventoXmlGZipB64}.
                json_body={"pedidoRegistroEventoXmlGZipB64": pedido_b64},
            )
        except PortalNacionalHTTPError as exc:
            return _http_error_para_resultado(exc, contexto=contexto)
        except Exception as exc:
            return EmissaoResultado(
                status="Rejeitada", mensagem_erro=f"Erro de rede: {exc!s}"
            )

        # Sucesso (201): EventosPostResponseSucesso = {tipoAmbiente,
        # versaoAplicativo, dataHoraProcessamento, eventoXmlGZipB64}.
        if 200 <= resp.status_code < 300:
            # Incrementa contador apos sucesso (caller commit a config).
            self.config.nfse_num_evento_atual = self._proximo_n_ped_reg()
            return EmissaoResultado(status="Cancelada", gateway_id=chave_acesso)

        return EmissaoResultado(
            status="Rejeitada",
            mensagem_erro=f"{contexto} status inesperado {resp.status_code}",
        )

    def cancelar(
        self, gateway_id: str, motivo: str, *, cod_motivo: int = 9
    ) -> EmissaoResultado:
        """Evento e101101 — Cancelamento simples da NFS-e.

        Args:
            gateway_id: chave de acesso da NFS-e (50 digitos).
            motivo: descricao do motivo (>=15 chars).
            cod_motivo: 1=Erro emissao, 2=Servico nao prestado, 9=Outros.
                Default 9 pra compat com chamadas antigas que so passavam
                texto livre.
        """
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

        # Documento do autor = documento do emissor (advogado/escritorio).
        documento_autor = (
            getattr(self.config, "documento_emissor", None)
            or getattr(self.config, "cnpj_emissor", None)
        )
        if not documento_autor:
            return EmissaoResultado(
                status="Rejeitada",
                mensagem_erro="Documento do emissor nao configurado.",
            )

        try:
            xml_pedido = montar_pedido_cancelamento(
                chave_nfse=gateway_id,
                cod_motivo=cod_motivo,
                motivo_texto=motivo,
                documento_autor=documento_autor,
                ambiente=self.config.ambiente or "sandbox",
                n_ped_reg=self._proximo_n_ped_reg(),
            )
        except ValueError as exc:
            return EmissaoResultado(status="Rejeitada", mensagem_erro=str(exc))

        return self._enviar_evento(gateway_id, xml_pedido, contexto="Cancelamento:")

    def cancelar_por_substituicao(
        self,
        gateway_id: str,
        *,
        chave_substituta: str,
        cod_motivo: int,
        motivo_texto: str | None = None,
    ) -> EmissaoResultado:
        """Evento e105102 — Cancelamento por Substituicao.

        Usado quando a NFS-e antiga e substituida por uma nova ja emitida.
        Ambas continuam existindo: a antiga vira "cancelada por
        substituicao" e referencia a nova.

        Args:
            gateway_id: chave da NFS-e a cancelar (50 digitos).
            chave_substituta: chave da NFS-e nova que substitui (50 digitos).
            cod_motivo: TSCodJustSubst — 1-5 ou 99 (Outros).
            motivo_texto: opcional. Se enviado, min 15 chars.
        """
        if not self.config or not getattr(self.config, "tem_certificado", False):
            return EmissaoResultado(
                status="Rejeitada", mensagem_erro="Sem certificado."
            )
        erro_chave = self._validar_chave_acesso(gateway_id)
        if erro_chave:
            return EmissaoResultado(status="Rejeitada", mensagem_erro=erro_chave)
        erro_subst = self._validar_chave_acesso(chave_substituta)
        if erro_subst:
            return EmissaoResultado(
                status="Rejeitada",
                mensagem_erro=f"Chave substituta: {erro_subst}",
            )

        documento_autor = (
            getattr(self.config, "documento_emissor", None)
            or getattr(self.config, "cnpj_emissor", None)
        )
        if not documento_autor:
            return EmissaoResultado(
                status="Rejeitada",
                mensagem_erro="Documento do emissor nao configurado.",
            )

        try:
            xml_pedido = montar_pedido_cancelamento_por_substituicao(
                chave_nfse=gateway_id,
                chave_substituta=chave_substituta,
                cod_motivo=cod_motivo,
                motivo_texto=motivo_texto,
                documento_autor=documento_autor,
                ambiente=self.config.ambiente or "sandbox",
                n_ped_reg=self._proximo_n_ped_reg(),
            )
        except ValueError as exc:
            return EmissaoResultado(status="Rejeitada", mensagem_erro=str(exc))

        return self._enviar_evento(
            gateway_id, xml_pedido, contexto="Cancelamento por substituicao:"
        )

    # ===================== Decisao Judicial (Etapa 5.6.6.2) =====================

    def emitir_decisao_judicial(self, nfse_xml_assinado: str) -> EmissaoResultado:
        """Endpoint POST /decisao-judicial/nfse do Swagger oficial.

        Diferente de emitir() comum: o body NAO e DPS — e a propria NFSe
        ja em formato XML (assinada pelo emissor com cert ICP-Brasil),
        compactada GZip+Base64. Usado quando o advogado tem uma decisao
        judicial obrigando a emissao com caracteristicas especificas
        que nao passam pela DPS padrao.

        Args:
            nfse_xml_assinado: XML da NFSe ja montada e assinada com
                XMLDSIG. Sera comprimida GZip+Base64 antes do envio.

        Returns:
            EmissaoResultado com status Autorizada (chaveAcesso) ou
            Rejeitada (mensagem).
        """
        if not self.config or not getattr(self.config, "tem_certificado", False):
            return EmissaoResultado(
                status="Rejeitada",
                mensagem_erro="Sem certificado A1 carregado.",
            )
        if not getattr(self.config, "certificado_pfx_encrypted", None):
            return EmissaoResultado(
                status="Rejeitada",
                mensagem_erro="Certificado A1 nao encontrado no banco. Reenvie em Settings.",
            )
        if not nfse_xml_assinado or not nfse_xml_assinado.strip():
            return EmissaoResultado(
                status="Rejeitada", mensagem_erro="XML da NFS-e vazio."
            )

        try:
            key_pem, cert_pem = self._carregar_cert_pem()
        except Exception as exc:
            return EmissaoResultado(
                status="Rejeitada", mensagem_erro=f"Falha ao carregar cert: {exc!s}"
            )

        xml_b64 = comprimir_e_codificar(nfse_xml_assinado)
        url = f"{resolver_base_url(self.config)}/decisao-judicial/nfse"

        try:
            resp = request_com_mtls(
                "POST",
                url,
                cert_pem=cert_pem,
                key_pem=key_pem,
                # Schema Swagger: NFSeBypassPostRequest = {xmlGZipB64}
                # (note: nao e dpsXmlGZipB64 como o /nfse comum).
                json_body={"xmlGZipB64": xml_b64},
            )
        except PortalNacionalHTTPError as exc:
            return _http_error_para_resultado(exc, contexto="Decisao judicial:")
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
            nfse_xml_b64 = body.get("nfseXmlGZipB64") or ""
            dados = {}
            if nfse_xml_b64:
                try:
                    dados = extrair_dados_nfse(decodificar_e_descomprimir(nfse_xml_b64))
                except Exception as exc:
                    logger.warning("Falha ao parsear NFSe de decisao judicial: %s", exc)
            alertas = body.get("alertas") or []
            mensagem_alerta = _formatar_mensagens(alertas) if alertas else None
            return EmissaoResultado(
                status="Autorizada",
                gateway_id=str(chave),
                numero_nfse=dados.get("numero_nfse"),
                serie=dados.get("serie"),
                codigo_verificacao=dados.get("codigo_verificacao"),
                pdf_url=_danfse_url(str(chave), self.config),
                mensagem_erro=mensagem_alerta,
            )

        erros = body.get("erros") or []
        if erros:
            return EmissaoResultado(
                status="Rejeitada", mensagem_erro=_formatar_mensagens(erros)[:1000]
            )
        return EmissaoResultado(
            status="Rejeitada",
            mensagem_erro=f"Resposta do Portal inesperada: {str(body)[:300]}",
        )

    # ===================== Consultar evento por seq (Etapa 5.6.6.2) =====================

    # Tipos de evento validos segundo enum do Swagger oficial.
    # Mapeamento canonico ainda nao publicado pelo Portal — IDs sao
    # provavelmente: 101101/101103=cancelamento, 105102/4/5=substituicao,
    # outros=eventos administrativos. Ate ter o Anexo II oficial, deixar
    # como lista permissiva.
    TIPOS_EVENTO_VALIDOS = {
        101101,
        101103,
        105102,
        105104,
        105105,
        202201,
        202205,
        203202,
        203206,
        204203,
        204207,
        205204,
        205208,
        305101,
        305102,
        305103,
        467201,
        907201,
    }

    def consultar_evento(
        self, chave_acesso: str, tipo_evento: int, num_seq_evento: int
    ) -> EmissaoResultado:
        """GET /nfse/{chaveAcesso}/eventos/{tipoEvento}/{numSeqEvento}.

        Recupera um evento especifico ja registrado pra uma NFS-e.
        Util pra confirmar processamento de cancelamento, conferir
        carta de correcao etc.

        Args:
            chave_acesso: 50 digitos.
            tipo_evento: codigo do enum do Swagger.
            num_seq_evento: numero sequencial do evento dentro da chave.

        Returns:
            EmissaoResultado com status=Autorizada (sucesso, evento
            encontrado) ou Rejeitada (404 sem evento, 422 regra de
            negocio, 401 sem permissao).
        """
        if not self.config or not getattr(self.config, "tem_certificado", False):
            return EmissaoResultado(
                status="Rejeitada", mensagem_erro="Sem certificado para consultar."
            )
        erro_chave = self._validar_chave_acesso(chave_acesso)
        if erro_chave:
            return EmissaoResultado(status="Rejeitada", mensagem_erro=erro_chave)
        if tipo_evento not in self.TIPOS_EVENTO_VALIDOS:
            return EmissaoResultado(
                status="Rejeitada",
                mensagem_erro=(
                    f"tipo_evento={tipo_evento} fora do enum oficial. "
                    f"Valores aceitos: {sorted(self.TIPOS_EVENTO_VALIDOS)}"
                ),
            )
        if not isinstance(num_seq_evento, int) or num_seq_evento < 1:
            return EmissaoResultado(
                status="Rejeitada",
                mensagem_erro="num_seq_evento deve ser inteiro >= 1.",
            )

        try:
            key_pem, cert_pem = self._carregar_cert_pem()
        except Exception as exc:
            return EmissaoResultado(
                status="Rejeitada", mensagem_erro=f"Falha ao carregar cert: {exc!s}"
            )

        url = (
            f"{resolver_base_url(self.config)}/nfse/{chave_acesso}"
            f"/eventos/{tipo_evento}/{num_seq_evento}"
        )
        try:
            resp = request_com_mtls("GET", url, cert_pem=cert_pem, key_pem=key_pem)
        except PortalNacionalHTTPError as exc:
            return _http_error_para_resultado(exc, contexto="Consulta evento:")
        except Exception as exc:
            return EmissaoResultado(
                status="Rejeitada", mensagem_erro=f"Erro de rede: {exc!s}"
            )

        # Schema oficial: EventosPostResponseSucesso = {tipoAmbiente,
        # versaoAplicativo, dataHoraProcessamento, eventoXmlGZipB64}.
        # Presenca de eventoXmlGZipB64 == sucesso.
        try:
            body = resp.json()
        except (ValueError, json.JSONDecodeError):
            return EmissaoResultado(
                status="Rejeitada", mensagem_erro="Resposta nao-JSON do Portal."
            )
        if body.get("eventoXmlGZipB64"):
            return EmissaoResultado(status="Autorizada", gateway_id=chave_acesso)
        return EmissaoResultado(
            status="Rejeitada", mensagem_erro="Resposta sem eventoXmlGZipB64."
        )
