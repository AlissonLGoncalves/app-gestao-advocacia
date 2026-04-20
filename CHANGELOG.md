# Changelog

Todos os releases significativos do Sistema de Gestao para Advocacia.
Segue [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Security

- [S1][SEC] Fechado IDOR multi-tenant em vinculo de contratos e vinculo de publicacoes DJEN, reforcando filtro por tenant e retorno 404 para evitar enumeracao entre tenants.

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

[1.2.0]: https://github.com/AlissonLGoncalves/app-gestao-advocacia/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/AlissonLGoncalves/app-gestao-advocacia/releases/tag/v1.1.1
