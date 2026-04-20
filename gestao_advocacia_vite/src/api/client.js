import { API_URL } from '../config.js'

function getToken() {
  return localStorage.getItem('access_token') || localStorage.getItem('token')
}

async function parseErrorPayload(response) {
  const contentType = response.headers?.get?.('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json().catch(() => ({}))
  }

  if (typeof response.json === 'function') {
    const payload = await response.json().catch(() => null)
    if (payload && typeof payload === 'object') {
      return payload
    }
  }

  const text =
    typeof response.text === 'function' ? await response.text().catch(() => '') : ''
  return text ? { message: text } : {}
}

export async function request(path, options = {}) {
  const { auth = true, headers = {}, body, ...rest } = options
  const token = getToken()
  const isFormData = body instanceof FormData

  const finalHeaders = {
    Accept: 'application/json',
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
    body,
  })

  if (response.status === 401) {
    localStorage.removeItem('token')
    localStorage.removeItem('access_token')

    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login'
    }

    throw new Error('Sessão expirada. Faça login novamente.')
  }

  if (!response.ok) {
    const payload = await parseErrorPayload(response)
    const message = payload.erro || payload.message || `Erro HTTP: ${response.status}`
    const error = new Error(message)
    error.status = response.status
    error.payload = payload
    throw error
  }

  if (response.status === 204) {
    return null
  }

  const contentType = response.headers?.get?.('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json()
  }

  if (typeof response.json === 'function') {
    const payload = await response.json().catch(() => null)
    if (payload !== null && payload !== undefined) {
      return payload
    }
  }

  return typeof response.text === 'function' ? response.text() : null
}

export const api = {
  get: (path, options = {}) => request(path, { ...options, method: 'GET' }),
  post: (path, payload, options = {}) =>
    request(path, { ...options, method: 'POST', body: JSON.stringify(payload) }),
  postForm: (path, formData, options = {}) =>
    request(path, { ...options, method: 'POST', body: formData }),
  put: (path, payload, options = {}) =>
    request(path, { ...options, method: 'PUT', body: JSON.stringify(payload) }),
  del: (path, options = {}) => request(path, { ...options, method: 'DELETE' }),
}
