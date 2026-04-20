# Indices compostos por tenant e tempo

## Objetivo

Reduzir risco de seq scan nas tabelas com crescimento continuo, priorizando filtros por tenant e ordenacao/intervalo temporal.

## Indices adicionados

- `ix_publicacao_djen_tenant_created` em `publicacao_djen(tenant_id, data_captura)`
- `ix_movimentacao_cnj_tenant_created` em `movimentacao_cnj(caso_id, data_registro_sistema)`
- `ix_audit_log_tenant_created` em `audit_log(tenant_id, data_hora)`
- `ix_documento_tenant_created` em `documento(tenant_id, data_upload)`
- `ix_evento_agenda_tenant_created` em `evento_agenda(tenant_id, data_inicio)`
- `ix_tarefa_prazo_tenant_created` em `tarefa_prazo(tenant_id, data_criacao)`
- `ix_recebimento_tenant_created` em `recebimento(tenant_id, data_recebimento)`
- `ix_despesa_tenant_created` em `despesa(tenant_id, data_despesa)`

## Observacoes de modelagem

- `movimentacao_cnj` nao possui `tenant_id` na tabela; o particionamento de acesso ocorre por `caso_id`.
- `evento_agenda` nao possui coluna explicita de criacao; foi usada `data_inicio` como temporal principal de consulta.

## Razao por tabela

- `publicacao_djen`: alto volume de capturas DJEN por tenant ao longo do tempo.
- `movimentacao_cnj`: volume acumulado por processo/caso, com consultas por historico recente.
- `audit_log`: trilha de auditoria cresce continuamente; filtros por tenant e janela temporal sao comuns.
- `documento`: uploads por tenant com consultas por mais recentes.
- `evento_agenda`: listagens por tenant e data de agenda.
- `tarefa_prazo`: consultas por tenant com foco em tarefas novas/vencimento.
- `recebimento` e `despesa`: relatorios financeiros por tenant e periodo.

## Estimativa de crescimento

- `publicacao_djen`: alta (diaria, potencialmente dezenas/centenas por tenant).
- `movimentacao_cnj`: media/alta (depende de quantidade de processos ativos).
- `audit_log`: alta (eventos operacionais e administrativos).
- `documento`: media (uploads conforme operacao do escritorio).
- `evento_agenda`: media (agenda cresce continuamente).
- `tarefa_prazo`: media/alta (tarefas e prazos operacionais).
- `recebimento`: media (lancamentos financeiros periodicos).
- `despesa`: media (lancamentos financeiros periodicos).

## Observacao de deploy

A migration usa criacao concorrente em PostgreSQL (`postgresql_concurrently=True`) com bloco de autocommit para reduzir lock de escrita durante deploy.
