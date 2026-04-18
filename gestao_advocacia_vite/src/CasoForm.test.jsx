import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { toast } from 'react-toastify'
import userEvent from '@testing-library/user-event'
import CasoForm from './CasoForm'

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), dismiss: vi.fn() },
  ToastContainer: () => null,
}))

vi.mock('./config.js', () => ({ API_URL: 'http://localhost:5000/api' }))

vi.mock('./utils/cnj.js', () => ({
  parseCNJ: vi.fn(() => null),
  formatCNJ: vi.fn((v) => v),
}))

const mockClientes = [
  { id: 1, nome_razao_social: 'Acme Corp' },
  { id: 2, nome_razao_social: 'João Silva' },
]

function renderCasoForm(props = {}) {
  return render(<CasoForm onCasoChange={vi.fn()} onCancel={vi.fn()} {...props} />)
}

describe('CasoForm — novo caso', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'fake-token')
    // Mock para o fetch de clientes no mount
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockClientes,
    })
  })

  it('renderiza campos obrigatórios', async () => {
    renderCasoForm()
    await waitFor(() => {
      expect(screen.getByLabelText(/título do caso/i)).toBeInTheDocument()
    })
    expect(screen.getByRole('combobox', { name: /cliente/i })).toBeInTheDocument()
  })

  it('lista clientes no select após carregamento', async () => {
    renderCasoForm()
    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument()
      expect(screen.getByText('João Silva')).toBeInTheDocument()
    })
  })

  it('exibe erro de validação quando título está vazio ao submeter', async () => {
    const { container } = renderCasoForm()
    await waitFor(() => screen.getByLabelText(/título do caso/i))

    fireEvent.submit(container.querySelector('form'))
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
      expect(screen.getByText(/título do caso é obrigatório/i)).toBeInTheDocument()
    })
  })

  it('exibe erro de validação quando cliente não está selecionado', async () => {
    const { container } = renderCasoForm()
    await waitFor(() => screen.getByLabelText(/título do caso/i))

    await userEvent.type(screen.getByLabelText(/título do caso/i), 'Ação de Cobrança')

    fireEvent.submit(container.querySelector('form'))
    await waitFor(() => {
      expect(screen.getByText(/cliente é obrigatório/i)).toBeInTheDocument()
    })
  })

  it('submete com sucesso e chama onCasoChange', async () => {
    globalThis.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockClientes,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 10, titulo: 'Ação de Cobrança' }),
      })

    const onCasoChange = vi.fn()
    const { container } = render(<CasoForm onCasoChange={onCasoChange} onCancel={vi.fn()} />)

    await waitFor(() => screen.getByLabelText(/título do caso/i))
    await userEvent.type(screen.getByLabelText(/título do caso/i), 'Ação de Cobrança')

    // Selecionar cliente
    const clienteSelect = screen.getByRole('combobox', { name: /cliente/i })
    await userEvent.selectOptions(clienteSelect, ['1'])

    fireEvent.submit(container.querySelector('form'))

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/adicionado com sucesso/i))
      expect(onCasoChange).toHaveBeenCalled()
    })
  })
})

describe('CasoForm — edição de caso existente', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'fake-token')
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockClientes,
    })
  })

  it('preenche o formulário com os dados do caso a editar', async () => {
    const casoParaEditar = {
      id: 5,
      titulo: 'Caso Existente',
      cliente_id: 2,
      status: 'Ativo',
      parte_contraria: 'Empresa X',
    }
    renderCasoForm({ casoParaEditar })
    await waitFor(() => {
      expect(screen.getByDisplayValue('Caso Existente')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Empresa X')).toBeInTheDocument()
    })
  })
})
