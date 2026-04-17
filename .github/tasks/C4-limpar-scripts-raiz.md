# [C4] Limpar scripts de produção da raiz do repositório

> ⚠️ **ANTES DE COMEÇAR — leia `.github/tasks/README.md`.**
> 🥇 **Regra de ouro:** C1, C2 e C3 precisam estar MERGEADAS antes de começar esta. Uma crítica por vez.
> 🚫 **NÃO use `Co-Authored-By`** em commits — quebra o deploy no Vercel Hobby.

**Prioridade:** 🔴 Crítica
**Depende de:** nada
**Estimativa:** 2-3 horas

## Contexto

A raiz do repo tem vários scripts soltos que parecem "remendos de produção":

```
add_contratos_api_patch.py
corrigir_tenants_prod.py
diagnostico.py
diagnostico_prod.py
limpar_tenant_id.py
verificar_isolation.py
test.pdf
```

Isso é perigoso:
1. Scripts executáveis na raiz podem ser rodados por engano em produção.
2. `test.pdf` é fixture, não deveria estar na raiz.
3. Não há documentação de quando cada script deve ser usado.

## Tarefas

1. Para **cada** script da lista acima, analisar:
   - Ainda é necessário hoje?
   - O que ele faz?
   - Em que situação deve ser executado?

2. Criar pasta `scripts/maintenance/` e mover os scripts **que ainda são úteis**.

3. Em `scripts/maintenance/README.md`, documentar cada script:
   ```markdown
   ## corrigir_tenants_prod.py
   **O que faz:** descrição em 1-2 linhas.
   **Quando usar:** cenário específico (ex.: após migração X falhar).
   **Pré-requisitos:** variáveis de ambiente, backup recente, etc.
   **Como executar:** `python scripts/maintenance/corrigir_tenants_prod.py --dry-run`
   **Perigos:** o que pode dar errado.
   ```

4. **Deletar** scripts que são claramente obsoletos (ex.: `add_contratos_api_patch.py` se o patch já foi aplicado).

5. Mover `test.pdf` para `gestao_advocacia/tests/fixtures/test.pdf` e ajustar qualquer teste que o use.

6. Adicionar flag `--dry-run` em qualquer script que faça mutação no banco. Por padrão, só loga o que faria. Só executa de fato com `--execute`.

7. Mover `test_debug.py`, `test_debug_native.py`, `test_upload.py`, `test_upload_native.py` de `gestao_advocacia/` — se forem scratch, deletar; se forem testes reais, mover para `gestao_advocacia/tests/`.

## Critérios de aceite

- [ ] Raiz do repo limpa (só `README.md`, `package.json`, `render.yaml`, `vercel.json`, pastas).
- [ ] `scripts/maintenance/README.md` documenta todo script mantido.
- [ ] Scripts mantidos têm `--dry-run` por padrão.
- [ ] `test.pdf` está em `gestao_advocacia/tests/fixtures/`.
- [ ] Pasta `gestao_advocacia/` sem arquivos `test_*.py` scratch (só testes reais em `tests/`).
- [ ] Nenhum deploy quebrado (conferir `render.yaml`, `vercel.json`, `Procfile` — ajustar paths se algum referenciava os scripts movidos).

## Fora de escopo

- Reescrever os scripts.
- Corrigir os bugs que motivaram os scripts (isso é C1).
