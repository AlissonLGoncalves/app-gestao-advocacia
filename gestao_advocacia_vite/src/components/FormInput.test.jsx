import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FormInput from './FormInput.jsx'

describe('FormInput', () => {
  it('renderiza label, input e dispara onChange', () => {
    const onChange = vi.fn()
    render(<FormInput label="Nome" name="nome" id="nome" value="" onChange={onChange} />)

    const input = screen.getByLabelText('Nome')
    expect(input).toBeInTheDocument()
    expect(input).toHaveClass('form-control')

    fireEvent.change(input, { target: { value: 'Joao' } })
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('aplica is-invalid e exibe mensagem quando ha erro', () => {
    render(
      <FormInput
        label="Nome"
        name="nome"
        id="nome"
        value=""
        onChange={vi.fn()}
        error="Campo obrigatorio"
      />
    )

    expect(screen.getByLabelText('Nome')).toHaveClass('is-invalid')
    expect(screen.getByText('Campo obrigatorio')).toBeInTheDocument()
  })

  it('exibe asterisco quando required', () => {
    render(<FormInput label="Nome" name="nome" id="nome" value="" onChange={vi.fn()} required />)

    expect(screen.getByText(/Nome \*/)).toBeInTheDocument()
  })

  it('renderiza textarea quando as="textarea"', () => {
    render(
      <FormInput
        as="textarea"
        label="Notas"
        name="notas"
        id="notas"
        value="conteudo"
        onChange={vi.fn()}
        rows={4}
      />
    )

    const textarea = screen.getByLabelText('Notas')
    expect(textarea.tagName).toBe('TEXTAREA')
    expect(textarea).toHaveValue('conteudo')
  })

  it('respeita disabled', () => {
    render(<FormInput label="X" name="x" id="x" value="" onChange={vi.fn()} disabled />)
    expect(screen.getByLabelText('X')).toBeDisabled()
  })

  it('aplica containerClassName customizado', () => {
    const { container } = render(
      <FormInput
        label="X"
        name="x"
        id="x"
        value=""
        onChange={vi.fn()}
        containerClassName="col-md-6 mb-3"
      />
    )
    expect(container.firstChild).toHaveClass('col-md-6', 'mb-3')
  })
})
