import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ClienteForm from './ClienteForm.jsx'
import { createCliente, extrairDadosDocumentoCliente } from '../api/clientes.js'

const { toastMock } = vi.hoisted(() => ({
  toastMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock('react-toastify', () => ({
  toast: toastMock,
}))

vi.mock('./DocumentosClienteTab.jsx', () => ({
  default: () => <div data-testid="documentos-cliente-tab" />,
}))

vi.mock('../api/clientes.js', () => ({
  createCliente: vi.fn(),
  updateCliente: vi.fn(),
  extrairDadosDocumentoCliente: vi.fn(),
  anonimizarCliente: vi.fn(),
}))

describe('ClienteForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => ({}) }))
    createCliente.mockResolvedValue({ id: 10 })
    extrairDadosDocumentoCliente.mockResolvedValue({})
    localStorage.setItem('token', 'token-teste')
  })

  it('renderiza campos principais do formulario', async () => {
    render(<ClienteForm onClienteChange={vi.fn()} />)

    expect(await screen.findByLabelText(/tipo pessoa/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/nome completo/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^cpf \*/i)).toBeInTheDocument()
  })

  it('valida obrigatorios e nao envia sem dados minimos', async () => {
    render(<ClienteForm onClienteChange={vi.fn()} />)

    fireEvent.change(await screen.findByLabelText(/nome completo/i), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText(/^cpf \*/i), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /adicionar cliente/i }))

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalled()
    })

    expect(createCliente).not.toHaveBeenCalled()
  })

  it('envia com sucesso quando formulario e valido', async () => {
    const onClienteChange = vi.fn()
    render(<ClienteForm onClienteChange={onClienteChange} />)

    fireEvent.change(await screen.findByLabelText(/nome completo/i), {
      target: { value: 'Maria da Silva' },
    })
    fireEvent.change(screen.getByLabelText(/^cpf \*/i), { target: { value: '12345678901' } })
    fireEvent.click(screen.getByRole('button', { name: /adicionar cliente/i }))

    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalled()
      expect(onClienteChange).toHaveBeenCalled()
    })
  })

  it('exibe erro quando API retorna falha', async () => {
    createCliente.mockRejectedValue(new Error('falha interna'))

    render(<ClienteForm onClienteChange={vi.fn()} />)

    fireEvent.change(await screen.findByLabelText(/nome completo/i), {
      target: { value: 'Maria da Silva' },
    })
    fireEvent.change(screen.getByLabelText(/^cpf \*/i), { target: { value: '12345678901' } })
    fireEvent.click(screen.getByRole('button', { name: /adicionar cliente/i }))

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalled()
    })
  })

  it.skip('seleciona PJ automaticamente e preenche CNPJ quando OCR retorna CNPJ', async () => {
    extrairDadosDocumentoCliente.mockResolvedValue({
      cnpj: '12.345.678/0001-90',
      documento_principal: '12.345.678/0001-90',
      tipo_pessoa_sugerida: 'PJ',
      nome_razao_social: 'Empresa XPTO LTDA',
    })

    const { container } = render(<ClienteForm onClienteChange={vi.fn()} />)

    const inputFile = container.querySelector('#documento_ocr')
    const arquivo = new File(['conteudo'], 'empresa.txt', { type: 'text/plain' })
    fireEvent.change(inputFile, { target: { files: [arquivo] } })

    await waitFor(() => {
      const tipoPessoa = screen.getByLabelText(/tipo pessoa/i)
      expect(tipoPessoa.value).toBe('PJ')
    })

    const campoCnpj = screen.getByLabelText(/cnpj principal \*/i)
    expect(campoCnpj.value).toBe('12.345.678/0001-90')
    expect(screen.getByLabelText(/razao social \*/i).value).toBe('Empresa XPTO LTDA')
  })

  it('aplica mascara de CPF ao carregar cliente em edicao', async () => {
    render(
      <ClienteForm
        clienteParaEditar={{
          id: 123,
          tipo_pessoa: 'PF',
          nome_razao_social: 'Adriano Basso Marson',
          cpf_cnpj: '05199800930',
        }}
        onClienteChange={vi.fn()}
      />
    )

    expect(await screen.findByLabelText(/^cpf \*/i)).toHaveValue('051.998.009-30')
  })

  it('libera edicao de CPF ao clicar no botao Alterar CPF', async () => {
    render(
      <ClienteForm
        clienteParaEditar={{
          id: 123,
          tipo_pessoa: 'PF',
          nome_razao_social: 'Adriano Basso Marson',
          cpf_cnpj: '05199800930',
        }}
        onClienteChange={vi.fn()}
      />
    )

    const campoCpf = await screen.findByLabelText(/^cpf \*/i)
    expect(campoCpf).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /alterar cpf/i }))

    expect(campoCpf).not.toBeDisabled()
    fireEvent.change(campoCpf, { target: { value: '12345678901' } })
    expect(campoCpf).toHaveValue('123.456.789-01')
  })
})
