# Scripts de manutencao

Este diretorio concentra scripts administrativos que nao devem ficar na raiz do repositorio.

## Estado dos scripts do C4

| Script original | Status | Acao |
|---|---|---|
| corrigir_tenants_prod.py | Util | Movido para scripts/maintenance e com dry-run padrao |
| limpar_tenant_id.py | Util | Movido para scripts/maintenance e com dry-run padrao |
| diagnostico.py | Util | Movido para scripts/maintenance |
| diagnostico_prod.py | Util | Movido para scripts/maintenance |
| verificar_isolation.py | Util | Movido para scripts/maintenance |
| add_contratos_api_patch.py | Obsoleto | Removido (patch pontual ja aplicado no passado) |

## corrigir_tenants_prod.py
O que faz: gera backup CSV das linhas afetadas e corrige tenant_id de um usuario especifico em tabelas multi-tenant.
Quando usar: incidente de dados orfaos em ambiente remoto apos migracao/importacao.
Pre-requisitos: backup recente do banco, DATABASE_URL valida, acesso administrativo.
Como executar (dry-run padrao):
python scripts/maintenance/corrigir_tenants_prod.py --db "<DATABASE_URL>" --user-id 2 --tenant-name "Tenant Corrigido"
Como executar aplicando alteracoes:
python scripts/maintenance/corrigir_tenants_prod.py --db "<DATABASE_URL>" --user-id 2 --tenant-name "Tenant Corrigido" --execute
Perigos: altera dados reais e cria tenant novo quando executado com --execute.

## limpar_tenant_id.py
O que faz: identifica registros com tenant_id nulo e usa tenant_id do usuario dono para preencher.
Quando usar: limpeza corretiva apos detectar registros orfaos no banco principal.
Pre-requisitos: variaveis de ambiente configuradas para o backend, backup do banco e janela de manutencao.
Como executar (dry-run padrao):
python scripts/maintenance/limpar_tenant_id.py
Como executar aplicando alteracoes:
python scripts/maintenance/limpar_tenant_id.py --execute
Perigos: pode propagar mapeamentos incorretos se houver user_id inconsistente.

## diagnostico.py
O que faz: diagnostico local detalhado de usuarios e clientes com/sem tenant_id.
Quando usar: investigacao local de inconsistencias de isolamento.
Pre-requisitos: ambiente local configurado, banco acessivel e app Flask configurada.
Como executar:
python scripts/maintenance/diagnostico.py
Perigos: somente leitura.

## diagnostico_prod.py
O que faz: consultas somente leitura para inspecionar isolamento por tenant_id no banco remoto.
Quando usar: triagem rapida em producao sem alterar dados.
Pre-requisitos: DATABASE_URL do ambiente alvo.
Como executar:
python scripts/maintenance/diagnostico_prod.py --db "<DATABASE_URL>"
python scripts/maintenance/diagnostico_prod.py --db "<DATABASE_URL>" --cpf 62985302668
Perigos: somente leitura.

## verificar_isolation.py
O que faz: imprime visao consolidada de usuarios, clientes e casos com tenant_id.
Quando usar: validacao manual de isolamento apos migracoes e ajustes.
Pre-requisitos: ambiente local configurado para executar create_app().
Como executar:
python scripts/maintenance/verificar_isolation.py
Perigos: somente leitura.
