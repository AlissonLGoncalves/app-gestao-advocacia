function normalizeBaseUrl(url) {
  return String(url || '').replace(/\/+$/, '')
}

function ensureV1Prefix(url) {
  const normalized = normalizeBaseUrl(url)

  if (/\/api\/v1$/i.test(normalized)) {
    return normalized
  }

  if (/\/api$/i.test(normalized)) {
    return `${normalized}/v1`
  }

  return normalized
}

function resolveApiUrl() {
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl) {
    return ensureV1Prefix(normalizeBaseUrl(envUrl))
  }

  const host = typeof window !== 'undefined' ? window.location.hostname : ''
  const isLocalHost = host === 'localhost' || host === '127.0.0.1'

  if (isLocalHost || !host) {
    return 'http://127.0.0.1:5000/api/v1'
  }

  return 'https://app-gestao-advocacia.fly.dev/api/v1'
}

export const API_URL = resolveApiUrl()
