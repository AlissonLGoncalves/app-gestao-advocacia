import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
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
  const originalFetch = global.fetch

  beforeEach(() => {
    localStorage.setItem('token', 'fake')
  })
  afterEach(() => {
    global.fetch = originalFetch
    localStorage.clear()
  })

  function renderWithFetch(tarefas) {
    global.fetch = vi.fn().mockResolvedValue({
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
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
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
    expect(await screen.findByText('Vencidos')).toBeInTheDocument()
    // "Hoje" aparece como titulo de coluna E como prazo formatado — checa que aparece >= 1x
    expect(screen.getAllByText('Hoje').length).toBeGreaterThan(0)
    expect(screen.getByText('Próximos 7 dias')).toBeInTheDocument()
    expect(screen.getByText('Atrasado')).toBeInTheDocument()
    expect(screen.getByText('Hoje task')).toBeInTheDocument()
  })
})
