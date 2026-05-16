/**
 * API client de Notificacoes (in-app).
 *
 * Endpoints (backend Fase N1):
 *   GET    /notificacoes              lista (filtros: lida, tipo, limit)
 *   GET    /notificacoes/unread-count contagem rapida pro badge do sino
 *   PUT    /notificacoes/{id}/lida    marca uma como lida
 *   POST   /notificacoes/marcar-todas marca todas as nao-lidas
 *   DELETE /notificacoes/{id}         remove
 */
import { api } from './client.js'

function toQueryString(params) {
  const search = new URLSearchParams()
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return
    search.set(key, String(value))
  })
  const query = search.toString()
  return query ? `?${query}` : ''
}

export async function listNotificacoes(params = {}) {
  const data = await api.get(`/notificacoes/${toQueryString(params)}`)
  return Array.isArray(data) ? data : []
}

export function getNotificacoesUnreadCount() {
  return api.get('/notificacoes/unread-count')
}

export function marcarNotificacaoLida(id) {
  return api.put(`/notificacoes/${id}/lida`, {})
}

export function marcarTodasNotificacoesLidas() {
  return api.post('/notificacoes/marcar-todas', {})
}

export function deletarNotificacao(id) {
  return api.del(`/notificacoes/${id}`)
}
