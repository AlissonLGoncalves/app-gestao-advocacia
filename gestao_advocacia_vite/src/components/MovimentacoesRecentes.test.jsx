/**
 * Tests for MovimentacoesRecentes component (padrao DJEN)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router'
import MovimentacoesRecentes from './MovimentacoesRecentes'

const mockNavigate = vi.fn()

// Mock fetch
globalThis.fetch = vi.fn()

// Mock api/djen baixarCertidao para evitar import real
vi.mock('../api/djen.js', () => ({
  baixarCertidao: vi.fn(() => Promise.resolve(new Blob(['fake-pdf'], { type: 'application/pdf' }))),
}))

// Mock localStorage
const localStorageMock = (() => {
  let store = {}
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString()
    },
    clear: () => {
      store = {}
    },
  }
})()
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Mock react-router
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const mockData = {
  dias: 7,
  grupos: [
    {
      data: '2026-04-18',
      rotulo: 'Hoje',
      publicacoes: [
        {
          id: 1,
          cliente_nome: 'Dirce de Oliveira Pedotti',
          cliente_id: 45,
          caso_id: 67,
          numero_processo: '0000472-75.2025.8.16.0075',
          numero_processo_mascara: '0000472-75.2025.8.16.0075',
          tribunal: 'TJPR',
          sigla_tribunal: 'TJPR',
          orgao: '2a Vara Civel de Cornelio Procopio',
          nome_orgao: '2a Vara Civel de Cornelio Procopio',
          tipo_comunicacao: 'Intimacao',
          data_disponibilizacao: '2026-04-18',
          hash_comunicacao: 'abc123',
          lida: false,
        },
      ],
    },
    {
      data: '2026-04-17',
      rotulo: 'Ontem',
      publicacoes: [
        {
          id: 2,
          cliente_nome: 'João da Silva',
          cliente_id: 46,
          caso_id: 68,
          numero_processo: '0000473-75.2025.8.16.0075',
          numero_processo_mascara: '0000473-75.2025.8.16.0075',
          tribunal: 'TJSP',
          sigla_tribunal: 'TJSP',
          orgao: '1a Vara de São Paulo',
          nome_orgao: '1a Vara de São Paulo',
          tipo_comunicacao: 'Decisão',
          data_disponibilizacao: '2026-04-17',
          hash_comunicacao: '',
          lida: true,
        },
      ],
    },
  ],
}

describe('MovimentacoesRecentes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockReset()
    localStorage.clear()
    localStorage.setItem('auth_token', 'test-token')
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => mockData,
    })
  })

  it('renders component with header', async () => {
    render(
      <BrowserRouter>
        <MovimentacoesRecentes />
      </BrowserRouter>
    )

    expect(screen.getByText('Movimentações recentes')).toBeInTheDocument()
    expect(screen.getByText('Publicações DJEN dos últimos dias')).toBeInTheDocument()
  })

  it('loads publications on mount with default 7 days', async () => {
    render(
      <BrowserRouter>
        <MovimentacoesRecentes />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/dashboard/publicacoes-recentes?dias=7'),
        expect.any(Object)
      )
    })
  })

  it('displays period selector buttons', async () => {
    render(
      <BrowserRouter>
        <MovimentacoesRecentes />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '7d' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '15d' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '30d' })).toBeInTheDocument()
    })
  })

  it('changes period when button clicked', async () => {
    render(
      <BrowserRouter>
        <MovimentacoesRecentes />
      </BrowserRouter>
    )

    const btn15d = await screen.findByRole('button', { name: '15d' })
    fireEvent.click(btn15d)

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('dias=15'),
        expect.any(Object)
      )
    })
  })

  it('displays grouped publications with date labels', async () => {
    render(
      <BrowserRouter>
        <MovimentacoesRecentes />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Hoje')).toBeInTheDocument()
      expect(screen.getByText('Ontem')).toBeInTheDocument()
    })
  })

  it('displays sigla_tribunal and tipo_comunicacao as badges', async () => {
    render(
      <BrowserRouter>
        <MovimentacoesRecentes />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('TJPR')).toBeInTheDocument()
      expect(screen.getByText('TJSP')).toBeInTheDocument()
      expect(screen.getByText('Intimacao')).toBeInTheDocument()
      expect(screen.getByText('Decisão')).toBeInTheDocument()
    })
  })

  it('displays nome_orgao and process number', async () => {
    render(
      <BrowserRouter>
        <MovimentacoesRecentes />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/2a Vara Civel de Cornelio Procopio/)).toBeInTheDocument()
      expect(screen.getByText('0000472-75.2025.8.16.0075')).toBeInTheDocument()
    })
  })

  it('shows "Nova" badge for unread publications', async () => {
    render(
      <BrowserRouter>
        <MovimentacoesRecentes />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Nova')).toBeInTheDocument()
    })
  })

  it('shows empty state when no publications', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        dias: 7,
        grupos: [],
      }),
    })

    render(
      <BrowserRouter>
        <MovimentacoesRecentes />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Nenhuma publicação nos últimos 7 dias/)).toBeInTheDocument()
    })
  })

  it('displays error message on fetch failure', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: false,
    })

    render(
      <BrowserRouter>
        <MovimentacoesRecentes />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Erro:/)).toBeInTheDocument()
    })
  })

  it('applies custom className', () => {
    const { container } = render(
      <BrowserRouter>
        <MovimentacoesRecentes className="custom-class" />
      </BrowserRouter>
    )

    const cardElement = container.querySelector('.card')
    expect(cardElement).toHaveClass('custom-class')
  })

  it('navigates to /djen?publicacao=ID when clicking the publication card', async () => {
    render(
      <BrowserRouter>
        <MovimentacoesRecentes />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Dirce de Oliveira Pedotti')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('0000472-75.2025.8.16.0075'))

    expect(mockNavigate).toHaveBeenCalledWith('/djen?publicacao=1')
  })
})
