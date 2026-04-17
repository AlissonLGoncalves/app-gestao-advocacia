# [T1] README decente

> ⚠️ **ANTES DE COMEÇAR — leia `.github/tasks/README.md`.**
> 🥇 **Regra de ouro:** só começar triviais após C1–C4 e todas as normais dependentes estarem MERGEADAS.
> 🚫 **NÃO use `Co-Authored-By`** em commits — quebra o deploy no Vercel Hobby.

**Prioridade:** 🟢 Trivial
**Depende de:** C2 (pro badge), ideal após N1/N5
**Estimativa:** 2-3 horas

## Tarefas

Reescrever `README.md` na raiz com as seções:

1. **Título e descrição** — 2 parágrafos sobre o que é o app.
2. **Badges** — CI (de C2), cobertura (se N1 expôs).
3. **Stack** — backend e frontend (tecnologias principais).
4. **Requisitos** — Python 3.11, Node 20, PostgreSQL, etc.
5. **Como rodar local**:
   - Clonar.
   - Configurar `.env` (referenciar `.env.example` de T2).
   - Backend: criar venv, `pip install -r requirements.txt`, rodar migrations, `flask run`.
   - Frontend: `npm ci`, `npm run dev`.
6. **Como rodar testes** — backend (`pytest`) e frontend (`npm test`).
7. **Estrutura de pastas** — árvore resumida explicando o que é cada pasta principal.
8. **Deploy** — onde está (Render + Vercel), como é disparado.
9. **Documentação complementar** — links para `docs/tenant-isolation.md`, `docs/logging.md`, `docs/api-versioning.md`, etc.
10. **Licença** — se houver.

## Critérios de aceite

- [ ] `README.md` reescrito com todas as seções acima.
- [ ] Badge de CI funcionando.
- [ ] Instruções testadas — alguém novo consegue rodar o projeto seguindo o README.
- [ ] Links internos (para outros docs) funcionando.
