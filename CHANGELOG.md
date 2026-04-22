# Changelog

Todos os releases significativos do Sistema de Gestao para Advocacia.
Segue [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [1.5.0] - 2026-04-22

Drenagem do backlog de 8 PRs empilhados (S1-S4, A2, A3, B1, C0-C3), todos
rebasados sobre `main` pós-v1.4.0 (pós-S8 e pós-migração para Fly). Narrativa
completa do "como chegamos nas soluções" em
[`docs/sessao-2026-04-22-backlog-pipeline.md`](docs/sessao-2026-04-22-backlog-pipeline.md).

### Security

- **[S1]** IDOR fix de tenant em contratos e vínculos DJEN (404 em vez de 403
  para evitar enumeração) — PR #75.
- **[S2]** Rate limiting em `/login` (5/min), `/register` (3/min),
  `/register-invite` (10/min) via Flask-Limiter memory storage — PR #76.
- **[S3]** Política de senha forte (≥10, upper, digit, special) + invite
  48h configurável via `INVITE_TOKEN_HOURS` — PR #77.
- **[S4]** Validação de MIME real via `python-magic` em uploads (não confia
  mais no header do cliente) + whitelist explícita de CORS — PR #78.

### Added

- **[A2]** Versionamento de Termos de Uso e Política LGPD como markdown
  hasheado (SHA-256). Servidor envia `X-Terms-Version`/`X-LGPD-Version`;
  cliente força re-aceite quando muda — PR #79.
- **[A3]** Auditoria persistente de login em tabela `login_audit`
  (user_id, ip mascarado, user_agent, success, motivo, timestamp). Exposta
  na PerfilPage — PR #80.
- **[B1]** Cadastro completo do advogado (nome, CPF com lock após primeiro
  save, tipo_pessoa, OAB split em número + sigla+tribunal) + `PerfilPage`
  unificada com formulário + histórico de login — PR #81.
- **[C0-C3]** Chain Gemini: `GEMINI_API_KEY` como secret, extração de
  procuração via Gemini (`procuracao_analise` + worker), UI de upload +
  revisão, auto-vinculação de processo extraído ao criar cliente — PR #82.

### Fixed

- **Migration ENUM `procuracao_analise_status`**: `DuplicateObject` em
  `release_command` do Fly. Solução final: `postgresql.ENUM(...,
  create_type=False)` na Column (não `sa.Enum`, que ignora o flag) +
  checagem explícita em `pg_type` antes do `.create()`. Três commits de
  deploy iterativo (`5a4481d`, `63e10f4`, `1655fdf`).
- **Colisão de migration IDs**: dois PRs antigos usavam IDs que já existiam
  em main (B1 `e4f5a6b7c8d9`, C1 `e6f7a8b9c0d1`). Renomeados para
  `b1a1c2d3e4f5` e `c1a2b3c4d5e6`; `flask db merge heads` gerou
  `37428aed96da` e `80366d78be69`.
- **Conflict markers órfãos em `PrazosPage.jsx` e `DjenPage.jsx`**:
  cherry-pick do C3 deixou `<<<<<<< HEAD` no arquivo; pytest passou mas
  `npm run build` falhou. Lição incorporada: `npm run build` é obrigatório
  antes de considerar um rebase pronto.

## [1.4.0] - 2026-04-21

Ciclo de consolidação da camada de API no frontend (refatoração S8) +
correção de 4 bugs críticos de produção que estavam impedindo login.
Documentação técnica detalhada em
[`docs/sessao-2026-04-21-s8-e-fixes-producao.md`](docs/sessao-2026-04-21-s8-e-fixes-producao.md).

### Added

- **S8** `src/api/client.js` canônico no frontend — cliente HTTP único com
  `get`, `post`, `postForm`, `put`, `patch`, `del`, `upload`, `getBlob`.
  Headers `X-Terms-Version`/`X-LGPD-Version` obrigatórios. Handler global
  de `401` que limpa `localStorage` e redireciona pra `/login`.
- **S8.x** Módulos `src/api/<recurso>.js` para cada domínio (clientes,
  casos, documentos, financeiro, agenda, DJEN, procurações) — todas as
  chamadas `fetch` diretas em componentes/páginas foram migradas.
- Documento de handoff `.github/tasks/S8-handoff-rebase.md` com
  procedimento de rebase + regras de conflito (`--ours client.js`,
  `--theirs <recurso>.js`).

### Changed

- `fly.toml` — `[http_service.concurrency]` elevado de 25/20 para 50/40
  (`hard_limit`/`soft_limit`) para lidar com DJEN auto-sync simultâneo.
- Backend CORS/CSP — frontend aponta exclusivamente para
  `app-gestao-advocacia.fly.dev`; shim legado `onrender.com` removido de
  `config.js` e do `connect-src` do `vercel.json`.

### Fixed

- **Login quebrado em produção** (PR #68): `@auth_ns.marshal_with(...)`
  em `routes/auth.py` interceptava tuplas `({"message": ...}, 401)` e
  serializava como sucesso (retornando 200 com `access_token: null`).
  Substituído por `@auth_ns.response(200, "...", token_model_dto)`.
- **Handler global de erro HTTP** (`app_runtime.py`): retornava objeto
  Werkzeug cru (HTML) em vez de JSON. Agora usa
  `jsonify({"message": error.description}), error.code`.
- **Loop de redirect em `/api/v1/...`** (`app.py`): o blueprint legacy
  `/api/*` redirecionava requests que já começavam com `v1/` causando
  308 infinito. Adicionado guard `if subpath.startswith("v1/"): abort(404)`.
- **CVE-2026-28684**: `python-dotenv` bumpado de 1.1.0 para 1.2.2
  (regeneração de `requirements.lock` com hashes).
- **DJEN search**: requests por keystroke eliminados via `filtrosRef`
  (ref em vez de state para comparação), reduzindo carga no Fly em ~90%.
- **Pool de conexões Postgres resiliente** (commit `d338332`):
  `SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True, "pool_recycle": 280}`.
  Elimina `psycopg2.OperationalError: SSL connection has been closed
  unexpectedly` quando a máquina Fly dorme (auto-stop) e as conexões
  do pool morrem no servidor Postgres.
- **Migration DJEN out-of-order** (commit `fc01012`): a migration
  `add_djen_tables` tinha dependência anterior a `add_tenant_module`,
  quebrando `flask db upgrade` em schema vazio. Corrigida a ordem
  `down_revision`.

### Infra

- **Postgres migrado para Fly `gru`** — o banco de produção estava no
  Render (`oregon-postgres.render.com`) apesar da API estar no Fly. Após
  a deleção do Render, foi criado um Postgres gerenciado no Fly na mesma
  região da API (`gru`), eliminando latência cross-region e isolando
  toda a stack numa única plataforma. Dados anteriores perdidos
  (ambiente de desenvolvimento, não comercializado). Detalhes em
  [`docs/sessao-2026-04-21-s8-e-fixes-producao.md`](docs/sessao-2026-04-21-s8-e-fixes-producao.md#c1-incidente).

### Removed

- **Render.com** como alternativa ativa de backend — o deploy no Render
  é zumbi; Fly é a única plataforma oficial. Menções ativas a
  `onrender.com` em código foram removidas; docs históricos preservados.

## [1.3.0] - 2026-04-21

Ciclo focado em usabilidade e produtividade no uso diário. Todas as melhorias
foram voltadas para o fluxo real de um advogado — menos cliques, mais contexto.

### Added

- **DJEN auto-sync**: sincronização automática dos diários de justiça ao abrir o app
  (via `sessionStorage` guard, uma vez por dia, via `triggerDjenSync` no Dashboard)
- **Dashboard — briefing diário**: seção "Atenção — Hoje" com pills clicáveis para
  publicações DJEN pendentes, tarefas vencidas, tarefas com vencimento hoje e eventos do dia
- **Agenda — toggle Calendário / Lista**: `AgendaPage` agora integra o `CalendarView`
  (FullCalendar) que já existia mas nunca era exibido; preferência salva em `localStorage`
- **Prazos — Kanban com destaque de urgência**: cartões vencidos recebem borda vermelha e
  badge "Vencido há X dias"; botão de edição inline; agendamento por grupo de urgência na
  vista Lista (7 grupos: Vencidos / Hoje / Amanhã / Esta semana / Próximos / Sem prazo / Concluídos)
- **Sidebar — badges numéricos**: DJEN mostra contagem de triagem pendente; Prazos mostra
  soma de tarefas vencidas + vencendo hoje; ambos atualizam a cada navegação
- **Busca global no header**: campo expandível que pesquisa casos e clientes em paralelo
  com debounce 300 ms; resultados agrupados, máximo 5 por categoria (`GlobalSearch.jsx`)
- **Modal de confirmação Bootstrap** (`useConfirm` hook): substituiu `window.confirm` em
  9 arquivos — CasoList, ClienteList, EventoAgendaList, DespesaList, RecebimentoList,
  ClienteForm, DocumentoList, HonorariosCasoCard, DjenPage
- **Empty states com CTAs** (`EmptyState.jsx`): listas vazias agora exibem ícone da entidade
  + botão "Novo X" quando realmente sem dados; ícone de lupa + "Limpar filtros" quando há
  filtros ativos sem resultados — aplicado em 6 listas
- **Preview de documentos**: botão 👁 em DocumentoList abre modal `modal-xl` com
  renderização nativa de PDFs (iframe) e imagens (img); outros tipos exibem fallback com download
- **Toast personalizado no login**: exibe `"Bem-vindo, [nome]! ✓"` usando o nome do usuário

### Changed

- `dashboard.py`: adicionadas queries de `tarefas_vencidas` e `tarefas_vencendo_hoje`
  ao endpoint `/dashboard/stats` (resposta expandida com `alertas_tarefas`)

### Security

- **[S1][SEC]** Fechado IDOR multi-tenant em vinculo de contratos e vinculo
  de publicacoes DJEN, reforcando filtro por tenant e retorno 404 para
  evitar enumeracao entre tenants.

## [1.2.0] - 2026-04-18

Ciclo grande de refatoracao, hardening e observabilidade. Todas as tarefas do
roadmap `.github/tasks/` (C1-C4, N1-N5, T1-T5) foram concluidas e mergeadas.

### Added

- **N1** Suite de testes de frontend (Vitest + React Testing Library, ~57 testes)
- **N3** Versionamento de API publicado em `/api/v1` (retrocompatibilidade mantida)
- **N4** Logging estruturado com request IDs e niveis configuraveis via `LOG_LEVEL` (`docs/logging.md`)
- **T5** Documentacao OpenAPI/Swagger automatica em `/api/v1/docs` e `/api/v1/openapi.json`
- **T1** README expandido com secoes de Deploy, Documentacao complementar e Licenca
- **T2** `.env.example` backend e frontend documentando todas as variaveis
- **CHANGELOG.md** (este arquivo)

### Changed

- **C3** Refatoracao estrutural: `app.py` passou de 790 para 115 linhas. Rotas, models e servicos extraidos para modulos dedicados em `routes/`, `models/`, `services/`
- **C1** Isolamento multi-tenant reforcado com invariantes documentadas (`docs/tenant-isolation.md`)
- **C2** Pipeline de CI completo (GitHub Actions): jobs `backend`, `backend-style`, `frontend`
- **N2** Formularios grandes quebrados em componentes menores
- **N5** Dependencias pinadas via `pip-compile` com `requirements.lock` + hashes
- **T3** Padronizacao de estilo: `ruff` + `black` (backend), `eslint` + `prettier` (frontend), rodando no CI

### Removed

- **C4/T4** Scripts scratch e artefatos locais removidos da raiz; scripts operacionais movidos para `scripts/maintenance/`

### Fixed

- Estabilizacao do job `backend-style` no CI (versoes exatas de `ruff==0.8.2` e `black==24.10.0`)

## [1.1.1] - anterior

Versao base do ciclo atual. Historico anterior nao formalizado neste CHANGELOG.

[1.5.0]: https://github.com/AlissonLGoncalves/app-gestao-advocacia/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/AlissonLGoncalves/app-gestao-advocacia/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/AlissonLGoncalves/app-gestao-advocacia/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/AlissonLGoncalves/app-gestao-advocacia/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/AlissonLGoncalves/app-gestao-advocacia/releases/tag/v1.1.1
