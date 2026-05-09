import { API_URL } from '../config.js'

const BASE = API_URL

function getToken() {
  return (
    localStorage.getItem('access_token') ||
    localStorage.getItem('token') ||
    localStorage.getItem('auth_token') ||
    null
  )
}

function normalizePath(path) {
  return path.startsWith('/') ? path : `/${path}`
}

function toQueryString(params = {}) {
  const search = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') {
      return
    }
    search.set(key, String(value))
  })

  const query = search.toString()
  return query ? `?${query}` : ''
}

function toIsoOrNull(value) {
  if (!value) return null

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toISOString()
}

function normalizeEvento(evento) {
  if (!evento || typeof evento !== 'object') {
    return evento
  }

  return {
    ...evento,
    titulo: evento.titulo || evento.title || '',
    data_inicio: evento.data_inicio || evento.start || null,
    data_fim: evento.data_fim || evento.end || null,
    descricao: evento.descricao || evento.description || '',
    concluido:
      typeof evento.concluido === 'boolean'
        ? evento.concluido
        : (evento.status_evento || '').toLowerCase() === 'concluido',
  }
}

function normalizeEventoPayload(payload) {
  if (Array.isArray(payload)) {
    return payload.map(normalizeEvento)
  }

  if (payload?.eventos && Array.isArray(payload.eventos)) {
    return payload.eventos.map(normalizeEvento)
  }

  return []
}

function mapEventoInput(body = {}) {
  const dataInicio = toIsoOrNull(body.data_inicio)
  const dataFim = toIsoOrNull(body.data_fim)

  return {
    titulo: body.titulo,
    data_inicio: dataInicio,
    data_fim: dataFim,
    descricao: body.descricao || null,
    tipo_evento: body.tipo_evento || 'Outro',
    prioridade: body.prioridade || 'Normal',
    status_evento: body.status_evento || (body.concluido ? 'Concluido' : 'Pendente'),
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${BASE}${normalizePath(path)}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const payload = await response
    .json()
    .catch(async () => ({ message: await response.text().catch(() => '') }))

  if (!response.ok) {
    const error = new Error(payload?.erro || payload?.message || `Erro HTTP ${response.status}`)
    error.status = response.status
    error.payload = payload
    throw error
  }

  return payload
}

export async function listEventos(params = {}) {
  const payload = await request(`/eventos/${toQueryString(params)}`)
  return normalizeEventoPayload(payload)
}

export async function getEvento(id) {
  const payload = await request(`/eventos/${id}`)
  return normalizeEvento(payload)
}

export async function createEvento(body) {
  const payload = await request('/eventos/', {
    method: 'POST',
    body: mapEventoInput(body),
  })
  return normalizeEvento(payload)
}

export async function updateEvento(id, body) {
  const payload = await request(`/eventos/${id}`, {
    method: 'PUT',
    body: mapEventoInput(body),
  })
  return normalizeEvento(payload)
}

export function deleteEvento(id) {
  return request(`/eventos/${id}`, { method: 'DELETE' })
}

export function listByCaso(casoId, params = {}) {
  return listEventos({ ...params, caso_id: casoId })
}

export async function listProximos(dias = 7) {
  const payload = await request('/dashboard/stats')
  const eventos = payload?.proximos_eventos || []

  const limite = new Date()
  limite.setDate(limite.getDate() + Number(dias || 7))

  return eventos.map(normalizeEvento).filter((evento) => {
    if (!evento?.data_inicio) return false
    const inicio = new Date(evento.data_inicio)
    return !Number.isNaN(inicio.getTime()) && inicio <= limite
  })
}

