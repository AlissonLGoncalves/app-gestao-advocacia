/**
 * Fase 4 — MeuDiaCard: prazos de hoje/vencidos, agenda de hoje e
 * intimações não tratadas, tudo clicável.
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

vi.mock('../api/itensAgenda.js', () => ({ listItensAgenda: vi.fn() }))
vi.mock('../api/djen.js', () => ({ getContadoresInbox: vi.fn() }))

import { listItensAgenda } from '../api/itensAgenda.js'
import { getContadoresInbox } from '../api/djen.js'
import MeuDiaCard from './MeuDiaCard.jsx'

const hoje = (() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
})()

const renderCard = () =>
  render(
    <MemoryRouter>
      <MeuDiaCard />
    </MemoryRouter>
  )

describe('MeuDiaCard (Fase 4)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('mostra prazos vencidos + de hoje, compromissos e intimações não tratadas', async () => {
    listItensAgenda.mockResolvedValue([
      { id: 1, tipo: 'tarefa', titulo: 'Contestação', data_vencimento: hoje },
      { id: 2, tipo: 'tarefa', titulo: 'Vencido', data_vencimento: '2020-01-01' },
      { id: 3, tipo: 'evento', titulo: 'Audiência Maria', data_inicio: `${hoje}T14:00:00` },
      { id: 4, tipo: 'evento', titulo: 'Outro dia', data_inicio: '2030-01-01T10:00:00' },
    ])
    getContadoresInbox.mockResolvedValue({ nao_tratadas: 7 })

    renderCard()
    expect(await screen.findByTestId('meu-dia-card')).toBeInTheDocument()
    expect(screen.getByTestId('meu-dia-prazos')).toHaveTextContent('1 vencido')
    expect(screen.getByTestId('meu-dia-prazos')).toHaveTextContent('1 vence hoje')
    expect(screen.getByTestId('meu-dia-compromissos')).toHaveTextContent('14:00 · Audiência Maria')
    expect(screen.getByTestId('meu-dia-intimacoes')).toHaveTextContent('7')
  })

  it('dia limpo: estados zerados e mensagem de controle', async () => {
    listItensAgenda.mockResolvedValue([])
    getContadoresInbox.mockResolvedValue({ nao_tratadas: 0 })
    renderCard()
    expect(await screen.findByTestId('meu-dia-card')).toBeInTheDocument()
    expect(screen.getByTestId('meu-dia-intimacoes')).toHaveTextContent('caixa zerada')
    expect(screen.getByText(/Dia sob controle/)).toBeInTheDocument()
  })

  it('falha no inbox não derruba o card (Promise.allSettled)', async () => {
    listItensAgenda.mockResolvedValue([])
    getContadoresInbox.mockRejectedValue(new Error('500'))
    renderCard()
    expect(await screen.findByTestId('meu-dia-card')).toBeInTheDocument()
  })
})
