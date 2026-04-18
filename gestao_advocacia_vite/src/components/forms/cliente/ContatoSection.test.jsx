import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ContatoSection from './ContatoSection.jsx'

const baseFormData = { telefone: '', email: '', notas_gerais: '' }

describe('ContatoSection', () => {
  it('renderiza campos de contato', () => {
    render(<ContatoSection formData={baseFormData} validationErrors={{}} onChange={vi.fn()} />)

    expect(screen.getByLabelText(/^telefone$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/notas gerais/i)).toBeInTheDocument()
  })

  it('exibe erro de validacao de email', () => {
    render(
      <ContatoSection
        formData={baseFormData}
        validationErrors={{ email: 'E-mail inválido.' }}
        onChange={vi.fn()}
      />
    )

    expect(screen.getByText('E-mail inválido.')).toBeInTheDocument()
    expect(screen.getByLabelText(/^email$/i)).toHaveClass('is-invalid')
  })

  it('exibe valores preenchidos', () => {
    render(
      <ContatoSection
        formData={{ telefone: '(41) 99999-0000', email: 'test@test.com', notas_gerais: 'obs' }}
        validationErrors={{}}
        onChange={vi.fn()}
      />
    )

    expect(screen.getByDisplayValue('(41) 99999-0000')).toBeInTheDocument()
    expect(screen.getByDisplayValue('test@test.com')).toBeInTheDocument()
  })

  it('chama onChange ao editar telefone', () => {
    const onChange = vi.fn()
    render(<ContatoSection formData={baseFormData} validationErrors={{}} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText(/^telefone$/i), { target: { value: '(41) 3333-0000' } })
    expect(onChange).toHaveBeenCalled()
  })
})
