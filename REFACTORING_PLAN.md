# 🔧 Plano de Refatoração - Análise de Qualidade de Código

**Data:** 9 de maio de 2026  
**Status:** 📋 Planejado (0 de 38 tarefas iniciadas)  
**Tempo Estimado:** 4-5 semanas  

---

## 📊 Resumo dos Achados

```
┌──────────────────────────────────────────────┐
│  28 ACHADOS IDENTIFICADOS                    │
├──────────────────────────────────────────────┤
│  🔴 ALTO RISCO (4)       ████░░░░░░ 14%     │
│  🟡 MÉDIO RISCO (12)     ████████░░ 43%     │
│  🟢 BAIXO RISCO (12)     ████████░░ 43%     │
└──────────────────────────────────────────────┘
```

---

## 🎯 Prioridades por Fase

### FASE 1: Refatoração Crítica (Semana 1-2) 
**Impact:** Alta | **Complexidade:** Média

#### 1️⃣ Consolidar Validação CPF/CNPJ [🔴 ALTO RISCO]

**Problema:** Código duplicado em 2+ arquivos
```
❌ routes/auth.py          (linhas 178-189)
❌ contrato_service.py     (linhas 67-71)
```

**Solução:**
```python
# Criar: gestao_advocacia/utils/cpf_cnpj.py
✓ extract_digits(value: str) -> str
✓ validate_cpf(cpf: str) -> bool
✓ format_cpf(cpf: str) -> str
```

**Subtarefas:**
- [ ] Criar `utils/cpf_cnpj.py` com funções centralizadas
- [ ] Atualizar `routes/auth.py` para usar nova util
- [ ] Atualizar `contrato_service.py` para usar nova util
- [ ] Remover código duplicado original

**Verificação:**
```bash
# Backend: grep para verificar se há duplicatas
grep -r "def.*valid.*cpf" gestao_advocacia/
grep -r "_only_digits" gestao_advocacia/
```

---

#### 2️⃣ Remover Código Comentado [🔴 ALTO RISCO]

**Código Morto Encontrado:**

| Arquivo | Linhas | Conteúdo |
|---------|--------|----------|
| `RelatoriosPage.jsx` | 51-52 | 2 opções de relatório comentadas |
| `config.py` | 39, 45 | Debug prints comentados |

**Subtarefas:**
- [ ] Remover comentários em `RelatoriosPage.jsx` (linhas 51-52)
  ```jsx
  ❌ {/* <option value="RECEITA_POR_CLIENTE">Receita por Cliente</option> */}
  ❌ {/* <option value="DESPESAS_POR_CATEGORIA">Despesas por Categoria</option> */}
  ```

- [ ] Remover debug prints em `config.py`
  ```python
  ❌ # print(f"INFO: Arquivo .env carregado de: {dotenv_path}") # Para depuração
  ❌ # print(f"INFO: Arquivo .env carregado de: {env_local_path}") # Para depuração
  ```

**Resultado Esperado:** 100% de remoção de código não documentado

---

### FASE 2: Otimização de Hooks (Semana 2-3)
**Impact:** Média | **Complexidade:** Média

#### 3️⃣ Criar Hook Reutilizável `useListData` [🟡 MÉDIO RISCO]

**Problema:** Mesmo padrão de fetch+loading+error em 5+ componentes

```javascript
// ❌ PADRÃO DUPLICADO (encontrado em):
// - CasoList.jsx
// - ClienteList.jsx
// - DespesasPage.jsx
// - RecebimentosPage.jsx
// - DocumentosPage.jsx

const [dados, setDados] = useState([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState('')

const fetchDados = useCallback(async () => {
  setLoading(true)
  try {
    const response = await api.get(...)
    setDados(response)
  } catch (err) {
    setError(err.message)
  } finally {
    setLoading(false)
  }
}, [])

useEffect(() => {
  fetchDados()
}, [])
```

**Solução:**
```javascript
// ✓ Criar: src/hooks/useListData.js
export function useListData(endpoint, params = {}) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refetch, setRefetch] = useState(0)

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true)
        const response = await api.get(endpoint, { params })
        setData(response)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [endpoint, refetch, params])

  return { data, loading, error, refetch: () => setRefetch(r => r + 1) }
}
```

**Subtarefas:**
- [ ] Criar `src/hooks/useListData.js`
- [ ] Refatorar `CasoList.jsx` para usar hook
- [ ] Refatorar `ClienteList.jsx` para usar hook
- [ ] Refatorar `DespesasPage.jsx` para usar hook
- [ ] Refatorar `RecebimentosPage.jsx` para usar hook
- [ ] Refatorar `DocumentosPage.jsx` para usar hook
- [ ] Executar testes para cada página refatorada

**Ganho Esperado:** 150+ linhas de código removidas

---

### FASE 3: Componentes Reutilizáveis (Semana 3-4)
**Impact:** Média | **Complexidade:** Alta

#### 4️⃣ Extrair Componente `FormInput` [🟡 MÉDIO RISCO]

**Problema:** Renderização de campos com validação duplicada em 5+ componentes

```javascript
// ❌ DUPLICAÇÃO ENCONTRADA EM:
// - ClienteForm.jsx
// - CasoForm.jsx
// - DadosPessoaisSection.jsx
// - EnderecoSection.jsx
// - DadosProcessoSection.jsx
```

**Solução:**
```jsx
// ✓ Criar: src/components/FormInput.jsx
export default function FormInput({
  label,
  value,
  onChange,
  error,
  placeholder,
  type = 'text',
  maxLength,
  required,
  disabled,
  ...props
}) {
  return (
    <div className="mb-3">
      {label && (
        <label className="form-label">
          {label}
          {required && <span className="text-danger">*</span>}
        </label>
      )}
      <input
        type={type}
        className={`form-control ${error ? 'is-invalid' : ''}`}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        {...props}
      />
      {error && <div className="invalid-feedback d-block">{error}</div>}
    </div>
  )
}
```

**Subtarefas:**
- [ ] Criar `components/FormInput.jsx` com props bem definidas
- [ ] Refatorar `ClienteForm.jsx` para usar novo componente
- [ ] Refatorar `CasoForm.jsx` para usar novo componente
- [ ] Refatorar seções de formulário para usar novo componente
- [ ] Testar validação e estilos em todos os formulários

**Ganho Esperado:** 80+ linhas removidas

---

### FASE 4: Limpeza e Validação (Semana 4-5)
**Impact:** Baixa | **Complexidade:** Baixa

#### 5️⃣ Auditar APIs Possivelmente Não Utilizadas [🟡 MÉDIO RISCO]

```javascript
// ❌ FUNÇÕES ORFÃS EM: src/api/agenda.js
// - connectGoogleAgenda() (linha 167)
// - callbackGoogleAgenda() (linha 171)
```

**Subtarefas:**
- [ ] Buscar por `connectGoogleAgenda` em todo o projeto
  ```bash
  grep -r "connectGoogleAgenda" gestao_advocacia_vite/
  ```
- [ ] Buscar por `callbackGoogleAgenda` em todo o projeto
  ```bash
  grep -r "callbackGoogleAgenda" gestao_advocacia_vite/
  ```
- [ ] Se não encontrado: remover ou documentar como deprecated
- [ ] Se encontrado: validar que está integrado corretamente

---

#### 6️⃣ Limpar Imports Não Utilizados [🟡 MÉDIO RISCO]

| Arquivo | Linha | Import | Status |
|---------|-------|--------|--------|
| `app.py` | 105 | `from helpers import get_item_or_404` | F401 |
| `app.py` | 107 | `from models import (...)` | F401 |

**Subtarefas:**
- [ ] Verificar se `get_item_or_404` é re-exportado
- [ ] Verificar se `models` são re-exportados
- [ ] Se sim: adicionar `__all__` documentando re-exports
- [ ] Se não: remover imports
- [ ] Rodar pylint para verificar F401

---

#### 7️⃣ Remover Classes/Funções Orfãs [🟢 BAIXO RISCO]

| Arquivo | Linha | Item | Motivo |
|---------|-------|------|--------|
| `extensions.py` | 9 | `class NullMail` | Placeholder sem uso |
| `migrations/env.py` | 52 | `include_object()` | Verificar se é realmente chamado |

**Subtarefas:**
- [ ] Remover `NullMail` em `extensions.py` se não realmente utilizado
- [ ] Verificar se `include_object()` é chamado pelo Alembic
- [ ] Remover se orfão

---

## 🧪 Teste e Validação

### Pré-Refatoração
```bash
# Backend
cd gestao_advocacia
pytest tests/
mypy gestao_advocacia/
pylint gestao_advocacia/ --disable=all --enable=F401

# Frontend
cd gestao_advocacia_vite
npm run lint
npm run test
npm run build
```

### Pós-Refatoração
```bash
# Executar mesmos testes acima
# Além de:

# Vulture (detecta código morto em Python)
pip install vulture
vulture gestao_advocacia/ --threshold 80

# Verificar duplicações
npm install --save-dev copy-webpack-plugin
npm run build -- --analyze
```

---

## 📈 Métricas de Sucesso

| Métrica | Antes | Depois | Meta |
|---------|-------|--------|------|
| Linhas duplicadas | ~200 | ~50 | ✅ 75% redução |
| Código comentado | 4 blocos | 0 | ✅ 100% removido |
| Componentes reutilizáveis | 0 | 2 | ✅ FormInput + useListData |
| Import F401 | 2 | 0 | ✅ 100% limpo |
| Cyclomatic complexity | Não medido | < 8 | ✅ Refatorar hooks |

---

## ⚠️ Riscos Identificados

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Quebrar funcionalidade ao refatorar CPF | Baixa | Alto | Criar testes unit específicos antes |
| Hooks criados com bugs | Média | Médio | Testar cada página após refatoração |
| Re-export acidentalmente removido | Baixa | Alto | Verificar `__all__` em app.py |

---

## 🚀 Próximas Ações

1. **Hoje:** Revisar este plano com o time
2. **Amanhã:** Iniciar FASE 1 (CPF/CNPJ + Código comentado)
3. **Próxima Semana:** FASE 2 (useListData hook)
4. **2 Semanas:** FASE 3 (FormInput component)
5. **3 Semanas:** FASE 4 (Limpeza)
6. **4 Semanas:** Criar PR consolidada, revisar e fazer merge

---

## 📚 Referências

- [Arquivo: CODE_QUALITY_ANALYSIS_REPORT.json](./CODE_QUALITY_ANALYSIS_REPORT.json) - Análise técnica completa
- [Arquivo: CODE_QUALITY_SUMMARY.md](./CODE_QUALITY_SUMMARY.md) - Sumário detalhado
- [Tarefa: REFACTORING_TASKS.md](./REFACTORING_TASKS.md) - Checklist de subtarefas

---

**Preparado por:** GitHub Copilot Analysis  
**Revisado por:** [Seu time]  
**Aprovado em:** [Data]
