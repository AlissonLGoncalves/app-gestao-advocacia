import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import ModalCriarClienteCaso from './ModalCriarClienteCaso.jsx'

vi.mock('react-toastify', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

const buildPublicacao = () => ({
  publicacao: {
    id: 77,
    nome_orgao: '2a Vara Civel de Cornelio Procopio',
    numero_processo: '0000472-75.2025.8.16.0075',
  },
  analise: {
    numero_processo: '0000472-75.2025.8.16.0075',
    classe_processual: 'Procedimento Comum Civel',
    comarca: 'Cornelio Procopio',
    valor_causa: 'R$150.000,00',
    partes_autoras: ['DIRCE DE OLIVEIRA PEDOTTI'],
    partes_reus: ['Banco do Brasil S/A'],
  },
  sugestoes_vinculo: {
    clientes: [{ id: 1, nome_razao_social: 'DIRCE DE OLIVEIRA PEDOTTI', score: 0.92 }],
    casos: [
      {
        id: 15,
        titulo: 'Caso já cadastrado',
        numero_processo: '0000472-75.2025.8.16.0075',
        score: 0.99,
      },
    ],
  },
})

describe('ModalCriarClienteCaso', () => {
  it('renderiza com campos pre-preenchidos da analise', () => {
    render(
      <ModalCriarClienteCaso publicacao={buildPublicacao()} onClose={vi.fn()} onSuccess={vi.fn()} />
    )

    expect(screen.getByLabelText(/Número do processo/i)).toHaveValue('0000472-75.2025.8.16.0075')
    expect(screen.getByLabelText(/Tipo da ação/i)).toHaveValue('Procedimento Comum Civel')
    expect(screen.getByLabelText(/Vara\/Juízo/i)).toHaveValue('2a Vara Civel de Cornelio Procopio')
    expect(screen.getByLabelText(/Comarca/i)).toHaveValue('Cornelio Procopio')
    expect(screen.getByLabelText(/Parte contrária/i)).toHaveValue('Banco do Brasil S/A')
  })

  it('exibe badges de extraido automaticamente nos campos pre-preenchidos', () => {
    render(
      <ModalCriarClienteCaso publicacao={buildPublicacao()} onClose={vi.fn()} onSuccess={vi.fn()} />
    )

    expect(screen.getAllByText('extraido automaticamente').length).toBeGreaterThan(3)
  })

  it('trocar radio Autor/Reu inverte a parte contraria sugerida', () => {
    render(
      <ModalCriarClienteCaso publicacao={buildPublicacao()} onClose={vi.fn()} onSuccess={vi.fn()} />
    )

    const campoParteContraria = screen.getByLabelText(/Parte contrária/i)
    expect(campoParteContraria).toHaveValue('Banco do Brasil S/A')

    fireEvent.click(screen.getByLabelText('Reu'))
    expect(campoParteContraria).toHaveValue('DIRCE DE OLIVEIRA PEDOTTI')
  })

  it('selecionar cliente existente esconde form de novo cliente', () => {
    render(
      <ModalCriarClienteCaso publicacao={buildPublicacao()} onClose={vi.fn()} onSuccess={vi.fn()} />
    )

    expect(screen.queryByTestId('novo-cliente-form')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'novo' } })
    expect(screen.getByTestId('novo-cliente-form')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: '1' } })
    expect(screen.queryByTestId('novo-cliente-form')).not.toBeInTheDocument()
  })

  it('mostra banner de caso existente quando ha match por numero de processo', () => {
    render(
      <ModalCriarClienteCaso publicacao={buildPublicacao()} onClose={vi.fn()} onSuccess={vi.fn()} />
    )

    expect(screen.getByText(/Já existe caso com este número/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vincular a este caso' })).toBeInTheDocument()
  })

  // Regressao 10/09/2026: sem a triagem por IA (chave do Gemini ausente) o
  // formulario abria vazio mesmo com as partes visiveis no card, obrigando a
  // redigitar o nome. Agora cai para polo_ativo/polo_passivo da ComunicaAPI.
  const semAnalise = () => ({
    publicacao: {
      id: 91,
      nome_orgao: 'Juizado Especial da Fazenda Publica de Cornelio Procopio',
      numero_processo: '00007910920268160075',
      numero_processo_mascara: '0000791-09.2026.8.16.0075',
      nome_classe: 'Procedimento do Juizado Especial da Fazenda Publica',
      polo_ativo: 'HELOISA CASSIANO DA SILVA | OUTRO AUTOR',
      polo_passivo: 'MUNICIPIO DE CORNELIO PROCOPIO',
    },
    analise: {},
    sugestoes_vinculo: {},
  })

  it('sem analise da IA, usa as partes da publicacao no formulario', () => {
    render(
      <ModalCriarClienteCaso publicacao={semAnalise()} onClose={vi.fn()} onSuccess={vi.fn()} />
    )

    // Primeiro nome do polo ativo vira o cliente (o " | OUTRO AUTOR" fica de fora).
    expect(screen.getByLabelText(/Nome.*Raz/i)).toHaveValue('HELOISA CASSIANO DA SILVA')
    expect(screen.getByLabelText(/Parte contr/i)).toHaveValue('MUNICIPIO DE CORNELIO PROCOPIO')
  })

  it('sem analise da IA, usa numero com mascara e a classe do tribunal', () => {
    render(
      <ModalCriarClienteCaso publicacao={semAnalise()} onClose={vi.fn()} onSuccess={vi.fn()} />
    )

    expect(screen.getByLabelText(/N.*mero do processo/i)).toHaveValue('0000791-09.2026.8.16.0075')
    expect(screen.getByLabelText(/T.*tulo/i)).toHaveValue('Processo 0000791-09.2026.8.16.0075')
    expect(screen.getByLabelText(/Tipo da a/i)).toHaveValue(
      'Procedimento do Juizado Especial da Fazenda Publica'
    )
  })
})
