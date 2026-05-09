/**
 * API client para modelos editáveis de documentos — Epic #9 (#183).
 */

import { api } from './client.js'

export const listModelos = () => api.get('/modelos')
export const getModelo = (id) => api.get(`/modelos/${id}`)
export const createModelo = (payload) => api.post('/modelos', payload)
export const updateModelo = (id, payload) => api.put(`/modelos/${id}`, payload)
export const deleteModelo = (id) => api.del(`/modelos/${id}`)

/**
 * Renderiza modelo HTML pra um cliente/caso. Backend retorna { html, ... }.
 * Frontend pode injetar em iframe pra preview ou abrir em nova aba pra impressão.
 */
export const gerarDocumentoDoModelo = (modeloId, payload) =>
  api.post(`/modelos/${modeloId}/gerar`, payload)
