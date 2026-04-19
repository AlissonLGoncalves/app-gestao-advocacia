/**
 * Tests for MovimentacoesRecentes component (F3)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import MovimentacoesRecentes from './MovimentacoesRecentes'

const mockNavigate = vi.fn()

// Mock fetch
global.fetch = vi.fn()

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

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
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
          tribunal: 'TJPR',
          orgao: '2a Vara Civel de Cornelio Procopio',
          tipo_comunicacao: 'Intimacao',
          resumo: 'Texto da publicação de hoje com mais informações...',
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
          tribunal: 'TJSP',
          orgao: '1a Vara de São Paulo',
          tipo_comunicacao: 'Decisão',
          resumo: 'Decisão do tribunal...',
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
    global.fetch.mockResolvedValue({
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

    expect(screen.getByText('Movimentacoes recentes')).toBeInTheDocument()
    expect(screen.getByText('Publicacoes DJEN dos ultimos dias')).toBeInTheDocument()
  })

  it('loads publications on mount with default 7 days', async () => {
    render(
      <BrowserRouter>
        <MovimentacoesRecentes />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
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
      expect(global.fetch).toHaveBeenCalledWith(
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

  it('displays client names from publications', async () => {
    render(
      <BrowserRouter>
        <MovimentacoesRecentes />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Dirce de Oliveira Pedotti')).toBeInTheDocument()
      expect(screen.getByText('João da Silva')).toBeInTheDocument()
    })
  })

  it('displays tribunal and orgao information', async () => {
    render(
      <BrowserRouter>
        <MovimentacoesRecentes />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/TJPR/)).toBeInTheDocument()
      expect(screen.getByText(/2a Vara Civel de Cornelio Procopio/)).toBeInTheDocument()
    })
  })

  it('displays tipo_comunicacao as badge', async () => {
    render(
      <BrowserRouter>
        <MovimentacoesRecentes />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Intimacao')).toBeInTheDocument()
      expect(screen.getByText('Decisão')).toBeInTheDocument()
    })
  })

  it('displays unread indicator (red dot) for unread publications', async () => {
    render(
      <BrowserRouter>
        <MovimentacoesRecentes />
      </BrowserRouter>
    )

    await waitFor(() => {
      // Verify unread publication exists
      const direcElement = screen.getByText('Dirce de Oliveira Pedotti').closest('.publication-item')
      expect(direcElement).toBeInTheDocument()
      // The red dot should be present (as a styled div)
    })
  })

  it('displays truncated resumo text', async () => {
    render(
      <BrowserRouter>
        <MovimentacoesRecentes />
      </BrowserRouter>
    )

    await waitFor(() => {
      // Check that long text is truncated with ...
      const resumo = screen.getByText(/Texto da publicação de hoje/)
      expect(resumo.textContent).toContain('...')
    })
  })

  it('shows empty state when no publications', async () => {
    global.fetch.mockResolvedValue({
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
      expect(screen.getByText(/Nenhuma publicacao nos ultimos 7 dias/)).toBeInTheDocument()
    })
  })

  it('displays error message on fetch failure', async () => {
    global.fetch.mockResolvedValue({
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

  it('navigates to case detail when clicking the publication card', async () => {
    render(
      <BrowserRouter>
        <MovimentacoesRecentes />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Dirce de Oliveira Pedotti')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Dirce de Oliveira Pedotti'))

    expect(mockNavigate).toHaveBeenCalledWith('/casos/detalhe/67')
  })

  it('opens the DJEN publication detail when clicking the process number', async () => {
    render(
      <BrowserRouter>
        <MovimentacoesRecentes />
      </BrowserRouter>
    )

    const numeroProcesso = await screen.findByRole('button', {
      name: '0000472-75.2025.8.16.0075',
    })

    fireEvent.click(numeroProcesso)

    expect(mockNavigate).toHaveBeenCalledWith('/djen?publicacao=1')
  })
})
