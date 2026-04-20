# [D2] Re-aceite quando Termos mudarem

> ⚠️ **ANTES DE COMEÇAR — leia `.github/tasks/README.md` e `ROADMAP-2026-Q2.md`.**
> 🚫 **NÃO use `Co-Authored-By`** em commits.

**Prioridade:** 🟡 Média (compliance contínua)
**Track:** D — Qualidade de vida
**Depende de:** A1, A2
**Estimativa:** 3-4 horas

## Problema

Quando subir `termos-v2.0.md`, usuários antigos continuarão com consentimento v1.0 registrado. Precisa forçar re-aceite na próxima sessão.

## Tarefas

### Frontend

1. **Hook/middleware** no bootstrap do app (ex: `src/App.jsx` ou layout autenticado):
   - Ao carregar, chamar em paralelo `GET /auth/me/consentimentos` e `GET /auth/termos-vigentes`
   - Comparar: se versão vigente de `termos` ou `lgpd` ≠ versão aceita pelo user → redirect para `/aceitar-novos-termos` (modal bloqueante)
2. **Página `src/pages/AceitarNovosTermosPage.jsx`**:
   - Mostra markdown dos novos termos
   - Opcional: diff com versão anterior (pode ser fase 2)
   - Checkboxes de aceite (Termos + LGPD separados)
   - Botão "Aceitar e continuar" → `POST /auth/me/aceitar-termos`
   - Botão "Não aceito, sair da conta" → logout

### Backend

3. **`POST /auth/me/aceitar-termos`** (`jwt_required`) `{tipo, versao}`:
   - Cria novo registro `ConsentimentoUsuario` com IP/user-agent
   - Retorna 200 ou 409 se já tiver aceitado a versão

### Testes

- hook detecta divergência de versão
- aceite cria novo registro mantendo os antigos (histórico)

## Critérios de aceite

- [ ] Subir `termos-v1.1.md` (fake, pra testar) faz o user ser redirecionado
- [ ] Após aceite, acesso normal é liberado
- [ ] Histórico antigo mantido
- [ ] Testes passando
- [ ] CI verde

## Branch e PR

- Branch: `feat/d2-reaceite-termos`
- Título PR: `[D2] Re-aceite obrigatório quando Termos mudarem`
