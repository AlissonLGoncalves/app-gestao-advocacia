import { TERMS_VERSION, LGPD_VERSION } from '../constants/legal'
import { mensagemAmigavel, ERRO_REDE } from '../utils/errorMessages.js'

const BASE = import.meta.env.VITE_API_URL || '/api/v1'

function getToken() {
  return localStorage.getItem('access_token') || localStorage.getItem('token')
}

function buildHeaders({ headers = {}, isFormData, auth = true }) {
  const finalHeaders = {
    Accept: 'application/json',
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
    'X-Terms-Version': TERMS_VERSION,
    'X-LGPD-Version': LGPD_VERSION,
    ...headers,
  }
  const token = getToken()
  if (auth && token) finalHeaders.Authorization = `Bearer ${token}`
  return finalHeaders
}

function handleUnauthorized() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('token')
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login'
  }
  throw new Error('Sessão expirada')
}

// Endpoints onde um 401 significa "credencial invalida" (nao "sessao expirada"):
// nao devemos limpar localStorage nem redirecionar pra /login nesses casos.
const AUTH_ENDPOINTS_401_IS_CREDENTIAL_ERROR = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
]

function is401CredentialError(path) {
  return AUTH_ENDPOINTS_401_IS_CREDENTIAL_ERROR.some((p) => path.startsWith(p))
}

async function throwIfError(res, path) {
  if (!res.ok) {
    const payload = await res.json().catch(() => ({ message: res.statusText }))
    if (res.status === 401 && !is401CredentialError(path)) {
      // Sessao expirada / token invalido em endpoint autenticado
      handleUnauthorized()
    }
    const tecnica = payload.message || payload.erro || `HTTP ${res.status}`
    // Issue #299 — err.message vira a versao amigavel PT-BR (os ~99
    // toast.error(err.message) existentes ficam amigaveis sem mudanca).
    // A original fica em err.technical/err.payload pra depuracao.
    const err = Object.assign(new Error(mensagemAmigavel(res.status, tecnica)), {
      status: res.status,
      payload,
      technical: tecnica,
    })
    console.warn(`API ${res.status} em ${path}:`, tecnica)
    throw err
  }
}

export async function request(path, { method = 'GET', body, headers, signal, auth = true } = {}) {
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
  const finalHeaders = buildHeaders({ headers, isFormData, auth })
  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: finalHeaders,
      body: isFormData
        ? body
        : body !== undefined && body !== null
          ? JSON.stringify(body)
          : undefined,
      signal,
    })
  } catch (e) {
    // Abort e fluxo normal (buscas canceladas) — repassa intacto.
    if (e?.name === 'AbortError') throw e
    // Falha de rede (fetch rejeita com TypeError): mensagem amigavel.
    throw Object.assign(new Error(ERRO_REDE), { cause: e, technical: String(e) })
  }
  await throwIfError(res, path)
  if (res.status === 204) return null
  return res.json()
}

export async function getBlob(path, { headers, signal, auth = true } = {}) {
  const finalHeaders = buildHeaders({ headers, isFormData: true, auth })
  delete finalHeaders['Content-Type']
  const res = await fetch(`${BASE}${path}`, { method: 'GET', headers: finalHeaders, signal })
  await throwIfError(res, path)
  return res.blob()
}

export async function upload(path, formData, { headers, signal, auth = true } = {}) {
  return request(path, { method: 'POST', body: formData, headers, signal, auth })
}

export const api = {
  get: (p, opts) => request(p, { ...opts, method: 'GET' }),
  post: (p, body, opts) => request(p, { ...opts, method: 'POST', body }),
  postForm: (p, formData, opts) => request(p, { ...opts, method: 'POST', body: formData }),
  put: (p, body, opts) => request(p, { ...opts, method: 'PUT', body }),
  patch: (p, body, opts) => request(p, { ...opts, method: 'PATCH', body }),
  del: (p, opts) => request(p, { ...opts, method: 'DELETE' }),
  getBlob: (p, opts) => getBlob(p, opts),
  upload: (p, formData, opts) => upload(p, formData, opts),
}
