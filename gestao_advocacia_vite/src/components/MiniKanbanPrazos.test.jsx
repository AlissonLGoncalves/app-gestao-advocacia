import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import MiniKanbanPrazos, { classificarTarefa } from './MiniKanbanPrazos.jsx'

describe('classificarTarefa', () => {
  const hoje = '2026-05-11'

  it('retorna vencido quando data_vencimento < hoje', () => {
    expect(classificarTarefa({ data_vencimento: '2026-05-10' }, hoje)).toBe('vencido')
    expect(classificarTarefa({ data_vencimento: '2026-04-01' }, hoje)).toBe('vencido')
  })

  it('retorna hoje quando data_vencimento === hoje', () => {
    expect(classificarTarefa({ data_vencimento: '2026-05-11' }, hoje)).toBe('hoje')
  })

  it('retorna proximos7 quando entre 1 e 7 dias', () => {
    expect(classificarTarefa({ data_vencimento: '2026-05-12' }, hoje)).toBe('proximos7')
    expect(classificarTarefa({ data_vencimento: '2026-05-18' }, hoje)).toBe('proximos7')
  })

  it('retorna null quando alem de 7 dias', () => {
    expect(classificarTarefa({ data_vencimento: '2026-05-19' }, hoje)).toBeNull()
  })

  it('ignora tarefas concluidas', () => {
    expect(
      classificarTarefa({ data_vencimento: '2026-05-10', status: 'Concluído' }, hoje)
    ).toBeNull()
    expect(
      classificarTarefa({ data_vencimento: '2026-05-10', status: 'Concluido' }, hoje)
    ).toBeNull()
  })

  it('retorna null quando sem data_vencimento', () => {
    expect(classificarTarefa({}, hoje)).toBeNull()
    expect(classificarTarefa({ data_vencimento: null }, hoje)).toBeNull()
  })

  it('aceita ISO completo na data', () => {
    expect(classificarTarefa({ data_vencimento: '2026-05-10T12:00:00' }, hoje)).toBe('vencido')
  })
})

describe('MiniKanbanPrazos render', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    localStorage.setItem('token', 'fake')
  })
  afterEach(() => {
    globalThis.fetch = originalFetch
    localStorage.clear()
  })

  function renderWithFetch(tarefas) {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => tarefas,
    })
    return render(
      <MemoryRouter>
        <MiniKanbanPrazos />
      </MemoryRouter>
    )
  }

  it('nao renderiza nada quando todas tarefas estao fora do horizonte de 7 dias', async () => {
    const { container } = renderWithFetch([
      { id: 1, titulo: 'Longe', data_vencimento: '2099-01-01', status: 'A Fazer' },
    ])
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())
    // pode ficar com null root quando totalUrgente === 0
    await waitFor(() => {
      expect(container.querySelector('.card')).toBeNull()
    })
  })

  it('mostra colunas e contagens quando ha prazos urgentes', async () => {
    renderWithFetch([
      { id: 1, titulo: 'Atrasado', data_vencimento: '2020-01-01', status: 'A Fazer' },
      {
        id: 2,
        titulo: 'Hoje task',
        data_vencimento: new Date().toISOString().slice(0, 10),
        status: 'A Fazer',
      },
    ])
    // Aguarda os cards renderizarem (apos fetch resolver). Findby* e necessario
    // porque o widget renderiza colunas imediatamente em "Carregando..." e so
    // depois os cards aparecem — CI mais lento pegou essa race.
    expect(await screen.findByText('Atrasado')).toBeInTheDocument()
    expect(screen.getByText('Vencidos')).toBeInTheDocument()
    expect(screen.getAllByText('Hoje').length).toBeGreaterThan(0)
    expect(screen.getByText('Próximos 7 dias')).toBeInTheDocument()
    expect(screen.getByText('Hoje task')).toBeInTheDocument()
  })
})

describe('baixa em massa de vencidos (feedback 12/06)', () => {
  const originalFetch = globalThis.fetch
  beforeEach(() => localStorage.setItem('token', 'fake'))
  afterEach(() => {
    globalThis.fetch = originalFetch
    localStorage.clear()
  })

  it('botão "Já tratei no tribunal" baixa todos os vencidos via /tratar', async () => {
    const { fireEvent } = await import('@testing-library/react')
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { id: 11, titulo: 'Vencido A', data_vencimento: '2020-01-01', status: 'A Fazer' },
        { id: 12, titulo: 'Vencido B', data_vencimento: '2020-01-02', status: 'A Fazer' },
      ],
    })
    render(
      <MemoryRouter>
        <MiniKanbanPrazos />
      </MemoryRouter>
    )
    const btn = await screen.findByTestId('btn-baixar-vencidos')
    fireEvent.click(btn)
    // modal do useConfirm
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }))
    await waitFor(() => {
      const urls = globalThis.fetch.mock.calls.map(([u]) => String(u))
      expect(urls.some((u) => u.includes('/itens-agenda/11/tratar'))).toBe(true)
      expect(urls.some((u) => u.includes('/itens-agenda/12/tratar'))).toBe(true)
    })
  })
})
