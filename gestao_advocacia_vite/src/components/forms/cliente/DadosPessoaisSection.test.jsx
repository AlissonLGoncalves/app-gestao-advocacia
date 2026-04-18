import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DadosPessoaisSection from './DadosPessoaisSection.jsx'

const baseFormData = {
  tipo_pessoa: 'PF',
  nome_razao_social: '',
  cpf_cnpj: '',
  rg: '',
  orgao_emissor: '',
  data_nascimento: '',
  estado_civil: '',
  profissao: '',
  nacionalidade: '',
}

const defaultProps = {
  formData: baseFormData,
  isEditing: false,
  loadingCnpj: false,
  validationErrors: {},
  onChange: vi.fn(),
  onCpfCnpjChange: vi.fn(),
  onDataNascimentoChange: vi.fn(),
  onGenericCnpjBlur: vi.fn(),
  formatDataParaExibicao: (d) => d,
}

describe('DadosPessoaisSection', () => {
  it('renderiza campo nome e cpf/cnpj', () => {
    render(<DadosPessoaisSection {...defaultProps} />)

    expect(screen.getByLabelText(/nome completo/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^cpf/i)).toBeInTheDocument()
  })

  it('exibe campos exclusivos de PF quando tipo_pessoa=PF', () => {
    render(<DadosPessoaisSection {...defaultProps} />)

    expect(screen.getByLabelText(/data de nascimento/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/estado civil/i)).toBeInTheDocument()
  })

  it('exibe spinner de loading CNPJ', () => {
    render(
      <DadosPessoaisSection
        {...defaultProps}
        formData={{ ...baseFormData, tipo_pessoa: 'PJ', cpf_cnpj: '12345678000190' }}
        loadingCnpj={true}
      />
    )

    expect(document.querySelector('.spinner-border')).toBeInTheDocument()
  })

  it('exibe erro de validacao em nome_razao_social', () => {
    render(
      <DadosPessoaisSection
        {...defaultProps}
        validationErrors={{ nome_razao_social: 'Nome é obrigatório.' }}
      />
    )

    expect(screen.getByText('Nome é obrigatório.')).toBeInTheDocument()
  })

  it('chama onChange ao editar nome', () => {
    const onChange = vi.fn()
    render(<DadosPessoaisSection {...defaultProps} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText(/nome completo/i), { target: { value: 'João Silva' } })
    expect(onChange).toHaveBeenCalled()
  })
})
