import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import DespesasPage from './DespesasPage.jsx'
import { getDespesa } from '../api/financeiro.js'

vi.mock('../DespesaList.jsx', () => ({
  default: () => <div data-testid="despesa-list" />,
}))

vi.mock('../DespesaForm.jsx', () => ({
  default: ({ despesaParaEditar }) => (
    <div data-testid="despesa-form">{despesaParaEditar?.descricao || 'sem-dados'}</div>
  ),
}))

vi.mock('../components/BotaoAdicionar.jsx', () => ({
  default: () => <button type="button">Adicionar</button>,
}))

vi.mock('../api/financeiro.js', () => ({
  getDespesa: vi.fn(),
}))

describe('DespesasPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('carrega despesa no modo de edicao', async () => {
    getDespesa.mockResolvedValueOnce({ id: 21, descricao: 'Custas iniciais' })

    render(
      <MemoryRouter initialEntries={['/despesas/editar/21']}>
        <Routes>
          <Route path="/despesas/editar/:despesaId" element={<DespesasPage />} />
          <Route path="/despesas" element={<div>lista</div>} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(getDespesa).toHaveBeenCalledWith('21')
    })

    expect(await screen.findByTestId('despesa-form')).toHaveTextContent('Custas iniciais')
  })
})
