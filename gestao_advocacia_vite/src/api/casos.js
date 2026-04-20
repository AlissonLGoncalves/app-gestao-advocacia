import { api } from './client'

export function listCasos() {
  return api.get('/casos')
}

/** @param {number|string} id */
export function getCaso(id) {
  return api.get(`/casos/${id}`)
}

/** @param {object} payload */
export function createCaso(payload) {
  return api.post('/casos', payload)
}

/** @param {number|string} id @param {object} payload */
export function updateCaso(id, payload) {
  return api.put(`/casos/${id}`, payload)
}

/** @param {number|string} id */
export function deleteCaso(id) {
  return api.del(`/casos/${id}`)
}
