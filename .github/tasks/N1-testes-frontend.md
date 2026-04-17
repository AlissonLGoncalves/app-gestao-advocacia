# [N1] Testes de frontend

> ⚠️ **ANTES DE COMEÇAR — leia `.github/tasks/README.md`.**
> 🥇 **Regra de ouro:** TODAS as críticas (C1–C4) precisam estar MERGEADAS antes de começar tarefas normais.
> 🚫 **NÃO use `Co-Authored-By`** em commits — quebra o deploy no Vercel Hobby.

**Prioridade:** 🟡 Normal
**Depende de:** C2 (CI precisa existir)
**Estimativa:** 3-5 dias

## Contexto

`gestao_advocacia_vite/` tem 1 arquivo de teste para 19 componentes. Qualquer refactor vira roleta russa.

## Tarefas

1. Configurar **Vitest + React Testing Library + jsdom** (se já não estiver).
   - Adicionar `vitest`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom` como devDependencies.
   - Criar `vitest.config.js` ou adicionar ao `vite.config.js`.
   - Adicionar scripts no `package.json`: `"test": "vitest"`, `"test:coverage": "vitest --coverage"`.

2. Escrever testes para os formulários críticos:
   - `ClienteForm.jsx`
   - `CasoForm.jsx`
   - `ContratoForm.jsx` (se existir)
   - Login / Autenticação

3. Para cada formulário, cobrir:
   - Renderiza sem crashar.
   - Validação de campos obrigatórios (submete vazio → mostra erro).
   - Submit com sucesso (mock da API, espera toast/redirect).
   - Submit com erro 400 (mostra mensagem de erro do backend).
   - Submit com erro 500 (mostra mensagem genérica).

4. Atingir **40% de cobertura** nos componentes de formulário (medir com `vitest --coverage`).

5. Adicionar `npm run test` (não cobertura) ao workflow de CI (editar `.github/workflows/ci.yml` criado em C2).

## Critérios de aceite

- [ ] Vitest configurado e rodando.
- [ ] Pelo menos 4 arquivos de teste novos, cobrindo os formulários principais.
- [ ] Cobertura de formulários ≥ 40%.
- [ ] CI roda `npm test` e falha se teste falhar.
- [ ] README do frontend documenta como rodar testes.

## Fora de escopo

- Testes E2E (Playwright/Cypress).
- Testes de componentes não-formulário (Dashboard, listagens) — ficam para depois.
