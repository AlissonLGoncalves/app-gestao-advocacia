import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  baixarCertidao,
  createOab,
  criarClienteCasoTriagem,
  deleteOab,
  getMonitoramentoStatus,
  getPublicacao,
  listOabs,
  listPublicacoes,
  listTriagem,
  processarLoteTriagem,
  syncDjen,
  triggerBackfill,
  updatePublicacao,
  vincularDecisao,
} from './djen'

describe('api/djen', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal('fetch', vi.fn())
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
      if (key === 'token') return 'token-teste'
      return null
    })
  })

  it('lista e cria/remove OABs', async () => {
    globalThis.fetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [{ id: 1 }] })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 2 }) })
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => null })

    await listOabs()
    await createOab({ numero_oab: '12345', uf_oab: 'SP' })
    await deleteOab(2)

    expect(globalThis.fetch.mock.calls[0][0]).toContain('/djen/oabs')
    expect(globalThis.fetch.mock.calls[1][1].method).toBe('POST')
    expect(globalThis.fetch.mock.calls[2][1].method).toBe('DELETE')
  })

  it('consulta publicacoes e detalhes', async () => {
    globalThis.fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [{ id: 1 }], total: 1 }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 10 }) })

    await listPublicacoes({ limit: 10, lida: false })
    await getPublicacao(10)

    expect(globalThis.fetch.mock.calls[0][0]).toContain('/djen/publicacoes?limit=10&lida=false')
    expect(globalThis.fetch.mock.calls[1][0]).toContain('/djen/publicacoes/10')
  })

  it('executa fluxo de triagem e sync', async () => {
    globalThis.fetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ items: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ processadas: 2 }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ resumo: {} }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 9 }) })

    await listTriagem({ limit: 20, offset: 0 })
    await vincularDecisao(5, 9)
    await processarLoteTriagem([1, 2])
    await syncDjen(30)
    await updatePublicacao(9, { lida: true })

    expect(globalThis.fetch.mock.calls[0][0]).toContain('/djen/triagem?limit=20&offset=0')
    expect(globalThis.fetch.mock.calls[1][0]).toContain('/djen/triagem/5/vincular-caso')
    expect(globalThis.fetch.mock.calls[2][0]).toContain('/djen/triagem/processar-lote')
    expect(globalThis.fetch.mock.calls[3][0]).toContain('/djen/sync')
    expect(globalThis.fetch.mock.calls[4][1].method).toBe('PATCH')
  })

  it('trata 409 em criar cliente/caso', async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ caso_existente: { id: 77 }, mensagem: 'Duplicado' }),
    })

    const result = await criarClienteCasoTriagem(77, { cliente_id: null })

    expect(result).toEqual(expect.objectContaining({ caso_existente: { id: 77 } }))
  })

  it('baixa certidao e monitoramento/backfill', async () => {
    globalThis.fetch
      .mockResolvedValueOnce({ ok: true, status: 200, blob: async () => new Blob(['pdf']) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ status: 'ok' }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) })

    const blob = await baixarCertidao(11)
    await getMonitoramentoStatus()
    await triggerBackfill(3)

    expect(blob).toBeInstanceOf(Blob)
    expect(globalThis.fetch.mock.calls[0][0]).toContain('/djen/publicacoes/11/certidao')
    expect(globalThis.fetch.mock.calls[1][0]).toContain('/djen/monitoramento/status')
    expect(globalThis.fetch.mock.calls[2][0]).toContain('/djen/oabs/3/backfill')
  })
})
