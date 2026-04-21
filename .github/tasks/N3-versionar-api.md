# [N3] Versionamento de API (`/api/v1`)

> ⚠️ **ANTES DE COMEÇAR — leia `.github/tasks/README.md`.**
> 🥇 **Regra de ouro:** TODAS as críticas (C1–C4) precisam estar MERGEADAS antes de começar tarefas normais.
> 🚫 **NÃO use `Co-Authored-By`** em commits — quebra o deploy no Vercel Hobby.

**Prioridade:** 🟡 Normal
**Depende de:** C3 (blueprints facilitam o prefixo global)
**Estimativa:** 1-2 dias

## Contexto

Todas as rotas hoje estão em `/api/<recurso>` sem versão. Qualquer breaking change futura impacta clientes sem como distinguir.

## Tarefas

1. Registrar todos os blueprints sob `url_prefix="/api/v1"` no factory `create_app()`.
2. Criar um blueprint **alias** que aceita as URLs antigas `/api/xxx` e:
   - Responde normalmente (delegando para o handler v1).
   - Adiciona headers `Deprecation: true` e `Sunset: <data 30 dias no futuro>`.
3. Atualizar **todas** as chamadas no frontend (`gestao_advocacia_vite/src`) para usar `/api/v1/`.
   - Buscar por `/api/` em todo o `src/` — centralizar a base em um único lugar se ainda não estiver (ex.: `services/api.js` com `axios.create({ baseURL: '/api/v1' })`).
4. Criar `docs/api-versioning.md` explicando:
   - Política de versionamento (quando bumpar maior).
   - Prazo de deprecation (30 dias padrão).
   - Como adicionar `v2` no futuro.

## Critérios de aceite

- [ ] Todas as rotas acessíveis em `/api/v1/...`.
- [ ] Rotas antigas `/api/...` ainda funcionam com header de deprecation.
- [ ] Frontend 100% migrado para `/api/v1`.
- [ ] Nenhum teste backend quebrado (testes devem apontar para `/api/v1`).
- [ ] Deploy em staging testado — login e operações principais funcionam.

## Fora de escopo

- Criar `/api/v2`.
- Remover de vez as rotas antigas (fica para daqui a 30 dias).
