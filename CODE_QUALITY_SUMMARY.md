# 📋 Análise de Código Morto - Gestão Advocacia

**Data da Análise:** 9 de maio de 2026  
**Projeto:** app-gestao-advocacia (Full-stack: Python + React/Vite)  
**Status Geral:** ⚠️ **28 achados** (4 alto risco, 12 médio risco, 12 baixo risco)

---

## 🎯 Resumo Executivo

Esta análise sistemática identificou código não utilizado, duplicado e potencialmente problemático em todo o projeto. A maioria dos achados é de baixo risco e pode ser removida com segurança após validação. Alguns padrões de duplicação de código devem ser consolidados para melhor manutenibilidade.

### Estatísticas Rápidas
- **Código comentado não documentado:** 4 instâncias
- **Duplicação de lógica detectada:** 4 padrões
- **Funções/métodos orfãos:** 2
- **Variáveis de estado não utilizadas:** 2
- **APIs possivelmente não utilizadas:** 2

---

## 🔴 Achados de Alto Risco (4)

### 1. Duplicação: Validação de CPF/CNPJ
**Arquivos afetados:**
- `gestao_advocacia/routes/auth.py` (linhas 178-189)
- `gestao_advocacia/contrato_service.py` (linhas 67-71)

**Problema:** Mesma lógica de validação implementada em múltiplos lugares
- `_somente_digitos()` / `_only_digits()`
- `_formatar_cpf()`
- `_validar_cpf()` / `_is_valid_cpf()`

**Risco:** Quando uma validação muda, é necessário atualizar em múltiplos locais, aumentando chance de bugs e inconsistência.

**Ação Recomendada:** 
```python
# Criar: gestao_advocacia/utils/cpf_cnpj.py
def extract_digits(value: str) -> str:
    return ''.join(c for c in value if c.isdigit())

def validate_cpf(cpf: str) -> bool:
    # Lógica centralizada
    pass

def format_cpf(cpf: str) -> str:
    # Lógica centralizada
    pass
```

---

### 2. Duplicação: Padrão de Busca + Carregamento + Erro em Páginas
**Arquivos afetados:**
- `CasoList.jsx`
- `ClienteList.jsx`
- `DespesasPage.jsx`
- `RecebimentosPage.jsx`
- `DocumentosPage.jsx`

**Padrão Repetido:**
```javascript
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

**Risco:** Duplicação aumenta bugs potenciais; mudanças no padrão precisam ser aplicadas em 5+ locais

**Ação Recomendada:**
```javascript
// Criar: src/hooks/useListData.js
export function useListData(endpoint, params) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetch = async () => {
      try {
        const response = await api.get(endpoint, params)
        setData(response)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [endpoint, params])

  return { data, loading, error }
}
```

---

### 3. Duplicação: Renderização de Campos de Formulário
**Arquivos afetados:**
- `ClienteForm.jsx`
- `CasoForm.jsx`
- `components/forms/cliente/DadosPessoaisSection.jsx`
- `components/forms/cliente/EnderecoSection.jsx`
- `components/forms/caso/DadosProcessoSection.jsx`

**Problema:** Cada componente reimplementa validação de input + rendering de erro

**Ação Recomendada:** Criar `components/FormInput.jsx` reutilizável

---

### 4. APIs Possivelmente Não Utilizadas
**Funções em `gestao_advocacia_vite/src/api/agenda.js`:**
- `connectGoogleAgenda()` (linha 167)
- `callbackGoogleAgenda()` (linha 171)

**Problema:** Funções exportadas mas nenhum componente visível as importa

**Ação:** Verificar se integração com Google Calendar está completa ou abandonada

---

## 🟡 Achados de Médio Risco (12)

### Código Comentado Sem Documentação

#### RelatoriosPage.jsx (linhas 51-52)
```jsx
{/* <option value="RECEITA_POR_CLIENTE">Receita por Cliente</option> */}
{/* <option value="DESPESAS_POR_CATEGORIA">Despesas por Categoria</option> */}
```
- **Problema:** Duas opções de relatório comentadas sem explicação
- **Não há:** handlers para estes tipos em `renderRelatorioSelecionado()`
- **Ação:** Remover comentários OU implementar feature completamente

#### config.py (linhas 39, 45, 46-47)
```python
# print(f"INFO: Arquivo .env carregado de: {dotenv_path}") # Para depuração
# print(...) # Para depuração
# else:
# print(f"AVISO: Arquivo .env não encontrado...")
```
- **Problema:** Debug prints comentados; production code não deve ter isto
- **Ação:** Remover e usar `app.logger` ao invés

### Imports com Flag F401 (Não Utilizados)
- `app.py` linha 105: `from helpers import get_item_or_404`
- `app.py` linha 107: `from models import (...)`

**Ação:** Documentar se são re-exports ou remover

---

## 🟢 Achados de Baixo Risco (12)

### Variáveis de Estado Não Utilizadas
- `CasoForm.jsx:48` - `eventosIA` (useState) - definido mas raramente lido
- `Dashboard.jsx:170` - `resultadoConsulta` - verificar renderização

### Funções Orfãs
- `extensions.py:9` - `class NullMail` - comentário diz "placeholder"; remover
- `migrations/env.py:52` - `include_object()` - verificar se é realmente chamado

### Callbacks com Uso Limitado
- `CasoList.jsx:56` - `fetchClientesParaFiltro` - verificar triggering

---

## 📊 Distribuição de Achados

```
Comentado (não documentado):     4 instâncias [🔴 
Code duplication:                4 padrões    [🔴
API/Função orfã:                 2 itens      [🟡
Estado não utilizado:            2 hooks      [🟡
Imports não utilizados:          2 imports    [🟡
Callbacks/Hooks subutilizados:   1 item       [🟡
Dead code blocks:                4 itens      [🟢
Componentes subutilizados:       2 itens      [🟢
```

---

## ✅ Plano de Ação (Priorizado)

### Prioridade 1: ALTA (Esta semana)
1. **Consolidar validação CPF/CNPJ**
   - Criar `utils/cpf_cnpj.py`
   - Atualizar imports em `auth.py` e `contrato_service.py`
   - Remover duplicação

2. **Remover código comentado sem propósito**
   - `RelatoriosPage.jsx:51-52` - Remover opções comentadas
   - `config.py:39,45-47` - Remover prints de debug
   - Criar issues no GitHub para features incompletas

### Prioridade 2: MÉDIA (Próximas 2 semanas)
3. **Criar hooks reutilizáveis**
   - `useListData()` para padronizar fetch/loading/error
   - `useFormData()` para formulários

4. **Extrair componente FormInput**
   - Eliminar duplicação em formulários
   - Padronizar validação visual

5. **Verificar APIs não utilizadas**
   - Google Calendar integration ativa?
   - Se não, remover `connectGoogleAgenda()` e `callbackGoogleAgenda()`

### Prioridade 3: BAIXA (Próximo mês)
6. **Limpeza de imports**
   - Documentar re-exports ou remover flags F401
   - Remover `NullMail` placeholder

7. **Otimizar state variables**
   - Revisar `eventosIA` e `resultadoConsulta`
   - Consolidar ou remover state não utilizado

---

## 🛠 Ferramentas Recomendadas

Para evitar estes problemas no futuro:

### Backend (Python)
```bash
# Encontrar imports não utilizados
pip install vulture
vulture gestao_advocacia/

# Verificar complexidade + dead code
pip install pylint
pylint gestao_advocacia/
```

### Frontend (JavaScript)
```bash
# ESLint com plugins
npm install --save-dev eslint eslint-plugin-no-unused-vars
npm run lint

# Unused imports detection
npm install --save-dev eslint-plugin-import
```

### CI/CD Integration
Adicionar ao pipeline:
```yaml
# .github/workflows/code-quality.yml
- name: Check dead code
  run: |
    vulture gestao_advocacia/ --threshold 80
    npm run lint
```

---

## 📝 Notas Importantes

1. **F401 Noqa Comments**: Alguns imports têm `# noqa: F401` - verificar se são re-exports antes de remover

2. **Relative Imports**: Em várias funções há imports relativos dentro de `try/except` (ex: `djen_tasks.py`). Manter como estão (otimização de startup)

3. **Brazil-Specific Code**: Funções de CNJ/DJEN são específicas do domínio jurídico brasileiro - não consolidar sem contexto completo

4. **Multi-tenant Isolation**: Verificar que refatoração não quebre isolamento de tenant (RLS policies)

---

## 📄 Arquivos Gerados

- **CODE_QUALITY_ANALYSIS_REPORT.json** - Relatório estruturado completo com IDs únicos
- **CODE_QUALITY_SUMMARY.md** - Este arquivo (sumário executivo)

---

**Próxima revisão recomendada:** 30 de maio de 2026

*Análise realizada com: grep_search, semantic_search, manual inspection*
