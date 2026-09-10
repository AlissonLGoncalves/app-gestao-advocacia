import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import LinhaDjen from './LinhaDjen.jsx'
import ProgressoDia from './ProgressoDia.jsx'
import ResumoSemana from './ResumoSemana.jsx'
import SequenciaChip from './SequenciaChip.jsx'
import TudoEmDia from './TudoEmDia.jsx'

describe('ProgressoDia', () => {
  it('expõe "X de Y resolvidas" como barra de progresso acessivel', () => {
    render(<ProgressoDia resolvidas={4} total={7} />)
    const barra = screen.getByRole('progressbar', { name: '4 de 7 resolvidas' })
    expect(barra).toHaveAttribute('aria-valuenow', '4')
    expect(barra).toHaveAttribute('aria-valuemax', '7')
    expect(barra.firstChild).toHaveStyle({ width: '57%' })
  })

  it('nao divide por zero e usa singular', () => {
    render(<ProgressoDia resolvidas={0} total={0} />)
    expect(screen.getByRole('progressbar', { name: '0 de 0 resolvidas' })).toBeInTheDocument()
    render(<ProgressoDia resolvidas={1} total={1} />)
    expect(screen.getByRole('progressbar', { name: '1 de 1 resolvida' })).toBeInTheDocument()
  })
})

describe('SequenciaChip', () => {
  it('some abaixo de 1 dia e pluraliza', () => {
    const { rerender } = render(<SequenciaChip dias={0} />)
    expect(screen.queryByTestId('sequencia-chip')).not.toBeInTheDocument()
    rerender(<SequenciaChip dias={1} />)
    expect(screen.getByTestId('sequencia-chip')).toHaveTextContent('1 dia seguido em dia')
    rerender(<SequenciaChip dias={7} />)
    expect(screen.getByTestId('sequencia-chip')).toHaveTextContent('7 dias seguidos em dia')
  })
})

describe('LinhaDjen', () => {
  it('resume a captura de hoje com link para intimacoes', () => {
    const onNavegar = vi.fn()
    render(
      <LinhaDjen
        configurado
        captura={{ publicacoes: 1, tribunais: ['TJPR'], vinculadas: 1 }}
        onNavegar={onNavegar}
      />
    )
    expect(
      screen.getByText('Hoje às 7h: 1 publicação lida em TJPR · 1 já vinculada a caso.')
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ver intimações' }))
    expect(onNavegar).toHaveBeenCalledWith('/djen')
  })

  it('sem publicacoes hoje diz isso em vez de "0 publicações"', () => {
    render(
      <LinhaDjen
        configurado
        captura={{ publicacoes: 0, tribunais: [], vinculadas: 0 }}
        onNavegar={vi.fn()}
      />
    )
    expect(screen.getByText(/nenhuma publicação nova/)).toBeInTheDocument()
  })

  it('sem OAB convida a cadastrar', () => {
    const onNavegar = vi.fn()
    render(<LinhaDjen configurado={false} captura={null} onNavegar={onNavegar} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar OAB' }))
    expect(onNavegar).toHaveBeenCalledWith('/djen?aba=oabs')
  })
})

describe('ResumoSemana', () => {
  it('frase positiva sem prazos perdidos', () => {
    const onNavegar = vi.fn()
    render(
      <ResumoSemana semana={{ intimacoes_tratadas: 1, prazos_perdidos: 0 }} onNavegar={onNavegar} />
    )
    expect(
      screen.getByText('Você tratou 1 intimação e não perdeu nenhum prazo.')
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ver resumo' }))
    expect(onNavegar).toHaveBeenCalledWith('/agenda')
  })

  it('alerta quando prazos venceram sem tratamento', () => {
    render(
      <ResumoSemana semana={{ intimacoes_tratadas: 23, prazos_perdidos: 2 }} onNavegar={vi.fn()} />
    )
    expect(
      screen.getByText('Você tratou 23 intimações e 2 prazos venceram sem tratamento.')
    ).toBeInTheDocument()
    expect(document.querySelector('.dh-semana')).toHaveClass('dh-semana--alerta')
  })

  it('semana sem atividade nao diz "0 intimações"', () => {
    render(
      <ResumoSemana semana={{ intimacoes_tratadas: 0, prazos_perdidos: 0 }} onNavegar={vi.fn()} />
    )
    expect(
      screen.getByText('Você ainda não tratou intimações esta semana e não perdeu nenhum prazo.')
    ).toBeInTheDocument()
  })
})

describe('TudoEmDia', () => {
  it('estado vazio com "Ver casos"', () => {
    const onNavegar = vi.fn()
    render(<TudoEmDia bancoVazio={false} onNavegar={onNavegar} />)
    expect(screen.getByText('Tudo em dia.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ver casos' }))
    expect(onNavegar).toHaveBeenCalledWith('/casos')
  })

  it('banco vazio com "Novo caso"', () => {
    const onNavegar = vi.fn()
    render(<TudoEmDia bancoVazio onNavegar={onNavegar} />)
    expect(screen.getByText('Comece cadastrando seu primeiro caso.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Novo caso' }))
    expect(onNavegar).toHaveBeenCalledWith('/casos/novo')
  })
})
