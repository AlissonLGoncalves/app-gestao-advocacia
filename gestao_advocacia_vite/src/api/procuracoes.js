import { api } from './client'

/**
 * Camada inicial para endpoints de procuracoes.
 * Os caminhos exatos podem evoluir conforme os proximos incrementos S8.x.
 */
export function listProcuracoes() {
  return api.get('/procuracoes')
}

/** @param {object} payload */
export function createProcuracao(payload) {
  return api.post('/procuracoes', payload)
}
