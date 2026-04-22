# Logging de PII (LGPD)

## Escopo

Este documento separa o que pode ficar bruto por exigencia legal e o que deve ser mascarado no logger de aplicacao.

## O que fica bruto (audit trail legal)

- Tabela `audit_log` no banco de dados.
- Uso: trilha de auditoria para operacoes sensiveis (ex.: anonimiza\u00e7\u00e3o, eventos administrativos).
- Justificativa: trilha legal interna, controlada por acesso ao banco.

## O que e mascarado (stdout/stderr da aplicacao)

- Logs estruturados enviados ao logger da aplicacao (Fly logs).
- Campos de autenticacao sensiveis:
  - `email` -> mascarado com `mask_email`
  - `user_id` -> substituido por `user_id_hash` via `mask_user_id`
- `tenant_id` permanece em claro para operacao e troubleshooting multi-tenant.

## Retencao de logs (Fly)

- Retencao padrao operacional: 30 dias.
- Revisar janela de retencao com DPO e Seguranca conforme politica interna.

## Extracao de audit trail para um titular (DPO)

1. Identificar o titular por `user_id` interno (ou chaves correlatas autorizadas).
2. Consultar trilha no banco, nunca em logs de aplicacao:

```sql
SELECT id, acao, user_id, tenant_id, metadata, created_at
FROM audit_log
WHERE user_id = :user_id
ORDER BY created_at DESC;
```

3. Exportar resultado com controle de acesso, registro de solicitacao e cadeia de custodia.
4. Se necessario, cruzar com consentimentos e eventos na mesma janela temporal.
