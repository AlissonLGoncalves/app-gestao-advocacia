# [C1] Backend: endpoint de extração de procuração via Gemini

> ⚠️ **ANTES DE COMEÇAR — leia `.github/tasks/README.md` e `ROADMAP-2026-Q2.md`.**
> 🚫 **NÃO use `Co-Authored-By`** em commits.

**Prioridade:** 🟠 Alta (feature de negócio)
**Track:** C — Automação de procuração
**Depende de:** B1 (precisa de `nome_completo` e OAB no User), C0 (Gemini API key)
**Bloqueia:** C2
**Estimativa:** 6-8 horas

## Objetivo

Criar endpoint que recebe upload de procuração (PDF digital, PDF escaneado, DOCX ou imagem) e retorna JSON estruturado com dados do outorgante (cliente) para pré-preenchimento do cadastro.

## Tarefas

### Dependências (adicionar em `requirements.in`, regenerar `requirements.lock`)

- `google-generativeai >= 0.8`
- `python-docx >= 1.1`

### Arquivos a criar

1. **`gestao_advocacia/services/procuracao_service.py`**
   - `preparar_conteudo(file_bytes, mime_type) -> dict`:
     - PDF (digital ou escaneado) e imagens: retornar `{type: 'file', bytes, mime}`
     - DOCX: converter para texto com `python-docx`, retornar `{type: 'text', content}`
     - Outros tipos: `raise ValueError`
   - `extrair_dados_procuracao(conteudo, advogado) -> dict`:
     - Chama Gemini 2.0 Flash (`gemini-2.0-flash-exp`) com prompt estruturado
     - `advogado` é dict com `nome_completo`, `numero_oab`, `sigla_oab_tribunal`
     - Prompt instrui o modelo a:
       - Identificar o **OUTORGANTE** (cliente), nunca confundir com outorgado
       - Usar nome/OAB do advogado para desambiguar
       - Extrair: `nome_completo`, `cpf` OU `cnpj`, `rg`, `nacionalidade`, `estado_civil`, `profissao`, `endereco` (`logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `uf`, `cep`), `numero_processo` (se houver)
       - Retornar `null` para campos não encontrados (nunca inventar)
       - Retornar `confianca` entre 0 e 1
     - `response_mime_type="application/json"` + `response_schema` (Pydantic → JSON Schema)
   - Validação: `validar_cpf`, `validar_cnpj` — se inválido, zerar campo e subtrair 0.1 da confiança.

2. **`gestao_advocacia/routes/procuracao.py`** (novo blueprint)
   - `POST /api/v1/clientes/extrair-procuracao` (`jwt_required`)
   - Aceita multipart/form-data com campo `arquivo`
   - Valida: mimetype em `[application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, image/jpeg, image/png]`, tamanho ≤ 10MB
   - Lê `User` logado → passa `nome_completo`/`numero_oab`/`sigla_oab_tribunal` para o service
   - Retorna JSON 200 com estrutura `{cliente: {...}, numero_processo, confianca}`
   - Erros:
     - 400 arquivo inválido ou tipo não suportado
     - 413 arquivo > 10MB
     - 422 extração falhou (Gemini retornou JSON inválido ou confiança < 0.2)
     - 502 Gemini API indisponível
     - 503 `GEMINI_API_KEY` não configurada

3. Registrar blueprint em `gestao_advocacia/routes/api_registry.py`.

### Testes

`gestao_advocacia/tests/test_procuracao_service.py`:
- Mock `google.generativeai.GenerativeModel.generate_content` com monkeypatch
- Teste 1: texto de procuração mock → extrai nome/CPF/endereço
- Teste 2: CPF inválido zerado, confiança reduzida
- Teste 3: sem outorgante claro → `confianca < 0.5`
- Teste 4: erro de rede Gemini → `raise ProcuracaoExtractionError`
- Teste 5: endpoint retorna 400 para tipo não suportado
- Teste 6: endpoint retorna 413 para arquivo > 10MB
- Teste 7: endpoint retorna 503 sem `GEMINI_API_KEY`
- Teste 8: DOCX converte via `python-docx` antes do Gemini

## Critérios de aceite

- [ ] Dependências adicionadas ao `requirements.in` e `requirements.lock` regenerado com hashes
- [ ] Service + rota funcionam end-to-end em dev local com key de teste
- [ ] 8/8 testes passando
- [ ] `ANTHROPIC_API_KEY` NÃO aparece em log/erro (validar no teste 7)
- [ ] CI verde (backend + backend-style)

## Branch e PR

- Branch: `feat/c1-extrator-procuracao`
- Título PR: `[C1] Backend: endpoint de extração de procuração via Gemini`
