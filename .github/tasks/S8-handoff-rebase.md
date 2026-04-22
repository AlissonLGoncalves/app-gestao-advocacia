# Handoff — Rebase das PRs S8.x

Documento de passagem para o VS Code chat continuar de onde parei.
Data: 2026-04-21.

---

## TL;DR

Eu comecei a consolidar as PRs S8 (centralização da camada de API no
frontend) que foram abertas com `client.js` divergente em cada branch.
Já fechei a duplicata, mergeei S8 fase 1, criei um `client.js` canônico
em `main` e mergeei **S8.2**. Estava no meio do rebase de **S8.3** quando
parei. Restam S8.3, S8.4, S8.5, S8.6 e o S8.7 (que ainda está sendo
escrito pelo chat) + rebase do PR #51 (README).

---

## Estado atual de `main`

```
08bb9dc style(frontend): prettier --write nos arquivos S8 ja mergeados
88cc7f7 refactor(s8.2): migrar recurso clientes para api/clientes (#62)
97a1be4 refactor(api): consolidar client.js canonico com upload/getBlob/postForm/patch
86cc795 refactor(s8): centralizar camada de API (fase 1 auth) (#60)
```

`gestao_advocacia_vite/src/api/client.js` em main é a **fonte canônica**
e tem: `get`, `post`, `postForm`, `put`, `patch`, `del`, `upload`,
`getBlob` + headers `X-Terms-Version` e `X-LGPD-Version`.
**Não mexer nele** durante os rebases — sempre preservar a versão de main.

---

## Já concluído

| Ação | Estado |
|---|---|
| Fechar PR #61 (duplicata do S8.2) | ✅ `gh pr close 61` |
| Merge PR #60 (S8 fase 1 — auth) | ✅ squash merge, branch deletada |
| Consolidar `client.js` canônico em main | ✅ commit `97a1be4` |
| Rebase + merge PR #62 (S8.2 clientes) | ✅ squash merge `88cc7f7` |
| Prettier nos arquivos S8 já em main | ✅ commit `08bb9dc` |

---

## Pendente (nesta ordem)

1. **S8.3 casos** — PR #63, branch `refactor/s8.3-api-casos`
2. **S8.4 documentos + upload** — PR #64, branch `refactor/s8.4-api-documentos`
3. **S8.5 financeiro** — PR #65, branch `refactor/s8.5-api-financeiro`
4. **S8.6 agenda** — PR #66, branch `refactor/s8.6-api-agenda`
5. **S8.7 djen + procuracoes** — branch `refactor/s8.7-api-djen-procuracoes` (em escrita, ainda sem PR)
6. **PR #51 README** — ficou para trás, precisa `git rebase origin/main` simples (só README, sem conflito real com código)

---

## Procedimento padrão para cada PR S8.x

Execute **da raiz do repo** (`C:\Users\aliss\app-gestao-advocacia`).

Existe um worktree por branch em `.claude/worktrees/s8.X-.../`. Se o
worktree não existir mais (foi removido), recrie com:

```bash
git worktree add .claude/worktrees/s8.X-<nome> refactor/s8.X-<nome>
```

Passos (substitua `X` e `<nome>`):

```bash
# 1) ir para o worktree da branch
cd .claude/worktrees/s8.X-<nome>

# 2) pegar main atualizado e rebasear
git fetch origin main
git rebase origin/main

# 3) resolver conflitos (padrão abaixo)
git checkout --ours gestao_advocacia_vite/src/api/client.js
git checkout --theirs gestao_advocacia_vite/src/api/<recurso>.js
git add gestao_advocacia_vite/src/api/client.js \
        gestao_advocacia_vite/src/api/<recurso>.js
git rebase --continue

# 4) rodar prettier nos arquivos tocados (para não quebrar CI)
cd gestao_advocacia_vite
npx prettier --write src/api/ <lista dos .jsx/.js tocados pela PR>
cd ..
git add -u
git commit --amend --no-edit --no-verify

# 5) validar localmente
cd gestao_advocacia_vite
npm ci --silent   # só na primeira vez por worktree
npm run lint
npm test -- --run
npm run build
cd ..

# 6) subir e mergear
git push --force-with-lease origin refactor/s8.X-<nome>

# aguarde CI verde (uns 2-3 min). Workers Builds (Cloudflare) pode
# ficar vermelho — é ruído, ignore.
gh pr merge <número> --squash --admin

# 7) limpar worktree
cd ../..
git worktree remove --force .claude/worktrees/s8.X-<nome>
git branch -D refactor/s8.X-<nome>
```

---

## Regra de resolução de conflito

Durante o rebase `git rebase origin/main`:

- `--ours` = `main` (upstream), `--theirs` = branch da PR (o commit sendo
  replicado). Oposto do `git merge`.
- **`src/api/client.js`** → sempre `--ours` (main canônico já tem
  tudo que as PRs tentaram adicionar: upload, getBlob, postForm, patch).
- **`src/api/<recurso>.js`** (clientes.js, casos.js, etc.) → sempre
  `--theirs` (a branch tem a implementação real; main tem apenas stub
  que foi introduzido pelo S8 fase 1).
- **Qualquer outro arquivo** (componentes, páginas, testes) → resolver
  manualmente. Geralmente não conflitam porque cada PR toca domínios
  diferentes.

---

## Particularidades por PR restante

### S8.3 casos (#63)

Branch `refactor/s8.3-api-casos`.
Já tentei rebasear antes do prettier entrar em main. Worktree atual
é `.claude/worktrees/s8.3-recheck` (no ponto antigo, commit `9fec95f`).
O mais limpo agora é:

```bash
git worktree remove --force .claude/worktrees/s8.3-recheck
git worktree add .claude/worktrees/s8.3-api-casos refactor/s8.3-api-casos
cd .claude/worktrees/s8.3-api-casos
git fetch origin main
git reset --hard origin/refactor/s8.3-api-casos   # volta para o estado do remoto (pré-rebase)
git rebase origin/main
```

Conflitos esperados:
- `src/api/client.js` → `--ours`
- `src/api/casos.js` → `--theirs`

Depois do rebase, prettier em:
```
src/api/casos.js src/api/casos.test.js
src/CasoForm.jsx src/CasoForm.test.jsx src/CasoList.jsx
src/hooks/useCasoForm.js src/hooks/useCasoForm.test.js
src/pages/CasoDetalhePage.jsx
src/pages/CasosPage.jsx src/pages/CasosPage.test.jsx
```

### S8.4 documentos (#64)

Branch `refactor/s8.4-api-documentos`. A branch **também estendeu**
`client.js` com `upload` e `getBlob` — mas o main canônico já tem
ambos. Só descartar a versão da branch é seguro.

Conflitos esperados:
- `src/api/client.js` → `--ours`
- `src/api/client.test.js` → **atenção** — main tem a versão do S8 fase
  1, branch adicionou testes de `upload`. Resolver MANUALMENTE fazendo
  união dos dois arquivos.
- `src/api/documentos.js` → `--theirs`

Verifique que os componentes `DocumentoForm`, `DocumentoList`,
`DocumentosCasoTab`, `DocumentosClienteTab` usem `api.upload(...)` (API
canônica) e não a antiga `api.post(..., formData)`.

### S8.5 financeiro (#65)

Branch `refactor/s8.5-api-financeiro`.
Conflitos esperados:
- `src/api/client.js` → `--ours`
- `src/api/financeiro.js` → `--theirs`
- `src/Dashboard.jsx` → provavelmente também tocado pelo S8.6.
  Se der conflito nele aqui, resolva `--theirs`; se der no S8.6,
  resolver manualmente.

Verifique uso de `api.getBlob` para download de relatórios
(`ContasAPagarReport`, `ContasAReceberReport`).

### S8.6 agenda (#66)

Branch `refactor/s8.6-api-agenda`.
**Boa notícia:** esta PR **não tocou** em `client.js` (só adicionou
`agenda.js` +173 linhas). Conflito mais simples:
- `src/api/agenda.js` → `--theirs`
- Possivelmente `src/Dashboard.jsx` se S8.5 já tiver entrado.

### S8.7 djen + procuracoes (em escrita)

Quando o chat finalizar e abrir PR, aplicar mesmo procedimento:
- `src/api/client.js` → `--ours`
- `src/api/djen.js` → `--theirs`
- `src/api/procuracoes.js` → `--theirs`

### PR #51 README

Simples. Do main worktree:
```bash
cd C:\Users\aliss\app-gestao-advocacia\.claude\worktrees\trusting-hamilton-aba6dc
git fetch origin main
git rebase origin/main
# README.md vai conflitar se o main mexeu nele — unir manualmente
git push --force-with-lease origin docs/readme-refresh
gh pr merge 51 --squash --admin
```

---

## Checks do CI

- **backend-style, backend, frontend, Vercel** → precisam estar verdes.
- **Workers Builds: app-gestao-advocacia** (Cloudflare) → **sempre
  falha**, é integração residual, ignorar. Use `--admin` no `gh pr merge`
  para passar por cima.
- **Vercel Preview Comments** → geralmente verde.

Se o job `frontend` falhar em `prettier --check`, rode
`npx prettier --write src/` no worktree, `git commit --amend --no-edit`,
force-push.

Se falhar em `npm test`, investigar — pode ser regressão do rebase
(algum componente que você chamava `api.postOld(...)` e agora precisa de
`api.post(...)`).

---

## Comandos úteis de verificação

```bash
# ver estado de todos os PRs S8
gh pr list --search "S8" --state all --limit 20

# ver checks de uma PR
gh pr checks <num>

# ver quais arquivos a PR toca
gh pr view <num> --json files -q '.files[].path'

# confirmar que client.js na main tem upload/getBlob
git show main:gestao_advocacia_vite/src/api/client.js | grep -E "upload|getBlob|postForm"
```

---

## Se algo der muito errado

`git rebase --abort` volta a branch ao estado anterior. Você não perde
nada porque o GitHub ainda tem o `refactor/s8.X-<nome>` remoto original
(até você fazer `push --force-with-lease`).

Para voltar uma branch remota a um estado conhecido:
```bash
git fetch origin
git reset --hard origin/refactor/s8.X-<nome>
```

Se o `gh pr merge --admin` falhar com "not mergeable", aguarde o CI
terminar (2-3 min) e tente de novo. `gh pr view <num> --json mergeable`
deve retornar `"MERGEABLE"`.
