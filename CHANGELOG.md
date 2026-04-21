# Changelog

Todos os releases significativos do Sistema de Gestao para Advocacia.
Segue [Semantic Versioning](https://semver.org/lang/pt-BR/).

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

[1.3.0]: https://github.com/AlissonLGoncalves/app-gestao-advocacia/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/AlissonLGoncalves/app-gestao-advocacia/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/AlissonLGoncalves/app-gestao-advocacia/releases/tag/v1.1.1
