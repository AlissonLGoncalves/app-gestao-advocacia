// src/config.js

function normalizeBaseUrl(url) {
  return String(url || '').replace(/\/+$/, '')
}

function resolveApiUrl() {
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl) {
    return normalizeBaseUrl(envUrl)
  }

  const host = typeof window !== 'undefined' ? window.location.hostname : ''
  const isLocalHost = host === 'localhost' || host === '127.0.0.1'

  // Fallback de desenvolvimento local.
  if (isLocalHost || !host) {
    return 'http://127.0.0.1:5000/api/v1'
  }

  // Fallback de produção quando VITE_API_URL não foi definida no deploy do frontend.
  return 'https://app-gestao-advocacia.fly.dev/api/v1'
}

export const API_URL = resolveApiUrl()
