import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RecebimentosPage from './RecebimentosPage.jsx'
import { getRecebimento } from '../api/financeiro.js'

vi.mock('../RecebimentoList.jsx', () => ({
  default: () => <div data-testid="recebimento-list" />,
}))

vi.mock('../RecebimentoForm.jsx', () => ({
  default: ({ recebimentoParaEditar }) => (
    <div data-testid="recebimento-form">{recebimentoParaEditar?.descricao || 'sem-dados'}</div>
  ),
}))

vi.mock('../components/BotaoAdicionar.jsx', () => ({
  default: () => <button type="button">Adicionar</button>,
}))

vi.mock('../api/financeiro.js', () => ({
  getRecebimento: vi.fn(),
}))

describe('RecebimentosPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('carrega recebimento no modo de edicao', async () => {
    getRecebimento.mockResolvedValueOnce({ id: 15, descricao: 'Parcela 1' })

    render(
      <MemoryRouter initialEntries={['/recebimentos/editar/15']}>
        <Routes>
          <Route path="/recebimentos/editar/:recebimentoId" element={<RecebimentosPage />} />
          <Route path="/recebimentos" element={<div>lista</div>} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(getRecebimento).toHaveBeenCalledWith('15')
    })

    expect(await screen.findByTestId('recebimento-form')).toHaveTextContent('Parcela 1')
  })
})
