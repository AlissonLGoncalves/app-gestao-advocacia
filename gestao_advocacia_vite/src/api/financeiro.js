import { api } from './client.js'

function toQueryString(params) {
  const search = new URLSearchParams()

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') {
      return
    }

    search.set(key, String(value))
  })

  const query = search.toString()
  return query ? `?${query}` : ''
}

function normalizeListPayload(payload, key) {
  if (Array.isArray(payload)) {
    return payload
  }

  return payload?.[key] || []
}

export async function listRecebimentos(params = {}) {
  const data = await api.get(`/recebimentos/${toQueryString(params)}`)
  return normalizeListPayload(data, 'recebimentos')
}

export function getRecebimento(id) {
  return api.get(`/recebimentos/${id}`)
}

export function createRecebimento(body) {
  return api.post('/recebimentos/', body)
}

export function updateRecebimento(id, body) {
  return api.put(`/recebimentos/${id}`, body)
}

export function deleteRecebimento(id) {
  return api.del(`/recebimentos/${id}`)
}

export function marcarRecebimentoPago(id, body = {}) {
  return api.put(`/recebimentos/${id}`, body)
}

/**
 * Cria uma serie de recebimentos (PARCELADO ou RECORRENTE).
 *
 * Body esperado pelo backend (POST /recebimentos/serie):
 *   tipo            "PARCELADO" | "RECORRENTE"
 *   frequencia      "MENSAL" | "SEMANAL" | "QUINZENAL" | "ANUAL"
 *   valor_parcela   number > 0
 *   total_parcelas  int (obrigatorio se PARCELADO; default 12 se RECORRENTE)
 *   data_inicio     "YYYY-MM-DD"
 *   descricao       string
 *   categoria?, cliente_id?, caso_id?, notas?
 *
 * Resposta: { recorrencia_id, tipo, total_geradas, parcelas: [...] }
 */
export function createRecebimentoSerie(body) {
  return api.post('/recebimentos/serie', body)
}

export async function listDespesas(params = {}) {
  const data = await api.get(`/despesas/${toQueryString(params)}`)
  return normalizeListPayload(data, 'despesas')
}

export function getDespesa(id) {
  return api.get(`/despesas/${id}`)
}

export function createDespesa(body) {
  return api.post('/despesas/', body)
}

export function updateDespesa(id, body) {
  return api.put(`/despesas/${id}`, body)
}

export function deleteDespesa(id) {
  return api.del(`/despesas/${id}`)
}

export function marcarDespesaPaga(id, body = {}) {
  return api.put(`/despesas/${id}`, body)
}

/**
 * Cria uma serie de despesas (PARCELADO ou RECORRENTE).
 * Espelha createRecebimentoSerie. Body: tipo, frequencia, valor_parcela,
 * total_parcelas, data_inicio, descricao, fornecedor?, categoria?,
 * cliente_id?, caso_id?, notas?.
 */
export function createDespesaSerie(body) {
  return api.post('/despesas/serie', body)
}

export function getResumoFinanceiro(params = {}) {
  return api.get(`/dashboard/stats${toQueryString(params)}`)
}

export function getRelatorioContasAReceber(params = {}) {
  return api.get(`/relatorios/contas-a-receber${toQueryString(params)}`)
}

export function getRelatorioContasAPagar(params = {}) {
  return api.get(`/relatorios/contas-a-pagar${toQueryString(params)}`)
}

export function downloadRelatorioContasAReceber(params = {}) {
  return api.getBlob(`/relatorios/contas-a-receber${toQueryString(params)}`)
}

export function downloadRelatorioContasAPagar(params = {}) {
  return api.getBlob(`/relatorios/contas-a-pagar${toQueryString(params)}`)
}

export function getRelatorioFluxoCaixa(ano) {
  return api.get(`/relatorios/fluxo-caixa${toQueryString({ ano })}`)
}

export function getRelatorioCasosStatus() {
  return api.get('/relatorios/casos-status')
}
