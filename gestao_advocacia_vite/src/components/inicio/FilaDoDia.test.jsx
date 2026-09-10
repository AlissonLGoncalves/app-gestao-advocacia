import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import FilaDoDia from './FilaDoDia.jsx'

const toastInfo = vi.fn()
vi.mock('react-toastify', () => ({
  toast: { info: (...args) => toastInfo(...args), error: vi.fn() },
}))

const linha = (chave, acao, extras = {}) => ({
  chave,
  fonte: 'tarefa',
  urgencia: 'hoje',
  titulo: `Título ${chave}`,
  detalhe: `Detalhe ${chave}`,
  acao,
  ...extras,
})

describe('FilaDoDia', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('limita a 7 linhas pendentes e avisa quantas ficaram de fora', () => {
    const pendentes = Array.from({ length: 9 }, (_, i) =>
      linha(`t${i}`, { tipo: 'navegar', rotulo: 'Abrir', destino: '/agenda' })
    )
    render(
      <FilaDoDia
        pendentes={pendentes}
        concluidas={[]}
        concluindoChave={null}
        onNavegar={vi.fn()}
        onConcluir={vi.fn()}
      />
    )

    expect(screen.getAllByTestId('fila-linha')).toHaveLength(7)
    expect(screen.getByText('9 pendentes')).toBeInTheDocument()
    expect(screen.getByText(/Mais 2 itens depois destes/)).toBeInTheDocument()
  })

  it('aplica o tom de urgencia e so um botao primario', () => {
    const pendentes = [
      linha('a', { tipo: 'navegar', rotulo: 'Ver', destino: '/x' }, { urgencia: 'vencido' }),
      linha('b', { tipo: 'navegar', rotulo: 'Ver', destino: '/y' }, { urgencia: 'hoje' }),
      linha('c', { tipo: 'navegar', rotulo: 'Ver', destino: '/z' }, { urgencia: 'semana' }),
    ]
    render(
      <FilaDoDia
        pendentes={pendentes}
        concluidas={[]}
        concluindoChave={null}
        onNavegar={vi.fn()}
        onConcluir={vi.fn()}
      />
    )
    const linhas = screen.getAllByTestId('fila-linha')
    expect(linhas[0]).toHaveClass('dh-linha--vencido')
    expect(linhas[1]).toHaveClass('dh-linha--hoje')
    expect(linhas[2]).toHaveClass('dh-linha--semana')
    expect(document.querySelectorAll('.dh-btn--primario')).toHaveLength(1)
    expect(document.querySelectorAll('.dh-btn--contorno')).toHaveLength(2)
  })

  it('"Abrir no tribunal" abre em nova aba e copia o numero quando precisa colar', () => {
    const writeText = vi.fn().mockResolvedValue()
    Object.assign(navigator, { clipboard: { writeText } })

    render(
      <FilaDoDia
        pendentes={[
          linha('p', {
            tipo: 'tribunal',
            rotulo: 'Abrir no tribunal',
            url: 'https://projudi.tjpr.jus.br/projudi/',
            nomePortal: 'Projudi/TJPR',
            precisaColar: true,
            numeroProcesso: '0001234-56.2026.8.16.0001',
          }),
        ]}
        concluidas={[]}
        concluindoChave={null}
        onNavegar={vi.fn()}
        onConcluir={vi.fn()}
      />
    )

    const link = screen.getByRole('link', { name: /Abrir no tribunal/ })
    expect(link).toHaveAttribute('href', 'https://projudi.tjpr.jus.br/projudi/')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    fireEvent.click(link)
    expect(writeText).toHaveBeenCalledWith('0001234-56.2026.8.16.0001')
  })

  it('"Concluir" chama onConcluir e mostra estado ocupado', () => {
    const onConcluir = vi.fn()
    const pendente = linha('c1', { tipo: 'concluir', rotulo: 'Concluir', itemId: 11 })
    const { rerender } = render(
      <FilaDoDia
        pendentes={[pendente]}
        concluidas={[]}
        concluindoChave={null}
        onNavegar={vi.fn()}
        onConcluir={onConcluir}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Concluir' }))
    expect(onConcluir).toHaveBeenCalledWith(pendente)

    rerender(
      <FilaDoDia
        pendentes={[pendente]}
        concluidas={[]}
        concluindoChave="c1"
        onNavegar={vi.fn()}
        onConcluir={onConcluir}
      />
    )
    expect(screen.getByRole('button', { name: 'Concluindo…' })).toBeDisabled()
  })

  it('mostra concluidas riscadas no fim com rotulo "Concluído"', () => {
    render(
      <FilaDoDia
        pendentes={[linha('a', { tipo: 'navegar', rotulo: 'Ver', destino: '/x' })]}
        concluidas={[{ chave: 'r1', titulo: 'Emitir guia de custas', detalhe: 'Prazo cumprido' }]}
        concluindoChave={null}
        onNavegar={vi.fn()}
        onConcluir={vi.fn()}
      />
    )
    const concluida = screen.getByTestId('fila-concluida')
    expect(concluida.querySelector('s')).toHaveTextContent('Emitir guia de custas')
    expect(concluida).toHaveTextContent('Concluído')
    const itens = document.querySelectorAll('.dh-fila__lista > li')
    expect(itens[itens.length - 1]).toBe(concluida)
  })
})
