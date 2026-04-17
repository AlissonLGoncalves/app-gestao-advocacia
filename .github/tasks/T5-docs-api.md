# [T5] Documentação automática de API (OpenAPI/Swagger)

> ⚠️ **ANTES DE COMEÇAR — leia `.github/tasks/README.md`.**
> 🥇 **Regra de ouro:** só começar triviais após C1–C4 estarem MERGEADAS.
> 🚫 **NÃO use `Co-Authored-By`** em commits — quebra o deploy no Vercel Hobby.

**Prioridade:** 🟢 Trivial
**Depende de:** C3 (blueprints), N3 (versionamento)
**Estimativa:** 1 dia

## Tarefas

1. Adicionar `flask-smorest` (ou `apispec` + `apispec-webframeworks`) ao `requirements.txt`.
2. Converter rotas dos blueprints para usar `MethodView` / decorators do flask-smorest com schemas `marshmallow`.
3. Expor documentação em `/api/v1/docs` (Swagger UI) e `/api/v1/openapi.json`.
4. Schemas em `gestao_advocacia/schemas/` (um arquivo por recurso).
5. Proteger `/docs` em produção (exigir auth ou desabilitar via env var).

## Critérios de aceite

- [ ] Swagger UI acessível em dev.
- [ ] `openapi.json` válido (testar com https://editor.swagger.io).
- [ ] Todos os endpoints públicos documentados (request body, response, códigos).
- [ ] `/docs` protegida em produção.

## Fora de escopo

- Documentar endpoints internos/administrativos.
- Gerar SDK cliente.
