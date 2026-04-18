import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ClienteForm from './ClienteForm.jsx'

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

vi.mock('./components/DocumentosClienteTab.jsx', () => ({
  default: () => <div data-testid="documentos-cliente-tab" />,
}))

describe('ClienteForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.fetch = vi.fn((url) => {
      if (String(url).includes('/clientes/?sort_by=')) {
        return Promise.resolve({ ok: true, json: async () => [] })
      }
      return Promise.resolve({ ok: true, json: async () => ({ id: 10 }) })
    })
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

    const calls = globalThis.fetch.mock.calls.filter(
      ([url]) => !String(url).includes('/clientes/?sort_by=')
    )
    expect(calls.length).toBe(0)
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
    globalThis.fetch = vi.fn((url) => {
      if (String(url).includes('/clientes/?sort_by=')) {
        return Promise.resolve({ ok: true, json: async () => [] })
      }
      return Promise.resolve({
        ok: false,
        status: 500,
        json: async () => ({ erro: 'falha interna' }),
      })
    })

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

  it('seleciona PJ automaticamente e preenche CNPJ quando OCR retorna CNPJ', async () => {
    globalThis.fetch = vi.fn((url) => {
      if (String(url).includes('/clientes/extrair-dados-doc')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            cnpj: '12.345.678/0001-90',
            documento_principal: '12.345.678/0001-90',
            tipo_pessoa_sugerida: 'PJ',
            nome_razao_social: 'Empresa XPTO LTDA',
          }),
        })
      }
      if (String(url).includes('/clientes/?sort_by=')) {
        return Promise.resolve({ ok: true, json: async () => [] })
      }
      return Promise.resolve({ ok: true, json: async () => ({ id: 10 }) })
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
})
