# Roadmap 2026 Q2 — Compliance, Cadastro Completo e Automação de Procuração

> **Status:** planejamento aberto em 2026-04-18 a partir da conversa com o dono do produto.
> **Contexto:** após v1.2.0 (ciclo C1-C4, N1-N5, T1-T5 concluído), três frentes foram identificadas como prioritárias para permitir operação com clientes reais.

## Por que este roadmap existe

Durante a validação do cadastro e do fluxo de onboarding foi identificado que:

1. O aceite dos Termos de Uso e da política LGPD **não é persistido** no banco — a rota `POST /auth/register` apenas cria o `User` e o `Tenant`, sem registro da aceitação, da versão do texto, do IP ou do user-agent. Isso é risco legal concreto.
2. O frontend envia campos (`oab`, `tipo_pessoa`) que o backend **descarta silenciosamente**, e o modelo `User` não tem `nome_completo` nem `cpf` — nome vira `username` (também usado como login).
3. Para automatizar o cadastro de clientes a partir do upload de uma procuração (objetivo do ciclo), é necessário saber quem é o advogado logado (nome + OAB) para o LLM distinguir outorgante de outorgado.

Este roadmap agrupa as tarefas em 4 tracks, priorizados para destravar cada dependência em sequência.

## Visão geral dos tracks

| Track | Objetivo | Bloqueia |
|-------|----------|----------|
| 🅰️ **A — Compliance LGPD** | Persistir consentimento, versionar Termos, auditar login | Operação com qualquer cliente real |
| 🅱️ **B — Cadastro completo do advogado** | `nome_completo`, `cpf`, salvar OAB que já vem do frontend | Track C |
| 🆎 **C — Automação de procuração** | Upload de PDF/DOCX/escaneada → extração LLM → pré-preenchimento do cadastro de cliente | — |
| 🆓 **D — Qualidade de vida** | Reset de senha, re-aceite de termos, direito ao esquecimento | — |

## Ordem de execução recomendada

```
A1 → A2 → B1 → A3 → (C0 manual) → C1 → C2 → C3 → D1 → D2 → D3
```

Justificativa:
- **A1/A2 primeiro**: sem persistência de consentimento + versionamento, qualquer novo cadastro entra com risco LGPD.
- **B1 antes de C**: procuração precisa do `nome_completo` e OAB do user logado.
- **A3 entra antes de C** para fechar a fundação de auditoria.
- **C**: a feature de negócio pedida (automatizar cadastro via procuração).
- **D**: polimento; faz sentido depois que o fluxo core está fechado.

## Tarefas

### 🅰️ Track A — Compliance LGPD

- [A1 — Persistir aceite de Termos/LGPD](A1-consentimento-lgpd.md)
- [A2 — Versionar Termos em arquivos markdown hasheados](A2-versionar-termos.md)
- [A3 — Auditoria persistente de login](A3-login-audit.md)

### 🅱️ Track B — Cadastro completo

- [B1 — Completar schema do User (nome_completo, CPF) + tela de perfil](B1-user-completo.md)

### 🆎 Track C — Automação de procuração

- [C0 — Preparar API key do Gemini (manual)](C0-gemini-api-key.md)
- [C1 — Backend: endpoint de extração de procuração](C1-backend-extrator-procuracao.md)
- [C2 — Frontend: upload + pré-preenchimento](C2-frontend-upload-procuracao.md)
- [C3 — Integração com modal DJEN (F2)](C3-integracao-djen-procuracao.md)

### 🆓 Track D — Qualidade de vida

- [D1 — Reset de senha por email](D1-reset-senha.md)
- [D2 — Re-aceite quando Termos mudarem](D2-reaceite-termos.md)
- [D3 — Direito ao esquecimento (LGPD art. 18)](D3-direito-esquecimento.md)

## Decisões técnicas fechadas

- **LLM para procuração**: Google Gemini 2.0 Flash (tier gratuito via AI Studio). Multimodal nativo — aceita PDF digital, PDF escaneado e imagem sem precisar de Tesseract ou pdfplumber.
- **DOCX**: converter para texto com `python-docx` antes de passar ao LLM.
- **Versionamento de Termos**: arquivos `.md` em `gestao_advocacia_vite/src/legal/` com cabeçalho YAML (`versao`, `data_vigencia`), hash SHA-256 calculado on-the-fly.
- **Identificação do advogado no prompt de procuração**: `User.nome_completo` + `User.numero_oab` + `User.sigla_oab_tribunal` são enviados ao LLM para distinguir outorgado (advogado) de outorgante (cliente).

## Regras herdadas do `.github/tasks/README.md`

Todas as regras do README de tarefas permanecem válidas:

1. **Uma tarefa por PR** — não misturar.
2. **Commits sem `Co-Authored-By`** — quebra o Vercel Hobby.
3. **Branch por tarefa**: `feat/<id>-<slug>` (ex.: `feat/a1-consentimento-lgpd`).
4. **Antes do push**: rodar style + testes (`ruff check . --fix && black . && pytest` no backend; `npm run lint && npx prettier --write . && npm test` no frontend).
5. **Título do PR**: `[<ID>] <título curto>`.
