import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { render, screen, fireEvent } from '@testing-library/react'
import ProximoPassoCard from './ProximoPassoCard.jsx'

const HOJE = new Date('2026-09-08T09:00:00')

function r(props) {
  return render(
    <MemoryRouter>
      <ProximoPassoCard hoje={HOJE} {...props} />
    </MemoryRouter>
  )
}

describe('ProximoPassoCard', () => {
  it('prazo futuro: frase "{ação} até {data}" + chip "em N dias"', () => {
    r({
      item: {
        id: 1,
        status: 'Pendente',
        titulo: 'Contestação — Maria × Banco',
        tipo_providencia: 'contestacao_15d',
        data_vencimento: '2026-09-20',
      },
    })
    expect(screen.getByTestId('passo-frase')).toHaveTextContent(
      'Apresentar contestação até 20/09/2026'
    )
    expect(screen.getByTestId('chip-vencimento')).toHaveTextContent('em 12 dias')
    expect(screen.queryByTestId('passo-decurso')).not.toBeInTheDocument()
  })

  it('prazo vencido: "venceu em {data}" em vermelho + chip "vencido há N dias"', () => {
    r({
      item: {
        id: 1,
        status: 'Pendente',
        titulo: 'Manifestar',
        tipo_providencia: 'manifestacao_15d',
        data_vencimento: '2026-09-01',
      },
    })
    const frase = screen.getByTestId('passo-frase')
    expect(frase).toHaveTextContent('Apresentar manifestação — venceu em 01/09/2026')
    expect(frase.querySelector('.cd-vencido')).not.toBeNull()
    expect(screen.getByTestId('chip-vencimento')).toHaveTextContent('vencido há 7 dias')
    expect(screen.getByTestId('chip-vencimento')).toHaveClass('cd-chip-urg--danger')
  })

  it('sem itens: "Nenhum passo pendente." + botão que chama onRegistrar', () => {
    const onRegistrar = vi.fn()
    r({ item: null, onRegistrar })
    expect(screen.getByTestId('passo-vazio')).toHaveTextContent('Nenhum passo pendente.')
    expect(screen.queryByTestId('chip-vencimento')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('btn-registrar-passo'))
    expect(onRegistrar).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('peca-cabivel')).not.toBeInTheDocument()
  })

  it('com providência: bloco "Peça cabível" + "Gerar peça" abre o fluxo com o item', () => {
    const onGerarPeca = vi.fn()
    const item = {
      id: 9,
      status: 'Pendente',
      titulo: 'Recorrer',
      tipo_providencia: 'recurso_15d',
      data_vencimento: '2026-09-15',
      prazo_dias_origem: 15,
      publicacao_djen_id: 77,
    }
    r({ item, onGerarPeca, publicacao: { id: 77, data_disponibilizacao: '2026-08-31' } })
    expect(screen.getByTestId('peca-cabivel')).toHaveTextContent('Recurso')
    expect(screen.getByTestId('peca-cabivel')).toHaveTextContent(
      'Endereçamento, qualificação das partes e nº do processo'
    )
    fireEvent.click(screen.getByTestId('btn-gerar-peca'))
    expect(onGerarPeca).toHaveBeenCalledWith(item)
    // origem DJEN + decurso
    const fonte = screen.getByTestId('passo-fonte-djen')
    expect(fonte).toHaveTextContent('Prazo extraído da publicação do DJEN de 31/08/2026')
    expect(screen.getByRole('link', { name: /ver publicação/i })).toHaveAttribute(
      'href',
      '/djen?publicacao=77'
    )
    expect(screen.getByTestId('passo-decurso')).toHaveTextContent('Decurso de prazo: dia 8 de 15')
  })

  it('sem providência usa o título do item e não mostra peça cabível', () => {
    r({
      item: { id: 2, status: 'Pendente', titulo: 'Ligar para o cliente', data_vencimento: null },
    })
    expect(screen.getByTestId('passo-frase')).toHaveTextContent('Ligar para o cliente')
    expect(screen.getByTestId('chip-vencimento')).toHaveTextContent('sem data')
    expect(screen.queryByTestId('peca-cabivel')).not.toBeInTheDocument()
  })

  it('checklist: "{k} de {n} concluídos", concluído riscado, pendente com ação', () => {
    const onChecklistAcao = vi.fn()
    r({
      item: null,
      onChecklistAcao,
      checklist: [
        { id: 'procuracao', label: 'Procuração no processo', concluido: true },
        {
          id: 'cliente',
          label: 'Cliente com CPF/CNPJ e endereço',
          concluido: false,
          acao: { tipo: 'link', to: '/clientes/editar/7', label: 'Completar' },
        },
        {
          id: 'contrato',
          label: 'Contrato de honorários',
          concluido: false,
          acao: { tipo: 'botao', id: 'contrato', label: 'Criar' },
        },
      ],
    })
    expect(screen.getByTestId('check-progresso')).toHaveTextContent('1 de 3 concluídos')
    expect(screen.getByTestId('check-procuracao')).toHaveClass('cd-check-item--ok')
    expect(screen.getByRole('link', { name: /Completar/ })).toHaveAttribute(
      'href',
      '/clientes/editar/7'
    )
    fireEvent.click(screen.getByRole('button', { name: /Criar/ }))
    expect(onChecklistAcao).toHaveBeenCalledWith(
      'contrato',
      expect.objectContaining({ id: 'contrato' })
    )
  })
})
