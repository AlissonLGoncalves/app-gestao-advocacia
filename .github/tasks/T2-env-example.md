# [T2] Arquivos `.env.example`

> ⚠️ **ANTES DE COMEÇAR — leia `.github/tasks/README.md`.**
> 🥇 **Regra de ouro:** só começar triviais após C1–C4 estarem MERGEADAS.
> 🚫 **NÃO use `Co-Authored-By`** em commits — quebra o deploy no Vercel Hobby.

**Prioridade:** 🟢 Trivial
**Depende de:** nada
**Estimativa:** 1 hora

## Tarefas

1. Criar `gestao_advocacia/.env.example` listando **todas** as env vars usadas pelo backend:
   - Buscar por `os.environ`, `os.getenv`, `config.get` em todo o backend.
   - Para cada var: nome, valor placeholder, comentário de 1 linha explicando o propósito.
   - Exemplo:
     ```
     # Connection string do PostgreSQL
     DATABASE_URL=postgresql://user:pass@localhost:5432/gestao_advocacia

     # Segredo para assinar JWTs (use openssl rand -hex 32)
     JWT_SECRET_KEY=changeme

     # Credenciais SMTP para envio de e-mails
     MAIL_SERVER=smtp.gmail.com
     MAIL_USERNAME=
     MAIL_PASSWORD=
     ```

2. Criar `gestao_advocacia_vite/.env.example` para o frontend (mesmo processo, buscar por `import.meta.env`).

3. Garantir `.env` e `.env.local` no `.gitignore` (já deve estar, conferir).

4. Referenciar no README (T1) como copiar: `cp .env.example .env` e preencher.

## Critérios de aceite

- [ ] `.env.example` criado em backend e frontend.
- [ ] Todas as env vars usadas no código estão listadas.
- [ ] Nenhum segredo real no `.env.example`.
- [ ] `.gitignore` correto.
