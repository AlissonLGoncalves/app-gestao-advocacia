import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PatronusLogo from './PatronusLogo.jsx'

describe('PatronusLogo', () => {
  it('renderiza marca, wordmark e tagline por padrao', () => {
    const { container } = render(<PatronusLogo />)
    expect(screen.getByRole('img', { name: 'Patronus' })).toBeInTheDocument()
    expect(screen.getByText('Patronus')).toBeInTheDocument()
    expect(screen.getByText('Sistema Jurídico')).toBeInTheDocument()
    expect(container.firstChild).toHaveClass('patronus-logo-light')
  })

  it('modo compact mostra so o hexagono', () => {
    const { container } = render(<PatronusLogo compact />)
    expect(screen.getByRole('img', { name: 'Patronus' })).toBeInTheDocument()
    expect(screen.queryByText('Sistema Jurídico')).not.toBeInTheDocument()
    expect(container.firstChild).toHaveClass('is-compact')
  })

  it('aceita tamanho e tom', () => {
    render(<PatronusLogo size={64} tone="dark" tagline="" />)
    const svg = screen.getByRole('img', { name: 'Patronus' })
    expect(svg).toHaveAttribute('width', '64')
    expect(svg.closest('.patronus-logo')).toHaveClass('patronus-logo-dark')
    expect(screen.queryByText('Sistema Jurídico')).not.toBeInTheDocument()
  })

  it('gera id de gradiente unico por instancia', () => {
    const { container } = render(
      <>
        <PatronusLogo compact />
        <PatronusLogo compact />
      </>
    )
    const ids = [...container.querySelectorAll('linearGradient')].map((g) => g.id)
    expect(ids).toHaveLength(2)
    expect(ids[0]).not.toBe(ids[1])
  })
})
