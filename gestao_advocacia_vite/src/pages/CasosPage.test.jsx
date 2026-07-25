import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import { render, screen, waitFor } from '@testing-library/react'
import CasosPage from './CasosPage.jsx'
import { getCaso } from '../api/casos.js'

vi.mock('../api/casos.js', () => ({
  getCaso: vi.fn(),
}))

vi.mock('../components/CasoList.jsx', () => ({
  default: () => <div data-testid="caso-list">Lista de casos</div>,
}))

vi.mock('../components/CasoForm.jsx', () => ({
  default: ({ casoParaEditar }) => (
    <div data-testid="caso-form">Form caso: {casoParaEditar?.titulo || 'novo'}</div>
  ),
}))

vi.mock('../components/BotaoAdicionar.jsx', () => ({
  default: ({ texto }) => <button type="button">{texto}</button>,
}))

describe('CasosPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'token-teste')
  })

  it('renderiza lista no modo padrão', async () => {
    render(
      <MemoryRouter initialEntries={['/casos']}>
        <Routes>
          <Route path="/casos" element={<CasosPage />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByTestId('caso-list')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /adicionar novo caso/i })).toBeInTheDocument()
  })

  it('carrega caso para edição e exibe formulário', async () => {
    getCaso.mockResolvedValue({ id: 10, titulo: 'Caso Trabalhista' })

    render(
      <MemoryRouter initialEntries={['/casos/editar/10']}>
        <Routes>
          <Route path="/casos/editar/:casoId" element={<CasosPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(getCaso).toHaveBeenCalledWith('10')
    })

    expect(await screen.findByTestId('caso-form')).toHaveTextContent('Caso Trabalhista')
  })
})
