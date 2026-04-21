import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  analisarProcuracao,
  deleteProcuracao,
  getAnalise,
  listProcuracoes,
  uploadProcuracao,
} from './procuracoes'

describe('api/procuracoes', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal('fetch', vi.fn())
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
      if (key === 'token') return 'token-teste'
      return null
    })
  })

  it('lista procuracoes por caso', async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ items: [] }),
    })

    await listProcuracoes(9)

    expect(globalThis.fetch.mock.calls[0][0]).toContain('/procuracoes?caso_id=9')
  })

  it('faz upload com multipart via api.upload', async () => {
    const file = new File(['conteudo'], 'procuracao.pdf', { type: 'application/pdf' })

    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 1 }),
    })

    await uploadProcuracao(3, file)

    const [, options] = globalThis.fetch.mock.calls[0]
    expect(options.method).toBe('POST')
    expect(options.headers['Content-Type']).toBeUndefined()
    expect(options.body).toBeInstanceOf(FormData)
  })

  it('executa analisar, obter analise e excluir', async () => {
    globalThis.fetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ resumo: 'ok' }) })
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => null })

    await analisarProcuracao(12)
    await getAnalise(12)
    await deleteProcuracao(12)

    expect(globalThis.fetch.mock.calls[0][0]).toContain('/procuracoes/12/analisar')
    expect(globalThis.fetch.mock.calls[1][0]).toContain('/procuracoes/12/analise')
    expect(globalThis.fetch.mock.calls[2][1].method).toBe('DELETE')
  })
})
