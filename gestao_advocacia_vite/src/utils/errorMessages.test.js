// Issue #299 — tradutor central de erros: amigável sem perder validação PT-BR.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mensagemAmigavel, pareceTecnica, ERRO_REDE } from './errorMessages.js'
import { request } from '../api/client.js'

describe('mensagemAmigavel', () => {
  it('preserva validação PT-BR do backend em 400', () => {
    expect(mensagemAmigavel(400, 'Título do caso é obrigatório.')).toBe(
      'Título do caso é obrigatório.'
    )
  })

  it('troca mensagem técnica em 4xx por genérica do status', () => {
    expect(mensagemAmigavel(404, 'Tenant not found')).toBe(
      'Registro não encontrado — pode ter sido removido.'
    )
    expect(mensagemAmigavel(403, 'Forbidden')).toBe('Você não tem permissão para esta ação.')
  })

  it('5xx nunca vaza detalhe do servidor', () => {
    expect(mensagemAmigavel(500, 'IntegrityError: duplicate key value')).toBe(
      'Erro interno no servidor. Tente novamente em instantes.'
    )
    expect(mensagemAmigavel(503, 'Service Unavailable')).toMatch(/indisponível/)
  })

  it('status desconhecido cai no genérico', () => {
    expect(mensagemAmigavel(418, 'HTTP 418')).toBe('Algo deu errado. Tente novamente em instantes.')
  })
})

describe('pareceTecnica', () => {
  it('detecta jargão técnico', () => {
    expect(pareceTecnica('Tenant not found')).toBe(true)
    expect(pareceTecnica('sqlalchemy.exc.IntegrityError ...')).toBe(true)
    expect(pareceTecnica('HTTP 500')).toBe(true)
  })
  it('aceita mensagem de validação em português', () => {
    expect(pareceTecnica('Cliente é obrigatório.')).toBe(false)
  })
})

describe('request — integração do mapper (#299)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('500 lança mensagem amigável e guarda a técnica em err.technical', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Internal Server Error' }),
      })
    )
    await expect(request('/casos')).rejects.toMatchObject({
      message: 'Erro interno no servidor. Tente novamente em instantes.',
      technical: 'Internal Server Error',
      status: 500,
    })
  })

  it('queda de rede vira mensagem amigável (não TypeError cru)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(request('/casos')).rejects.toThrow(ERRO_REDE)
  })

  it('AbortError passa intacto (fluxo de busca cancelada)', async () => {
    const abortErr = Object.assign(new Error('aborted'), { name: 'AbortError' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortErr))
    await expect(request('/casos')).rejects.toBe(abortErr)
  })
})
