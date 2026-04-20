import { api } from './client'

function toQuery(params = {}) {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value))
    }
  })
  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

/** @returns {Promise<Array<object>|{clientes:Array<object>}>} */
export function listClientes(params = {}) {
  return api.get(`/clientes/${toQuery(params)}`)
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

/** @param {FormData} formData */
export function extrairDadosDocumentoCliente(formData) {
  return api.postForm('/clientes/extrair-dados-doc', formData)
}

/** @param {number|string} id */
export function anonimizarCliente(id) {
  return api.post(`/clientes/${id}/anonimizar`, {})
}
