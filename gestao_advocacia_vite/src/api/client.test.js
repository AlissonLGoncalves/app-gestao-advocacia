import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api, request } from './client'

const createJsonResponse = ({ ok = true, status = 200, payload = {} } = {}) => ({
  ok,
  status,
  statusText: ok ? 'OK' : 'Error',
  headers: {
    get: (name) => (name === 'content-type' ? 'application/json' : null),
  },
  json: vi.fn().mockResolvedValue(payload),
  text: vi.fn().mockResolvedValue(''),
  blob: vi.fn().mockResolvedValue(new Blob(['x'])),
})

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

  it('401 em /auth/login NAO limpa token nem redireciona (credencial invalida)', async () => {
    localStorage.setItem('access_token', 'token-de-outra-sessao')

    const originalLocation = window.location
    delete window.location
    window.location = { href: 'http://localhost/login', pathname: '/login' }

    globalThis.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ message: 'Nome de usuário/email ou senha inválidos.' }),
    })

    await expect(
      request('/auth/login', {
        method: 'POST',
        body: { username_or_email: 'x', password: 'y' },
      })
    ).rejects.toThrow('Nome de usuário/email ou senha inválidos.')

    // token da sessao anterior NAO deve ser limpo
    expect(localStorage.getItem('access_token')).toBe('token-de-outra-sessao')
    // nao deve ter redirecionado pra /login
    expect(window.location.href).toBe('http://localhost/login')

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

describe('api.upload', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal('fetch', vi.fn())
    localStorage.clear()
  })

  it('nao envia Content-Type manualmente no multipart', async () => {
    const formData = new FormData()
    formData.append('file', new File(['pdf'], 'teste.pdf', { type: 'application/pdf' }))

    globalThis.fetch.mockResolvedValueOnce(createJsonResponse({ payload: { ok: true } }))

    await api.upload('/documentos/upload', formData)

    const [, options] = globalThis.fetch.mock.calls[0]
    expect(options.method).toBe('POST')
    expect(options.headers.Authorization).toBeUndefined()
    expect(options.headers['Content-Type']).toBeUndefined()
    expect(options.body).toBe(formData)
  })

  it('limpa token em resposta 401 no upload', async () => {
    localStorage.setItem('token', 'abc123')

    globalThis.fetch.mockResolvedValueOnce(
      createJsonResponse({ ok: false, status: 401, payload: { erro: 'nao autorizado' } })
    )

    await expect(api.upload('/documentos/upload', new FormData())).rejects.toThrow(
      'Sessão expirada'
    )

    expect(localStorage.getItem('token')).toBeNull()
  })
})
