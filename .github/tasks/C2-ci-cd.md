# [C2] CI/CD mínimo (GitHub Actions)

> ⚠️ **ANTES DE COMEÇAR — leia `.github/tasks/README.md`.**
> 🥇 **Regra de ouro:** C1 precisa estar MERGEADA antes de começar esta. Uma crítica por vez.
> 🚫 **NÃO use `Co-Authored-By`** em commits — quebra o deploy no Vercel Hobby.

**Prioridade:** 🔴 Crítica
**Bloqueia:** nada (mas beneficia todas as outras)
**Estimativa:** meio dia

## Contexto

Hoje não existe nenhum pipeline de CI. Qualquer commit quebrado pode chegar em produção sem aviso. Precisamos de uma rede de segurança mínima rodando a cada push e pull request.

## Tarefas

1. Criar `.github/workflows/ci.yml` com dois jobs rodando em paralelo:

### Job `backend`
- Runner: `ubuntu-latest`
- Python 3.11
- Passos:
  - Checkout
  - Setup Python 3.11 com cache de pip
  - `cd gestao_advocacia && pip install -r requirements.txt`
  - `pip install pytest-cov`
  - `cd gestao_advocacia && pytest --cov=. --cov-report=term-missing --cov-fail-under=50`

### Job `frontend`
- Runner: `ubuntu-latest`
- Node 20
- Passos:
  - Checkout
  - Setup Node 20 com cache de npm
  - `cd gestao_advocacia_vite && npm ci`
  - `cd gestao_advocacia_vite && npm run lint`
  - `cd gestao_advocacia_vite && npm run build`

### Gatilhos
- `push` nas branches `main` e `task/**`
- `pull_request` para `main`

2. Adicionar no topo do `README.md` um badge de CI:
   ```
   ![CI](https://github.com/<OWNER>/<REPO>/actions/workflows/ci.yml/badge.svg)
   ```
   (descobrir OWNER/REPO com `gh repo view --json nameWithOwner`)

3. Se o `cov-fail-under=50` estiver muito alto para a cobertura atual, **abaixar temporariamente** para o valor atual (arredondado para baixo em 5) e deixar um comentário `# TODO: aumentar para 70% após tarefa N1`.

## Critérios de aceite

- [ ] Workflow `.github/workflows/ci.yml` criado.
- [ ] Jobs `backend` e `frontend` rodam em paralelo.
- [ ] Ambos passam verdes no PR desta tarefa.
- [ ] Badge de CI no README.
- [ ] PR quebrado de teste (ex.: teste que falha propositalmente) é barrado pelo CI — comprovar com screenshot ou link.

## Fora de escopo

- Deploy automático (fica para uma tarefa futura).
- Cobertura > 50% (tarefas N1 e além).
- Cache avançado, matrix de versões.
