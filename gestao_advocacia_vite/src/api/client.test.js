import { beforeEach, describe, expect, it, vi } from 'vitest'

import { request } from './client'

describe('api/client request', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    globalThis.fetch = vi.fn()
  })

  it('test_request_adiciona_authorization_header_quando_token_presente', async () => {
    localStorage.setItem('access_token', 'abc123')
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    })

    await request('/auth/me')

    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    const [, options] = globalThis.fetch.mock.calls[0]
    expect(options.headers.Authorization).toBe('Bearer abc123')
  })

  it('test_request_401_limpa_token_e_redireciona', async () => {
    localStorage.setItem('access_token', 'abc123')

    const originalLocation = window.location
    delete window.location
    window.location = { href: 'http://localhost/' }

    globalThis.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ message: 'unauthorized' }),
    })

    await expect(request('/auth/me')).rejects.toThrow('Sessão expirada')
    expect(localStorage.getItem('access_token')).toBeNull()
    expect(window.location.href).toBe('/login')

    window.location = originalLocation
  })

  it('test_request_erro_throw_com_status_e_payload', async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ message: 'dados invalidos' }),
    })

    try {
      await request('/auth/register', { method: 'POST', body: { a: 1 } })
      throw new Error('deveria falhar')
    } catch (error) {
      expect(error.message).toBe('dados invalidos')
      expect(error.status).toBe(400)
      expect(error.payload).toEqual({ message: 'dados invalidos' })
    }
  })

  it('test_request_204_retorna_null', async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: async () => ({ ignored: true }),
    })

    await expect(request('/auth/logout', { method: 'DELETE' })).resolves.toBeNull()
  })
})
