# Schemas XSD oficiais do Portal Nacional NFS-e

Versão **1.01** (publicada em 2026-02-09).

Baixados de: <https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual/nfse-esquemas_xsd-v1-01-20260209.zip>

## Arquivos

| Schema | Uso no código |
|---|---|
| `DPS_v1.01.xsd` | Declaração Prévia de Serviço — `dps_builder.py` |
| `NFSe_v1.01.xsd` | NFS-e autorizada — `extrair_dados_nfse()` (apenas leitura) |
| `pedRegEvento_v1.01.xsd` | Pedido de Registro de Evento — `event_builder.py` |
| `evento_v1.01.xsd` | Evento gerado pelo Portal — leitura na resposta |
| `tiposEventos_v1.01.xsd` | Tipos complexos dos eventos (e101101, e105102, etc) |
| `tiposComplexos_v1.01.xsd` | Tipos complexos reutilizados (endereços, valores) |
| `tiposSimples_v1.01.xsd` | Tipos simples (Id, chave, motivo, datas) |
| `CNC_v1.00.xsd` + `tiposCnc_v1.00.xsd` | Comunicação Nacional de Conformidade (não usado pelo contribuinte) |
| `xmldsig-core-schema.xsd` | W3C XMLDSIG — assinatura |

## Quando rotacionar

Quando o gov.br publicar nova versão, baixar novo ZIP, substituir os
arquivos aqui e ajustar `targetNamespace` se mudar de `1.01` pra `1.02+`.
Atualizar também as constantes de versão em `event_builder.py` e
`dps_builder.py`.
