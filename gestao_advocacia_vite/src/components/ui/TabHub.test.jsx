/**
 * TabHub: shell de abas dos hubs do "menu enxuto" (Financeiro, Documentos,
 * Configurações). A aba ativa vive no query param `aba` (linkável + back).
 */
import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import TabHub from './TabHub.jsx'

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname + loc.search}</div>
}

const tabs = [
  { key: 'a', label: 'Aba A', element: <div>Conteudo A</div> },
  { key: 'b', label: 'Aba B', element: <div>Conteudo B</div> },
]

describe('TabHub', () => {
  it('renderiza a primeira aba por padrão', () => {
    render(
      <MemoryRouter initialEntries={['/hub']}>
        <TabHub tabs={tabs} />
      </MemoryRouter>
    )
    expect(screen.getByText('Conteudo A')).toBeInTheDocument()
    expect(screen.queryByText('Conteudo B')).not.toBeInTheDocument()
  })

  it('clicar numa aba troca o conteúdo e grava ?aba= na URL', () => {
    render(
      <MemoryRouter initialEntries={['/hub']}>
        <TabHub tabs={tabs} />
        <LocationProbe />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByRole('button', { name: /Aba B/i }))
    expect(screen.getByText('Conteudo B')).toBeInTheDocument()
    expect(screen.queryByText('Conteudo A')).not.toBeInTheDocument()
    expect(screen.getByTestId('loc').textContent).toContain('aba=b')
  })

  it('respeita a aba inicial vinda da URL', () => {
    render(
      <MemoryRouter initialEntries={['/hub?aba=b']}>
        <TabHub tabs={tabs} />
      </MemoryRouter>
    )
    expect(screen.getByText('Conteudo B')).toBeInTheDocument()
  })
})
