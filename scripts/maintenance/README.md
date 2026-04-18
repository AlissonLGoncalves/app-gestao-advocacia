# Scripts de Manutenção

Scripts operacionais para uso em situações específicas de produção.

> ⚠️ **SEMPRE faça backup antes de rodar scripts que escrevem no banco.**
> ⚠️ **Nunca rode estes scripts diretamente no pipeline de CI/CD.**

---

## corrigir_tenants_prod.py

**O que faz:** Corrige `tenant_id` de um usuário específico — cria um tenant se necessário, faz backup CSV dos registros afetados em `backups/<timestamp>/` e preenche `tenant_id` em todas as tabelas que estavam com NULL para aquele `user_id`.

**Quando usar:** Após falha de migração que deixou registros órfãos de tenant para um usuário específico.

**Pré-requisitos:** `DATABASE_URL` do banco de produção, backup recente confirmado.

**Como executar:**
```bash
# Dry-run implícito: sem --yes, o script pergunta confirmação
python scripts/maintenance/corrigir_tenants_prod.py \
  --db "postgresql://user:pass@host:5432/dbname" \
  --user-id 2 \
  --tenant-name "Nome do Tenant"

# Execução direta sem confirmação interativa:
python scripts/maintenance/corrigir_tenants_prod.py \
  --db "postgresql://..." --user-id 2 --tenant-name "Nome" --yes
```

**Perigos:** Modifica dados de produção. Sempre confirme o `--user-id` e tenha backup antes.

---

## diagnostico.py

**O que faz:** Diagnóstico local — lista todos os usuários, clientes órfãos (sem `tenant_id`) e clientes com `tenant_id`, conectando via app Flask com `.env` local.

**Quando usar:** Debugging de isolamento em ambiente local ou de staging.

**Pré-requisitos:** `.env` configurado na raiz com `DATABASE_URL` válida.

**Como executar:**
```bash
python scripts/maintenance/diagnostico.py
```

**Perigos:** Apenas leitura. Sem risco.

---

## diagnostico_prod.py

**O que faz:** Diagnóstico somente leitura — conta clientes por `tenant_id`, lista usuários, identifica registros com `tenant_id IS NULL`. Conecta diretamente via `DATABASE_URL` sem usar o app Flask.

**Quando usar:** Verificação rápida de isolamento em produção sem precisar de deploy.

**Pré-requisitos:** `DATABASE_URL` do banco de produção (Postgres).

**Como executar:**
```bash
python scripts/maintenance/diagnostico_prod.py --db "postgresql://..."
# Ou com variável de ambiente:
DATABASE_URL="postgresql://..." python scripts/maintenance/diagnostico_prod.py

# Filtrar por CPF específico:
python scripts/maintenance/diagnostico_prod.py --db "postgresql://..." --cpf 62985302668
```

**Perigos:** Apenas leitura. Sem risco.

---

## limpar_tenant_id.py

**O que faz:** Atribui `tenant_id` a todos os registros órfãos (com `tenant_id = NULL`) em todas as tabelas, baseando-se no `tenant_id` do usuário dono (`user_id`). Usa o app Flask e `.env` local.

**Quando usar:** Após migração que não propagou `tenant_id` para tabelas existentes.

**Pré-requisitos:** `.env` configurado, banco acessível, backup recente.

**Como executar:**
```bash
python scripts/maintenance/limpar_tenant_id.py
```

**Perigos:** Escreve no banco apontado por `DATABASE_URL`. Faça backup antes.

---

## verificar_isolation.py

**O que faz:** Lista todos os usuários, clientes e casos com seus respectivos `tenant_id`, para inspeção visual do isolamento multi-tenant. Usa o app Flask com `.env` local.

**Quando usar:** Verificação pós-deploy ou após qualquer operação que possa ter comprometido o isolamento.

**Pré-requisitos:** `.env` configurado.

**Como executar:**
```bash
python scripts/maintenance/verificar_isolation.py
```

**Perigos:** Apenas leitura. Sem risco.
