# [T3] Padronização (ruff / black / prettier)

> ⚠️ **ANTES DE COMEÇAR — leia `.github/tasks/README.md`.**
> 🥇 **Regra de ouro:** só começar triviais após C1–C4 estarem MERGEADAS.
> 🚫 **NÃO use `Co-Authored-By`** em commits — quebra o deploy no Vercel Hobby.

**Prioridade:** 🟢 Trivial
**Depende de:** C2
**Estimativa:** 2-3 horas

## Tarefas

### Backend

1. Adicionar ao `requirements.txt` (seção dev ou `requirements-dev.txt`):
   - `ruff`
   - `black`
2. Criar `gestao_advocacia/pyproject.toml` com config de `ruff` e `black` (line-length 100, target Python 3.11).
3. Rodar uma vez: `ruff check --fix .` e `black .`.
4. Adicionar ao CI (workflow de C2):
   - `ruff check .`
   - `black --check .`
   Falhar em diff.

### Frontend

1. Garantir `eslint` configurado (já existe `eslint.config.js`).
2. Adicionar `prettier` como devDependency.
3. Criar `.prettierrc` na raiz do frontend com config básica.
4. Rodar uma vez: `npm run lint -- --fix` e `npx prettier --write "src/**/*.{js,jsx,css}"`.
5. Adicionar ao CI:
   - `npm run lint`
   - `npx prettier --check "src/**/*.{js,jsx,css}"`

## Critérios de aceite

- [ ] `ruff` e `black` configurados e rodando no CI.
- [ ] `eslint` e `prettier` configurados e rodando no CI.
- [ ] Código inteiro formatado (PR grande com apenas mudanças de formatação).
- [ ] Nenhum teste quebrado.

## Dica

O PR de formatação inicial será **enorme**. Fazer em commit separado do commit de configuração para facilitar review.
