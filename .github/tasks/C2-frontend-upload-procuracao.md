# [C2] Frontend: upload de procuração + pré-preenchimento

> ⚠️ **ANTES DE COMEÇAR — leia `.github/tasks/README.md` e `ROADMAP-2026-Q2.md`.**
> 🚫 **NÃO use `Co-Authored-By`** em commits.

**Prioridade:** 🟠 Alta
**Track:** C — Automação de procuração
**Depende de:** C1
**Bloqueia:** C3
**Estimativa:** 5-6 horas

## Objetivo

Adicionar botão "Extrair de procuração" no formulário de cadastro de cliente que faz upload, chama `POST /clientes/extrair-procuracao` e pré-preenche os campos com AI_BADGEs visíveis.

## Tarefas

### Componente comum

1. Extrair `AI_BADGE` usado em `ModalCriarClienteCaso.jsx` (F2) para `src/components/common/AIBadge.jsx` — ícone `bi-magic` com tooltip "Extraído automaticamente por IA".

### Service

2. `src/services/procuracaoService.js`:
   - `extrairProcuracao(file: File): Promise<ExtracaoResult>`
   - Usa `apiClient` existente (já aponta para `/api/v1` após fix `ensureApiVersion`)
   - Content-Type: multipart/form-data com field `arquivo`

### UI

3. Modificar `src/components/clientes/ClienteForm.jsx` (ou componente equivalente):
   - Novo botão acima do form: `<i class="bi bi-file-earmark-pdf"></i> Extrair de procuração (PDF/DOCX)`
   - Ao clicar: abre input file invisible (`accept=".pdf,.docx,.jpg,.png"`)
   - Validação cliente: max 10MB; se maior → toast erro, não envia
   - Estado loading: spinner + "Analisando procuração..."
   - Sucesso:
     - `setState` dos campos do form com dados retornados
     - Marca cada campo preenchido com flag `camposAutoPreenchidos` (Set) para mostrar AI_BADGE
   - Erro:
     - 413 → "Arquivo muito grande (máx 10MB)"
     - 422 → "Não foi possível extrair. Revise o documento ou preencha manualmente."
     - 503 → "Serviço de extração temporariamente indisponível."
   - Se `confianca < 0.6`: banner amarelo "Revise os campos com atenção — confiança baixa"

### Testes

`src/components/clientes/ClienteForm.test.jsx`:
- Upload de arquivo mock → campos preenchidos + badges visíveis
- Arquivo > 10MB → toast erro, não chama API
- API 422 → toast claro, form permanece vazio
- `confianca < 0.6` → banner amarelo aparece

## Critérios de aceite

- [ ] `AIBadge` extraído para componente comum e reutilizado em F2
- [ ] Botão visível e funcional em dev local (backend + frontend rodando)
- [ ] Todos os campos pré-preenchidos têm badge
- [ ] Banner de baixa confiança aparece quando apropriado
- [ ] 4/4 testes passando
- [ ] `npm run lint && npx prettier --check .` verde
- [ ] CI verde

## Branch e PR

- Branch: `feat/c2-upload-procuracao-frontend`
- Título PR: `[C2] Frontend: upload de procuração com pré-preenchimento do form de cliente`
