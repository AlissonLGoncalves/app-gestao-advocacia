"""PortalNacionalGateway — adapter pro Portal Nacional NFS-e (gov.br).

Sub-etapa 5.6.1 (esta): esqueleto. Monta DPS XML e GZip+Base64, mas
NAO assina XMLDSIG nem faz HTTP real. Toda chamada `emitir()` retorna
Rejeitada explicando o que falta.

Sub-etapa 5.6.2: assinatura XMLDSIG + storage do certificado A1.
Sub-etapa 5.6.3: chamada HTTP mTLS real.

Por que devolver Rejeitada em vez de NotImplementedError? Porque o
service ja persiste EmissaoNFSe e queremos que a UI mostre uma
mensagem clara em vez de propagar exception 500.
"""

from __future__ import annotations

from ..gateway import EmissaoPayload, EmissaoResultado, NFSeGatewayBase
from .dps_builder import comprimir_e_codificar, montar_dps_xml


class PortalNacionalGateway(NFSeGatewayBase):
    tipo = "portal_nacional"

    def __init__(self, config=None):
        # config = ConfigNFSe (passada pelo factory). Mantida pra acessar
        # serie/numero e URLs base nas sub-etapas seguintes.
        self.config = config

    def _pre_validar(self, payload: EmissaoPayload) -> str | None:
        """Devolve None se ok, ou string com erro pra usuario."""
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
                "Adapter Portal Nacional ainda nao esta pronto: falta o "
                "certificado A1 e a implementacao de XMLDSIG (sub-etapa "
                "5.6.2). Por enquanto, use o gateway 'mock' para testes."
            )
        return None

    def emitir(self, payload: EmissaoPayload) -> EmissaoResultado:
        erro = self._pre_validar(payload)
        if erro:
            return EmissaoResultado(status="Rejeitada", mensagem_erro=erro)

        # Mesmo sem cert, ja monta DPS e GZip+Base64 — exercita o
        # codigo de builder pra os tests pegarem regressao se mexer
        # depois.
        serie = self.config.nfse_serie_atual or 1
        numero = (self.config.nfse_numero_atual or 0) + 1
        xml = montar_dps_xml(payload, self.config, serie=serie, numero=numero)
        # Apenas pra exercitar (resultado descartado por enquanto)
        _ = comprimir_e_codificar(xml)

        return EmissaoResultado(
            status="Rejeitada",
            mensagem_erro=(
                "DPS montada com sucesso, mas sub-etapas 5.6.2 (XMLDSIG) "
                "e 5.6.3 (HTTP mTLS) ainda nao implementadas. Veja "
                "issue #239 no GitHub para acompanhar."
            ),
        )

    def consultar_status(self, gateway_id: str) -> EmissaoResultado:
        return EmissaoResultado(
            status="Rejeitada",
            mensagem_erro="Consulta de status pendente (sub-etapa 5.6.3).",
        )

    def cancelar(self, gateway_id: str, motivo: str) -> EmissaoResultado:
        return EmissaoResultado(
            status="Rejeitada",
            mensagem_erro="Cancelamento pendente (sub-etapa 5.6.3).",
        )
