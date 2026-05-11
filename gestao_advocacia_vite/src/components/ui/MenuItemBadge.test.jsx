import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import MenuItemBadge from './MenuItemBadge.jsx'

describe('MenuItemBadge', () => {
  it('renderiza o count quando > 0', () => {
    render(<MenuItemBadge count={5} />)
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('nao renderiza nada quando count === 0', () => {
    const { container } = render(<MenuItemBadge count={0} />)
    expect(container.firstChild).toBeNull()
  })

  it('nao renderiza nada quando count e undefined', () => {
    const { container } = render(<MenuItemBadge />)
    expect(container.firstChild).toBeNull()
  })

  it('clipa em max+ quando count excede max', () => {
    render(<MenuItemBadge count={150} max={99} />)
    expect(screen.getByText('99+')).toBeInTheDocument()
  })

  it('usa cor warning quando cor=warning', () => {
    render(<MenuItemBadge count={3} cor="warning" />)
    const badge = screen.getByText('3')
    expect(badge.style.backgroundColor).toBe('rgb(245, 158, 11)')
  })

  it('usa cor info quando cor=info', () => {
    render(<MenuItemBadge count={2} cor="info" />)
    const badge = screen.getByText('2')
    expect(badge.style.backgroundColor).toBe('rgb(59, 130, 246)')
  })

  it('fallback pra danger quando cor invalida', () => {
    render(<MenuItemBadge count={1} cor="banana" />)
    const badge = screen.getByText('1')
    expect(badge.style.backgroundColor).toBe('rgb(239, 68, 68)')
  })
})
