/**
 * GlobalSearch como command palette (Ctrl+K): além de buscar casos/clientes,
 * mostra AÇÕES e navega ao selecioná-las. Cobre o "menu enxuto" — Relatórios,
 * Financeiro e Configurações saíram da sidebar e ficam acessíveis aqui.
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'

vi.mock('../api/client.js', () => ({
  api: { get: vi.fn(() => Promise.resolve([])) },
}))

import GlobalSearch from './GlobalSearch.jsx'

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname + loc.search}</div>
}

const renderPalette = () =>
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <GlobalSearch />
      <LocationProbe />
    </MemoryRouter>
  )

const abrir = () => fireEvent.click(screen.getByRole('button', { name: /Buscar/i }))

describe('GlobalSearch — command palette de ações', () => {
  beforeEach(() => vi.clearAllMocks())

  it('ao abrir (query vazia) lista as ações', () => {
    renderPalette()
    abrir()
    expect(screen.getByText('Tratar intimações')).toBeInTheDocument()
    expect(screen.getByText('Abrir Relatórios')).toBeInTheDocument()
    expect(screen.getByText('Abrir Configurações')).toBeInTheDocument()
  })

  it('filtra ações pela query, ignorando acento', () => {
    renderPalette()
    abrir()
    const input = screen.getByPlaceholderText(/Buscar casos, clientes/i)
    fireEvent.change(input, { target: { value: 'relatorio' } })
    expect(screen.getByText('Abrir Relatórios')).toBeInTheDocument()
    expect(screen.queryByText('Tratar intimações')).not.toBeInTheDocument()
  })

  it('clicar numa ação navega pra rota dela', () => {
    renderPalette()
    abrir()
    fireEvent.click(screen.getByText('Abrir Relatórios'))
    expect(screen.getByTestId('loc').textContent).toBe('/relatorios')
  })
})
