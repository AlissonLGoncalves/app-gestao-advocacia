import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import RiscoBadge from './RiscoBadge.jsx'
import { calcularRiscoDjen } from '../../utils/djenRisco.js'

describe('calcularRiscoDjen', () => {
  it('importante null -> desconhecido', () => {
    expect(calcularRiscoDjen({ importante: null })).toBe('desconhecido')
    expect(calcularRiscoDjen({})).toBe('desconhecido')
    expect(calcularRiscoDjen(null)).toBe('desconhecido')
  })

  it('importante false -> baixo', () => {
    expect(calcularRiscoDjen({ importante: false })).toBe('baixo')
    expect(calcularRiscoDjen({ importante: false, tipo_comunicacao: 'Sentença' })).toBe('baixo')
  })

  it('importante true + tipo critico -> alto', () => {
    expect(calcularRiscoDjen({ importante: true, tipo_comunicacao: 'Sentença' })).toBe('alto')
    expect(
      calcularRiscoDjen({ importante: true, tipo_comunicacao: 'Decisão Interlocutória' })
    ).toBe('alto')
    expect(calcularRiscoDjen({ importante: true, tipo_comunicacao: 'Acórdão' })).toBe('alto')
    expect(
      calcularRiscoDjen({ importante: true, tipo_comunicacao: 'Designação de Audiência' })
    ).toBe('alto')
  })

  it('importante true + tipo nao critico -> medio', () => {
    expect(calcularRiscoDjen({ importante: true, tipo_comunicacao: 'Intimação' })).toBe('medio')
    expect(calcularRiscoDjen({ importante: true, tipo_comunicacao: 'Despacho' })).toBe('medio')
  })

  it('importante true sem tipo -> medio', () => {
    expect(calcularRiscoDjen({ importante: true })).toBe('medio')
    expect(calcularRiscoDjen({ importante: true, tipo_comunicacao: null })).toBe('medio')
  })
})

describe('RiscoBadge render', () => {
  it('renderiza alto com label Alto', () => {
    render(<RiscoBadge pub={{ importante: true, tipo_comunicacao: 'Sentença' }} />)
    expect(screen.getByTestId('risco-badge-alto')).toBeInTheDocument()
    expect(screen.getByText('Alto')).toBeInTheDocument()
  })

  it('renderiza medio com label Atenção', () => {
    render(<RiscoBadge pub={{ importante: true, tipo_comunicacao: 'Intimação' }} />)
    expect(screen.getByText('Atenção')).toBeInTheDocument()
  })

  it('NAO renderiza baixo por padrao', () => {
    const { container } = render(<RiscoBadge pub={{ importante: false }} />)
    expect(container.firstChild).toBeNull()
  })

  it('renderiza baixo quando mostrarBaixo=true', () => {
    render(<RiscoBadge pub={{ importante: false }} mostrarBaixo />)
    expect(screen.getByText('Rotina')).toBeInTheDocument()
  })

  it('NAO renderiza desconhecido por padrao', () => {
    const { container } = render(<RiscoBadge pub={{ importante: null }} />)
    expect(container.firstChild).toBeNull()
  })

  it('aceita nivel direto via prop', () => {
    render(<RiscoBadge nivel="alto" />)
    expect(screen.getByText('Alto')).toBeInTheDocument()
  })

  it('modo compacto omite o texto', () => {
    render(<RiscoBadge pub={{ importante: true, tipo_comunicacao: 'Sentença' }} compacto />)
    expect(screen.queryByText('Alto')).toBeNull()
    expect(screen.getByTestId('risco-badge-alto')).toBeInTheDocument()
  })
})
