# [A3] Auditoria persistente de login

> ⚠️ **ANTES DE COMEÇAR — leia `.github/tasks/README.md` e `ROADMAP-2026-Q2.md`.**
> 🚫 **NÃO use `Co-Authored-By`** em commits.

**Prioridade:** 🔴 Crítica (compliance, segurança)
**Track:** A — Compliance
**Depende de:** B1 (para tela de histórico no perfil)
**Estimativa:** 3-4 horas

## Problema

`UserLogin.post()` (`routes/auth.py`) faz `app.logger.info("login_success")` e `app.logger.warning("login_failed")`, mas **não persiste** em tabela. Logs estruturados vão para stdout/Fly e somem após rotação. Auditoria LGPD e investigação de incidentes exigem histórico persistente.

## Tarefas

### Backend

1. **Migration** — tabela `login_audit`:
   - `id` (PK), `user_id` (FK `user`, nullable — falha pode não ter user),
     `email_tentativa` (str 120), `sucesso` (bool),
     `ip` (str 45), `user_agent` (str 500),
     `motivo_falha` (str 50, nullable: `invalid_credentials`, `user_not_found`, `account_locked`),
     `criado_em` (datetime, index)
2. **Modelo** `LoginAudit` em `models/__init__.py`.
3. **`UserLogin.post()`**: criar registro em ambos os casos:
   - sucesso → `sucesso=True`, `motivo_falha=None`
   - falha → `sucesso=False`, `motivo_falha` apropriado
4. **`GET /auth/me/historico-login?limit=50`** (`jwt_required`) retorna últimos logins do user com IP mascarado (`1.2.3.*`).

### Frontend

Em `PerfilPage.jsx` (criado em B1), adicionar seção **"Histórico de acesso"**:
- Tabela com últimas 10 entradas: data/hora, IP mascarado, sucesso/falha, motivo
- Link "Ver todos" abre modal com limit=50

## Testes

`gestao_advocacia/tests/test_login_audit.py`:
- login ok → registro com `sucesso=True`
- login fail senha → `sucesso=False`, `motivo_falha='invalid_credentials'`
- login fail user inexistente → `sucesso=False`, `motivo_falha='user_not_found'`, `user_id=None`
- `/historico-login` retorna lista ordenada desc por data

## Critérios de aceite

- [ ] Migration + modelo criados
- [ ] Login success e fail registrando corretamente
- [ ] IP mascarado no endpoint
- [ ] Seção no perfil renderizando
- [ ] Testes backend 4/4 passando
- [ ] CI verde

## Branch e PR

- Branch: `feat/a3-login-audit`
- Título PR: `[A3] Auditoria persistente de login (tabela login_audit)`
