import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('resolveApiUrl', () => {
  const originalEnv = { ...import.meta.env }

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    for (const key of Object.keys(import.meta.env)) {
      if (!(key in originalEnv)) delete import.meta.env[key]
    }
    Object.assign(import.meta.env, originalEnv)
  })

  it('usa VITE_API_URL como esta quando ja tem /api/v1', async () => {
    import.meta.env.VITE_API_URL = 'https://backend.test/api/v1'
    const { API_URL } = await import('./config.js')
    expect(API_URL).toBe('https://backend.test/api/v1')
  })

  it('adiciona /v1 quando VITE_API_URL termina em /api (legacy)', async () => {
    import.meta.env.VITE_API_URL = 'https://backend.test/api'
    const { API_URL } = await import('./config.js')
    expect(API_URL).toBe('https://backend.test/api/v1')
  })

  it('remove barra final antes de normalizar', async () => {
    import.meta.env.VITE_API_URL = 'https://backend.test/api/'
    const { API_URL } = await import('./config.js')
    expect(API_URL).toBe('https://backend.test/api/v1')
  })

  it('preserva /api/v2 ou outra versao futura', async () => {
    import.meta.env.VITE_API_URL = 'https://backend.test/api/v2'
    const { API_URL } = await import('./config.js')
    expect(API_URL).toBe('https://backend.test/api/v2')
  })
})
