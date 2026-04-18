// src/config.js

function normalizeBaseUrl(url) {
  return String(url || '').replace(/\/+$/, '')
}

// Garante que a URL base da API termine em /api/vN. Se veio so /api (sem versao),
// adiciona /v1. Isso evita quebrar quando VITE_API_URL foi configurada no Vercel
// antes do versionamento (N3) e nao foi atualizada — o backend redireciona
// /api/* para /api/v1/* com 308, mas browsers recusam seguir 308 em POST.
function ensureApiVersion(url) {
  const base = normalizeBaseUrl(url)
  if (!base) return base
  if (/\/api\/v\d+$/.test(base)) return base
  if (/\/api$/.test(base)) return `${base}/v1`
  return base
}

function resolveApiUrl() {
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl) {
    return ensureApiVersion(envUrl)
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
