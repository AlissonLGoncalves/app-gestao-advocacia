---
fonte: https://www.cnj.jus.br/sistemas/datajud/modelo-de-transferencia-de-dados/
versao: "1.2"
base_normativa: "Resolução CNJ nº 331/2020, art. 4º"
base_tecnica: "Modelo Nacional de Interoperabilidade (MNI) v2.2.2"
orgao: "Departamento de Pesquisas Judiciárias — DPJ / CNJ"
schema_local: "docs/compliance/schemas/cnj-mtd-v1.2.xsd"
arquivado_em: "2026-04-18"
---

# Modelo de Transferência de Dados (MTD) — CNJ v1.2

Documento arquivado como artefato de compliance e referência técnica. O MTD define o formato XML que os tribunais usam para enviar dados processuais ao CNJ; é a base do **DATAJUD** (cujo Termo de Uso está em [`datajud-termo-uso-v1.2.md`](datajud-termo-uso-v1.2.md)).

## Por que arquivar no repo

O Patronus consome metadados processuais via API do DATAJUD (endpoint `api_publica_<tribunal>`). A estrutura dos campos retornados deriva diretamente do MTD — conhecer o schema é essencial para:

1. **Parsing correto** em `cnj_service.py` e `djen_service.py` (ex: `numeroBoletimOcorrencia`, `racaCor`, `prioridade`)
2. **Validação de dados** antes de persistir em `PublicacaoDJEN`, `Caso`, `Cliente`
3. **Entender quais campos realmente existem** antes de pedir features impossíveis (se não está no MTD, o CNJ não retorna)

## Novidades v1.2 (vs v1.1)

### Cabeçalho processual

| Campo | Tipo | Uso no Patronus |
|-------|------|-----------------|
| `numeroBoletimOcorrencia` | string | Útil para vincular caso criminal ao BO de origem |
| `numeroInqueritoPolicial` | string | Idem, para inquéritos |

### Parte/Pessoa

| Campo | Valores possíveis | Uso no Patronus |
|-------|-------------------|-----------------|
| `parte.prioridade` (multivalorado) | Objeto `cnj:prioridadeProcessoParte` com `tipo`, `dataConcessao`, `dataFim` | Identificar processos com prioridade (idoso, doença grave). Recomendação CNJ: preencher `dataConcessao` quando `tipoPrioridade=ID` (idoso). |
| `racaCor` | `BC` Branco(a), `PD` Pardo(a), `PR` Preto(a), `IN` Indígena, `AM` Amarelo(a), `QL` Quilombola, `ND` Não declarado | Dado sensível (LGPD art. 5º II) — tratar com base legal específica; exibir apenas se necessário para o processo |

## Cuidados LGPD ao consumir MTD

O MTD traz **dados pessoais e sensíveis** (nome, CPF, raça/cor, prioridade por saúde). A cláusula 4.2 do [Termo de Uso do DATAJUD](datajud-termo-uso-v1.2.md) proíbe coleta/processamento além do permitido pela LGPD.

Regras que o código deve respeitar:
- **Raça/cor** (`racaCor`): armazenar apenas se houver necessidade operacional clara; nunca expor em relatórios agregados sem consentimento
- **Prioridade processual**: o `tipoPrioridade` pode revelar estado de saúde — dado sensível, tratar como confidencial
- **Boletim de Ocorrência / Inquérito**: expõe envolvimento em investigação — restringir visibilidade ao advogado do caso, não ao tenant inteiro

## Arquivo XSD

O schema completo está em [`schemas/cnj-mtd-v1.2.xsd`](schemas/cnj-mtd-v1.2.xsd) (2.653 linhas, ~90 KB).

Namespace: `http://www.cnj.jus.br/modelo-de-transferencia-de-dados-1.2`

Tipos principais definidos no XSD (relevantes para o Patronus):
- `cnj:tipoProcessoJudicial` — raiz de um processo
- `cnj:tipoCabecalhoProcesso` — metadados do processo
- `cnj:tipoParte` / `cnj:tipoPessoa` — partes e pessoas envolvidas
- `cnj:tipoMovimentoProcessual` — movimentações (base dos nossos alertas DJEN)
- `cnj:prioridadeProcessoParte` — prioridades processuais (novo em 1.2)
- `cnj:tipoCadastroIdentificador` — CPF/CNPJ/RIC com validação de dígitos

## Relação com outras frentes do projeto

- **Track A (compliance LGPD)**: os Termos do Patronus (task A2) devem mencionar que consumimos dados MTD do DATAJUD e declarar base legal
- **Track C (procuração)**: o parser de procuração extrai CPF/CNPJ — alinhar formato com `tipoCadastroIdentificador` do MTD (11 ou 14 dígitos, só números)
- **Futuro**: se o Patronus for enviar dados ao CNJ (cenário hoje inexistente mas possível), o XSD é a fonte de verdade para validação local antes do upload
