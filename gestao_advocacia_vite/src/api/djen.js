import { api } from './client'

export function listPublicacoes(params = {}) {
  const query = new URLSearchParams(params).toString()
  return api.get(`/djen/publicacoes${query ? `?${query}` : ''}`)
}

/** @param {number|string} id @param {object} payload */
export function vincularPublicacao(id, payload) {
  return api.post(`/djen/publicacoes/${id}/vincular`, payload)
}

/** @param {number|string} id */
export function ignorarPublicacao(id) {
  return api.post(`/djen/publicacoes/${id}/ignorar`, {})
}
