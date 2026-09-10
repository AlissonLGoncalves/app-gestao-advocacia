import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CabecalhoMes from './CabecalhoMes.jsx'

describe('CabecalhoMes', () => {
  it('mostra titulo, contagem e navega', () => {
    const onAnterior = vi.fn()
    const onProximo = vi.fn()
    render(
      <CabecalhoMes
        titulo="Setembro 2026"
        contagem={{ prazos: 14, audiencias: 1 }}
        chip="todos"
        onAnterior={onAnterior}
        onProximo={onProximo}
      />
    )
    expect(screen.getByText('Setembro 2026')).toBeInTheDocument()
    expect(screen.getByTestId('contagem-mes')).toHaveTextContent('14 prazos · 1 audiência')
    fireEvent.click(screen.getByRole('button', { name: 'Mês anterior' }))
    fireEvent.click(screen.getByRole('button', { name: 'Próximo mês' }))
    expect(onAnterior).toHaveBeenCalled()
    expect(onProximo).toHaveBeenCalled()
  })

  it('chips de filtro marcam o ativo e chamam onChip', () => {
    const onChip = vi.fn()
    render(<CabecalhoMes titulo="Setembro 2026" contagem={{}} chip="prazos" onChip={onChip} />)
    expect(screen.getByRole('button', { name: 'Prazos' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'Audiências' }))
    expect(onChip).toHaveBeenCalledWith('audiencias')
  })
})
