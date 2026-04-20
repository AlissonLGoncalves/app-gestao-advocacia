import { api } from './client'

export function listEventos() {
  return api.get('/eventos')
}

/** @param {object} payload */
export function createEvento(payload) {
  return api.post('/eventos', payload)
}

/** @param {number|string} id @param {object} payload */
export function updateEvento(id, payload) {
  return api.put(`/eventos/${id}`, payload)
}

/** @param {number|string} id */
export function deleteEvento(id) {
  return api.del(`/eventos/${id}`)
}

export function listTarefas() {
  return api.get('/tarefas')
}

/** @param {object} payload */
export function createTarefa(payload) {
  return api.post('/tarefas', payload)
}

/** @param {number|string} id @param {object} payload */
export function updateTarefa(id, payload) {
  return api.put(`/tarefas/${id}`, payload)
}

/** @param {number|string} id */
export function deleteTarefa(id) {
  return api.del(`/tarefas/${id}`)
}
