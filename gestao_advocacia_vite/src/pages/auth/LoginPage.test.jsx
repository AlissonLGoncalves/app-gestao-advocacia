import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import LoginPage from './LoginPage'

// Mocks globais
vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), dismiss: vi.fn() },
  ToastContainer: () => null,
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../config', () => ({ API_URL: 'http://localhost:5000/api' }))
vi.mock('../../version.js', () => ({ APP_VERSION: '1.0.0' }))

function renderLogin() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renderiza os campos de usuário e senha', () => {
    renderLogin()
    expect(screen.getByLabelText(/usuário ou email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument()
  })

  it('exibe erro toast quando campos estão vazios', async () => {
    const { toast } = await import('react-toastify')
    const { container } = renderLogin()
    // Disparar submit diretamente para bypassar validação nativa HTML5 no jsdom
    fireEvent.submit(container.querySelector('form'))
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringMatching(/preencha o nome de usuário/i)
      )
    })
  })

  it('envia credenciais corretas e redireciona para /dashboard', async () => {
    const { toast } = await import('react-toastify')
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({ access_token: 'token123', user: { id: 1, username: 'adv' } }),
    })

    renderLogin()

    await userEvent.type(screen.getByLabelText(/usuário ou email/i), 'adv')
    await userEvent.type(screen.getByLabelText(/senha/i), 'secret')
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }))

    await waitFor(() => {
      expect(localStorage.getItem('token')).toBe('token123')
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
      expect(toast.success).toHaveBeenCalled()
    })
  })

  it('exibe mensagem de erro quando credenciais são inválidas', async () => {
    const { toast } = await import('react-toastify')
    globalThis.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ message: 'Credenciais inválidas.' }),
    })

    renderLogin()
    await userEvent.type(screen.getByLabelText(/usuário ou email/i), 'adv')
    await userEvent.type(screen.getByLabelText(/senha/i), 'errada')
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/credenciais/i))
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })
})
