import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

import VisaoHoje from './VisaoHoje.jsx'

const HOJE = '2026-09-08'

describe('VisaoHoje (fila do dia)', () => {
  it('agrupa em Vencidos / Hoje / Amanhã / Esta semana, por hora', () => {
    const itens = [
      {
        id: 1,
        titulo: 'Vencido X',
        tipo: 'tarefa',
        status: 'Pendente',
        data_vencimento: '2026-09-01',
      },
      {
        id: 2,
        titulo: 'Reunião',
        tipo: 'evento',
        status: 'Pendente',
        data_inicio: `${HOJE}T16:00:00`,
      },
      {
        id: 3,
        titulo: 'Audiência',
        tipo: 'evento',
        status: 'Pendente',
        data_inicio: `${HOJE}T09:30:00`,
      },
      {
        id: 4,
        titulo: 'Amanhã Y',
        tipo: 'tarefa',
        status: 'Pendente',
        data_vencimento: '2026-09-09',
      },
      {
        id: 5,
        titulo: 'Semana Z',
        tipo: 'tarefa',
        status: 'Pendente',
        data_vencimento: '2026-09-12',
      },
      { id: 6, titulo: 'Longe', tipo: 'tarefa', status: 'Pendente', data_vencimento: '2026-10-12' },
    ]
    render(<VisaoHoje itens={itens} casos={[]} hoje={HOJE} />)
    expect(screen.getByText(/2 compromissos hoje/)).toBeInTheDocument()
    expect(screen.getByText(/1 vencido/)).toBeInTheDocument()
    expect(screen.getByTestId('bloco-vencidos')).toHaveTextContent('Vencido X')
    const hoje = screen.getByTestId('bloco-hoje')
    const titulos = Array.from(hoje.querySelectorAll('.ag-card-titulo')).map((b) => b.textContent)
    expect(titulos).toEqual(['Audiência', 'Reunião'])
    expect(screen.getByTestId('bloco-amanha')).toHaveTextContent('Amanhã Y')
    expect(screen.getByTestId('bloco-semana')).toHaveTextContent('Semana Z')
    expect(screen.queryByText('Longe')).not.toBeInTheDocument()
  })

  it('vazio: "Tudo em dia."', () => {
    render(<VisaoHoje itens={[]} casos={[]} hoje={HOJE} />)
    expect(screen.getByTestId('hoje-vazio')).toHaveTextContent('Tudo em dia.')
  })
})
