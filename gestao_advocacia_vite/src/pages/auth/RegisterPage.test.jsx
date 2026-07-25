import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import RegisterPage from './RegisterPage'
import { register as registerRequest } from '../../api/auth'

vi.mock('../../api/auth', () => ({
  register: vi.fn(),
  registerInvite: vi.fn(),
}))
vi.mock('../../legal/termos-v1.0.md?raw', () => ({
  default: '---\nversao: v1.0\n---\n\n# Mock Termos\nConteudo mock dos termos.',
}))
vi.mock('../../legal/lgpd-v1.0.md?raw', () => ({
  default: '---\nversao: v1.0\n---\n\n# Mock LGPD\nConteudo mock da LGPD.',
}))

// Mock fetch globalmente (para /auth/termos-vigentes e BrasilAPI)
const fetchMock = vi.fn()
globalThis.fetch = fetchMock

// Mock react-toastify
vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), dismiss: vi.fn() },
}))

function renderPage(initialEntries = ['/register']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <RegisterPage />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  fetchMock.mockImplementation(async (url) => {
    if (String(url).includes('/auth/termos-vigentes')) {
      return {
        ok: true,
        json: async () => ({
          termos: {
            versao: 'v1.0',
            hash: 'hash-termos',
            conteudo: '---\nversao: v1.0\n---\n\n# Termos Via API\nTexto termos.',
          },
          lgpd: {
            versao: 'v1.0',
            hash: 'hash-lgpd',
            conteudo: '---\nversao: v1.0\n---\n\n# LGPD Via API\nTexto lgpd.',
          },
        }),
      }
    }

    return {
      ok: true,
      json: async () => ({ message: 'ok' }),
    }
  })
})

describe('RegisterPage — aceite LGPD', () => {
  it('botão de submit fica desabilitado enquanto os dois checkboxes não estão marcados', () => {
    renderPage()
    const submitBtn = screen.getByRole('button', { name: /criar conta/i })
    // Ambos desmarcados → desabilitado
    expect(submitBtn).toBeDisabled()

    // Marca apenas termos
    const checkboxTermos = screen.getByLabelText(/termos/i)
    fireEvent.click(checkboxTermos)
    expect(submitBtn).toBeDisabled()

    // Marca também LGPD
    const checkboxLgpd = screen.getByLabelText(/lgpd|privacidade/i)
    fireEvent.click(checkboxLgpd)
    expect(submitBtn).not.toBeDisabled()
  })

  it('ao submeter com aceites, o body enviado contém aceite_termos, aceite_lgpd, versao_termos e versao_lgpd', async () => {
    registerRequest.mockResolvedValueOnce({ message: 'ok' })

    const { container } = renderPage()

    // Preenche campos obrigatórios
    fireEvent.change(screen.getByPlaceholderText(/000\.000\.000-00/i), {
      target: { value: '123.456.789-09' },
    })
    fireEvent.change(screen.getByPlaceholderText(/dr\. joão silva/i), {
      target: { value: 'João Advogado' },
    })
    const emailInput = container.querySelector('input[type="email"]')
    const senhaInput = container.querySelector('input[type="password"]')
    expect(emailInput).toBeTruthy()
    expect(senhaInput).toBeTruthy()

    fireEvent.change(emailInput, {
      target: { value: 'joao@teste.com' },
    })
    fireEvent.change(senhaInput, {
      target: { value: 'Senha1234!' },
    })

    // Marca checkboxes
    fireEvent.click(screen.getByLabelText(/termos/i))
    fireEvent.click(screen.getByLabelText(/lgpd|privacidade/i))

    fireEvent.submit(screen.getByRole('button', { name: /criar conta/i }).closest('form'))

    await waitFor(() => expect(registerRequest).toHaveBeenCalled())

    const body = registerRequest.mock.calls[0][0]

    expect(body.aceite_termos).toBe(true)
    expect(body.aceite_lgpd).toBe(true)
    expect(body.versao_termos).toBe('v1.0')
    expect(body.versao_lgpd).toBe('v1.0')
  })

  it('carrega markdown no modal de termos', async () => {
    renderPage()

    fireEvent.click(screen.getByText(/termos de serviço/i))

    await waitFor(() => {
      expect(screen.getByText(/termos via api/i)).toBeInTheDocument()
      expect(screen.getByText(/lgpd via api/i)).toBeInTheDocument()
    })
  })
})
