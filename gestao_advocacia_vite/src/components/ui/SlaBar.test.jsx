import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import SlaBar, { corPorDias } from './SlaBar.jsx'

describe('corPorDias', () => {
  it('vencido (diff negativo) retorna vermelho forte', () => {
    expect(corPorDias(-1)).toBe('#dc3545')
    expect(corPorDias(-30)).toBe('#dc3545')
  })

  it('hoje (diff 0) retorna danger', () => {
    expect(corPorDias(0)).toBe('#ef4444')
  })

  it('1-3 dias retorna laranja', () => {
    expect(corPorDias(1)).toBe('#f59e0b')
    expect(corPorDias(3)).toBe('#f59e0b')
  })

  it('4-7 dias retorna amarelo', () => {
    expect(corPorDias(4)).toBe('#fbbf24')
    expect(corPorDias(7)).toBe('#fbbf24')
  })

  it('8-15 dias retorna verde', () => {
    expect(corPorDias(8)).toBe('#34c759')
    expect(corPorDias(15)).toBe('#34c759')
  })

  it('alem de 15 dias retorna null (sem barra)', () => {
    expect(corPorDias(16)).toBeNull()
    expect(corPorDias(100)).toBeNull()
  })

  it('null/undefined retorna null', () => {
    expect(corPorDias(null)).toBeNull()
    expect(corPorDias(undefined)).toBeNull()
  })
})

describe('SlaBar render', () => {
  it('nao renderiza quando concluido', () => {
    const { container } = render(<SlaBar dataVencimento="2020-01-01" concluido />)
    expect(container.firstChild).toBeNull()
  })

  it('nao renderiza quando sem data', () => {
    const { container } = render(<SlaBar />)
    expect(container.firstChild).toBeNull()
  })

  it('nao renderiza quando data muito longe (>15 dias)', () => {
    const longe = new Date()
    longe.setDate(longe.getDate() + 30)
    const iso = longe.toISOString().slice(0, 10)
    const { container } = render(<SlaBar dataVencimento={iso} />)
    expect(container.firstChild).toBeNull()
  })

  it('renderiza com aria-label para data passada', () => {
    const { container } = render(<SlaBar dataVencimento="2020-01-01" />)
    const bar = container.firstChild
    expect(bar).not.toBeNull()
    expect(bar.getAttribute('aria-label')).toMatch(/Vencido/)
  })

  it('aceita data ISO completo (YYYY-MM-DDTHH:MM)', () => {
    const { container } = render(<SlaBar dataVencimento="2020-01-01T12:00:00" />)
    expect(container.firstChild).not.toBeNull()
  })
})
