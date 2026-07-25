import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import HeaderQuickAdd from './HeaderQuickAdd.jsx'

// Mock useNavigate — capturamos chamadas pra checar redirects.
const navigateMock = vi.fn()
vi.mock('react-router', () => ({
  useNavigate: () => navigateMock,
}))

describe('HeaderQuickAdd', () => {
  beforeEach(() => {
    navigateMock.mockClear()
  })

  it('renderiza o botão "Novo" e nao mostra dropdown inicialmente', () => {
    render(<HeaderQuickAdd />)
    expect(screen.getByTestId('header-quick-add-toggle')).toBeInTheDocument()
    expect(screen.queryByTestId('header-quick-add-menu')).not.toBeInTheDocument()
  })

  it('abre o dropdown ao clicar no botão e mostra os 5 itens', () => {
    render(<HeaderQuickAdd />)
    fireEvent.click(screen.getByTestId('header-quick-add-toggle'))
    expect(screen.getByTestId('header-quick-add-menu')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Cliente/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Caso/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Recebimento/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Despesa/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Evento/i })).toBeInTheDocument()
  })

  it('navega ao clicar num item e fecha o dropdown', () => {
    render(<HeaderQuickAdd />)
    fireEvent.click(screen.getByTestId('header-quick-add-toggle'))
    fireEvent.click(screen.getByRole('menuitem', { name: /Cliente/i }))
    expect(navigateMock).toHaveBeenCalledWith('/clientes/novo')
    expect(screen.queryByTestId('header-quick-add-menu')).not.toBeInTheDocument()
  })

  it('fecha ao pressionar Escape', () => {
    render(<HeaderQuickAdd />)
    fireEvent.click(screen.getByTestId('header-quick-add-toggle'))
    expect(screen.getByTestId('header-quick-add-menu')).toBeInTheDocument()
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(screen.queryByTestId('header-quick-add-menu')).not.toBeInTheDocument()
  })

  it('Alt+N abre o dropdown quando esta fechado', () => {
    render(<HeaderQuickAdd />)
    expect(screen.queryByTestId('header-quick-add-menu')).not.toBeInTheDocument()
    act(() => {
      fireEvent.keyDown(document, { key: 'n', altKey: true })
    })
    expect(screen.getByTestId('header-quick-add-menu')).toBeInTheDocument()
  })

  it('Alt+N fecha quando ja esta aberto', () => {
    render(<HeaderQuickAdd />)
    fireEvent.click(screen.getByTestId('header-quick-add-toggle'))
    expect(screen.getByTestId('header-quick-add-menu')).toBeInTheDocument()
    act(() => {
      fireEvent.keyDown(document, { key: 'N', altKey: true })
    })
    expect(screen.queryByTestId('header-quick-add-menu')).not.toBeInTheDocument()
  })

  it('Enter no item ativo navega', () => {
    render(<HeaderQuickAdd />)
    fireEvent.click(screen.getByTestId('header-quick-add-toggle'))
    // Item 0 = Cliente — Enter vai pra /clientes/novo
    act(() => {
      fireEvent.keyDown(document, { key: 'Enter' })
    })
    expect(navigateMock).toHaveBeenCalledWith('/clientes/novo')
  })

  it('seta para baixo move o item ativo e Enter navega no segundo', () => {
    render(<HeaderQuickAdd />)
    fireEvent.click(screen.getByTestId('header-quick-add-toggle'))
    act(() => {
      fireEvent.keyDown(document, { key: 'ArrowDown' })
    })
    act(() => {
      fireEvent.keyDown(document, { key: 'Enter' })
    })
    // Item 1 = Caso → /casos/novo
    expect(navigateMock).toHaveBeenCalledWith('/casos/novo')
  })

  it('atalho de letra (R) navega direto pra Recebimento', () => {
    render(<HeaderQuickAdd />)
    fireEvent.click(screen.getByTestId('header-quick-add-toggle'))
    act(() => {
      fireEvent.keyDown(document, { key: 'r' })
    })
    expect(navigateMock).toHaveBeenCalledWith('/recebimentos/novo')
  })

  it('atalho de letra com Ctrl modificador NAO dispara (evita conflito com browser)', () => {
    render(<HeaderQuickAdd />)
    fireEvent.click(screen.getByTestId('header-quick-add-toggle'))
    act(() => {
      fireEvent.keyDown(document, { key: 'r', ctrlKey: true })
    })
    expect(navigateMock).not.toHaveBeenCalled()
  })
})
