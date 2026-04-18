import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DadosProcessoSection from './DadosProcessoSection.jsx'

const baseFormData = {
  numero_processo: '',
  titulo: '',
  cliente_id: '',
  status: 'Ativo',
  tipo_acao: '',
  area_direito: '',
  valor_causa: '',
  notas_caso: '',
}

const clientes = [
  { id: 1, nome_razao_social: 'Cliente Alpha' },
  { id: 2, nome_razao_social: 'Cliente Beta' },
]

describe('DadosProcessoSection', () => {
  it('renderiza campos obrigatorios', () => {
    render(
      <DadosProcessoSection
        formData={baseFormData}
        clientes={clientes}
        cnjInfo={null}
        isSyncingCNJ={false}
        validationErrors={{}}
        onChange={vi.fn()}
        onNumeroProcessoChange={vi.fn()}
      />
    )

    expect(screen.getByLabelText(/título do caso/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/cliente associado/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^status/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/número do processo/i)).toBeInTheDocument()
  })

  it('exibe clientes no select', () => {
    render(
      <DadosProcessoSection
        formData={baseFormData}
        clientes={clientes}
        cnjInfo={null}
        isSyncingCNJ={false}
        validationErrors={{}}
        onChange={vi.fn()}
        onNumeroProcessoChange={vi.fn()}
      />
    )

    expect(screen.getByText('Cliente Alpha')).toBeInTheDocument()
    expect(screen.getByText('Cliente Beta')).toBeInTheDocument()
  })

  it('exibe informacoes de cnjInfo quando fornecido', () => {
    const cnjInfo = {
      tribunalNome: 'TJPR – Paraná',
      areaSugerida: 'Cível',
      ano: '2025',
      instanciaSugerida: '1ª Instância',
    }

    render(
      <DadosProcessoSection
        formData={baseFormData}
        clientes={[]}
        cnjInfo={cnjInfo}
        isSyncingCNJ={false}
        validationErrors={{}}
        onChange={vi.fn()}
        onNumeroProcessoChange={vi.fn()}
      />
    )

    expect(screen.getByText(/TJPR/i)).toBeInTheDocument()
    expect(screen.getByText(/2025/)).toBeInTheDocument()
  })

  it('exibe spinner de sincronizacao CNJ', () => {
    const cnjInfo = {
      tribunalNome: 'STJ',
      areaSugerida: 'Cível',
      ano: '2025',
      instanciaSugerida: '2ª',
    }

    render(
      <DadosProcessoSection
        formData={baseFormData}
        clientes={[]}
        cnjInfo={cnjInfo}
        isSyncingCNJ={true}
        validationErrors={{}}
        onChange={vi.fn()}
        onNumeroProcessoChange={vi.fn()}
      />
    )

    expect(screen.getByText(/apurando/i)).toBeInTheDocument()
  })

  it('exibe mensagem de erro de validacao no titulo', () => {
    render(
      <DadosProcessoSection
        formData={baseFormData}
        clientes={[]}
        cnjInfo={null}
        isSyncingCNJ={false}
        validationErrors={{ titulo: 'Título do caso é obrigatório.' }}
        onChange={vi.fn()}
        onNumeroProcessoChange={vi.fn()}
      />
    )

    expect(screen.getByText(/título do caso é obrigatório/i)).toBeInTheDocument()
  })

  it('chama onNumeroProcessoChange ao digitar', () => {
    const onNumeroProcessoChange = vi.fn()

    render(
      <DadosProcessoSection
        formData={baseFormData}
        clientes={[]}
        cnjInfo={null}
        isSyncingCNJ={false}
        validationErrors={{}}
        onChange={vi.fn()}
        onNumeroProcessoChange={onNumeroProcessoChange}
      />
    )

    fireEvent.change(screen.getByLabelText(/número do processo/i), { target: { value: '0000001' } })
    expect(onNumeroProcessoChange).toHaveBeenCalled()
  })
})
