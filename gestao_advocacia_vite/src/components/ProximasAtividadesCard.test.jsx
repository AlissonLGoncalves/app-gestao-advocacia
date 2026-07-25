import React from 'react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router'
import { render, screen } from '@testing-library/react'
import ProximasAtividadesCard from './ProximasAtividadesCard.jsx'

function r(prazos) {
  return render(
    <MemoryRouter>
      <ProximasAtividadesCard prazos={prazos} />
    </MemoryRouter>
  )
}

const FUTURO = '2099-12-31'
const PASSADO = '2020-01-01'

describe('ProximasAtividadesCard', () => {
  it('mostra empty state quando não há prazos', () => {
    r([])
    expect(screen.getByText(/Nenhuma tarefa pendente/i)).toBeInTheDocument()
  })

  it('filtra concluídos', () => {
    r([
      { id: 1, titulo: 'Pendente', status: 'A Fazer', data_vencimento: FUTURO },
      { id: 2, titulo: 'Pronto', status: 'Concluído', data_vencimento: FUTURO },
    ])
    expect(screen.getByTestId('atividade-1')).toBeInTheDocument()
    expect(screen.queryByTestId('atividade-2')).not.toBeInTheDocument()
  })

  it('ordena por vencimento crescente', () => {
    r([
      { id: 1, titulo: 'Tarde', status: 'A Fazer', data_vencimento: '2099-06-30' },
      { id: 2, titulo: 'Cedo', status: 'A Fazer', data_vencimento: '2099-01-15' },
    ])
    const itens = screen.getAllByTestId(/^atividade-/)
    expect(itens[0]).toHaveAttribute('data-testid', 'atividade-2') // cedo primeiro
  })

  it('limita a 5 itens', () => {
    const muitas = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      titulo: `T${i + 1}`,
      status: 'A Fazer',
      data_vencimento: `2099-0${(i % 9) + 1}-15`,
    }))
    r(muitas)
    expect(screen.getAllByTestId(/^atividade-/)).toHaveLength(5)
  })

  it('mostra "Vencido há X" para datas passadas', () => {
    r([
      {
        id: 1,
        titulo: 'Atrasado',
        status: 'A Fazer',
        data_vencimento: PASSADO,
        prioridade: 'Alta',
      },
    ])
    expect(screen.getByText(/Vencido há/i)).toBeInTheDocument()
  })

  it('link Kanban presente', () => {
    r([])
    expect(screen.getByText(/Kanban/i)).toBeInTheDocument()
  })
})
