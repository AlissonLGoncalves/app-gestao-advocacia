import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { toast } from 'react-toastify'
import userEvent from '@testing-library/user-event'
import ClienteForm from './ClienteForm'

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), dismiss: vi.fn() },
  ToastContainer: () => null,
}))

vi.mock('./config.js', () => ({ API_URL: 'http://localhost:5000/api' }))

vi.mock('./components/DocumentosClienteTab.jsx', () => ({
  default: () => <div data-testid="docs-tab" />,
}))

function renderClienteForm(props = {}) {
  return render(<ClienteForm onClienteChange={vi.fn()} onCancel={vi.fn()} {...props} />)
}

describe('ClienteForm — novo cliente PF', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'fake-token')
    globalThis.fetch = vi.fn()
  })

  it('renderiza campos obrigatórios de pessoa física', () => {
    renderClienteForm()
    expect(screen.getByLabelText(/nome completo/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^cpf \*/i)).toBeInTheDocument()
  })

  it('exibe erro de validação quando nome está vazio ao submeter', async () => {
    const { container } = renderClienteForm()
    fireEvent.submit(container.querySelector('form'))
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/corrija os erros/i))
      expect(screen.getByText(/nome \/ razão social é obrigatório/i)).toBeInTheDocument()
    })
  })

  it('exibe erro de validação quando CPF tem dígitos inválidos', async () => {
    const { container } = renderClienteForm()
    await userEvent.type(screen.getByLabelText(/nome completo/i), 'João da Silva')
    // CPF com 10 dígitos (inválido)
    await userEvent.type(screen.getByLabelText(/^cpf \*/i), '1234567890')
    fireEvent.submit(container.querySelector('form'))
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
      expect(screen.getByText(/cpf principal deve conter 11 dígitos/i)).toBeInTheDocument()
    })
  })

  it('submete o formulário com sucesso e chama onClienteChange', async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 1, nome_razao_social: 'João da Silva' }),
    })

    const onClienteChange = vi.fn()
    const { container } = render(<ClienteForm onClienteChange={onClienteChange} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText(/nome completo/i), 'João da Silva')
    await userEvent.type(screen.getByLabelText(/^cpf \*/i), '12345678901')
    fireEvent.submit(container.querySelector('form'))

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/adicionado com sucesso/i))
      expect(onClienteChange).toHaveBeenCalled()
    })
  })
})

describe('ClienteForm — edição de cliente existente', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'fake-token')
    globalThis.fetch = vi.fn()
  })

  it('preenche o formulário com os dados do cliente a editar', () => {
    const clienteParaEditar = {
      id: 42,
      tipo_pessoa: 'PF',
      nome_razao_social: 'Maria Souza',
      cpf_cnpj: '98765432100',
      email: 'maria@example.com',
    }
    renderClienteForm({ clienteParaEditar })
    expect(screen.getByDisplayValue('Maria Souza')).toBeInTheDocument()
    expect(screen.getByDisplayValue('maria@example.com')).toBeInTheDocument()
  })

  it('chama PUT ao salvar cliente existente e exibe mensagem de atualização', async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 42, nome_razao_social: 'Maria Souza' }),
    })

    const clienteParaEditar = {
      id: 42,
      tipo_pessoa: 'PF',
      nome_razao_social: 'Maria Souza',
      cpf_cnpj: '98765432100',
    }
    const { container } = renderClienteForm({ clienteParaEditar })
    fireEvent.submit(container.querySelector('form'))

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/clientes/42'),
        expect.objectContaining({ method: 'PUT' })
      )
    })
  })
})
