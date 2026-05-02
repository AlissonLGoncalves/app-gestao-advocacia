# Integração Patronus × projudi-agent

Documentação de implementação **por etapas** da integração entre o app
Patronus (Flask na nuvem) e o `projudi-agent` (Playwright local) para
sincronizar processos, movimentações e peças do PROJUDI TJ-PR.

> **Status atual** (2026-05-02): scraping ✅ funcional · push ❌ não implementado
> · endpoints no Patronus ❌ não existem.

---

## Visão geral

```
[ Máquina do advogado ]                  [ Patronus na nuvem ]
┌──────────────────────┐                 ┌────────────────────────────┐
│ projudi-agent        │                 │ Flask backend (Fly.io)     │
│  (rodando local)     │                 │                            │
│                      │  POST /processos│                            │
│  ┌──────────────┐    │ ──────────────► │ /api/projudi/processos     │
│  │ Chrome debug │    │                 │ /api/projudi/movimentacoes │
│  │  + Playwright│    │  POST /movim.   │ /api/projudi/pecas (multi) │
│  └──────────────┘    │ ──────────────► │ /api/projudi/auth/token    │
│         │            │                 │                            │
│         ▼            │                 │  ↓                         │
│  data/projudi.db     │  POST /pecas    │  Idempotência + RLS        │
│  (SQLite local)      │ ──────────────► │  Cria/atualiza Caso        │
│                      │                 │  Cria TarefaPrazo (Kanban) │
└──────────────────────┘                 └────────────────────────────┘
        ↑ cron 1×/h                              ↓
        Auth: Bearer token tenant-scoped         Frontend recebe push (futuro)
```

### Princípios

1. **Local-first**: agent roda na máquina do advogado (sessão Chrome com 2FA persiste).
2. **Idempotência ponta-a-ponta**: rodar 2× não duplica nada.
3. **Delta incremental**: movimentações filtradas por `seq > último_seq` no agent.
4. **Tenant-scoped**: cada token API mapeia 1:1 a um tenant do Patronus.
5. **Falha silenciosa controlada**: agent fora do ar não impede uso do app.

---

## Estado atual dos componentes

### projudi-agent

| Componente | Status |
|---|---|
| `chrome start/status` | ✅ |
| `db init/info` | ✅ |
| `login set/clear-password` | ✅ |
| `sync carteira` | ✅ |
| `sync movimentacoes` | ✅ delta por `seq` |
| `sync exportar` (PDF) | ✅ |
| `sync push` | ❌ `NotImplementedError` |
| `sync pecas` (peça individual) | ❌ stub |
| `ocr/` | ❌ pasta vazia |
| Testes | ⚠️ apenas 1 teste de DB |

### Patronus

| Componente | Status |
|---|---|
| `/api/projudi/auth/token` | ❌ não existe |
| `/api/projudi/processos` | ❌ não existe |
| `/api/projudi/movimentacoes` | ❌ não existe |
| `/api/projudi/pecas` | ❌ não existe |
| Modelo de token API | ❌ |
| UI de "última sync" | ❌ |

---

## Fases de implementação

A integração foi quebrada em **6 fases sequenciais**, cada uma entregável e
testável de forma independente. Cada fase tem **critérios de aceite** claros
para evitar entrar na próxima sem ter a anterior fechada.

---

### Fase 1 — Modelo de token API + autenticação

**Objetivo:** permitir que o agent autentique no Patronus sem usar o JWT do
usuário (que expira em horas). Token longo-vivo, tenant-scoped, revogável.

**Onde:** Patronus backend.

**Tarefas:**

- [ ] Novo modelo `ProjudiAgentToken` em `gestao_advocacia/models/__init__.py`:
  - `id`, `tenant_id`, `user_id` (dono), `token_hash` (sha256 do token),
    `nome` (apelido configurável), `ativo`, `created_at`, `last_used_at`,
    `revoked_at`.
- [ ] Migration Alembic para criar a tabela.
- [ ] Endpoint `POST /api/projudi/auth/token` (admin do tenant) — gera novo
  token de 32 chars, retorna **uma única vez** (depois só hash no banco).
- [ ] Endpoint `GET /api/projudi/auth/tokens` — lista tokens (sem revelar valor).
- [ ] Endpoint `DELETE /api/projudi/auth/tokens/<id>` — revoga.
- [ ] Decorator `@projudi_agent_required` em `helpers.py` — valida header
  `Authorization: Bearer <token>` contra hash, set `g.tenant_id` + `g.user_id`,
  atualiza `last_used_at`.
- [ ] UI nas Configurações: aba "Integrações" → seção PROJUDI Agent → botão
  "Gerar token", lista tokens existentes, copy-to-clipboard.

**Critérios de aceite:**

- [ ] `curl -H "Authorization: Bearer <token>" .../api/projudi/auth/me` retorna
  200 com `{tenant_id, user_id, nome_token}`.
- [ ] Token revogado retorna 401.
- [ ] Token sem header retorna 401.
- [ ] `last_used_at` atualiza a cada chamada.

**Entregável:** PR `feat(projudi): token API tenant-scoped pra agent local`

---

### Fase 2 — Endpoint `/api/projudi/processos`

**Objetivo:** receber lista de processos da carteira do advogado e criar/atualizar
`Caso` no Patronus.

**Onde:** Patronus backend.

**Tarefas:**

- [ ] Endpoint `POST /api/projudi/processos` com `@projudi_agent_required`.
- [ ] Body esperado:
  ```json
  {
    "processos": [
      {
        "numero_cnj": "0001234-12.2026.8.16.0001",
        "polo_ativo": "...",
        "polo_passivo": "...",
        "classe": "Procedimento Comum Cível",
        "vara": "1ª Vara Cível de Curitiba",
        "valor_causa": 15000.00,
        "data_distribuicao": "2026-04-15",
        "categoria_projudi": "Ativos",
        "raw": {}
      }
    ]
  }
  ```
- [ ] Para cada processo:
  - Busca `Caso` por `(tenant_id, numero_processo=numero_cnj)`.
  - Se existe: atualiza só campos vazios (não sobrescreve trabalho manual).
  - Se não existe: cria com `status="Ativo"`, vincula a `Cliente` se houver
    match por nome (reusando `tentar_auto_vincular_a_caso` invertido).
  - Se não acha cliente: deixa `cliente_id=NULL` e marca pra triagem manual.
- [ ] Retorna `{criados, atualizados, sem_cliente}` para log do agent.
- [ ] Idempotência: 2 chamadas com mesmo CNJ não criam duplicata.

**Critérios de aceite:**

- [ ] Mock POST com 5 processos cria 5 Casos.
- [ ] Mock POST repetido não cria nada novo.
- [ ] Processo com cliente cadastrado vincula automaticamente.
- [ ] Processo sem cliente correspondente fica órfão (visível em triagem).

**Entregável:** PR `feat(projudi): POST /api/projudi/processos cria/sync Casos`

---

### Fase 3 — Endpoint `/api/projudi/movimentacoes`

**Objetivo:** receber movimentações novas (delta) e:
1. Salvar todas como log em `MovimentacaoCNJ` (já existe esse modelo).
2. Detectar prazos via IA e criar `TarefaPrazo` no Kanban.

**Onde:** Patronus backend.

**Tarefas:**

- [ ] Endpoint `POST /api/projudi/movimentacoes` com `@projudi_agent_required`.
- [ ] Body:
  ```json
  {
    "movimentacoes": [
      {
        "numero_cnj": "0001234-12.2026.8.16.0001",
        "seq": 47,
        "data": "2026-04-30",
        "tipo": "Despacho",
        "descricao": "Intima-se a parte autora para manifestação em 15 dias.",
        "fingerprint": "sha256...",
        "raw": {}
      }
    ]
  }
  ```
- [ ] Para cada movimentação:
  - Busca `Caso` por `numero_cnj`. Se não acha: ignora (log warning).
  - Cria `MovimentacaoCNJ` com `dedup_key = fingerprint` (se já existe, skipa).
  - Roda detector de prazo (regex + IA fallback) — ver Fase 3.5.
  - Se detectar prazo: cria `TarefaPrazo` com `data_vencimento`, `caso_id`,
    `prioridade` (calculada por dias até vencer).
- [ ] Retorna `{movimentacoes_criadas, prazos_criados, ignorados}`.

**Critérios de aceite:**

- [ ] Movimentação com texto "Intima-se para contestar em 15 dias" gera
  `TarefaPrazo` com data correta (data movimentação + 15 dias úteis).
- [ ] Movimentação só de log (ex: "Conclusos") não cria prazo.
- [ ] Reenviar a mesma movimentação não duplica nem o log nem o prazo.

**Entregável:** PR `feat(projudi): POST /api/projudi/movimentacoes + detector prazos`

---

### Fase 3.5 — Detector de prazos (módulo)

**Objetivo:** receber texto de movimentação e retornar prazo estruturado
(ou `None` se não houver prazo).

**Onde:** Patronus backend (módulo `prazo_detector.py`).

**Tarefas:**

- [ ] Função `detectar_prazo(texto, data_referencia) -> dict | None`.
- [ ] Camada 1 — regex: padrões comuns
  - `(\d+)\s+dias?\s+(úteis|corridos)?` + `(contestar|recurso|impugnar|...)`
  - Calcula `data_vencimento` (data_referencia + N dias úteis/corridos).
- [ ] Camada 2 — IA fallback: quando regex não acha mas texto >100 chars,
  chama Gemini com prompt focado:
  ```
  Identifique se este texto contém prazo processual.
  Retorne JSON: {tipo: "contestacao|recurso|...", dias: N,
  uteis: bool, vencimento_iso: "YYYY-MM-DD" ou null}
  ```
- [ ] Cache: textos já analisados ficam em hash → resultado (evita re-IA).

**Critérios de aceite:**

- [ ] Test suite com 20 textos reais de movimentação:
  - 10 com prazo (contestar 15d, recorrer 15d, embargar 5d, etc.)
  - 10 sem prazo (conclusos, juntada, despacho mero expediente)
  - Detecção correta em ≥85%.
- [ ] Falso positivo <5% (não cria prazo onde não tem).

**Entregável:** PR `feat(prazos): detector hibrido regex+IA pra movimentacoes`

---

### Fase 4 — Endpoint `/api/projudi/pecas` (PDF)

**Objetivo:** receber PDF consolidado do `sync exportar` e salvar como
`Documento` vinculado ao `Caso`.

**Onde:** Patronus backend.

**Tarefas:**

- [ ] Endpoint `POST /api/projudi/pecas` (multipart/form-data) com
  `@projudi_agent_required`.
- [ ] Campos do form: `file` (PDF), `numero_cnj`, `escopo` (tudo|capa|...)
  e `data_exportacao`.
- [ ] Validações:
  - MIME PDF (reusa `validar_upload`).
  - Limite 50 MB (autos consolidados podem ser pesados).
  - Hash SHA-256 do conteúdo — se já existe `Documento` com mesmo hash + caso,
    skipa (idempotência).
- [ ] Cria `Documento` com `nome_arquivo = "PROJUDI - <escopo> - <data>.pdf"`,
  `path_arquivo` em storage, vinculado ao `Caso`.
- [ ] Trigger opcional: se for primeira peça do caso, dispara extração de
  eventos via IA (reusando endpoint `/casos/extrair-eventos-de-documento/<id>`)
  com flag `auto=true` que cria prazos sem pedir confirmação.

**Critérios de aceite:**

- [ ] POST com PDF válido cria `Documento` em até 5s.
- [ ] POST do mesmo PDF 2x não duplica.
- [ ] PDF aparece em `/casos/detalhe/<id>` aba Documentos.

**Entregável:** PR `feat(projudi): POST /api/projudi/pecas + storage`

---

### Fase 5 — Implementar `push_to_app.py` no projudi-agent

**Objetivo:** completar o lado do agent que faz POST para os endpoints novos.

**Onde:** projudi-agent (`projudi_agent/sync/push_to_app.py`).

**Tarefas:**

- [ ] Implementar `push_processos(settings, processos)`:
  - POST `/api/projudi/processos` com lista do banco local.
  - Atualiza `sync_log` com timestamp de sucesso.
- [ ] Implementar `push_movimentacoes(settings, movimentacoes)`:
  - Filtra só `pushed_at IS NULL` no banco local.
  - POST em lotes de 50.
  - Marca `pushed_at = now()` no SQLite após 200 OK.
- [ ] Implementar `push_pecas(settings, pecas_paths)`:
  - Para cada PDF em `downloads/<cnj>/`, POST multipart.
  - Marca `enviado_em` na tabela `exportacoes` local.
- [ ] Novo comando CLI: `projudi-agent sync push` — orquestra os 3 acima.
- [ ] Retry policy: 3 tentativas com backoff exponencial em 5xx.
- [ ] Schema do SQLite: adicionar coluna `pushed_at` em `movimentacoes` e
  `exportacoes` (migration via `db init` reentrante).

**Critérios de aceite:**

- [ ] `projudi-agent sync push` em ambiente teste sobe os 3 tipos sem erro.
- [ ] Rodar 2× só sobe novidades (idempotência).
- [ ] Falha de rede no meio: retry funciona, log claro.
- [ ] Token revogado → erro amigável, não trava agent.

**Entregável:** PR no `projudi-agent`: `feat(sync): push pra Patronus implementado`

---

### Fase 6 — UX no Patronus + observabilidade

**Objetivo:** o usuário ver que a integração está funcionando e quando foi
o último sync.

**Onde:** Patronus frontend + backend.

**Tarefas:**

- [ ] Modelo `ProjudiSyncLog` no banco — registra cada chamada bem-sucedida
  com tipo (processos|movimentacoes|pecas), counts, duração.
- [ ] Endpoint `GET /api/projudi/sync/status` — retorna último sync por tipo.
- [ ] Dashboard: badge "PROJUDI: sync há 23min ✓" ou "PROJUDI: sem sync há 6h ⚠️".
- [ ] Página `/configuracoes/integracoes` mostra:
  - Status do agent (sync recente?).
  - Lista de tokens API com botão de revogar.
  - Instruções de setup do agent (link pro README).
- [ ] Notificação no toast quando chegam movimentações novas via push (futuro:
  WebSocket; por agora, polling no Dashboard a cada 5min).

**Critérios de aceite:**

- [ ] Dashboard mostra "Última sync PROJUDI: ..." com timestamp real.
- [ ] Tela de Integrações lista tokens criados.
- [ ] Revogar token corta o acesso imediatamente (próxima chamada do agent dá 401).

**Entregável:** PR `feat(integracoes): UI status sync PROJUDI + revogar tokens`

---

## Riscos e mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| PROJUDI muda layout, scraper quebra | Alta | Alto | Site-map docs detalhados + testes manuais antes de cada sync grande |
| Token vaza | Baixa | Alto | Tokens revogáveis, hash no banco, `last_used_at` pra detectar abuso |
| Agent fora do ar (PC desligado) | Alta | Médio | Sync roda quando PC sobe; UI mostra "sem sync há Xh" |
| Detector de prazo gera falsos positivos | Média | Médio | Threshold de confiança + UI permite descartar TarefaPrazo |
| Volume grande de PDFs estoura storage | Baixa | Alto | Limite de 50 MB/peça + alerta de cota |
| Cron em PC pessoal (Windows) é instável | Média | Médio | Documentar Task Scheduler do Windows; retry no agent |

---

## Cronograma sugerido

Cada fase é entregável independente. Estimativas de "tempo focado":

| Fase | Esforço | Pré-requisito |
|---|---|---|
| 1 — Token API | 4h | — |
| 2 — /processos | 3h | Fase 1 |
| 3 — /movimentacoes | 4h | Fase 1 |
| 3.5 — Detector prazos | 6h | Fase 3 |
| 4 — /pecas | 4h | Fase 1 |
| 5 — push_to_app | 5h | Fases 1-4 |
| 6 — UX + observabilidade | 4h | Fases 1-5 |
| **Total** | **~30h** | |

Distribuído em sprints de 1 semana cada, dá pra fechar tudo em 4-5 semanas com
validação real entre as fases.

---

## Checklist de pronto-pra-produção

Antes de declarar a integração estável:

- [ ] Todas as 6 fases mergeadas e em produção.
- [ ] Token API gerado e rodando em pelo menos 1 máquina.
- [ ] `sync push` rodando agendado (Task Scheduler do Windows).
- [ ] 1 semana de sync sem erro reportado.
- [ ] Dashboard do Patronus mostra status verde.
- [ ] Pelo menos 1 prazo real detectado e cumprido com base no que veio do PROJUDI.
- [ ] Documentação operacional para o usuário final (README do agent atualizado).

---

## Referências

- README do agent: `C:\Users\aliss\projudi-agent\README.md`
- Site-map dos seletores: `C:\Users\aliss\projudi-agent\docs\site-map\`
- Modelo `TarefaPrazo` no Patronus: [models/__init__.py:703](gestao_advocacia/models/__init__.py)
- Modelo `MovimentacaoCNJ` no Patronus: [models/__init__.py:322](gestao_advocacia/models/__init__.py)
- Página Kanban: [pages/PrazosPage.jsx](gestao_advocacia_vite/src/pages/PrazosPage.jsx)
- Detector de prazo similar (eventos via IA): [eventos_extractor_service.py](gestao_advocacia/eventos_extractor_service.py)
