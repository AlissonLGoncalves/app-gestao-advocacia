# Logging Estruturado (JSON)

Este projeto usa logs JSON para facilitar troubleshooting no Render.

## Campos padrão

Todos os logs incluem:

- `timestamp`
- `level`
- `logger`
- `message`
- `request_id`
- `user_id`
- `tenant_id`

Campos adicionais podem aparecer conforme o evento (`event`, `endpoint`, `status_code`, etc.).

## Request ID

- O backend lê `X-Request-ID` no `before_request`.
- Se não existir, gera UUID4 automaticamente.
- O valor sempre volta no header de resposta `X-Request-ID`.

## Eventos instrumentados

### Autenticação

- Sucesso: `login_success` (nível `INFO`)
- Falha: `login_failed` (nível `WARNING`, com `email` e `reason`)

### Segurança de tenant

- Acesso cross-tenant bloqueado: `cross_tenant_access_blocked` (nível `WARNING`)
- Campos extras: `user_id`, `current_tenant`, `target_tenant`, `endpoint`, `item_id`, `model`

### Erros 5xx

- Evento: `server_error` (nível `ERROR`)
- Inclui stacktrace e contexto (`endpoint`, `method`, `status_code`)

## Configuração de nível de log

Use a variável de ambiente `LOG_LEVEL`:

- `DEBUG`
- `INFO`
- `WARNING`
- `ERROR`
- `CRITICAL`

Exemplo no Render:

```bash
LOG_LEVEL=INFO
```

## Como consultar no Render

1. Abra o serviço backend no Render.
2. Vá em `Logs`.
3. Filtre por termos de evento:
   - `"event": "login_failed"`
   - `"event": "cross_tenant_access_blocked"`
   - `"event": "server_error"`
4. Copie o `request_id` para correlacionar toda a linha do tempo da requisição.

## Exemplos

```json
{"timestamp":"2026-04-18T14:03:21.120000+00:00","level":"INFO","logger":"app","message":"login_success","request_id":"2f9f2b18-3f6d-4e4a-bd34-9e3c2f9f0c11","user_id":12,"tenant_id":7,"event":"login_success"}
```

```json
{"timestamp":"2026-04-18T14:04:10.912000+00:00","level":"WARNING","logger":"app","message":"cross_tenant_access_blocked","request_id":"req-abc-123","user_id":12,"tenant_id":7,"event":"cross_tenant_access_blocked","current_tenant":7,"target_tenant":99,"endpoint":"/api/clientes/55"}
```
