# Tenant Isolation Audit

## Resumo

- Estrategia adotada: Opcao B (decorator tenant_scoped + helper query_for_tenant).
- Regra de seguranca: acesso cross-tenant retorna 404 (sem vazar existencia).
- Defesa adicional: logs WARNING em bloqueios cross-tenant contendo user_id, tenant atual, tenant alvo e endpoint.

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
