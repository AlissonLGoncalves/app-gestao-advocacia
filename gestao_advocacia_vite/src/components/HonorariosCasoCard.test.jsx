import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import HonorariosCasoCard from './HonorariosCasoCard.jsx'

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

describe('HonorariosCasoCard (ContratoForm equivalente)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'token-teste')
    globalThis.fetch = vi.fn((url, options) => {
      if (String(url).includes('/contratos/') && !options?.method) {
        return Promise.resolve({ ok: true, json: async () => [] })
      }
      if (String(url).includes('/contratos/') && options?.method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({ id: 1 }) })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })
  })

  it('renderiza card e permite abrir formulario de contrato', async () => {
    render(<HonorariosCasoCard casoId={1} clienteId={2} />)

    expect(await screen.findByRole('heading', { name: /gest/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /novo contrato/i }))
    expect(screen.getByText(/cadastrar novo contrato/i)).toBeInTheDocument()
  })

  it('submit com sucesso cria contrato', async () => {
    render(<HonorariosCasoCard casoId={1} clienteId={2} />)

    fireEvent.click(await screen.findByRole('button', { name: /novo contrato/i }))
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '1500' } })
    fireEvent.click(screen.getByRole('button', { name: /salvar contrato/i }))

    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalled()
    })
  })

  it('submit com erro 4xx/5xx exibe toast de erro', async () => {
    globalThis.fetch = vi.fn((url, options) => {
      if (String(url).includes('/contratos/') && !options?.method) {
        return Promise.resolve({ ok: true, json: async () => [] })
      }
      if (String(url).includes('/contratos/') && options?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ message: 'erro no contrato' }),
        })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    render(<HonorariosCasoCard casoId={1} clienteId={2} />)

    fireEvent.click(await screen.findByRole('button', { name: /novo contrato/i }))
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '1500' } })
    fireEvent.click(screen.getByRole('button', { name: /salvar contrato/i }))

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalled()
    })
  })

  it('valida gerar parcelas sem campos obrigatorios', async () => {
    globalThis.fetch = vi.fn((url, options) => {
      if (String(url).includes('/contratos/') && !options?.method) {
        return Promise.resolve({
          ok: true,
          json: async () => [{ id: 7, caso_id: 1, tipo_honorario: 'Fixo', valor_total: '1000' }],
        })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    render(<HonorariosCasoCard casoId={1} clienteId={2} />)

    await screen.findByText(/contrato #7/i)
    fireEvent.click(screen.getByRole('button', { name: /gerar parcelas/i }))
    fireEvent.click(screen.getByRole('button', { name: /criar títulos agora/i }))

    await waitFor(() => {
      expect(toastMock.warn).toHaveBeenCalled()
    })
  })
})
