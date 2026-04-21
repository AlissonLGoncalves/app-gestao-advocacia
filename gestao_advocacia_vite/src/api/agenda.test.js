import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  callbackGoogleAgenda,
  connectGoogleAgenda,
  createEvento,
  deleteEvento,
  getEvento,
  listByCaso,
  listEventos,
  listProximos,
  updateEvento,
} from './agenda.js'

describe('api/agenda', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
      if (key === 'token') return 'token-teste'
      return null
    })
  })

  it('normaliza retorno de listEventos', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        eventos: [{ id: 1, title: 'Audiencia', start: '2026-04-12T10:00:00Z' }],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const eventos = await listEventos({ sort_by: 'data_inicio' })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/eventos/?sort_by=data_inicio'),
      expect.any(Object)
    )
    expect(eventos).toEqual([
      expect.objectContaining({
        id: 1,
        titulo: 'Audiencia',
        data_inicio: '2026-04-12T10:00:00Z',
      }),
    ])
  })

  it('busca um evento por id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 10, titulo: 'Prazo' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const evento = await getEvento(10)

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/eventos/10'),
      expect.any(Object)
    )
    expect(evento.titulo).toBe('Prazo')
  })

  it('cria evento com datas em ISO', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 20, titulo: 'Novo evento' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await createEvento({
      titulo: 'Novo evento',
      data_inicio: '2026-04-10T09:30',
      data_fim: '2026-04-10T10:00',
      concluido: false,
    })

    const requestOptions = fetchMock.mock.calls[0][1]
    const body = JSON.parse(requestOptions.body)

    expect(requestOptions.method).toBe('POST')
    expect(body.data_inicio).toContain('2026-04-10T')
    expect(body.data_fim).toContain('2026-04-10T')
  })

  it('atualiza e remove evento', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 30, titulo: 'Atualizado' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })
    vi.stubGlobal('fetch', fetchMock)

    await updateEvento(30, { titulo: 'Atualizado', data_inicio: '2026-04-12T11:00' })
    await deleteEvento(30)

    expect(fetchMock.mock.calls[0][0]).toContain('/eventos/30')
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT')
    expect(fetchMock.mock.calls[1][0]).toContain('/eventos/30')
    expect(fetchMock.mock.calls[1][1].method).toBe('DELETE')
  })

  it('lista por caso e proximos eventos', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ eventos: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          proximos_eventos: [
            { id: 1, titulo: 'Hoje', data_inicio: new Date().toISOString() },
            { id: 2, titulo: 'Muito longe', data_inicio: '2099-01-01T10:00:00Z' },
          ],
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    await listByCaso(77)
    const proximos = await listProximos(7)

    expect(fetchMock.mock.calls[0][0]).toContain('caso_id=77')
    expect(proximos).toHaveLength(1)
    expect(proximos[0].titulo).toBe('Hoje')
  })

  it('mantem endpoints json do google calendar', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ url: 'https://google.com' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', fetchMock)

    await connectGoogleAgenda()
    await callbackGoogleAgenda({ code: 'abc123' })

    expect(fetchMock.mock.calls[0][0]).toContain('/agenda/google/connect')
    expect(fetchMock.mock.calls[1][0]).toContain('/agenda/google/callback?code=abc123')
  })
})
