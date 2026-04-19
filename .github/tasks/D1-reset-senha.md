# [D1] Reset de senha por email

> ⚠️ **ANTES DE COMEÇAR — leia `.github/tasks/README.md` e `ROADMAP-2026-Q2.md`.**
> 🚫 **NÃO use `Co-Authored-By`** em commits.

**Prioridade:** 🟡 Média (UX)
**Track:** D — Qualidade de vida
**Depende de:** —
**Estimativa:** 4-5 horas

## Problema

`mail_service` já existe e é usado em `/auth/invite`, mas **não há fluxo de reset de senha**. Usuário que esquece fica travado.

## Tarefas

### Backend

1. **`POST /auth/forgot-password`** (público) `{email}`:
   - Gera JWT curto (1h, `type='reset'`, `sub=user_id`)
   - Envia email com link `FRONTEND_URL/reset-password?token=xxx`
   - **Sempre retorna 200** (não revela se email existe — proteção enumeration)
2. **`POST /auth/reset-password`** (público) `{token, nova_senha}`:
   - Valida JWT (`type=='reset'`, não expirado)
   - `new_user.set_password(nova_senha)`
   - Registra token em tabela `token_usado` para invalidar reuso
3. **Migration** tabela `token_usado`:
   - `id`, `jti` (str unique, do JWT), `usado_em` (datetime)

### Frontend

4. `src/pages/auth/ForgotPasswordPage.jsx` — form de email, rota `/forgot-password`.
5. `src/pages/auth/ResetPasswordPage.jsx` — form de nova senha (2x), lê `token` do query string, rota `/reset-password`.
6. Link "Esqueci minha senha" em `LoginPage.jsx`.

### Testes

- forgot-password sempre retorna 200
- reset-password com token válido troca senha
- reset-password com token usado → 400
- reset-password com token expirado → 400

## Critérios de aceite

- [ ] Fluxo end-to-end testado em dev
- [ ] Email renderiza link correto com FRONTEND_URL
- [ ] Token não pode ser reutilizado
- [ ] 4 testes backend passando
- [ ] CI verde

## Branch e PR

- Branch: `feat/d1-reset-senha`
- Título PR: `[D1] Reset de senha por email`
