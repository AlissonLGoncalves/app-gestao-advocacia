import { api } from './client'

const toQueryString = (params = {}) => {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value))
    }
  })
  const qs = query.toString()
  return qs ? `?${qs}` : ''
}

export const listProcuracoes = (casoId) =>
  api.get(`/procuracoes${toQueryString(casoId ? { caso_id: casoId } : {})}`)

export const uploadProcuracao = (casoId, file) => {
  const formData = new FormData()
  formData.append('file', file)
  if (casoId) {
    formData.append('caso_id', String(casoId))
  }
  return api.upload('/procuracoes/upload', formData)
}

export const analisarProcuracao = (id) => api.post(`/procuracoes/${id}/analisar`, {})
export const getAnalise = (id) => api.get(`/procuracoes/${id}/analise`)
export const deleteProcuracao = (id) => api.del(`/procuracoes/${id}`)

/** @param {object} payload */
export function createProcuracao(payload) {
  return api.post('/procuracoes', payload)
}
