# [C0] Preparar API key do Gemini (manual, sem código)

**Prioridade:** 🟠 Alta (pré-requisito de C1)
**Track:** C — Automação de procuração
**Depende de:** —
**Bloqueia:** C1
**Estimativa:** 5 minutos

## Objetivo

Configurar a credencial do Google Gemini que será usada em C1 para extração estruturada de procurações.

## Por que Gemini e não Claude/OpenAI

- **Gratuito** no tier free do Google AI Studio (15 req/min, 1M tokens/dia) — mais que suficiente para uso de procurações.
- **Multimodal nativo**: aceita PDF digital, PDF escaneado e imagem em uma única chamada. Elimina Tesseract (OCR) e pdfplumber (extração de texto) — menos dependências no backend.
- DOCX continua sendo convertido com `python-docx` antes do prompt (Gemini não lê DOCX direto).

## Passos (executar manualmente)

1. Acessar https://aistudio.google.com/app/apikey logado com a conta Google do projeto
2. Clicar em **"Create API key"** → "Create API key in new project" (ou selecionar projeto existente)
3. Copiar a key gerada (formato `AIzaSy...`)
4. Setar como secret no Fly:
   ```bash
   flyctl secrets set GEMINI_API_KEY=AIzaSy... -a app-gestao-advocacia
   ```
5. Setar localmente para dev em `gestao_advocacia/.env`:
   ```
   GEMINI_API_KEY=AIzaSy...
   ```
6. Adicionar ao `.env.example` (sem valor):
   ```
   # ----- IA / LLM -----
   GEMINI_API_KEY=
   ```

## Critérios de aceite

- [ ] Secret configurado no Fly
- [ ] Valor disponível em `os.environ.get('GEMINI_API_KEY')` após deploy
- [ ] `.env.example` atualizado (único item que vai para git)

## Observação

A assinatura Google One / Gemini Advanced (UI) **não** inclui API — são produtos diferentes. O tier free do AI Studio é independente e suficiente.
