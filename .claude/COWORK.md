# Protocolo de Cowork — 2 sessões Claude no mesmo projeto

Atualizado: 2026-05-09 — após incidente onde commit `d21af6a` (Epic #11) do
working tree principal vazou pro branch do worktree `trusting-hamilton`.

## Sessões e seus territórios

| Sessão | Working tree | Identificação |
|---|---|---|
| **A** (VS Code) | **DEVE** mover pra `.claude/worktrees/<nome>/` | sufixo `-vscode` em commits/branches se útil |
| **B** (Terminal Claude) | `.claude/worktrees/trusting-hamilton-aba6dc/` | sufixo `-terminal` se útil |

**Regra zero**: Nenhuma das duas sessões trabalha no working tree raiz
(`C:\Users\aliss\app-gestao-advocacia\`). É território só pra:
- `git fetch` / `git pull` em `main`
- Inspeção rápida (sem commits)
- Operações administrativas (flyctl, scripts de deploy)

## Regras de branch e commit

1. **Sempre partir do remoto recente**:
   ```sh
   git fetch origin --prune
   git checkout -b feat/<slug> origin/main
   ```
   Nunca `checkout -b feat/X main` (main local pode estar contaminado por
   commits da outra sessão que ainda não foram via PR).

2. **Nunca commitar direto em `main` local**. Tudo via branch + PR + squash
   merge. Se precisar fazer fix urgente em main, usa branch `hotfix/X` →
   PR → merge.

3. **Antes de iniciar uma epic**: comentar na issue do GitHub
   ```
   /assign-claude
   ```
   ou simples comentário `pegando agora — sessão B`. Outra sessão vê e
   evita duplicar.

4. **PRs auto-identificados**: prefixo `feat(...)` ok mas o body deve dizer
   qual sessão fez (linha "## Sessão: A (VS Code)" ou "B (Terminal)") —
   ajuda o user a saber quem corrigir se quebrar.

5. **Antes de PR ficar verde**: rodar `gh pr list` pra confirmar que não
   há outro PR aberto tocando os mesmos arquivos.

## Coordenação por arquivos críticos

| Arquivo | Quem pode tocar agora | Por quê |
|---|---|---|
| `routes/casos.py` | sessão fazendo Epic #11 (#185) | auto-detecção OAB |
| `pages/CasoDetalhePage.jsx` | sessão fazendo Epic #1 (#175) | viewer documentos |
| `pages/DjenPage.jsx` | quem pegar #176, #177, #184 | DJEN-related |
| `models/__init__.py` | sequencial (1 sessão por vez) | conflito de migrations |

Se vai mexer em arquivo da coluna 1, **comentar na issue antes**.

## Resolução de conflitos quando acontecem

Se um commit "vazou" entre branches (como aconteceu com `d21af6a`):

1. **Não dropar silenciosamente** — comunicar ao user que o commit X foi
   isolado/removido e por quê
2. Usar `git reset --hard <ref-limpo>` + `git cherry-pick <só-o-meu>`
3. Force push do branch isolado
4. Notificar a outra sessão (via issue ou MEMORY update) que o commit
   precisa ser refeito noutro branch

## Divisão sugerida das epics restantes

Baseado em "área de arquivos" pra minimizar conflito:

### Sessão A (VS Code) — backend-heavy + migrations
- ✅ #175 Documentos viewer (em curso)
- ✅ #185 Auto-detecção OAB (commit local — abrir PR)
- 🔜 #186 Busca automática on-demand (escopo grande, novo módulo)
- 🔜 #179 Importar CNJs lote (backend novo)
- 🔜 #8 Apensar processo (migration nova)

### Sessão B (Terminal Claude) — frontend-heavy + UX isolada
- ✅ #178 Botão "+" global (PR #188)
- ✅ #184 Categorias DJEN (PR #189)
- ✅ #176 Classificação IA (PR #191)
- 🔜 #6 Tabs no detalhe do caso (depende #175 mergear primeiro)
- 🔜 #7 Cards laterais no detalhe (depende #175)
- 🔜 #3 Tratar andamento → tarefa inline (toca DJEN, isolado)
- 🔜 #9 Modelos de documento (frontend pesado)

## Quando estiver bloqueado

Se a outra sessão tem PR aberto tocando os arquivos que você precisa:
1. Comentar no PR pedindo ETA de merge
2. Se ETA > 30min, pegar epic alternativa do meu lado
3. Se tudo do meu lado depende, pausar e avisar o user
