/**
 * Issue #297 — GlobalSearch: a resposta de uma busca antiga não pode
 * sobrescrever a da busca mais recente (last-query-wins + AbortController).
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

vi.mock('../api/client.js', () => ({
  api: { get: vi.fn() },
}))

import { api } from '../api/client.js'
import GlobalSearch from './GlobalSearch.jsx'

const renderSearch = () =>
  render(
    <MemoryRouter>
      <GlobalSearch />
    </MemoryRouter>
  )

const abrirEDigitar = async (texto) => {
  fireEvent.click(screen.getByRole('button', { name: /Buscar/i }))
  const input = await screen.findByPlaceholderText(/Buscar casos, clientes/i)
  fireEvent.change(input, { target: { value: texto } })
  return input
}

describe('GlobalSearch — race de buscas (#297)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  it('resposta atrasada da query antiga NÃO sobrescreve a query atual', async () => {
    // 1ª busca ("ma"): resolve DEVAGAR com "Maria Antiga"
    // 2ª busca ("mar"): resolve RÁPIDO com "Maria Recente"
    let resolveAntiga
    const antigaPromise = new Promise((res) => {
      resolveAntiga = res
    })
    api.get.mockImplementation((path) => {
      const q = decodeURIComponent(path.split('search=')[1] || '')
      if (path.startsWith('/clientes')) {
        if (q === 'ma') return antigaPromise
        return Promise.resolve([{ id: 2, nome_razao_social: 'Maria Recente' }])
      }
      return Promise.resolve([])
    })

    renderSearch()
    const input = await abrirEDigitar('ma')
    await act(() => vi.advanceTimersByTimeAsync(350)) // debounce da 1ª

    fireEvent.change(input, { target: { value: 'mar' } })
    await act(() => vi.advanceTimersByTimeAsync(350)) // debounce da 2ª

    // 2ª resposta chega primeiro
    await waitFor(() => expect(screen.getByText('Maria Recente')).toBeInTheDocument())

    // agora a 1ª (antiga) chega ATRASADA — não pode trocar o resultado
    await act(async () => {
      resolveAntiga([{ id: 1, nome_razao_social: 'Maria Antiga' }])
    })
    expect(screen.queryByText('Maria Antiga')).not.toBeInTheDocument()
    expect(screen.getByText('Maria Recente')).toBeInTheDocument()
  })

  it('digitar nova query aborta a request anterior (signal)', async () => {
    const signals = []
    api.get.mockImplementation((path, opts) => {
      signals.push(opts?.signal)
      return new Promise(() => {}) // nunca resolve
    })

    renderSearch()
    const input = await abrirEDigitar('ma')
    await act(() => vi.advanceTimersByTimeAsync(350))
    fireEvent.change(input, { target: { value: 'mar' } })
    await act(() => vi.advanceTimersByTimeAsync(350))

    // 1ª chamada (clientes da query "ma") deve ter sido abortada
    expect(signals.length).toBeGreaterThanOrEqual(3)
    expect(signals[0].aborted).toBe(true)
    // última request segue viva
    expect(signals[signals.length - 1].aborted).toBe(false)
  })
})
