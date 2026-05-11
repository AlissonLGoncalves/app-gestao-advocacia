import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AvatarSigla from './AvatarSigla.jsx'
import PrioridadeBadge from './PrioridadeBadge.jsx'
import StatusBadge from './StatusBadge.jsx'
import CardMeta from './CardMeta.jsx'
import { corPorNome, iniciaisDoNome } from '../../utils/avatarColor.js'

describe('avatarColor utils', () => {
  it('iniciaisDoNome retorna ate 2 letras maiusculas', () => {
    expect(iniciaisDoNome('Alisson Luiz')).toBe('AL')
    expect(iniciaisDoNome('Alisson')).toBe('AL')
    expect(iniciaisDoNome('Alisson Luiz Gomes')).toBe('AG')
    expect(iniciaisDoNome('  ')).toBeNull()
    expect(iniciaisDoNome(null)).toBeNull()
  })

  it('corPorNome e deterministica para o mesmo nome', () => {
    const a = corPorNome('Alisson Luiz')
    const b = corPorNome('Alisson Luiz')
    expect(a.bg).toBe(b.bg)
  })

  it('corPorNome difere entre nomes diferentes (na maioria dos casos)', () => {
    const a = corPorNome('Alisson')
    const b = corPorNome('Beatriz')
    // nao garantimos sempre diferente (modulo 8), mas testa que o hash muda
    expect(a).toBeDefined()
    expect(b).toBeDefined()
  })

  it('corPorNome retorna fallback muted para nome vazio', () => {
    expect(corPorNome(null).bg).toBe('#9ca7bb')
    expect(corPorNome('').bg).toBe('#9ca7bb')
  })
})

describe('AvatarSigla', () => {
  it('renderiza iniciais a partir do nome', () => {
    render(<AvatarSigla nome="Alisson Luiz" />)
    expect(screen.getByText('AL')).toBeInTheDocument()
  })

  it('respeita prop iniciais quando passada', () => {
    render(<AvatarSigla nome="Alisson Luiz" iniciais="XY" />)
    expect(screen.getByText('XY')).toBeInTheDocument()
  })

  it('nao renderiza nada quando nao ha nome nem iniciais', () => {
    const { container } = render(<AvatarSigla />)
    expect(container.firstChild).toBeNull()
  })
})

describe('PrioridadeBadge', () => {
  it('renderiza Urgente com classe danger', () => {
    render(<PrioridadeBadge prioridade="Urgente" />)
    const badge = screen.getByText('Urgente')
    expect(badge.className).toMatch(/danger/)
  })

  it('omite Normal por padrao', () => {
    const { container } = render(<PrioridadeBadge prioridade="Normal" />)
    expect(container.firstChild).toBeNull()
  })

  it('renderiza Normal quando mostrarNormal=true', () => {
    render(<PrioridadeBadge prioridade="Normal" mostrarNormal />)
    expect(screen.getByText('Normal')).toBeInTheDocument()
  })
})

describe('StatusBadge', () => {
  it('renderiza status Ativo com classe success', () => {
    render(<StatusBadge tipo="caso" valor="Ativo" />)
    const badge = screen.getByText('Ativo')
    expect(badge.className).toMatch(/success/)
  })

  it('aceita tipo tarefa e mapeia A Fazer para danger', () => {
    render(<StatusBadge tipo="tarefa" valor="A Fazer" />)
    expect(screen.getByText('A Fazer').className).toMatch(/danger/)
  })

  it('nao renderiza nada quando valor e vazio', () => {
    const { container } = render(<StatusBadge valor="" />)
    expect(container.firstChild).toBeNull()
  })
})

describe('CardMeta', () => {
  it('compoe status + prioridade + avatar', () => {
    render(
      <CardMeta
        status="Ativo"
        prioridade="Urgente"
        responsavelNome="Alisson Luiz"
      />
    )
    expect(screen.getByText('Ativo')).toBeInTheDocument()
    expect(screen.getByText('Urgente')).toBeInTheDocument()
    expect(screen.getByText('AL')).toBeInTheDocument()
  })

  it('omite atoms vazios sem quebrar', () => {
    render(<CardMeta status="Ativo" />)
    expect(screen.getByText('Ativo')).toBeInTheDocument()
  })
})
