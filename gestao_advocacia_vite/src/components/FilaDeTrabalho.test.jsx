/**
 * FilaDeTrabalho: o topo do Início vira UMA lista de ações, sem repetir os
 * mesmos prazos em 3 blocos como antes.
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

vi.mock('../api/itensAgenda.js', () => ({
  listItensAgenda: vi.fn(),
  tratarItemAgenda: vi.fn(),
}))
vi.mock('../api/djen.js', () => ({ getContadoresInbox: vi.fn() }))

import { listItensAgenda } from '../api/itensAgenda.js'
import { getContadoresInbox } from '../api/djen.js'
import FilaDeTrabalho from './FilaDeTrabalho.jsx'

const ontem = () => {
  const d = new Date(Date.now() - 86400000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const renderFila = () =>
  render(
    <MemoryRouter>
      <FilaDeTrabalho />
    </MemoryRouter>
  )

describe('FilaDeTrabalho', () => {
  beforeEach(() => vi.clearAllMocks())

  it('mostra prazo vencido e intimações como linhas de ação', async () => {
    listItensAgenda.mockResolvedValue([
      {
        id: 1,
        tipo: 'tarefa',
        titulo: 'Contestação',
        data_vencimento: ontem(),
        status: 'Pendente',
      },
    ])
    getContadoresInbox.mockResolvedValue({ nao_tratadas: 308 })

    renderFila()

    expect(await screen.findByText(/1 prazo venceu/i)).toBeInTheDocument()
    expect(screen.getByText(/308 intimações sem triagem/i)).toBeInTheDocument()
    // cada linha tem um botão de ação
    expect(screen.getByRole('button', { name: /Revisar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Abrir caixa/i })).toBeInTheDocument()
  })

  it('quando não há nada, diz que está tudo em dia', async () => {
    listItensAgenda.mockResolvedValue([])
    getContadoresInbox.mockResolvedValue({ nao_tratadas: 0 })

    renderFila()

    await waitFor(() => expect(screen.getByText(/Tudo em dia/i)).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /Revisar/i })).not.toBeInTheDocument()
  })

  it('busca os dados UMA vez (antes eram 3 widgets buscando o mesmo)', async () => {
    listItensAgenda.mockResolvedValue([])
    getContadoresInbox.mockResolvedValue({ nao_tratadas: 0 })

    renderFila()

    await waitFor(() => expect(screen.getByText(/Tudo em dia/i)).toBeInTheDocument())
    expect(listItensAgenda).toHaveBeenCalledTimes(1)
    expect(getContadoresInbox).toHaveBeenCalledTimes(1)
  })
})
