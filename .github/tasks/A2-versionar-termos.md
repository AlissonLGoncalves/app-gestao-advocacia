# [A2] Versionar Termos e LGPD em arquivos markdown hasheados

> ⚠️ **ANTES DE COMEÇAR — leia `.github/tasks/README.md` e `ROADMAP-2026-Q2.md`.**
> 🚫 **NÃO use `Co-Authored-By`** em commits.

**Prioridade:** 🔴 Crítica (compliance)
**Track:** A — Compliance
**Depende de:** A1
**Bloqueia:** D2
**Estimativa:** 3-4 horas

## Problema

Hoje o texto dos Termos está **inline** em `RegisterPage.jsx` (seções 1 a 6, ~150 linhas JSX). Não há versionamento, não há hash, não há fonte única — quando mudar o texto, é impossível saber qual versão cada usuário aceitou.

## Tarefas

### 1. Mover textos para arquivos markdown

Criar:
- `gestao_advocacia_vite/src/legal/termos-v1.0.md`
- `gestao_advocacia_vite/src/legal/lgpd-v1.0.md`

Com cabeçalho YAML:
```yaml
---
versao: v1.0
data_vigencia: 2026-04-18
---
```

Conteúdo: extrair das seções atuais do modal em `RegisterPage.jsx`. LGPD pode expandir a seção 4 atual dos Termos em documento próprio.

### 2. Copiar para o backend

Criar `gestao_advocacia/legal/termos-v1.0.md` e `lgpd-v1.0.md` (mesmo conteúdo, lido pelo servidor).

### 3. Endpoint `GET /auth/termos-vigentes` (público)

Retorna JSON:
```json
{
  "termos": {
    "versao": "v1.0",
    "data_vigencia": "2026-04-18",
    "hash": "sha256:...",
    "conteudo": "markdown completo"
  },
  "lgpd": { ... }
}
```

Hash calculado on-the-fly (`hashlib.sha256`) do conteúdo do arquivo. Service em `gestao_advocacia/services/legal_service.py` com cache em memória.

### 4. Frontend

- Adicionar dependência `react-markdown`.
- `RegisterPage.jsx`: buscar `/auth/termos-vigentes` no mount. Renderizar no modal via `<ReactMarkdown>`.
- Mostrar versão no rodapé do modal: `"Termos v1.0 (vigente desde 2026-04-18) — SHA256: abc123..."`.
- Remover texto hardcoded.

### 5. Integração com A1

`TERMS_VERSION` e `LGPD_VERSION` de `src/constants/legal.js` passam a ser lidos do backend (não mais hardcoded). Payload de `/auth/register` já funciona — só muda a fonte.

## Testes

- Backend: `/auth/termos-vigentes` retorna hash estável entre chamadas.
- Frontend: markdown renderiza, versão aparece no rodapé.

## Critérios de aceite

- [ ] 4 arquivos markdown criados (frontend + backend, termos + lgpd)
- [ ] `GET /auth/termos-vigentes` retorna estrutura correta com hash
- [ ] Texto hardcoded removido de `RegisterPage.jsx`
- [ ] Modal renderiza markdown com versão no rodapé
- [ ] CI verde

## Branch e PR

- Branch: `feat/a2-versionar-termos`
- Título PR: `[A2] Versionamento de Termos e LGPD em arquivos markdown hasheados`
