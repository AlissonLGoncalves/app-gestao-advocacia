# Mapeamento de Isolamento Multi-Tenant

## Resumo

- **Estratégia adotada:** `tenant_scoped` decorator + helper `query_for_tenant`.
- **Regra de segurança:** acesso cross-tenant retorna 404 (sem vazar existência do recurso).
- **Defesa adicional:** logs `WARNING` em bloqueios cross-tenant com `user_id`, tenant atual, tenant alvo e endpoint.

---

## Como funciona

Cada recurso pertence a um tenant (escritório) identificado por `tenant_id` (FK para a tabela `tenant`). A função `query_for_tenant(model)` em `helpers/tenant.py` aplica automaticamente filtros de `tenant_id` (e `user_id` quando o modelo possui esse campo) em todas as queries. O decorator `@tenant_scoped` garante que `get_tenant_id()` seja chamado antes do handler, abortando com 401/403 se o usuário não estiver autenticado ou não pertencer a nenhum tenant.

---

## Tabela de modelos

| Modelo | Tabela | `tenant_id` | `user_id` | Filtrado por |
|---|---|---|---|---|
| `Tenant` | `tenant` | — (é o próprio tenant) | ✗ | n/a |
| `User` | `user` | ✓ | ✗ | `tenant_id` |
| `Cliente` | `cliente` | ✓ | ✓ | `tenant_id` + `user_id` |
| `Caso` | `caso` | ✓ | ✓ | `tenant_id` + `user_id` |
| `MovimentacaoCNJ` | `movimentacao_cnj` | ✗ | ✗ | filho de `Caso` (isolado por JOIN) |
| `AuditLog` | `audit_log` | ✓ | ✗ | `tenant_id` |
| `EventoAgenda` | `evento_agenda` | ✓ | ✓ | `tenant_id` + `user_id` |
| `Documento` | `documento` | ✓ | ✓ | `tenant_id` + `user_id` |
| `ContratoHonorario` | `contrato_honorario` | ✓ | ✓ | `tenant_id` + `user_id` |
| `Despesa` | `despesa` | ✓ | ✓ | `tenant_id` + `user_id` |
| `Recebimento` | `recebimento` | ✓ | ✓ | `tenant_id` + `user_id` |
| `TarefaPrazo` | `tarefa_prazo` | ✓ | ✓ | `tenant_id` + `user_id` |
| `DjenOabMonitoramento` | `djen_oab_monitoramento` | ✓ | ✓ | `tenant_id` + `user_id` |
| `PublicacaoDJEN` | `publicacao_djen` | ✓ | ✓ | `tenant_id` + `user_id` |
| `DjenVinculoDecisao` | `djen_vinculo_decisao` | ✗ | ✗ | filho de `PublicacaoDJEN` (isolado por JOIN) |

---

## Rotas e mecanismo de isolamento

Todos os endpoints de listagem usam `query_for_tenant(Model)`. Todos os endpoints de GET/PUT/DELETE por ID usam `get_item_or_404(Model, id)`.

| Rota | Arquivo | Isolado por |
|---|---|---|
| `GET/POST /api/clientes` | `routes/clientes.py` | `query_for_tenant(Cliente)` |
| `GET/PUT/DELETE /api/clientes/<id>` | `routes/clientes.py` | `get_item_or_404(Cliente, id)` |
| `GET/POST /api/casos` | `routes/casos.py` | `query_for_tenant(Caso)` |
| `GET/PUT/DELETE /api/casos/<id>` | `routes/casos.py` | `get_item_or_404(Caso, id)` |
| `GET/POST /api/eventos` | `routes/eventos.py` | `query_for_tenant(EventoAgenda)` |
| `GET/PUT/DELETE /api/eventos/<id>` | `routes/eventos.py` | `get_item_or_404(EventoAgenda, id)` |
| `GET /api/documentos/download/<id>` | `routes/documentos.py` | `get_item_or_404(Documento, id)` |
| `DELETE /api/documentos/<id>` | `routes/documentos.py` | `get_item_or_404(Documento, id)` |
| `POST /api/documentos/upload` | `routes/documentos.py` | `tenant_scoped` + `get_tenant_id()` |
| `GET/POST /api/despesas` | `routes/despesas.py` | `query_for_tenant(Despesa)` |
| `GET/PUT/DELETE /api/despesas/<id>` | `routes/despesas.py` | `get_item_or_404(Despesa, id)` |
| `GET/POST /api/recebimentos` | `routes/recebimentos.py` | `query_for_tenant(Recebimento)` |
| `GET/PUT/DELETE /api/recebimentos/<id>` | `routes/recebimentos.py` | `get_item_or_404(Recebimento, id)` |
| `GET/POST /api/contratos` | `routes/contratos.py` | `query_for_tenant(ContratoHonorario)` |
| `GET/PUT/DELETE /api/contratos/<id>` | `routes/contratos.py` | `get_item_or_404(ContratoHonorario, id)` |
| `GET/POST /api/tarefas` | `routes/tarefas.py` | `query_for_tenant(TarefaPrazo)` |
| `GET/PUT/DELETE /api/tarefas/<id>` | `routes/tarefas.py` | `get_item_or_404(TarefaPrazo, id)` |
| `GET/POST /api/djen/oabs` | `djen_routes.py` | `query_for_tenant(DjenOabMonitoramento)` |
| `DELETE /api/djen/oabs/<id>` | `djen_routes.py` | `get_item_or_404(DjenOabMonitoramento, id)` |
| `GET /api/djen/publicacoes` | `djen_routes.py` | `query_for_tenant(PublicacaoDJEN)` |
| `GET/PATCH /api/djen/publicacoes/<id>` | `djen_routes.py` | `get_item_or_404(PublicacaoDJEN, id)` |

---

## Testes de cobertura

O arquivo `tests/test_tenant_isolation.py` cobre:

- **`test_listagens_nunca_vazam_outro_tenant`** — parametrizado para 9 recursos: garante que listagens de tenant A não retornam nenhum dado de tenant B.
- **`test_cross_tenant_get_put_delete_retorna_404`** — parametrizado para 10 recursos: garante que GET, PUT e DELETE de um ID de tenant B, autenticado como tenant A, retornam 404.
- **`test_usuario_sem_tenant_e_bloqueado`** — garante que um usuário sem `tenant_id` recebe 403 em qualquer endpoint protegido.
- **`test_log_warning_quando_cross_tenant_bloqueado`** — garante que tentativas de acesso cross-tenant produzem log de auditoria com evento `cross_tenant_access_blocked`.

---

## Modelos filhos (sem tenant_id próprio)

`MovimentacaoCNJ` e `DjenVinculoDecisao` não têm `tenant_id` porque são entidades filhas acessadas apenas via JOINs através do modelo pai já isolado (`Caso` e `PublicacaoDJEN` respectivamente). Não existe endpoint que liste ou acesse essas entidades diretamente sem passar pelo pai.

---

## Matriz de modelos x rotas

| Modelo | Tem tenant_id? | Rotas que acessam o modelo | Cada rota filtra por tenant? | Observacoes |
|---|---|---|---|---|
| Tenant | N/A | auth/register (criacao indireta) | N/A | Modelo administrativo, sem CRUD publico dedicado. |
| User | Sim | auth/login, auth/me, auth/invite, auth/register-invite | Parcial | Rotas de autenticacao; tenant_scoped nao se aplica a login/register por design. |
| Cliente | Sim | GET/POST /api/clientes, GET/PUT/DELETE /api/clientes/<id>, POST /api/clientes/<id>/anonimizar | Sim | Listagem e item por query_for_tenant/get_item_or_404. |
| Caso | Sim | GET/POST /api/casos, GET/PUT/DELETE /api/casos/<id>, POST /api/casos/<id>/atualizar-cnj | Sim | Validacoes de cliente e duplicidade com query_for_tenant. |
| MovimentacaoCNJ | Sim | GET /api/casos/<id>/movimentacoes-cnj, atualizar-cnj (escrita) | Sim | Escopo herdado do caso do tenant. |
| EventoAgenda | Sim | GET/POST /api/eventos, GET/PUT/DELETE /api/eventos/<id> | Sim | get_list_query/get_item_or_404. |
| Documento | Sim | GET /api/documentos, POST /api/documentos/upload, GET /api/documentos/download/<id>, DELETE /api/documentos/<id> | Sim | Upload valida caso via query_for_tenant(Caso). |
| Despesa | Sim | GET/POST /api/despesas, GET/PUT/DELETE /api/despesas/<id> | Sim | Validacao de caso com query_for_tenant(Caso). |
| Recebimento | Sim | GET/POST /api/recebimentos, GET/PUT/DELETE /api/recebimentos/<id> | Sim | Validacao de caso com query_for_tenant(Caso). |
| ContratoHonorario | Sim | GET/POST /api/contratos, GET/PUT/DELETE /api/contratos/<id>, POST /api/contratos/<id>/gerar-parcelas | Sim | Criacao valida caso no escopo do tenant. |
| TarefaPrazo | Sim | GET/POST /api/tarefas, GET/PUT/DELETE /api/tarefas/<id> | Sim | Escopo por tenant e user via helpers centrais. |
| AuditLog | Sim | GET /api/auditoria | Sim | Filtro direto por tenant_id e role admin. |
| DjenOabMonitoramento | Sim | GET/POST /api/djen/oabs, DELETE /api/djen/oabs/<id> | Sim | Escopo por tenant + log de tentativa cross-tenant por ID. |
| PublicacaoDJEN | Sim | GET /api/djen/publicacoes, GET/PATCH /api/djen/publicacoes/<id>, GET /api/djen/triagem, acoes de triagem | Sim | Escopo por tenant em todas as consultas; log cross-tenant em detalhe/patch/certidao. |
| DjenVinculoDecisao | Sim | GET /api/djen/qualidade, escrita nas acoes de triagem | Sim | Consultas por tenant e escrita derivada de publicacao scoped. |

## Vulnerabilidades identificadas e corrigidas

1. get_item_or_404 retornava 403 em acesso cross-tenant.
- Correcao: agora retorna 404 e gera log WARNING estruturado.

2. Diversas rotas CRUD usavam Model.query.filter_by(user_id=...) sem blindagem central.
- Correcao: adotado query_for_tenant para listagens/validacoes e tenant_scoped em rotas CRUD.

3. Usuario sem tenant podia passar por algumas rotas sem bloqueio central.
- Correcao: get_tenant_id agora bloqueia tenant_id nulo com 403.

4. Rotas DJEN por ID retornavam 404 sem telemetria de tentativa cross-tenant.
- Correcao: helper de lookup scoped com logging de violacao em DjenOabMonitoramento/PublicacaoDJEN.
