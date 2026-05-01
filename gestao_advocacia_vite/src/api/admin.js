// admin-fase0: cliente HTTP do backoffice super-admin.
// Base path /admin/v1 (NUNCA reusa /api/v1). Reusa o token JWT do localStorage.
// Frontend gating e somente UX — backend valida role superadmin via JWT claim.

import { TERMS_VERSION, LGPD_VERSION } from '../constants/legal'

const RAW_API = import.meta.env.VITE_API_URL || '/api/v1'
// Deriva a base do backoffice a partir da base do app (mesmo host/origem).
// Suporta:
//   '/api/v1'                          -> '/admin/v1'
//   'https://api.exemplo.com/api/v1'   -> 'https://api.exemplo.com/admin/v1'
//   'https://api.exemplo.com'          -> 'https://api.exemplo.com/admin/v1'
function deriveAdminBase(apiBase) {
  if (!apiBase) return '/admin/v1'
  if (apiBase.endsWith('/api/v1')) return apiBase.slice(0, -'/api/v1'.length) + '/admin/v1'
  if (apiBase.endsWith('/api/v1/')) return apiBase.slice(0, -'/api/v1/'.length) + '/admin/v1'
  if (apiBase.endsWith('/admin/v1')) return apiBase
  return apiBase.replace(/\/$/, '') + '/admin/v1'
}

const ADMIN_BASE = deriveAdminBase(RAW_API)

function getToken() {
  return localStorage.getItem('access_token') || localStorage.getItem('token')
}

function buildHeaders({ headers = {} } = {}) {
  const token = getToken()
  const finalHeaders = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Terms-Version': TERMS_VERSION,
    'X-LGPD-Version': LGPD_VERSION,
    ...headers,
  }
  if (token) finalHeaders.Authorization = `Bearer ${token}`
  return finalHeaders
}

async function adminRequest(path, { method = 'GET', body, signal } = {}) {
  const res = await fetch(`${ADMIN_BASE}${path}`, {
    method,
    headers: buildHeaders(),
    body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
    signal,
  })
  if (!res.ok) {
    const payload = await res.json().catch(() => ({ message: res.statusText }))
    const err = new Error(payload.message || payload.erro || `HTTP ${res.status}`)
    err.status = res.status
    err.payload = payload
    throw err
  }
  if (res.status === 204) return null
  return res.json()
}

export const adminApi = {
  me: () => adminRequest('/me'),
  listTenants: ({ q = '', status = '', page = 1, size = 25 } = {}) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (status) params.set('status', status)
    params.set('page', String(page))
    params.set('size', String(size))
    return adminRequest(`/tenants?${params.toString()}`)
  },
  getTenant: (id) => adminRequest(`/tenants/${id}`),
  getTenantUsuarios: (id) => adminRequest(`/tenants/${id}/usuarios`),
  getTenantAtividade: (id) => adminRequest(`/tenants/${id}/atividade`),
  suspender: (id, motivo = '') =>
    adminRequest(`/tenants/${id}/suspender`, { method: 'POST', body: { motivo } }),
  reativar: (id, motivo = '') =>
    adminRequest(`/tenants/${id}/reativar`, { method: 'POST', body: { motivo } }),
  criarAnotacao: (id, texto) =>
    adminRequest(`/tenants/${id}/anotacao`, { method: 'POST', body: { texto } }),
  listAnotacoes: (id) => adminRequest(`/tenants/${id}/anotacoes`),
  // Access Requests (issue #112 v2)
  listAccessRequests: ({ status = '', page = 1, perPage = 25 } = {}) => {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    params.set('page', String(page))
    params.set('per_page', String(perPage))
    return adminRequest(`/access-requests?${params.toString()}`)
  },
  approveAccessRequest: (id) => adminRequest(`/access-requests/${id}/approve`, { method: 'POST' }),
  rejectAccessRequest: (id, motivo = '') =>
    adminRequest(`/access-requests/${id}/reject`, { method: 'POST', body: { motivo } }),
}
