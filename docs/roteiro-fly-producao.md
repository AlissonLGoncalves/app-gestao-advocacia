# Roteiro de Operacao - Backend no Fly (producao)

## Objetivo
Padronizar o ambiente para usar:
- Frontend: Vercel
- Backend API: Fly (`https://app-gestao-advocacia.fly.dev`)

Este roteiro evita regressao para Render e elimina erros de CORS por host incorreto.

## Estado aplicado neste repositorio
1. `gestao_advocacia_vite/src/config.js`
- Fallback de producao em Fly.
- Normalizacao para converter host legado `onrender.com` para `fly.dev` quando vier por variavel de ambiente antiga.

2. `gestao_advocacia_vite/vercel.json`
- CSP `connect-src` permitindo `https://app-gestao-advocacia.fly.dev`.

3. `fly.toml`
- Restaurado na raiz do repositorio com regiao `gru`, health check e volume.

## Etapa 1 - Confirmar variaveis no Vercel
No projeto do frontend (Vercel):

1. Settings -> Environment Variables
2. Definir/atualizar:
- `VITE_API_URL=https://app-gestao-advocacia.fly.dev/api/v1`

3. Remover variavel antiga, se existir:
- qualquer `VITE_API_URL` apontando para `onrender.com`

4. Redeploy da ultima versao.

## Etapa 2 - Confirmar backend no Fly
No Fly Dashboard da aplicacao `app-gestao-advocacia`:

1. Validar status: `Deployed`
2. Validar regiao primaria: `gru`
3. Validar machine ativa: minimo 1
4. Validar healthcheck:
- `GET /` retornando 200

Com CLI (opcional):
- `flyctl status -a app-gestao-advocacia`
- `flyctl checks list -a app-gestao-advocacia`

## Etapa 3 - Validar CORS no backend
Garantir que o backend aceita origem do frontend:
- `https://app-gestao-advocacia.vercel.app`

No codigo, a origem ja esta liberada em `gestao_advocacia/app_runtime.py`.

Se houver dominio customizado do frontend, incluir tambem em:
- `CORS_ALLOWED_ORIGINS` (secret/env no Fly)

Exemplo:
- `https://app-gestao-advocacia.vercel.app,https://seu-dominio.com`

## Etapa 4 - Teste funcional ponta a ponta
Abrir o frontend publicado e validar no DevTools (Network):

1. Login
- `POST /api/v1/auth/login`
- Esperado: 200 com `access_token` valido
- Login invalido: 401 com JSON de erro

2. Dashboard
- `GET /api/v1/dashboard/stats`
- Esperado: 200

3. Clientes
- `GET /api/v1/clientes?sort_by=nome_razao_social...`
- Esperado: 200

4. DJEN
- `GET /api/v1/djen/oabs`
- Esperado: 200 (ou 4xx/5xx funcional do modulo, mas sem CORS)

Critico:
- Nenhuma chamada para `onrender.com`
- Nenhuma chamada para host incorreto
- Nenhum erro de preflight CORS

## Etapa 5 - Hard refresh e cache
Depois do deploy no Vercel:
- `Ctrl+F5` no navegador
- Se necessario, limpar cache de site

Motivo: evitar bundle antigo com host legado.

## Etapa 6 - Monitoramento inicial (30-60 min)
Acompanhar:

1. Logs Fly
- erros 5xx
- timeout
- falhas de DB/migracao

2. Logs frontend
- falhas em `dashboard/stats`, `clientes`, `djen/oabs`

3. Uso de recursos no Fly
- CPU/RAM da machine

## Etapa 7 - Rollback rapido (se algo quebrar)
1. Frontend (Vercel)
- Reverter para deploy anterior funcional

2. Backend (Fly)
- Reverter release no Fly ou redeploy da imagem anterior

3. Config
- Confirmar `VITE_API_URL` valido
- Confirmar CSP em `vercel.json`

## Checklist final
- [ ] `VITE_API_URL` no Vercel aponta para Fly
- [ ] `fly.toml` presente e valido
- [ ] CSP permite `app-gestao-advocacia.fly.dev`
- [ ] Login, Dashboard e Clientes respondem 200
- [ ] Sem erros CORS no browser
- [ ] Sem referencias ativas a `onrender.com` no ambiente de producao

## Observacao sobre Render
`render.yaml` pode permanecer no repositorio como historico/alternativa, mas nao deve ser a origem ativa enquanto a operacao principal estiver no Fly.
