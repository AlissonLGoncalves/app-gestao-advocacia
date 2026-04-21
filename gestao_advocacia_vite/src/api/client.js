import { TERMS_VERSION, LGPD_VERSION } from '../constants/legal'

const BASE = import.meta.env.VITE_API_URL || '/api/v1'

function getToken() {
  return localStorage.getItem('access_token')
}

export async function request(path, { method = 'GET', body, headers = {}, signal } = {}) {
  const finalHeaders = {
    'Content-Type': 'application/json',
    'X-Terms-Version': TERMS_VERSION,
    'X-LGPD-Version': LGPD_VERSION,
    ...headers,
  }

  const token = getToken()
  if (token) finalHeaders.Authorization = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: finalHeaders,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  })

  if (res.status === 401) {
    localStorage.removeItem('access_token')
    localStorage.removeItem('token')
    window.location.href = '/login'
    throw new Error('Sessão expirada')
  }

  if (!res.ok) {
    const payload = await res.json().catch(() => ({ message: res.statusText }))
    throw Object.assign(new Error(payload.message || `HTTP ${res.status}`), {
      status: res.status,
      payload,
    })
  }

  if (res.status === 204) return null
  return res.json()
}

export const api = {
  get: (p, opts) => request(p, { ...opts, method: 'GET' }),
  post: (p, body, opts) => request(p, { ...opts, method: 'POST', body }),
  put: (p, body, opts) => request(p, { ...opts, method: 'PUT', body }),
  patch: (p, body, opts) => request(p, { ...opts, method: 'PATCH', body }),
  del: (p, opts) => request(p, { ...opts, method: 'DELETE' }),
}
