# ✅ Checklist de Refatoração Detalhada

**Status:** 🔴 Não Iniciado  
**Última atualização:** 9 de maio de 2026

---

## 🔴 FASE 1: Refatoração Crítica (Estimado: 1 semana)

### Tarefa 1.1: Consolidar Validação CPF/CNPJ

**Objetivo:** Eliminar duplicação de código entre `routes/auth.py` e `contrato_service.py`

#### 1.1.1 Criar novo arquivo `gestao_advocacia/utils/cpf_cnpj.py`
- [ ] Criar arquivo
- [ ] Implementar `extract_digits(value: str) -> str`
- [ ] Implementar `validate_cpf(cpf: str) -> bool`
- [ ] Implementar `format_cpf(cpf: str) -> str`
- [ ] Implementar `validate_cnpj(cnpj: str) -> bool` (se duplicado)
- [ ] Adicionar docstrings
- [ ] Adicionar type hints
- [ ] Criar testes unit em `tests/utils/test_cpf_cnpj.py`
- [ ] Executar testes: `pytest tests/utils/test_cpf_cnpj.py -v`

**Checklist de Teste:**
- [ ] CPF válido (11 dígitos) retorna True
- [ ] CPF inválido (< 11 dígitos) retorna False
- [ ] CPF com máscara é removida corretamente
- [ ] CPF é formatado com máscara corretamente
- [ ] CNPJ (se aplicável) segue mesmo padrão

#### 1.1.2 Atualizar `gestao_advocacia/routes/auth.py`
- [ ] Remover função `_somente_digitos()`
- [ ] Remover função `_formatar_cpf()`
- [ ] Remover função `_validar_cpf()`
- [ ] Adicionar import: `from utils.cpf_cnpj import extract_digits, validate_cpf, format_cpf`
- [ ] Substituir `_somente_digitos()` por `extract_digits()`
- [ ] Substituir `_formatar_cpf()` por `format_cpf()`
- [ ] Substituir `_validar_cpf()` por `validate_cpf()`
- [ ] Executar testes: `pytest tests/routes/test_auth.py -v`
- [ ] Testar fluxo de registro completo em dev

**Locais específicos a atualizar:**
```python
# Linhas 178-189 em auth.py
# Procure por:
# - _somente_digitos(cpf)
# - _formatar_cpf(cpf)
# - _validar_cpf(cpf)
```

#### 1.1.3 Atualizar `gestao_advocacia/contrato_service.py`
- [ ] Remover função `_only_digits()`
- [ ] Remover função `_is_valid_cpf()`
- [ ] Adicionar import: `from utils.cpf_cnpj import extract_digits, validate_cpf`
- [ ] Substituir `_only_digits()` por `extract_digits()`
- [ ] Substituir `_is_valid_cpf()` por `validate_cpf()`
- [ ] Executar testes: `pytest tests/test_contrato_service.py -v`

**Locais específicos a atualizar:**
```python
# Linhas 67-71 em contrato_service.py
# Procure por:
# - _only_digits(value)
# - _is_valid_cpf(cpf)
```

#### 1.1.4 Verificação Final
- [ ] Executar grep para verificar se há ainda duplicatas:
  ```bash
  grep -r "def.*validate.*cpf" gestao_advocacia/
  grep -r "_only_digits\|_somente_digitos" gestao_advocacia/
  ```
- [ ] Resultado esperado: apenas em `utils/cpf_cnpj.py`
- [ ] Executar suite de testes: `pytest -v`

---

### Tarefa 1.2: Remover Código Comentado

**Objetivo:** Eliminar 4 blocos de código comentado não documentado

#### 1.2.1 Limpar `gestao_advocacia_vite/src/RelatoriosPage.jsx`
- [ ] Abrir arquivo `RelatoriosPage.jsx`
- [ ] Navegar para linhas 51-52
- [ ] **ANTES:**
  ```jsx
  <select>
    <option value="CONTAS_A_RECEBER">Contas a Receber</option>
    <option value="CONTAS_A_PAGAR">Contas a Pagar</option>
    {/* <option value="RECEITA_POR_CLIENTE">Receita por Cliente</option> */}
    {/* <option value="DESPESAS_POR_CATEGORIA">Despesas por Categoria</option> */}
  </select>
  ```
- [ ] **DEPOIS:**
  ```jsx
  <select>
    <option value="CONTAS_A_RECEBER">Contas a Receber</option>
    <option value="CONTAS_A_PAGAR">Contas a Pagar</option>
  </select>
  ```
- [ ] Remover linhas 51-52
- [ ] Salvar arquivo
- [ ] Verificar se há quebra visual: `npm run dev` e testar página

#### 1.2.2 Limpar `gestao_advocacia/config.py`
- [ ] Abrir arquivo `config.py`
- [ ] Navegar para linha 39
- [ ] **ANTES (linha 39):**
  ```python
  # print(f"INFO: Arquivo .env carregado de: {dotenv_path}") # Para depuração
  ```
- [ ] **DEPOIS:** Remover linha inteira
- [ ] Navegar para linha 45
- [ ] **ANTES (linha 45):**
  ```python
  # print(f"INFO: Arquivo .env carregado de: {env_local_path}") # Para depuração
  ```
- [ ] **DEPOIS:** Remover linha inteira
- [ ] Verificar linhas 46-47 também:
  ```python
  # else:
  #     print(f"AVISO: Arquivo .env não encontrado...")
  ```
- [ ] Se houver, deixar somente o `else:` e usar logging ao invés:
  ```python
  else:
      app.logger.warning("Arquivo .env não encontrado em")
  ```
- [ ] Salvar arquivo
- [ ] Executar testes: `pytest tests/test_config.py -v`

#### 1.2.3 Verificação Final
- [ ] Executar grep para verificar se há mais code comentado:
  ```bash
  # Procure por padrões suspeitos
  grep -r "^\s*#.*print\|^\s*#.*TODO\|^\s*#.*FIXME" gestao_advocacia_vite/src --include="*.jsx" --include="*.js" | grep -v "// " | head -20
  grep -r "^\s*#.*print" gestao_advocacia --include="*.py" | head -20
  ```
- [ ] Documentar qualquer comentário de contexto relevante
- [ ] Rodar linter: `npm run lint` e `pylint gestao_advocacia/`

---

## 🟡 FASE 2: Otimização de Hooks (Estimado: 1-2 semanas)

### Tarefa 2.1: Criar Hook Reutilizável `useListData`

**Objetivo:** Consolidar padrão de fetch+loading+error usado em 5+ componentes

#### 2.1.1 Criar novo hook `gestao_advocacia_vite/src/hooks/useListData.js`

- [x] Criar arquivo `src/hooks/useListData.js`
- [x] Implementar função principal:

```javascript
// src/hooks/useListData.js
import { useState, useEffect } from 'react'
import { api } from '../api/client'

/**
 * Hook para carregar lista de dados com tratamento automático de loading e erro
 * 
 * @param {string} endpoint - URL do endpoint (ex: '/api/v1/casos')
 * @param {object} params - Parâmetros opcionais para query string
 * @param {boolean} autoFetch - Se deve fazer fetch automaticamente (padrão: true)
 * @returns {object} { data, loading, error, refetch }
 */
export function useListData(endpoint, params = {}, autoFetch = true) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(autoFetch)
  const [error, setError] = useState(null)
  const [refetchCount, setRefetchCount] = useState(0)

  useEffect(() => {
    if (!autoFetch) return

    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await api.get(endpoint, { params })
        setData(response.data || response)
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Erro ao carregar dados')
        setData([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [endpoint, JSON.stringify(params), refetchCount])

  const refetch = () => setRefetchCount(c => c + 1)

  return { data, loading, error, refetch }
}

export default useListData
```

- [x] Adicionar JSDoc completo
- [ ] Testar com fetch simulado: `npm run test -- useListData.test.js`

#### 2.1.2 Criar arquivo de testes `src/hooks/useListData.test.js`

- [ ] Criar arquivo de teste
- [ ] Testar caso de sucesso
- [ ] Testar caso de erro
- [ ] Testar refetch
- [ ] Testar com parâmetros diferentes
- [ ] Executar: `npm run test -- useListData.test.js`

---

#### 2.1.3 Refatorar `gestao_advocacia_vite/src/CasoList.jsx`

**ANTES (primeiras 60 linhas aproximadamente):**
```javascript
const [casos, setCasos] = useState([])
const [clientes, setClientes] = useState([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState('')

const fetchCasos = useCallback(async () => {
  setLoading(true)
  try {
    const response = await api.get(...)
    setCasos(response)
  } catch (err) {
    setError(err.message)
  } finally {
    setLoading(false)
  }
}, [])

useEffect(() => {
  fetchCasos()
}, [])
```

**DEPOIS:**
```javascript
import useListData from '../hooks/useListData'

// Substituir todo o bloco acima por:
const { data: casos, loading, error, refetch: refetchCasos } = useListData('/api/v1/casos')
const { data: clientes } = useListData('/api/v1/clientes')
```

- [x] Abrir arquivo `CasoList.jsx`
- [x] Adicionar import: `import useListData from '../hooks/useListData'`
- [x] Localizar linhas com `const [casos, setCasos]` e bloco correlato
- [x] Substituir por `useListData` (ver acima)
- [x] Remover `const [loading, setLoading]`
- [x] Remover `const [error, setError]`
- [x] Verificar se há `setCasos()` sendo chamado e substituir por refetch se necessário
- [x] Executar: `npm run test` para verificar se tudo funciona
- [ ] Testar página em dev: `npm run dev` → Casos → Verificar se lista carrega

---

#### 2.1.4 Refatorar `gestao_advocacia_vite/src/ClienteList.jsx`

- [x] Repetir processo de 2.1.3
- [x] Linhas-alvo: `const [clientes, setClientes]`, `const [loading, setLoading]`, `const [error, setError]`
- [ ] Testar: `npm run dev` → Clientes → Verificar lista
- [ ] Verificar filtros e busca ainda funcionam

---

#### 2.1.5 Refatorar `gestao_advocacia_vite/src/DespesasPage.jsx`

- [x] Localizar padrão de fetch
- [x] Aplicar `useListData`
- [ ] Testar página: `npm run dev` → Despesas

---

#### 2.1.6 Refatorar `gestao_advocacia_vite/src/RecebimentosPage.jsx`

- [x] Localizar padrão de fetch
- [x] Aplicar `useListData`
- [ ] Testar página: `npm run dev` → Recebimentos

---

#### 2.1.7 Refatorar `gestao_advocacia_vite/src/DocumentosPage.jsx`

- [x] Localizar padrão de fetch
- [x] Aplicar `useListData`
- [ ] Testar página: `npm run dev` → Documentos

---

#### 2.1.8 Verificação Final

- [x] Executar suite completa: `npm run test`
- [ ] Verificar cobertura: `npm run test -- --coverage`
- [x] Executar linter: `npm run lint`
- [ ] Testar navegação manual em todas as 5 páginas refatoradas
- [ ] Verificar que filtros e busca funcionam

---

## 🟡 FASE 3: Componentes Reutilizáveis (Estimado: 1-2 semanas)

### Tarefa 3.1: Extrair Componente `FormInput`

**Objetivo:** Consolidar renderização de input + validação em 5+ componentes

#### 3.1.1 Criar novo componente `gestao_advocacia_vite/src/components/FormInput.jsx`

- [x] Criar arquivo `components/FormInput.jsx`
- [x] Implementar componente:

```jsx
// src/components/FormInput.jsx
import React from 'react'
import PropTypes from 'prop-types'

/**
 * Componente de input reutilizável com validação e mensagem de erro
 */
export default function FormInput({
  label,
  value,
  onChange,
  error,
  placeholder,
  type = 'text',
  maxLength,
  required = false,
  disabled = false,
  className = '',
  inputClassName = '',
  helpText,
  autoComplete,
  ...props
}) {
  const hasError = Boolean(error)

  return (
    <div className={`mb-3 ${className}`}>
      {label && (
        <label className="form-label">
          {label}
          {required && <span className="text-danger ms-1">*</span>}
        </label>
      )}
      <input
        type={type}
        className={`form-control ${hasError ? 'is-invalid' : ''} ${inputClassName}`}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        required={required}
        autoComplete={autoComplete}
        {...props}
      />
      {error && (
        <div className="invalid-feedback d-block">
          {error}
        </div>
      )}
      {helpText && !error && (
        <small className="form-text text-muted d-block mt-1">
          {helpText}
        </small>
      )}
    </div>
  )
}

FormInput.propTypes = {
  label: PropTypes.string,
  value: PropTypes.any.isRequired,
  onChange: PropTypes.func.isRequired,
  error: PropTypes.string,
  placeholder: PropTypes.string,
  type: PropTypes.string,
  maxLength: PropTypes.number,
  required: PropTypes.bool,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  inputClassName: PropTypes.string,
  helpText: PropTypes.string,
  autoComplete: PropTypes.string,
}
```

- [ ] Adicionar testes em `components/FormInput.test.jsx`
- [ ] Testar renderização
- [ ] Testar validação (com erro)
- [ ] Testar sem erro

---

#### 3.1.2 Refatorar `gestao_advocacia_vite/src/ClienteForm.jsx`

**ANTES:**
```jsx
<div className="mb-3">
  <label className="form-label">
    Nome/Razão Social {formData.tipo_pessoa === 'F' && <span className="text-danger">*</span>}
  </label>
  <input
    type="text"
    className={`form-control ${formErrors.nome_razao_social ? 'is-invalid' : ''}`}
    value={formData.nome_razao_social}
    onChange={(e) => setFormData({...formData, nome_razao_social: e.target.value})}
    placeholder="Insira o nome completo ou razão social"
    disabled={isEditing}
  />
  {formErrors.nome_razao_social && (
    <div className="invalid-feedback d-block">
      {formErrors.nome_razao_social}
    </div>
  )}
</div>
```

**DEPOIS:**
```jsx
import FormInput from '../components/FormInput'

<FormInput
  label="Nome/Razão Social"
  value={formData.nome_razao_social}
  onChange={(e) => setFormData({...formData, nome_razao_social: e.target.value})}
  error={formErrors.nome_razao_social}
  placeholder="Insira o nome completo ou razão social"
  disabled={isEditing}
  required={formData.tipo_pessoa === 'F'}
/>
```

**Processo:**
- [x] Adicionar import no topo: `import FormInput from '../components/FormInput'`
- [x] Procurar por padrão de `<div className="mb-3">` + `<label>` + `<input>` + erro
- [x] Substituir por `<FormInput>`
- [ ] Repetir para todos os inputs do formulário
- [ ] Testar: `npm run dev` → Clientes → Editar cliente → Validar todos os campos
- [ ] Verificar se os estilos se mantêm iguais

---

#### 3.1.3 Refatorar `gestao_advocacia_vite/src/CasoForm.jsx`

- [x] Repetir processo de 3.1.2
- [ ] Procure por inputs de: Número do Processo, Area de Direito, Status, etc.
- [ ] Testar: `npm run dev` → Casos → Novo Caso → Validar formulário

---

#### 3.1.4 Refatorar Seções de Formulário

Procure por estes componentes e refatore seus inputs:

- [x] `src/components/forms/cliente/DadosPessoaisSection.jsx`
- [x] `src/components/forms/cliente/EnderecoSection.jsx`
- [x] `src/components/forms/caso/DadosProcessoSection.jsx`
- [ ] Qualquer outro componente com `<input>` + validação similar

---

#### 3.1.5 Verificação Final

- [x] Executar suite de testes: `npm run test`
- [ ] Executar linter: `npm run lint`
- [ ] Testar manualmente:
  - [ ] Abrir novo cliente
  - [ ] Testar validação
  - [ ] Testar salvamento
  - [ ] Testar edição
  - [ ] Repetir para Casos
- [ ] Verificar visualmente se os inputs estão iguais ao antes

---

## 🟢 FASE 4: Limpeza Final (Estimado: 1 semana)

### Tarefa 4.1: Auditar APIs do Google Agenda

- [ ] Executar busca:
  ```bash
  grep -r "connectGoogleAgenda" gestao_advocacia_vite/src
  grep -r "callbackGoogleAgenda" gestao_advocacia_vite/src
  ```
- [ ] Se encontrado: Documentar onde é usado
- [ ] Se **não** encontrado: Remover funções do arquivo `src/api/agenda.js`
- [ ] Executar testes: `npm run test`

---

### Tarefa 4.2: Limpar Imports Não Utilizados

#### 4.2.1 Verificar `gestao_advocacia/app.py`

- [ ] Abrir arquivo `app.py`
- [ ] Linha 105: `from helpers import get_item_or_404  # noqa: E402, F401`
  - [ ] Procurar se `get_item_or_404` é usado em outro lugar do projeto
  - [ ] Se **SIM**: Deixar como está (é re-export)
  - [ ] Se **NÃO**: Remover import

- [ ] Linha 107: `from models import (...)`
  - [ ] Procurar se modelos são usados em outro lugar
  - [ ] Se **SIM**: Deixar como está
  - [ ] Se **NÃO**: Remover imports

#### 4.2.2 Executar Pylint

- [ ] Executar: `pylint gestao_advocacia/app.py --disable=all --enable=F401`
- [ ] Revisar se há mais imports não utilizados
- [ ] Remover conforme necessário

---

### Tarefa 4.3: Remover Classes/Funções Orfãs

#### 4.3.1 Remover `NullMail` em `extensions.py`

- [ ] Abrir arquivo `gestao_advocacia/extensions.py`
- [ ] Linha 9: Procurar por `class NullMail`
- [ ] Se realmente não é usado, remover classe inteira
- [ ] Executar testes: `pytest -v`

#### 4.3.2 Revisar `include_object()` em `migrations/env.py`

- [ ] Abrir arquivo `gestao_advocacia/migrations/env.py`
- [ ] Linha 52: Procurar por `def include_object()`
- [ ] Esta função é padrão do Alembic, então **DEIXAR COMO ESTÁ**
- [ ] Adicionar comentário explicativo se necessário

---

## 🧪 FASE 5: Testes e Validação Final (Estimado: 3-5 dias)

### Tarefa 5.1: Testes Backend

- [ ] Executar suite de testes:
  ```bash
  cd gestao_advocacia
  pytest tests/ -v --cov=gestao_advocacia
  ```
- [ ] Resultado esperado: 100% de sucesso (ou mesmo que antes)
- [ ] Coverage esperada: ≥ 80%
- [ ] Executar type check:
  ```bash
  mypy gestao_advocacia/ --ignore-missing-imports
  ```

---

### Tarefa 5.2: Testes Frontend

- [ ] Executar suite de testes:
  ```bash
  cd gestao_advocacia_vite
  npm run test -- --coverage
  ```
- [ ] Resultado esperado: 100% de sucesso (ou mesmo que antes)
- [ ] Coverage esperada: ≥ 15% (threshold atual)

---

### Tarefa 5.3: Linters

- [ ] Backend:
  ```bash
  pylint gestao_advocacia/ --disable=all --enable=F401
  ```
- [ ] Frontend:
  ```bash
  npm run lint
  ```
- [ ] Resultado esperado: 0 erros

---

### Tarefa 5.4: Build e Deploy Local

- [ ] Build backend:
  ```bash
  cd gestao_advocacia
  python app.py  # ou conforme seu método de run
  ```
- [ ] Build frontend:
  ```bash
  cd gestao_advocacia_vite
  npm run build
  ```
- [ ] Teste em dev:
  ```bash
  npm run dev
  ```
- [ ] Testar fluxos principais:
  - [ ] Login/Register
  - [ ] Criar Cliente
  - [ ] Criar Caso
  - [ ] Criar Despesa
  - [ ] Criar Recebimento
  - [ ] Gerar Relatório

---

### Tarefa 5.5: Criar PR Consolidada

- [ ] Criar branch: `git checkout -b refactor/code-cleanup-2026-05`
- [ ] Commit: `git add .`
- [ ] Mensagem:
  ```
  refactor: consolidate CPF/CNPJ validation, remove dead code, extract useListData hook

  - Consolidate CPF/CNPJ validation logic into utils/cpf_cnpj.py
  - Remove commented-out code blocks
  - Extract useListData hook for list pages
  - Extract FormInput component for reusable form fields
  - Verify Google Agenda API usage
  - Clean up unused imports and orphaned functions

  Closes: #XXXX
  ```
- [ ] Push: `git push origin refactor/code-cleanup-2026-05`
- [ ] Criar PR no GitHub com link para este documento

---

## 📊 Status de Conclusão

```
FASE 1 - Refatoração Crítica
[........................................ ] 0%

FASE 2 - Otimização de Hooks
[........................................ ] 0%

FASE 3 - Componentes Reutilizáveis
[........................................ ] 0%

FASE 4 - Limpeza Final
[........................................ ] 0%

FASE 5 - Testes e Validação
[........................................ ] 0%

TOTAL: [0/38 tarefas] 0%
```

---

**Última atualização:** 9 de maio de 2026  
**Próxima revisão:** [A definir após iniciar FASE 1]
