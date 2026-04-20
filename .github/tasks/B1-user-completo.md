# [B1] Completar cadastro do advogado (nome_completo, CPF, OAB) + tela de perfil

> ⚠️ **ANTES DE COMEÇAR — leia `.github/tasks/README.md` e `ROADMAP-2026-Q2.md`.**
> 🚫 **NÃO use `Co-Authored-By`** em commits.

**Prioridade:** 🔴 Crítica (bug silencioso + bloqueia Track C)
**Track:** B — Cadastro completo
**Depende de:** A1 (para ordem de dependências)
**Bloqueia:** C1 (procuração precisa do `nome_completo` e OAB do user logado)
**Estimativa:** 5-7 horas

## Problema

O modelo `User` em `gestao_advocacia/models/__init__.py:17` tem:
- `username` (usado como login E como "nome" pelo frontend — confuso)
- `email`, `role`, `numero_oab`, `sigla_oab_tribunal`
- **Falta**: `nome_completo`, `cpf`, `tipo_pessoa`

O `RegisterPage.jsx` já envia `oab`, `tipo_pessoa` e `documento_identificacao` no payload, mas **o backend descarta `oab` e `tipo_pessoa`** silenciosamente — `routes/auth.py:31-69` só usa `username`, `email`, `password`, `role`, `documento` (que vai pro Tenant, não pro User).

Consequência:
- Sua OAB foi digitada no cadastro mas não foi salva
- Track C (procuração) não consegue saber quem é o advogado sem esses dados

## Tarefas

### Backend

1. **Migration Alembic** adicionar no `User`:
   - `nome_completo` (str 200, nullable)
   - `cpf` (str 14, nullable, index)
   - `tipo_pessoa` (str 2, nullable — `PF` | `PJ`)
2. **`User.to_dict()`** expor:
   - `nome_completo`, `numero_oab`, `sigla_oab_tribunal`, `tipo_pessoa`, `cpf` (mascarado: `***.***.***-**`)
3. **`POST /auth/register`** aceitar e persistir:
   - `nome_completo`, `cpf`, `tipo_pessoa`, `oab` → `numero_oab`, `sigla_oab_tribunal`
   - Validar CPF com dígitos verificadores (utils `validar_cpf`)
   - Se `tipo_pessoa == 'PF'`: CPF no User, documento no Tenant pode ser o mesmo CPF
   - Se `tipo_pessoa == 'PJ'`: CNPJ no Tenant, User sem CPF
4. **Novo `PUT /auth/me`** (`jwt_required`): permite editar
   - `nome_completo`, `numero_oab`, `sigla_oab_tribunal`
   - `cpf` somente se ainda vazio (não permite sobrescrever)
5. **Script de backfill** `scripts/maintenance/migrar_usernames_para_nome_completo.py`:
   - Para cada User com `nome_completo IS NULL`, copia `username` como valor inicial
   - Uso: `python -m scripts.maintenance.migrar_usernames_para_nome_completo --apply`

### Frontend

1. `RegisterPage.jsx`:
   - PF: enviar `nome_completo` (não mais `username=nomeOuRazao`)
   - PJ: `razao_social` → Tenant; `nome_completo` do admin separado
   - Adicionar campo "Sigla UF" ao lado da OAB (ex: `SP`, `PR`)
2. **Nova página `src/pages/PerfilPage.jsx`** rota `/perfil`:
   - Form com `nome_completo`, `numero_oab`, `sigla_oab_tribunal`, `cpf` (readonly se preenchido)
   - Botão "Salvar alterações" → `PUT /auth/me`
   - Mensagem clara de que OAB é obrigatória para usar automação de procuração
3. Link "Meu Perfil" no menu/header (componente existente de layout)

### Testes

`gestao_advocacia/tests/test_auth_perfil.py`:
- register PF com OAB inválida → 400
- register PF válido → User tem `nome_completo`, `cpf`, `numero_oab`
- register PJ → Tenant tem CNPJ, User não tem CPF
- `PUT /auth/me` atualiza campos permitidos
- `PUT /auth/me` tentando sobrescrever CPF preenchido → 400

`gestao_advocacia_vite/src/pages/PerfilPage.test.jsx`:
- carrega dados de `GET /auth/me`
- submit chama `PUT /auth/me`
- toast de sucesso

## Critérios de aceite

- [ ] Migration executada (testar em banco local antes)
- [ ] Backfill executado em produção após merge (`fly ssh`)
- [ ] Bug do OAB ignorado resolvido — seu próprio user atualizado
- [ ] `PerfilPage` funcional
- [ ] Testes 5 backend + 3 frontend passando
- [ ] CI verde

## Branch e PR

- Branch: `feat/b1-user-nome-oab-cpf`
- Título PR: `[B1] Completar cadastro do advogado (nome_completo, CPF, OAB) + tela de perfil`

## Pós-merge (manual)

```bash
flyctl ssh console -a app-gestao-advocacia
cd /app
python -m scripts.maintenance.migrar_usernames_para_nome_completo --apply
```

Depois entra no `/perfil` no app e atualiza sua OAB (ainda descartada no cadastro original).
