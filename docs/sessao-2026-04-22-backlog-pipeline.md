# Sessão 2026-04-22 — Drenagem do backlog de PRs (S1-S4, A2, A3, B1, C0-C3)

> Narrativa "como chegamos nas soluções". Complementa o `CHANGELOG.md` v1.5.0
> que lista o "o quê". Aqui está o **porquê** e o **como debugamos**.

## Contexto inicial

Havia 8 PRs abertos, empilhados em cima de branches antigos, feitos antes da
refatoração S8 (`src/api/client.js`) e antes da migração Render→Fly (v1.4.0).
Nenhum mergeava diretamente — todos geravam conflitos com `main` pós-S8 e
pós-fixes de produção.

Estratégia adotada: **cherry-pick em cima de branch novo** rebasado em `main`,
resolvendo conflito PR a PR, na ordem numérica (S1 → S2 → S3 → S4 → A2 → A3 →
B1 → C0-C3). Cada PR recebeu um novo número no GitHub (#75-82); os originais
foram fechados com `gh pr close <n> --comment "Substituída por #<novo>"`.

Por que cherry-pick e não `git rebase`? Porque os branches originais tinham
commits misturando a feature com drifts antigos de `src/pages/*.jsx` que
contradiziam o S8. Cherry-pick isolou **só o commit da feature**, deixando
todo o resto de `main` intocado.

---

## Padrão de resolução de conflitos

Três regras que apliquei consistentemente (e que funcionaram):

1. **`src/api/client.js` e `src/api/<recurso>.js`** — sempre `--ours` (HEAD).
   A refatoração S8 já estava mergeada; qualquer PR antigo mexendo em fetch
   direto perde para o novo api client.
2. **Páginas/componentes JSX que foram migrados para api client** — manter
   HEAD e **aplicar a feature em cima** manualmente. Nunca aceitar a versão
   incoming que ressuscita `fetch(API_URL/...)` direto.
3. **Migrations** — sempre conferir colisão de `revision` ID antes de commitar.
   Se colidir: renomear o arquivo + atualizar a variável `revision = "..."`
   dentro dele + rodar `flask db merge heads` se aparecer múltiplos heads.

---

## PR #75 — S1 IDOR fix tenant (contratos/DJEN)

**Sintoma esperado:** PRs mexiam em queries dos recursos mas usavam filtro
por `user_id` em vez de `tenant_id`, permitindo um usuário de tenant A buscar
recursos de tenant B se soubesse o ID.

**Solução:** `filter_by(tenant_id=get_current_tenant_id())` + retornar **404**
(não 403) para não revelar existência do recurso.

**Conflito resolvido:** já estava bem pequeno — só precisou resolver importação
de helper `get_current_tenant_id` que vinha de `auth_utils` em vez do path
antigo.

---

## PR #76 — S2 Rate limiting

**Decisão de design:** Flask-Limiter com `storage_uri="memory://"` (sem Redis).
Por quê? Porque no MVP o Fly tem 1 máquina `app` ativa em `gru` — memory
storage é consistente. Se escalar para >1 máquina, precisa Redis; fica
registrado no código como TODO.

Limites escolhidos empiricamente:
- `/login`: 5/min por IP
- `/register`: 3/min por IP
- `/register-invite`: 10/min por IP (convites são mais "burst")

**Gotcha descoberta:** Flask-Limiter precisa ser inicializado **antes** das
rotas serem registradas, senão os decorators não têm efeito. Isso forçou
reorganizar `app_runtime.py` para criar o `limiter` no topo.

---

## PR #77 — S3 Senha forte + invite 48h

**Decisão:** política de senha em `utils/password_policy.py` puro (sem
dependência Flask) → testável sem app context. Regras: ≥10 chars, 1 upper,
1 digit, 1 special.

**Convite 48h:** `INVITE_TOKEN_HOURS = int(os.environ.get("INVITE_TOKEN_HOURS", "48"))`
— configurável via env para permitir encurtar em produção sem redeploy.

**Conflito em `config.py`:** essa mesma linha seria tocada depois pelo C0
(GEMINI_API_KEY warning). Resolvemos aceitando ambas e deixando o `config.py`
com dois blocos `if os.environ.get("FLASK_ENV") == "production"`.

---

## PR #78 — S4 MIME real + CORS whitelist

**Problema:** validação de upload usava `request.files[...].mimetype` que vem
do **cliente** — trivial de forjar. Correção: `python-magic` lendo o header
real do arquivo.

**Pegadinha Windows:** `python-magic` depende de `libmagic` (binário nativo).
No Linux/Docker é `apt-get install libmagic1` (adicionado ao `Dockerfile`).
No Windows dev é outro pacote. Solução:

```txt
python-magic==0.4.27; sys_platform != "win32"
python-magic-bin==0.4.14; sys_platform == "win32"
```

Markers de plataforma no `requirements.txt` — pip instala o certo sozinho.

**CORS whitelist:** antes aceitava qualquer origem com `*`. Agora lista
explícita de `https://app-gestao-advocacia.fly.dev`, `http://localhost:5173`,
etc. Derrubou o shim `onrender.com` que ainda estava lá de gambiarra.

---

## PR #79 — A2 Termos/LGPD versionados

**Decisão de design:** termos e política LGPD como **arquivos markdown** em
`static/legal/`, com hash SHA-256 calculado no startup e enviado via headers
`X-Terms-Version` e `X-LGPD-Version`. Cliente guarda o hash aceito em
`localStorage`; se servidor muda, força re-aceite.

Por que markdown e não DB? Porque versionamento via Git é natural — cada
PR que altera termos tem histórico + diff + review. DB teria que construir
toda essa máquinaria manualmente.

**Erro encontrado durante testes Vitest:**
```
Error: carrega markdown no modal de termos
```
`RegisterPage.jsx` usava `API_URL` mas o import tinha sumido na refatoração
S8 (foi para `src/config/index.js`). Fix: adicionar `import { API_URL } from '../../config'`.

---

## PR #80 — A3 Auditoria persistente de login

**Model novo:** `login_audit` com `user_id`, `ip`, `user_agent`, `success`,
`motivo`, `timestamp`. Migration `a2b3c4d5e6f7_add_login_audit_table.py`.

**Conflito clássico em `routes/auth.py`:** tanto HEAD (por causa do S5 já
mergeado em v1.2.0) quanto A3 mexiam no bloco de log de falha de login.

- HEAD: `log.info("login_failed", extra={"username": mask_email(username_or_email), "reason": "invalid_credentials"})`
- A3: `log.info("login_failed", extra={"username": username_or_email, "motivo": "senha_incorreta" | "usuario_inexistente" | ...})`

**Como resolvi:** **combinar as duas intenções** — manter `mask_email` de
HEAD (PII compliance, S5) **e** o campo detalhado `motivo` de A3 (diagnóstico
operacional). Resultado:

```python
log.info("login_failed", extra={
    "username": mask_email(username_or_email),
    "motivo": motivo_especifico,
})
```

Critério de decisão: quando duas features são **ortogonais** (S5 = proteção
PII, A3 = observabilidade), nunca escolha uma — combine. Cherry-pick de PRs
antigos quase sempre tem esse caso.

---

## PR #81 — B1 Cadastro advogado + PerfilPage

**Primeira colisão de migration:** revision ID `e4f5a6b7c8d9` estava tanto
no novo `add_user_nome_cpf_tipo_pessoa` quanto no existente
`expand_sigla_tribunal_on_djen_oab`. Alembic falha com "Multiple heads".

**Receita de fix que virou padrão:**
1. Gerar novo ID único (hex de 12 chars): `b1a1c2d3e4f5`
2. Renomear arquivo: `mv e4f5...py b1a1...py`
3. **Editar** a variável `revision = "..."` dentro do arquivo (**crítico** —
   esquecer isso quebra `flask db upgrade` em runtime com erro confuso)
4. Apagar `__pycache__/` de migrations (`.pyc` antigo cita a revision velha)
5. `flask db merge heads` → gera uma migration vazia só pra unificar

**Conflito em `RegisterPage.jsx`:** HEAD usava variável `nomeOuRazao`; B1
renomeou para `nomeCadastro`. Solução: **ficar com o nome novo**
(`nomeCadastro`) mas manter todo o resto de HEAD (api client S8 + hashes
A2). Montagem manual linha a linha.

**Decisão em `PerfilPage.jsx`:** B1 reescreveu completamente a página
unificando formulário de perfil + histórico de login (que veio do A3). Como
A3 mergeou primeiro, a versão final precisava incluir as duas coisas. Optei
pela versão B1 (mais completa) + adicionei as utilities `maskIp` e
`formatDate` que A3 havia criado.

---

## PR #82 — C0-C3 Gemini chain (o mais denso)

**5 commits encadeados** para cherry-pickar:
- C0: `GEMINI_API_KEY` + warning em prod
- C1: model `procuracao_analise` + endpoint upload + worker
- C2: UI upload + revisão
- C3: auto-vincular processo extraído + lint cleanup

### Conflito duplicado em `config.py` e `requirements.txt`

`config.py` já tinha sido tocado em S3. Mergeamos os dois blocos:
```python
INVITE_TOKEN_HOURS = int(os.environ.get("INVITE_TOKEN_HOURS", "48"))   # S3
if os.environ.get("FLASK_ENV") == "production" and not GEMINI_API_KEY:  # C0
    logging.getLogger(__name__).warning(...)
```

`requirements.txt` tinha **duas entradas** conflitantes de Gemini:
- Já em main: `google-genai==1.73.1`
- Vindo de C0: `google-generativeai>=0.8.0`

**Decisão: ambas ficam.** São SDKs diferentes (o `google-genai` é o novo
unificado, mas `google-generativeai` ainda é o que o código de C1 importa).
Remover o C0 quebraria os imports. TODO em código: migrar tudo pra
`google-genai` num ciclo futuro.

### Colisão de migration — segunda ocorrência

Revision `e6f7a8b9c0d1` colidia:
- C1: `add_procuracao_analise_table` (incoming)
- S6: `add_indexes_tenant_created` (já em main)

Mesma receita do B1: renomear para `c1a2b3c4d5e6_add_procuracao_analise_table.py`,
editar `revision = "c1a2b3c4d5e6"`, limpar `__pycache__`, `flask db merge heads`
→ gerou `80366d78be69_merge_c1_procuracao_into_main.py`.

### Conflito de marcadores não resolvidos (pegadinha silenciosa)

Pelo menos **um** cherry-pick foi aceito com marcadores `<<<<<<< HEAD` ainda
no arquivo (o git não aborta se os marcadores estão dentro de strings ou se
você commita `-A` sem ler). O bug só apareceu no `npm run build`:

```
[builtin:vite-transform] Error: Unexpected token
  src/pages/PrazosPage.jsx:65:3
  src/pages/DjenPage.jsx:352:3
```

Lição: **sempre rodar `npm run build` antes de considerar o merge pronto** —
testes unitários passam com marcadores dentro de blocos não exercitados,
mas o bundler é um lint linguístico agressivo que pega.

**Decisão de resolução:**
- `PrazosPage.jsx`: HEAD tinha one-liners, C3 tinha refatoração verbose (if/else
  explícito). Como C3 era só "lint cleanup" sem mudar semântica, mantive HEAD.
- `DjenPage.jsx`: **aqui combinei de verdade.** HEAD usava `syncDjen()` do
  api client S8 (bom); C3 revertia para `fetch(API_URL/djen/sync, ...)` (ruim,
  anti-S8). Mas C3 também adicionava **`useCallback` + error handling
  estruturado** (bom). Resultado: api client de HEAD **dentro de** useCallback
  + try/catch/finally de C3.

### A cadeia de fixes no deploy — ENUM `DuplicateObject`

O primeiro `fly deploy` falhou no `release_command = "flask db upgrade"` com:
```
psycopg2.errors.DuplicateObject: type "procuracao_analise_status" already exists
```

**Tentativa 1 (errada):** pensei que era SQLAlchemy criando o ENUM duas vezes
(uma via `.create(bind, checkfirst=True)` explícito, outra via `op.create_table`
que detecta o tipo na Column). Criei uma segunda `procuracao_status_enum_col`
com `create_type=False` (`sa.Enum`):

```python
procuracao_status_enum_col = sa.Enum(..., create_type=False)
```

Deploy falhou igual. Por quê? Porque **`sa.Enum` base não respeita
`create_type=False`** — esse kwarg é específico do dialeto `postgresql.ENUM`.
Ficou lá silenciosamente ignorado.

**Tentativa 2 (errada):** desconfiei que `checkfirst=True` em
transações abortadas não funciona. Adicionei checagem manual:

```python
existe = bind.execute(sa.text(
    "SELECT 1 FROM pg_type WHERE typname = 'procuracao_analise_status'"
)).scalar()
if not existe:
    procuracao_status_enum.create(bind, checkfirst=False)
```

Deploy falhou igual. Ainda o SQLAlchemy durante `op.create_table` invocava
`CreateEnumType` ao ver a Column. Minha checagem manual antes de chamar
`.create()` era inútil — o problema era na **Column**, não no `.create()`.

**Tentativa 3 (correta):** trocar `sa.Enum` por `postgresql.ENUM` na Column
(o único que honra `create_type=False`):

```python
from sqlalchemy.dialects import postgresql
procuracao_status_enum_col = postgresql.ENUM(
    ..., name="procuracao_analise_status", create_type=False,
)
```

Deploy passou.

**Lição:** quando `create_type=False` "não funciona" em enums Postgres,
quase sempre é porque você está usando `sa.Enum` (o genérico) e não
`postgresql.ENUM` (o dialeto). Os dois têm a mesma assinatura mas comportamento
diferente nesse flag. Isso é uma pegadinha documentada mas obscura do
SQLAlchemy 2.x.

### Verificação final

```
$ fly ssh console -C "flask db current"
→ 80366d78be69 (head) (mergepoint)

$ fly ssh console -C "python -c 'from app import app, db; ...'"
→ procuracao_analise  ✓

$ curl -X POST https://app-gestao-advocacia.fly.dev/api/v1/procuracoes/analisar
→ 401 (auth required = endpoint vivo)
```

---

## Heurísticas que emergiram e devem ser reusadas

1. **Rebase de PR antigo = cherry-pick em branch novo**, nunca merge direto.
2. **Sempre rodar `pytest` + `npm test` + `npm run build`** antes de considerar
   um rebase pronto. Build pega marcadores órfãos que teste não pega.
3. **Colisão de migration ID:** renomear arquivo, **editar a variável
   `revision` dentro do arquivo**, limpar `__pycache__`, `flask db merge heads`.
4. **Features ortogonais em conflito (ex: S5 mask vs A3 motivo):** combinar
   as duas, nunca escolher.
5. **`postgresql.ENUM` > `sa.Enum`** em migrations Postgres que precisam de
   `create_type=False` ou idempotência.
6. **Verificar secrets no Fly ANTES de pedir ao usuário:** `fly secrets list
   | grep XXX`. Evita pergunta desnecessária.
7. **Após deploy, curl o endpoint com `-o /dev/null -w "%{http_code}"`** —
   401 em endpoint protegido = sucesso (rota existe + auth gate funcionando).

---

## PRs drenados nesta sessão

| # | Label | Sintoma de conflito | Técnica chave |
|---|---|---|---|
| #75 | S1 IDOR | helper path renomeado | ajuste de import |
| #76 | S2 rate limit | ordem init no app_runtime | reorganização de setup |
| #77 | S3 senha/invite | touch em config.py que C0 também tocaria | merge dos dois ifs |
| #78 | S4 MIME/CORS | platform markers no requirements | markers `sys_platform` |
| #79 | A2 termos/LGPD | API_URL removido no S8 | restaurar import via novo path |
| #80 | A3 login audit | S5 mask_email vs A3 motivo | combinar ambos |
| #81 | B1 cadastro adv | migration ID colidido (`e4f5...`) | renomear + merge heads |
| #82 | C0-C3 Gemini | migration ID colidido (`e6f7...`) + ENUM DuplicateObject | `postgresql.ENUM(create_type=False)` + `pg_type` checkfirst |

Todos deployados em produção Fly, banco Postgres `gru`, head `80366d78be69`.
