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

export const listOabs = () => api.get('/djen/oabs')
export const createOab = (data) => api.post('/djen/oabs', data)
export const deleteOab = (id) => api.del(`/djen/oabs/${id}`)

export function listPublicacoes(params = {}) {
  return api.get(`/djen/publicacoes${toQueryString(params)}`)
}

export const getPublicacao = (id) => api.get(`/djen/publicacoes/${id}`)
export const updatePublicacao = (id, payload) => api.patch(`/djen/publicacoes/${id}`, payload)

export const vincularDecisao = (pubId, casoId) =>
  api.post(`/djen/triagem/${pubId}/vincular-caso`, { caso_id: casoId })

export const vincularPublicacao = (id, payload) =>
  api.post(`/djen/publicacoes/${id}/vincular`, payload)

/** @param {number|string} id */
export function ignorarPublicacao(id) {
  return api.post(`/djen/publicacoes/${id}/ignorar`, {})
}

export const listTriagem = (params = {}) => api.get(`/djen/triagem${toQueryString(params)}`)
export const ignorarTriagem = (pubId, motivo) =>
  api.post(`/djen/triagem/${pubId}/ignorar`, { motivo })
export const processarLoteTriagem = (pubIds = []) =>
  api.post('/djen/triagem/processar-lote', { pub_ids: pubIds })
export const criarClienteCasoTriagem = (pubId, payload) =>
  api.post(`/djen/triagem/${pubId}/criar-cliente-caso`, payload).catch((error) => {
    if (error?.status === 409) {
      return error.payload || {}
    }
    throw error
  })

export const autoVincularPendentes = () => api.post('/djen/triagem/auto-vincular-pendentes', {})

export const getAnaliseIA = (pubId) => api.get(`/djen/triagem/${pubId}/analise-ia`)

// B1 (2026-05-01): /djen/sync agora retorna 202 + job_id (async).
// Use getSyncJobStatus(id) em polling para acompanhar progresso.
export const syncDjen = (dias) => api.post('/djen/sync', { dias })
export const getSyncJobStatus = (jobId) => api.get(`/djen/sync/${jobId}`)

export const baixarCertidao = (pubId) => api.getBlob(`/djen/publicacoes/${pubId}/certidao`)

export const getMonitoramentoStatus = () => api.get('/djen/monitoramento/status')
export const triggerBackfill = (oabId) =>
  api.post(oabId ? `/djen/oabs/${oabId}/backfill` : '/djen/backfill', {})
