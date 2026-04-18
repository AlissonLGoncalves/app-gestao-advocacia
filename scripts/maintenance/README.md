# Scripts de Manutencao

Esta pasta concentra scripts operacionais e de diagnostico que nao fazem parte do runtime da aplicacao.

## Regras

- Scripts que alteram dados devem operar em dry-run por padrao.
- Para aplicar alteracoes, o operador deve passar um flag explicito de execucao.
- Scripts legados de correcao de tenant foram removidos por estarem cobertos pela implementacao multi-tenant em producao.

## Scripts atuais

- `clean-local-artifacts.ps1`: remove artefatos locais de desenvolvimento.
  - Dry-run (padrao):
    - `powershell -File scripts/maintenance/clean-local-artifacts.ps1`
  - Execucao real:
    - `powershell -File scripts/maintenance/clean-local-artifacts.ps1 -Execute`

- `diagnostico.py`: diagnostico local (ORM) para inspecao de tenant em dados de desenvolvimento.

- `diagnostico_prod.py`: diagnostico por SQLAlchemy/Core para auditoria de tenant em base remota.
