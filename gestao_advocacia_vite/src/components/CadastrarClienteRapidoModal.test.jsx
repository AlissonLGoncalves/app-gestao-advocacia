import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('../api/clientes.js', () => ({
  createCliente: vi.fn(),
}))

import { createCliente } from '../api/clientes.js'
import CadastrarClienteRapidoModal from './CadastrarClienteRapidoModal.jsx'

describe('CadastrarClienteRapidoModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('nao renderiza nada quando open=false', () => {
    const { container } = render(
      <CadastrarClienteRapidoModal open={false} onClose={() => {}} onCreated={() => {}} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('pre-preenche nome quando nomeInicial passado', () => {
    render(
      <CadastrarClienteRapidoModal
        open
        nomeInicial="Joao da Silva"
        onClose={() => {}}
        onCreated={() => {}}
      />
    )
    expect(screen.getByLabelText(/Nome.*Razao Social/i).value).toBe('Joao da Silva')
  })

  it('valida nome obrigatorio', async () => {
    const onCreated = vi.fn()
    render(<CadastrarClienteRapidoModal open onClose={() => {}} onCreated={onCreated} />)

    fireEvent.click(screen.getByRole('button', { name: /Cadastrar e usar/i }))
    expect(await screen.findByText(/Nome obrigatorio/i)).toBeInTheDocument()
    expect(createCliente).not.toHaveBeenCalled()
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('chama createCliente com PF e devolve cliente via onCreated', async () => {
    const onCreated = vi.fn()
    const onClose = vi.fn()
    createCliente.mockResolvedValue({ id: 99, nome_razao_social: 'Joao da Silva' })

    render(
      <CadastrarClienteRapidoModal
        open
        nomeInicial="Joao da Silva"
        onClose={onClose}
        onCreated={onCreated}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Cadastrar e usar/i }))

    await waitFor(() => expect(createCliente).toHaveBeenCalledTimes(1))
    expect(createCliente).toHaveBeenCalledWith({
      nome_razao_social: 'Joao da Silva',
      tipo_pessoa: 'PF',
      cpf_cnpj: null,
      email: null,
    })
    expect(onCreated).toHaveBeenCalledWith({ id: 99, nome_razao_social: 'Joao da Silva' })
    expect(onClose).toHaveBeenCalled()
  })

  it('valida email mal-formado', async () => {
    render(
      <CadastrarClienteRapidoModal
        open
        nomeInicial="Maria"
        onClose={() => {}}
        onCreated={() => {}}
      />
    )
    fireEvent.change(screen.getByLabelText(/E-mail/i), { target: { value: 'nao-e-email' } })
    fireEvent.click(screen.getByRole('button', { name: /Cadastrar e usar/i }))
    expect(await screen.findByText(/E-mail invalido/i)).toBeInTheDocument()
    expect(createCliente).not.toHaveBeenCalled()
  })

  it('alterna PF/PJ no select de tipo', () => {
    render(<CadastrarClienteRapidoModal open onClose={() => {}} onCreated={() => {}} />)
    const select = screen.getByLabelText(/Tipo/i)
    expect(select.value).toBe('PF')
    fireEvent.change(select, { target: { value: 'PJ' } })
    expect(select.value).toBe('PJ')
  })
})
