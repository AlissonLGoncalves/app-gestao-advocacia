"""Adapters de gateway de NFS-e.

A interface abstrata `NFSeGatewayBase` define o que o resto da aplicacao
espera de qualquer gateway: emitir uma nota a partir de um payload
normalizado e retornar um resultado tambem normalizado.

Implementacoes:
- `MockGateway` — autoriza automaticamente. Usado em testes e enquanto o
  tenant ainda nao configurou um gateway real. Nao chama nada externo.
- (futuro) `PortalNacionalGateway` — adapter real contra o webservice
  do Portal Nacional NFS-e (gov.br). Sera implementado em PR separado
  quando houver certificado A1 do tenant e conta de homologacao.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class EmissaoPayload:
    """Dados normalizados de uma emissao, montados pelo NFSeService a partir
    do Recebimento + ConfigNFSe. Cada adapter traduz pra sua linguagem."""

    recebimento_id: int
    descricao_servico: str
    valor: float
    cnpj_emissor: str | None
    inscricao_municipal: str | None
    razao_social: str | None
    municipio: str | None
    uf: str | None
    codigo_servico: str | None
    regime_tributario: str | None
    aliquota_iss: float | None
    ambiente: str
    # Tomador (cliente do advogado). Opcional pq Recebimento pode nao ter cliente.
    tomador_nome: str | None = None
    tomador_documento: str | None = None
    extras: dict[str, Any] = field(default_factory=dict)


@dataclass
class EmissaoResultado:
    """Resultado normalizado pos-chamada do gateway.

    `status` segue o vocabulario do model EmissaoNFSe:
    "EmProcessamento" | "Autorizada" | "Rejeitada".
    Gateway real costuma retornar EmProcessamento (async) e depois manda
    webhook com o status final; mock retorna Autorizada direto.
    """

    status: str
    gateway_id: str | None = None
    numero_nfse: str | None = None
    serie: str | None = None
    codigo_verificacao: str | None = None
    xml_url: str | None = None
    pdf_url: str | None = None
    mensagem_erro: str | None = None


class NFSeGatewayBase:
    """Interface comum a todos os adapters. Cada gateway implementa."""

    tipo: str = "abstract"

    def emitir(self, payload: EmissaoPayload) -> EmissaoResultado:
        raise NotImplementedError

    def consultar_status(self, gateway_id: str) -> EmissaoResultado:
        """Re-checa o status no gateway. Util quando o gateway eh async e
        nao mandou webhook ainda."""
        raise NotImplementedError

    def cancelar(self, gateway_id: str, motivo: str) -> EmissaoResultado:
        """Cancela uma nota ja autorizada. Pode falhar se a janela de
        cancelamento (geralmente 24h) ja expirou."""
        raise NotImplementedError


class MockGateway(NFSeGatewayBase):
    """Gateway falso pra desenvolvimento e testes.

    Autoriza tudo automaticamente, gera numeros falsos e URLs ficticias.
    NAO emite nota de verdade — nada chega na Receita ou prefeitura.
    O tenant precisa configurar um gateway real (em PR futuro) pra
    emitir notas validas.
    """

    tipo = "mock"

    def emitir(self, payload: EmissaoPayload) -> EmissaoResultado:
        # Valida o minimo. Se faltar dado de emissor, rejeita pra simular
        # como gateway real reagiria.
        if not payload.cnpj_emissor or not payload.codigo_servico:
            return EmissaoResultado(
                status="Rejeitada",
                mensagem_erro=(
                    "Mock: CNPJ do emissor e codigo de servico sao obrigatorios. "
                    "Configure em Settings antes de emitir."
                ),
            )
        if payload.valor <= 0:
            return EmissaoResultado(
                status="Rejeitada",
                mensagem_erro="Mock: valor do servico deve ser positivo.",
            )

        gid = f"mock-{uuid.uuid4().hex[:12]}"
        numero = f"MOCK{int(datetime.utcnow().timestamp())}"
        return EmissaoResultado(
            status="Autorizada",
            gateway_id=gid,
            numero_nfse=numero,
            serie="MOCK",
            codigo_verificacao=uuid.uuid4().hex[:8].upper(),
            xml_url=f"https://mock.nfse.local/{gid}.xml",
            pdf_url=f"https://mock.nfse.local/{gid}.pdf",
        )

    def consultar_status(self, gateway_id: str) -> EmissaoResultado:
        # Mock sempre considera Autorizada se o id existe (formato mock-*).
        if not gateway_id or not gateway_id.startswith("mock-"):
            return EmissaoResultado(status="Rejeitada", mensagem_erro="Mock: ID invalido.")
        return EmissaoResultado(status="Autorizada", gateway_id=gateway_id)

    def cancelar(self, gateway_id: str, motivo: str) -> EmissaoResultado:
        return EmissaoResultado(status="Cancelada", gateway_id=gateway_id)


def get_gateway(tipo: str, config=None) -> NFSeGatewayBase:
    """Factory dos adapters de NFS-e.

    Args:
        tipo: valor de ConfigNFSe.gateway_tipo
        config: ConfigNFSe do tenant (alguns adapters precisam).
    """
    if tipo == "portal_nacional":
        # Import tardio pra evitar circular (portal_nacional importa daqui).
        from .portal_nacional.gateway import PortalNacionalGateway

        return PortalNacionalGateway(config=config)
    if tipo == "mock":
        return MockGateway()
    # Tipos nao implementados ainda (focus_nfe, plugnotas) caem no mock
    # pra nao quebrar o app. Trocar quando os adapters chegarem.
    return MockGateway()
