# Rollback de deploy Fly

> Procedimento para reverter um deploy quebrado em produção
> (`app-gestao-advocacia.fly.dev`). Estabelecido pela issue #96 após
> automação do deploy contínuo via `deploy-fly.yml` (PR #94).
>
> **Imprima/cole este doc no canal de incidente quando começar.** Em
> incidente, decisões são tomadas mais rápido com a sequência escrita
> à frente.

---

## 1. Diagnóstico rápido — está mesmo quebrado?

Antes de rollar, confirme em pelo menos **dois** sinais independentes
que é regressão real (e não falso positivo de monitoring):

| Fonte | Comando / URL | O que olhar |
|---|---|---|
| Health check da API | `curl -fsS https://app-gestao-advocacia.fly.dev/api/v1/health` | 200 + `"status":"ok"`. 503 → quebrou. |
| Logs Fly | `flyctl logs -a app-gestao-advocacia --since 10m` | Tracebacks repetidos, `5xx` em rotas que antes eram `2xx`. |
| Smoke endpoint autenticado | `curl -fsS https://app-gestao-advocacia.fly.dev/api/v1/casos -H "Authorization: Bearer $TOKEN"` | 200 ou 401 esperado. 500 ou conexão recusada → quebrou. |
| Actions (GitHub) | https://github.com/AlissonLGoncalves/app-gestao-advocacia/actions/workflows/deploy-fly.yml | Último job em vermelho indica deploy que falhou no health check pós-deploy. Se está verde mas o app está quebrado, é regressão silenciosa. |
| Sentry / observabilidade externa | (configurar — issue separada) | Spike de erros depois do timestamp do último deploy. |

Se apenas **um** sinal aponta problema, investigue mais antes de
rollback — o pior cenário não é o deploy ruim, é rollback desnecessário
que perde uma migration legítima.

---

## 2. Decisão — rollback de código vs hotfix forward

| Cenário | Ação recomendada |
|---|---|
| Deploy mergeou há **< 30 min**, apenas 1 PR no diff, regressão clara | **Rollback (revert merge)** — caminho 3.1 |
| Migration rodou, código quebrou só em runtime, dados não foram alterados | **Rollback (revert merge)** — caminho 3.1; migration vai correr a downgrade no próximo deploy via release_command, mas só se houver downgrade explícito (raro). Mais seguro: **forward fix** com nova migration que repara o estado, caminho 3.2 |
| Migration alterou dados (UPDATE/INSERT em produção) | **Forward fix** — caminho 3.2. Nunca rollar migration que tocou dados sem backup recente. |
| Vários PRs mergeados desde o último deploy verde, difícil isolar qual quebrou | **Rollback de release Fly direto** — caminho 3.3. Volta para a imagem anterior sem mexer em main. |
| Bug crítico afetando todos os usuários, qualquer fix demora >15 min | **Rollback de release Fly direto** — caminho 3.3. É o mais rápido (~2 min). |

**Critério geral**: se o problema é **só código** (sem migration ou
com migration idempotente), rollback é simples. Se a migration alterou
schema/dados, **forward fix** é quase sempre menos arriscado.

---

## 3. Procedimentos

### 3.1 Rollback de código via `git revert` do merge

Use quando o problema é de código, mergeou recente, e a migration (se
houver) é trivialmente reversível.

```bash
# Identificar o merge commit do PR problemático
git log --oneline --merges -10

# Reverter o merge — -m 1 mantém a linha de history como pai
git revert -m 1 <merge-commit-sha>

# Push direto pra main (NÃO precisa de PR — é situação de incidente
# e o workflow de branch protection do plano Free não bloqueia main)
git push origin main
```

Isso dispara automaticamente o `deploy-fly.yml` via `pull_request:closed`?
**Não** — o workflow só dispara em merge de PR. Para um revert direto
em main, use:

```bash
gh workflow run deploy-fly.yml --ref main
```

Ou via UI: Actions → "Deploy backend to Fly" → Run workflow → branch `main`.

**Validação após deploy**:

```bash
curl -fsS https://app-gestao-advocacia.fly.dev/api/v1/health | jq .
# Deve retornar status "ok"
```

### 3.2 Forward fix — nova migration ou hotfix de código

Use quando a migration mexeu em dados, ou quando reverter o código
quebraria invariantes que outros PRs já mergeados dependem.

1. Criar branch `hotfix/<descricao-curta>` a partir de main.
2. Implementar correção (nova migration que repara estado, ajuste no
   código, etc).
3. Abrir PR com label `prioridade:critica`.
4. **Pular CI completo é tentador, mas não pule.** Os testes pegam o
   tipo de bug que veio pra essa situação.
5. Squash-merge → deploy automático.

### 3.3 Rollback de release Fly direto (sem mexer em main)

Use quando:
- Múltiplos PRs entre o último deploy bom e o atual (difícil isolar).
- Pressa: precisa estabilizar produção em <5 min e diagnosticar depois.
- Problema é deploy parcial/transient e o código em main na verdade
  está OK (ex: máquina ficou num estado ruim).

```bash
# 1. Listar releases recentes (mais novo no topo)
flyctl releases --app app-gestao-advocacia | head -20

# Saída tipica:
#   VERSION  STATUS    DESCRIPTION                       USER  DATE
#   v53      complete  Deploy image dep-...              ...   2m ago    <- atual quebrado
#   v52      complete  Deploy image dep-...              ...   1h ago    <- ultimo bom
#   v51      complete  Deploy image dep-...              ...   3h ago

# 2. Identificar a IMAGEM da release boa (v52 no exemplo)
flyctl image show --app app-gestao-advocacia
# Ou pega da lista acima — a coluna "DESCRIPTION" tem o image tag.

# 3. Re-deployar a imagem antiga (sem rebuild)
flyctl deploy --app app-gestao-advocacia \
  --image registry.fly.io/app-gestao-advocacia:deployment-<id-da-v52> \
  --strategy immediate
```

**Atenção sobre migrations**:

- O `release_command` (`flask db upgrade`) **roda de novo** ao
  re-deployar uma imagem antiga. Como `flask db upgrade` é idempotente
  (só roda revs ainda não aplicadas), isso é seguro **se** a release
  antiga não tem nenhuma migration que já foi aplicada e depois
  removida do código. Cenário raro mas possível.
- Para garantir idempotência total, antes de rollback:
  `flyctl ssh console -a app-gestao-advocacia -C "flask db current"` →
  comparar com `git log` da release alvo. Se diverge, faça rollback de
  migration **antes** (3.4).

### 3.4 Rollback de migration

**Atenção**: rollback de migration em produção é a operação mais
arriscada deste runbook. Faça **backup do DB antes**.

```bash
# 1. Backup full do Postgres (Fly Postgres-flex usa volumes Fly)
flyctl postgres backup create -a <db-app-name>
flyctl postgres backup list -a <db-app-name> | head -5
# Anotar o ID do backup recém-criado.

# 2. Identificar a revision para qual quer voltar
flyctl ssh console -a app-gestao-advocacia -C "flask db history" | head -20

# 3. Executar downgrade
flyctl ssh console -a app-gestao-advocacia -C "flask db downgrade <revision-alvo>"

# 4. Validar
flyctl ssh console -a app-gestao-advocacia -C "flask db current"
# Deve mostrar a <revision-alvo>.

# 5. Health check
curl -fsS https://app-gestao-advocacia.fly.dev/api/v1/health | jq .
```

**Se algo der errado no downgrade** (migration sem `def downgrade()`,
constraint violation, etc): restaurar do backup do passo 1:

```bash
flyctl postgres backup restore -a <db-app-name> <backup-id>
```

---

## 4. Comunicação durante incidente

| Quando | Para quem | Conteúdo |
|---|---|---|
| Detectada regressão | Canal #incidentes (ou DM ao admin) | "Investigando regressão em prod, deploy v53 da Fly. Atualizo em 5 min." |
| Decidido rollback | Mesmo canal | "Rollback iniciado via [3.1 / 3.2 / 3.3]. ETA estabilização: <X> min." |
| Estabilizado | Mesmo canal + status page (quando tiver) | "Produção estável, health check verde. Iniciando postmortem." |
| Postmortem pronto | Time + repo wiki | Doc preenchido (template seção 5). |

**Banner no app durante incidente** (sem isso ainda — issue futura):
quando tiver, render banner amarelo no topo do React app via flag em
`/api/v1/health` ou env var; placeholder por enquanto é avisar via
canais externos.

---

## 5. Postmortem — template básico

Salvar em `docs/postmortems/YYYY-MM-DD-<slug>.md`. Sem culpados —
foco em sistema, não em pessoa.

```markdown
# Postmortem: <título curto>

**Data**: YYYY-MM-DD
**Duração da indisponibilidade**: HH:MM → HH:MM (X minutos)
**Impacto**: <ex: 100% das requests retornando 500 / latência p99 5x>
**Detectado por**: <health check / usuário / Sentry / alerta>
**Mitigado por**: <PR #X de revert / rollback Fly v52 / forward fix>

## Timeline (UTC)

- HH:MM — PR #N mergeou em main, deploy v53 iniciou
- HH:MM — Health check da Action falhou; deploy v53 marcado como ruim
- HH:MM — Engenheiro de plantão notificado (canal X)
- HH:MM — Diagnóstico: <root cause em uma frase>
- HH:MM — Rollback iniciado via <caminho>
- HH:MM — Health check verde após rollback
- HH:MM — Comunicado de resolução

## Root cause

<Parágrafo. Por que quebrou. O que no sistema permitiu chegar em prod.>

## Por que CI/staging não pegaram

<Parágrafo. Diferença entre staging e prod que mascarou. Lacuna no
teste suite ou na suite de smoke. Específico, não genérico.>

## Action items

- [ ] [P0 — owner] <ação concreta para evitar repetição. ex: "adicionar
  teste pytest cobrindo cenário X em test_Y.py">
- [ ] [P1 — owner] <melhoria de observabilidade>
- [ ] [P2 — owner] <doc atualizada>
```

---

## 6. Comandos de referência rápida

```bash
# Health check da API
curl -fsS https://app-gestao-advocacia.fly.dev/api/v1/health | jq .

# Estado das máquinas
flyctl status -a app-gestao-advocacia

# Logs em tempo real
flyctl logs -a app-gestao-advocacia

# Logs últimos 30 min
flyctl logs -a app-gestao-advocacia --since 30m

# Releases recentes
flyctl releases -a app-gestao-advocacia | head -10

# Console SSH na máquina app
flyctl ssh console -a app-gestao-advocacia

# Migration head atual no DB
flyctl ssh console -a app-gestao-advocacia -C "flask db current"

# Re-deploy de uma imagem antiga
flyctl deploy -a app-gestao-advocacia \
  --image registry.fly.io/app-gestao-advocacia:deployment-<id> \
  --strategy immediate

# Disparar workflow manualmente após revert em main
gh workflow run deploy-fly.yml --ref main
```

---

## Referências

- [Rotação do FLY_API_TOKEN](fly-token-rotation.md) — caso de uso
  compartilhado: rotacionar token também é parte da resposta a
  incidente quando a suspeita é vazamento de credencial.
- [`fly.toml`](../../fly.toml) — `release_command`, `auto_stop`,
  `concurrency`.
- [Workflow `deploy-fly.yml`](../../.github/workflows/deploy-fly.yml) —
  referência do health check pós-deploy.
- [Issue #96](https://github.com/AlissonLGoncalves/app-gestao-advocacia/issues/96) —
  origem deste doc.
