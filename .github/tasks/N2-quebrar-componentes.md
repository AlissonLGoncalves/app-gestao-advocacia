# [N2] Quebrar componentes gigantes

> ⚠️ **ANTES DE COMEÇAR — leia `.github/tasks/README.md`.**
> 🥇 **Regra de ouro:** TODAS as críticas (C1–C4) precisam estar MERGEADAS antes de começar tarefas normais.
> 🚫 **NÃO use `Co-Authored-By`** em commits — quebra o deploy no Vercel Hobby.

**Prioridade:** 🟡 Normal
**Depende de:** N1 (precisa dos testes para garantir que refactor não quebra)
**Estimativa:** 3-4 dias

## Contexto

- `ClienteForm.jsx` tem 761 linhas.
- `CasoForm.jsx` tem 551 linhas.

Componentes desse tamanho são impossíveis de entender, testar e evoluir.

## Tarefas

Para cada componente gigante:

1. Identificar **seções lógicas** do formulário (ex.: Dados Pessoais, Endereço, Contato, Documentos).
2. Extrair cada seção para um sub-componente em `components/<formulario>/<Secao>.jsx`.
3. Extrair **lógica de estado e validação** para um hook customizado `hooks/use<Formulario>.js`:
   - `useClienteForm()` retorna `{ values, errors, handleChange, handleSubmit, isSubmitting }`.
4. Extrair **chamadas de API** para um serviço em `services/<recurso>Service.js`:
   - `clienteService.create(data)`, `clienteService.update(id, data)`, etc.
5. O componente "pai" fica como orquestrador, idealmente < 200 linhas.

## Regras

- **Nenhum componente novo pode ter mais de 200 linhas.**
- **Rodar testes de N1 após cada extração.** Não abrir PR com teste quebrado.
- **Não mudar comportamento visível.** UX idêntica antes e depois.

## Critérios de aceite

- [ ] `ClienteForm.jsx` < 200 linhas.
- [ ] `CasoForm.jsx` < 200 linhas.
- [ ] Pelo menos um hook customizado por formulário em `hooks/`.
- [ ] Chamadas de API isoladas em `services/`.
- [ ] Testes de N1 continuam passando.
- [ ] Screenshots antes/depois no PR mostrando UI idêntica.

## Fora de escopo

- Quebrar outros componentes além dos dois listados.
- Mudar visual / design.
- Migrar para nova biblioteca de formulários (ex.: react-hook-form) — pode sugerir em issue separada.
