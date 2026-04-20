import { api } from './client'

/** @returns {Promise<Array<object>>} */
export function listClientes() {
  return api.get('/clientes')
}

/** @param {number|string} id */
export function getCliente(id) {
  return api.get(`/clientes/${id}`)
}

/** @param {object} payload */
export function createCliente(payload) {
  return api.post('/clientes', payload)
}

/** @param {number|string} id @param {object} payload */
export function updateCliente(id, payload) {
  return api.put(`/clientes/${id}`, payload)
}

/** @param {number|string} id */
export function deleteCliente(id) {
  return api.del(`/clientes/${id}`)
}
