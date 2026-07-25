import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import LoginPage from './LoginPage.jsx'
import { login as loginRequest } from '../../api/auth'

const { navigateMock, toastMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  toastMock: {
    dismiss: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('react-toastify', () => ({
  toast: toastMock,
}))

vi.mock('../../api/auth', () => ({
  login: vi.fn(),
}))

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renderiza campos e botao de login', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    )

    expect(screen.getByLabelText(/usuário ou email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument()
  })

  it('valida campos obrigatorios antes de enviar', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    )

    const form = screen.getByRole('button', { name: /entrar/i }).closest('form')
    fireEvent.submit(form)

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalled()
    })
    expect(loginRequest).not.toHaveBeenCalled()
  })

  it('faz submit com sucesso e redireciona', async () => {
    loginRequest.mockResolvedValueOnce({ access_token: 'token-123', user: { id: 1 } })

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    )

    fireEvent.change(screen.getByLabelText(/usuário ou email/i), { target: { value: 'admin' } })
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }))

    await waitFor(() => {
      expect(loginRequest).toHaveBeenCalledTimes(1)
      expect(toastMock.success).toHaveBeenCalled()
      expect(navigateMock).toHaveBeenCalledWith('/dashboard')
    })

    expect(localStorage.getItem('token')).toBe('token-123')
    expect(localStorage.getItem('access_token')).toBe('token-123')
  })

  it('exibe erro em resposta 4xx/5xx', async () => {
    loginRequest.mockRejectedValueOnce(new Error('Credenciais invalidas'))

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    )

    fireEvent.change(screen.getByLabelText(/usuário ou email/i), { target: { value: 'admin' } })
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'errado' } })
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }))

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalled()
    })
  })
})
