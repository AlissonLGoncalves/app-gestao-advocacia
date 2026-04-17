# [T4] Limpeza de arquivos scratch

> ⚠️ **ANTES DE COMEÇAR — leia `.github/tasks/README.md`.**
> 🥇 **Regra de ouro:** só começar triviais após C1–C4 estarem MERGEADAS.
> 🚫 **NÃO use `Co-Authored-By`** em commits — quebra o deploy no Vercel Hobby.

**Prioridade:** 🟢 Trivial
**Depende de:** C4 (que já faz parte disso)
**Estimativa:** 1 hora

## Tarefas

1. Revisar `backups/` na raiz:
   - Se for dump local de dev, mover para fora do repo ou adicionar ao `.gitignore`.
   - Se forem fixtures de teste, mover para `gestao_advocacia/tests/fixtures/`.
2. Avaliar `iniciar_backend.bat` e `iniciar_frontend.bat`:
   - Uso pessoal do autor? → mover para `scripts/dev/` e documentar, ou remover.
3. Conferir que não há mais scratch files em `gestao_advocacia/` (C4 cobre isso em parte; fazer um sweep final).
4. Rodar `git ls-files` e procurar por:
   - Arquivos `.pyc`, `__pycache__/` commitados (não deveriam).
   - `.DS_Store`, `Thumbs.db`.
   - `node_modules/` (improvável, mas conferir).
5. Atualizar `.gitignore` para tudo acima.

## Critérios de aceite

- [ ] `backups/` tratada.
- [ ] Scripts `.bat` movidos ou removidos.
- [ ] Zero arquivos gerados commitados.
- [ ] `.gitignore` robusto.
