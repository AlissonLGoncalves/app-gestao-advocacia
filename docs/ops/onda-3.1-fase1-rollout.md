# Onda 3.1 - Fase 1: rollout pos-merge

Este runbook cobre apenas passos operacionais depois do merge da
migration `e1f2a3b4c5d6_create_rls_roles` na `main`.

A migration cria os roles `app_admin` (BYPASSRLS) e `app_user` (sem
BYPASSRLS), mas nao define senha e nao altera secrets automaticamente.

Importante:

- RLS ainda nao e habilitado em tabelas na Fase 1.
- A senha do `postgres` superuser ja foi rotacionada em 2026-04-26
  apos vazamento em probe e permanece somente em secret do Fly.

## Pre-requisitos

- PR da Fase 1 mergeado na `main`.
- Deploy automatico do backend concluido com sucesso.
- Migration `e1f2a3b4c5d6` aplicada no release.
- Acesso ao app Fly e ao banco `patronus-db` via `flyctl`.

## 1. Gerar senhas fortes

PowerShell (Windows):

```powershell
$bytes = New-Object byte[] 24
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$admin = -join ($bytes | ForEach-Object { '{0:x2}' -f $_ })
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$user = -join ($bytes | ForEach-Object { '{0:x2}' -f $_ })

Write-Host "app_admin: $admin"
Write-Host "app_user:  $user"
```

bash:

```bash
admin=$(openssl rand -hex 24)
user=$(openssl rand -hex 24)
echo "app_admin: $admin"
echo "app_user:  $user"
```

Salvar as duas senhas em cofre seguro antes de prosseguir.

## 2. Aplicar `ALTER ROLE ... WITH PASSWORD`

```bash
flyctl postgres connect -a patronus-db
```

No `psql`:

```sql
ALTER ROLE app_admin WITH PASSWORD '<senha_app_admin>';
ALTER ROLE app_user  WITH PASSWORD '<senha_app_user>';

SELECT rolname, rolbypassrls
FROM pg_roles
WHERE rolname IN ('app_admin', 'app_user');
-- esperado: app_admin=true, app_user=false

\q
```

## 3. Atualizar secrets do app no Fly

```bash
flyctl secrets set \
  DATABASE_URL_ADMIN="postgres://app_admin:<senha_app_admin>@patronus-db.flycast:5432/postgres" \
  -a app-gestao-advocacia

flyctl secrets set \
  DATABASE_URL="postgres://app_user:<senha_app_user>@patronus-db.flycast:5432/postgres" \
  -a app-gestao-advocacia
```

Cada comando dispara rolling deploy. Acompanhar:

```bash
flyctl status -a app-gestao-advocacia
```

## 4. Smoke obrigatorio

Sem token JWT:

```bash
curl -i https://app-gestao-advocacia.fly.dev/api/v1/casos/1/timeline
```

Esperado: HTTP `401`.

Resultado diferente de `401` (ex.: `500`) deve ser tratado antes de
seguir para qualquer fase seguinte.

## 5. Rotacao de emergencia

Se qualquer senha de role vazar, rotacionar imediatamente:

1. Gerar senha nova.
2. Executar `ALTER ROLE ... WITH PASSWORD` no `patronus-db`.
3. Atualizar o secret correspondente com `flyctl secrets set`.
4. Validar com smoke (`/api/v1/casos/1/timeline` sem token -> `401`).

Rotacao rapida apenas de `app_user`:

```sql
ALTER ROLE app_user WITH PASSWORD '<nova_senha_app_user>';
```

```bash
flyctl secrets set \
  DATABASE_URL="postgres://app_user:<nova_senha_app_user>@patronus-db.flycast:5432/postgres" \
  -a app-gestao-advocacia
```

Rotacao rapida apenas de `app_admin`:

```sql
ALTER ROLE app_admin WITH PASSWORD '<nova_senha_app_admin>';
```

```bash
flyctl secrets set \
  DATABASE_URL_ADMIN="postgres://app_admin:<nova_senha_app_admin>@patronus-db.flycast:5432/postgres" \
  -a app-gestao-advocacia
```

## Historico de execucao

| Data | Responsavel | Notas |
|------|-------------|-------|
| (preencher apos rollout) | | |
