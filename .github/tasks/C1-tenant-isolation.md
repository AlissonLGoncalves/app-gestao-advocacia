# [C1] Auditoria e blindagem de isolamento multi-tenant

> ⚠️ **ANTES DE COMEÇAR — leia `.github/tasks/README.md`.**
> 🥇 **Regra de ouro:** uma tarefa crítica por vez. Esta é a PRIMEIRA. Nenhuma outra crítica pode estar em andamento.
> 🚫 **NÃO use `Co-Authored-By`** em commits — quebra o deploy no Vercel Hobby.

**Prioridade:** 🔴 Crítica
**Bloqueia:** C3
**Estimativa:** 2-3 dias

## Contexto

O app é multi-tenant (cada tenant = um escritório de advocacia). Nos últimos meses houve 4+ correções seguidas de problemas de isolamento (commits `1a2a578`, `26ca6e1`, `066e4bc`, `4a6e7ea`, `575d1a0`). Isso é um padrão perigoso: risco real de um tenant enxergar ou alterar dados de outro. Precisamos fechar isso de vez com testes, não mais com patches pontuais.

## Tarefas

1. **Mapear modelos e rotas.** Ler `gestao_advocacia/app.py` e qualquer módulo de rotas (`djen_routes.py` etc.). Criar `docs/tenant-isolation.md` com uma tabela:
   - coluna 1: Modelo
   - coluna 2: Tem `tenant_id`? (sim/não/N/A)
   - coluna 3: Rotas que acessam o modelo
   - coluna 4: Cada rota filtra por tenant? (sim/não)
   - coluna 5: Observações
2. **Escrever testes de isolamento** em `gestao_advocacia/tests/test_tenant_isolation.py`. Para CADA endpoint CRUD do app, verificar:
   - Tenant A não lê recurso do Tenant B → retorna 404 (não 403, para não vazar existência)
   - Tenant A não edita (PUT/PATCH) recurso do Tenant B → 404
   - Tenant A não deleta recurso do Tenant B → 404
   - `GET` de listagem nunca inclui itens de outro tenant
   - Usuário sem `tenant_id` é bloqueado (não retorna dados globais)
3. **Corrigir as falhas** encontradas pelos testes. Fazer o mínimo necessário — não refatorar além disso.
4. **Defesa em profundidade.** Implementar um dos dois:
   - **Opção A (preferida):** SQLAlchemy event listener (`before_compile` ou query class) que injeta filtro `tenant_id = current_tenant` automaticamente em todas as queries dos modelos multi-tenant.
   - **Opção B:** Decorator `@tenant_scoped` aplicado a todas as rotas, com helper `query_for_tenant(Model)` em vez de `Model.query`.
5. **Logar violações.** Quando um acesso cross-tenant for bloqueado, logar `WARNING` com `user_id`, `tenant_id_atual`, `tenant_id_alvo`, `endpoint`.

## Critérios de aceite

- [ ] `docs/tenant-isolation.md` criado com tabela completa de modelos × rotas.
- [ ] `test_tenant_isolation.py` cobre 100% das rotas CRUD do app.
- [ ] Todos os testes de isolamento passam.
- [ ] Suite de testes pré-existente continua passando (não quebrar nada).
- [ ] Opção A ou B de defesa em profundidade implementada.
- [ ] Log de violação cross-tenant funcionando (testado).
- [ ] PR descreve quais vulnerabilidades foram encontradas e corrigidas.

## Fora de escopo

- Refatoração de `app.py` (é a tarefa C3).
- Mudanças no frontend.
- Features novas.

## Dicas

- Helpers existentes: `get_tenant_id()`, `get_list_query()`, `get_item_or_404()`. Verifique se são usados consistentemente.
- Use `pytest` fixtures para criar dois tenants com dados e um usuário em cada.
- Não tente cobrir tudo em um único teste gigante — um teste por endpoint/operação.
