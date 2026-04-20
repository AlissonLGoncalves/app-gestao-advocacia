# [D3] Direito ao esquecimento (LGPD art. 18)

> ⚠️ **ANTES DE COMEÇAR — leia `.github/tasks/README.md` e `ROADMAP-2026-Q2.md`.**
> 🚫 **NÃO use `Co-Authored-By`** em commits.

**Prioridade:** 🟡 Média (compliance LGPD)
**Track:** D — Qualidade de vida
**Depende de:** A1, B1
**Estimativa:** 5-6 horas

## Problema

LGPD art. 18 garante ao titular o direito de solicitar eliminação dos dados. Hoje não há mecanismo — usuário fica permanentemente no banco.

## Complexidade

Alguns registros **não podem** ser apagados por obrigação legal ou contratual:
- `ContratoHonorario` — valor probatório
- `Recebimento`, `Despesa` — obrigação fiscal (5 anos)
- `Auditoria` de sistema — segurança

A estratégia é **anonimizar** esses registros e **deletar** o resto.

## Tarefas

### Backend

1. **Migration** — adicionar `deleted_at` (datetime nullable) em `User` e `Tenant`.
2. **`DELETE /auth/me`** (`jwt_required`) com confirmação por senha no body:
   - Marca `User.deleted_at = now()` e `Tenant.deleted_at = now()` (soft delete)
   - Em todas as queries ativas, filtrar `deleted_at IS NULL`
   - Invalida JWT atual (adicionar JTI a blacklist)
3. **Job cron** `deletar_contas_vencidas`:
   - Roda diariamente
   - Para cada `User/Tenant` com `deleted_at < now() - 30 dias`:
     - Anonimizar: `email='anonimizado-{id}@apagado'`, `nome_completo='[Removido]'`, `cpf=NULL`
     - Para Cliente relacionado: se houver `ContratoHonorario` ou registros fiscais, anonimizar nome/CPF. Senão, deletar fisicamente.
     - Apagar `ConsentimentoUsuario` (já prestou serviço)
     - Manter `LoginAudit` com `user_id=NULL`

### Frontend

4. Em `PerfilPage.jsx`, seção "Zona de perigo":
   - Botão vermelho "Excluir minha conta"
   - Modal: "Esta ação é irreversível após 30 dias. Dados fiscais serão anonimizados. Digite sua senha para confirmar."
   - Após sucesso: logout + mensagem "Conta marcada para exclusão. Você tem 30 dias para cancelar entrando em contato pelo suporte."

### Testes

- soft delete marca timestamp, JWT invalidado
- queries filtram deleted
- job anonimiza corretamente respeitando registros fiscais
- delete com senha errada → 401

## Critérios de aceite

- [ ] Soft delete funciona, usuário some do app
- [ ] Job cron configurado no APScheduler
- [ ] Anonimização preserva integridade de registros fiscais
- [ ] Mensagem clara sobre janela de 30 dias
- [ ] Testes passando
- [ ] CI verde

## Branch e PR

- Branch: `feat/d3-direito-esquecimento`
- Título PR: `[D3] Direito ao esquecimento (LGPD art. 18) — soft delete + anonimização`
