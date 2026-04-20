import { api } from './client'

export function listDocumentos() {
  return api.get('/documentos')
}

/** @param {number|string} id */
export function deleteDocumento(id) {
  return api.del(`/documentos/${id}`)
}
