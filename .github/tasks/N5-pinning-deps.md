# [N5] Pinning de dependências e auditoria

> ⚠️ **ANTES DE COMEÇAR — leia `.github/tasks/README.md`.**
> 🥇 **Regra de ouro:** TODAS as críticas (C1–C4) precisam estar MERGEADAS antes de começar tarefas normais.
> 🚫 **NÃO use `Co-Authored-By`** em commits — quebra o deploy no Vercel Hobby.

**Prioridade:** 🟡 Normal
**Depende de:** C2 (CI precisa existir para validar)
**Estimativa:** 1 dia

## Contexto

- `requirements.txt` não está 100% com versões exatas — risco de build não-reproduzível.
- Nenhuma auditoria automática de vulnerabilidades.

## Tarefas

### Backend

1. Instalar `pip-tools` e criar `gestao_advocacia/requirements.in` (abstrato, o que o app realmente importa).
2. Gerar `gestao_advocacia/requirements.txt` com `pip-compile --generate-hashes` (exato + hashes).
3. Adicionar `pip-audit` ao CI (job novo ou step no job backend).
4. Corrigir vulnerabilidades **alta/crítica** encontradas.

### Frontend

1. Rodar `npm audit` em `gestao_advocacia_vite/`.
2. Rodar `npm audit fix` para correções não-breaking.
3. Para breaking changes, listar no PR e pedir review humano antes de aplicar.
4. Adicionar `npm audit --audit-level=high` ao CI — falhar em high/critical.

### Dependabot

Criar `.github/dependabot.yml`:
- Ecossistemas: `pip` (gestao_advocacia/), `npm` (gestao_advocacia_vite/), `github-actions`.
- Frequência: weekly.
- Abertura de PRs agrupada por ecossistema.

## Critérios de aceite

- [ ] `requirements.txt` com versões exatas (==) e hashes.
- [ ] `requirements.in` abstrato.
- [ ] `pip-audit` passa (zero vulnerabilidades alta/crítica).
- [ ] `npm audit --audit-level=high` passa.
- [ ] `.github/dependabot.yml` configurado.
- [ ] CI roda as auditorias.

## Fora de escopo

- Atualizar major versions só por atualizar.
- Trocar bibliotecas.
