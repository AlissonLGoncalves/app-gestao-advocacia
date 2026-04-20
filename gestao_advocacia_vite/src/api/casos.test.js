import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCaso, deleteCaso, getCaso, listCasos } from './casos'

describe('api/casos', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    localStorage.setItem('token', 'token-teste')
  })

  it('listCasos passa query params corretamente', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({ ok: true, status: 200, json: async () => [] })

    await listCasos({ search: 'trabalhista', sort_by: 'titulo', sort_order: 'asc' })

    const [url] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/casos/?search=trabalhista&sort_by=titulo&sort_order=asc')
  })

  it('getCaso usa endpoint por id', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 7 }) })

    await getCaso(7)

    const [url, options] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/casos/7')
    expect(options.method).toBe('GET')
  })

  it('createCaso envia body JSON', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 12 }) })

    await createCaso({ titulo: 'Caso novo', cliente_id: 2 })

    const [, options] = fetchMock.mock.calls[0]
    expect(options.method).toBe('POST')
    expect(options.body).toBe(JSON.stringify({ titulo: 'Caso novo', cliente_id: 2 }))
  })

  it('deleteCaso retorna null em 204', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, status: 204 })

    const result = await deleteCaso(5)

    expect(result).toBeNull()
  })
})
