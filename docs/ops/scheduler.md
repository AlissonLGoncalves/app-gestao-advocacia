# Scheduler isolado para escala horizontal

## Opcao escolhida

Opcao A: processo dedicado no Fly para o scheduler.

## Por que essa opcao

- Menor complexidade de codigo e operacao no estado atual do projeto.
- Evita execucao duplicada de jobs quando houver mais de uma maquina do processo web.
- Mantem rollback simples (ajuste de processos no Fly), sem mudar armazenamento de jobs.

## Como funciona

- Processo `app` atende HTTP.
- Processo `scheduler` executa `python -m scheduler_runner`.
- `configure_scheduler` so inicia APScheduler quando `FLY_PROCESS_GROUP=scheduler`.

## Verificacao em producao

Use logs do processo dedicado:

```bash
fly logs --process=scheduler
```

Sinais esperados:
- mensagem de agendamento dos jobs
- mensagem de inicio do APScheduler

## Como pausar jobs sem deploy

Use feature flags ja existentes por env var:

- `CNJ_JOB_ENABLED=false`
- `DJEN_JOB_ENABLED=false`

Isso pausa os jobs correspondentes sem alterar codigo.

## Capacidade e memoria

Antes de deploy, confirmar memoria suficiente para o processo `scheduler`.

- Pode usar VM menor para `scheduler` se a carga permitir.
- Revisar `[[vm]]` no `fly.toml` e monitorar consumo em producao.
