import { api } from './client'

export function listDespesas() {
  return api.get('/despesas')
}

/** @param {object} payload */
export function createDespesa(payload) {
  return api.post('/despesas', payload)
}

/** @param {number|string} id @param {object} payload */
export function updateDespesa(id, payload) {
  return api.put(`/despesas/${id}`, payload)
}

/** @param {number|string} id */
export function deleteDespesa(id) {
  return api.del(`/despesas/${id}`)
}

export function listRecebimentos() {
  return api.get('/recebimentos')
}

/** @param {object} payload */
export function createRecebimento(payload) {
  return api.post('/recebimentos', payload)
}

/** @param {number|string} id @param {object} payload */
export function updateRecebimento(id, payload) {
  return api.put(`/recebimentos/${id}`, payload)
}

/** @param {number|string} id */
export function deleteRecebimento(id) {
  return api.del(`/recebimentos/${id}`)
}
