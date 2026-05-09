import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import useListData from './useListData.js'

describe('useListData', () => {
  it('carrega items via fetcher e expoe loading=false ao final', async () => {
    const fetcher = vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }])

    const { result } = renderHook(() =>
      useListData({ fetcher, errorPrefix: 'Erro X' })
    )

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(result.current.items).toEqual([{ id: 1 }, { id: 2 }])
    expect(result.current.error).toBe('')
  })

  it('aplica mapData para extrair lista de payload aninhado', async () => {
    const fetcher = vi.fn().mockResolvedValue({ casos: [{ id: 1 }] })

    const { result } = renderHook(() =>
      useListData({
        fetcher,
        mapData: (data) => data.casos,
        errorPrefix: 'Erro',
      })
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toEqual([{ id: 1 }])
  })

  it('captura erro e expoe mensagem com prefixo', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('falhou'))
    const onError = vi.fn()

    const { result } = renderHook(() =>
      useListData({ fetcher, errorPrefix: 'Erro ao carregar', onError })
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toEqual([])
    expect(result.current.error).toBe('Erro ao carregar: falhou')
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('refetch reexecuta o fetcher', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce([{ id: 1 }, { id: 2 }])

    const { result } = renderHook(() =>
      useListData({ fetcher, errorPrefix: 'Erro' })
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toHaveLength(1)

    await act(async () => {
      await result.current.refetch()
    })

    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(result.current.items).toHaveLength(2)
  })

  it('refreshKey dispara novo fetch quando muda', async () => {
    const fetcher = vi.fn().mockResolvedValue([])

    const { rerender, result } = renderHook(
      ({ refreshKey }) => useListData({ fetcher, errorPrefix: 'X', refreshKey }),
      { initialProps: { refreshKey: 0 } }
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fetcher).toHaveBeenCalledTimes(1)

    rerender({ refreshKey: 1 })
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
  })

  it('retorna array vazio quando mapData devolve nao-array', async () => {
    const fetcher = vi.fn().mockResolvedValue({ outraChave: 'x' })

    const { result } = renderHook(() =>
      useListData({
        fetcher,
        mapData: (data) => data.casos,
        errorPrefix: 'Erro',
      })
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toEqual([])
  })
})
