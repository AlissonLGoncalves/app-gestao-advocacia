# [A1] Persistir aceite de Termos/LGPD no banco

> ⚠️ **ANTES DE COMEÇAR — leia `.github/tasks/README.md` e `ROADMAP-2026-Q2.md`.**
> 🚫 **NÃO use `Co-Authored-By`** em commits — quebra o deploy no Vercel Hobby.

**Prioridade:** 🔴 Crítica (risco LGPD)
**Track:** A — Compliance
**Depende de:** —
**Bloqueia:** operação com clientes reais; A2, A3, D2
**Estimativa:** 4-6 horas

## Problema

Hoje `RegisterPage.jsx` mostra 2 checkboxes (Termos e LGPD) com modal de scroll obrigatório, mas o backend `POST /auth/register` (`gestao_advocacia/routes/auth.py`) não recebe nem persiste o aceite. Não há prova de consentimento com timestamp, versão, IP ou user-agent — viola ANPD e art. 8º §1º da LGPD.

## Tarefas

### Backend

1. **Migration Alembic** — tabela `consentimento_usuario`:
   - `id` (PK), `user_id` (FK `user`), `tipo` (str: `termos_uso` | `lgpd`),
     `versao` (str, ex `v1.0`), `aceito_em` (datetime), `ip` (str 45), `user_agent` (str 500),
     `hash_documento` (str 64)
   - `UNIQUE (user_id, tipo, versao)`
2. **Modelo** `ConsentimentoUsuario` em `models/__init__.py` com `to_dict()`.
3. **`POST /auth/register`** aceitar campos adicionais:
   - `aceite_termos: bool`, `aceite_lgpd: bool`, `versao_termos: str`, `versao_lgpd: str`
   - Se ambos `True` → criar 2 registros de `ConsentimentoUsuario` capturando `request.remote_addr` e `request.headers.get('User-Agent')`.
   - Se qualquer um `False` → retornar `400` com mensagem clara.
4. **`GET /auth/me/consentimentos`** (`jwt_required`) — lista consentimentos do user logado.

### Frontend

1. `RegisterPage.jsx`: incluir no payload do `/auth/register`:
   ```js
   { aceite_termos, aceite_lgpd, versao_termos: 'v1.0', versao_lgpd: 'v1.0' }
   ```
2. Criar `src/constants/legal.js` exportando `TERMS_VERSION` e `LGPD_VERSION`.

### Testes

- `gestao_advocacia/tests/test_auth_consentimentos.py`:
  - register com aceite válido → 2 registros criados, versão correta
  - register sem aceite → 400
  - `/me/consentimentos` retorna lista do user
- `gestao_advocacia_vite/src/pages/auth/RegisterPage.test.jsx`:
  - submit sem aceite → toast erro, não chama API
  - submit com aceite → payload inclui os 4 campos

## Critérios de aceite

- [ ] Migration gerada e revisada (usar `flask db migrate -m "consentimento_usuario"`)
- [ ] Backend salva 2 registros ao registrar com aceite
- [ ] Backend rejeita 400 sem aceite
- [ ] `GET /auth/me/consentimentos` retorna lista
- [ ] Testes backend 3/3 passando
- [ ] Testes frontend 2/2 passando
- [ ] `ruff check . && black . && pytest` verde em `gestao_advocacia/`
- [ ] `npm run lint && npx prettier --check . && npm test` verde em `gestao_advocacia_vite/`
- [ ] CI verde

## Branch e PR

- Branch: `feat/a1-consentimento-lgpd`
- Título PR: `[A1] Persistir aceite de Termos/LGPD com versão, IP e user-agent`
