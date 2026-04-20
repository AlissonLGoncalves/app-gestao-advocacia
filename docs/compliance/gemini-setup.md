# Gemini API Key - Setup Seguro (Backend)

Este projeto usa a Gemini API apenas no backend Flask. A chave nunca deve ser enviada para o frontend.

## 1) Gerar a API key

1. Acesse https://aistudio.google.com/app/apikey
2. Crie uma chave da Gemini API
3. Guarde a chave em local seguro

## 2) Ambiente local (backend)

Defina a variável de ambiente no ambiente local:

```powershell
$env:GEMINI_API_KEY="sua_chave_aqui"
```

Ou no arquivo `.env` da raiz (não versionar segredo):

```env
GEMINI_API_KEY=sua_chave_aqui
```

## 3) Produção no Fly

Configure como secret no app Fly:

```bash
fly secrets set GEMINI_API_KEY=xxx -a app-gestao-advocacia
```

Importante:
- Não comitar a chave no repositório
- Não expor a chave em variáveis `VITE_*`
- Não enviar a chave para o browser

## 4) Limites (free tier)

Referência operacional para `gemini-2.0-flash`:
- 15 RPM
- 1500 RPD

Valide periodicamente no painel da Google AI Studio, pois limites podem mudar por conta/plano/região.

## 5) Termos de uso

Leia e cumpra os termos oficiais:
- https://ai.google.dev/terms
