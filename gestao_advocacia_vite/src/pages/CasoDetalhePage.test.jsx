import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CasoDetalhePage from './CasoDetalhePage.jsx'
import { getCaso, listPublicacoesDjenCaso } from '../api/casos.js'

vi.mock('../api/casos.js', () => ({
  atualizarCasoViaDjen: vi.fn(),
  gerarResumoCaso: vi.fn(),
  getCaso: vi.fn(),
  listPublicacoesDjenCaso: vi.fn(),
}))

vi.mock('../components/HonorariosCasoCard', () => ({
  default: () => <div data-testid="honorarios-card">honorarios</div>,
}))
vi.mock('../components/DocumentosCasoTab', () => ({
  default: () => <div data-testid="docs-tab">docs</div>,
}))
vi.mock('../components/DocumentosVinculadosCard', () => ({
  default: () => <div data-testid="docs-vinculados">docs vinc</div>,
}))
vi.mock('../components/ApensarMenuCaso.jsx', () => ({
  default: () => <div data-testid="apensar-menu">apensar</div>,
}))
vi.mock('../components/CasoTimeline', () => ({
  default: () => <div data-testid="timeline">timeline</div>,
}))

const CASO_MOCK = {
  id: 1,
  nome_caso: 'Caso Teste',
  numero_processo: '0001234-56.2026.8.16.0075',
  status: 'Ativo',
  cliente_id: 7,
  nome_cliente: 'Cliente X',
  data_criacao: '2026-01-01T10:00:00',
  data_atualizacao: '2026-05-01T10:00:00',
  data_ultima_verificacao_cnj: '2026-05-08T10:00:00',
  descricao: 'desc',
}

beforeEach(() => {
  vi.clearAllMocks()
  getCaso.mockResolvedValue(CASO_MOCK)
  listPublicacoesDjenCaso.mockResolvedValue([])
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([]),
  })
  localStorage.setItem('token', 'token-teste')
})

function renderPage(initial = '/casos/1') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/casos/:casoId" element={<CasoDetalhePage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('CasoDetalhePage tabs (Epic #6 / #180)', () => {
  it('renderiza as 3 tabs e Resumo como default', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByTestId('caso-tabs')).toBeInTheDocument())
    expect(screen.getByTestId('tab-resumo')).toBeInTheDocument()
    expect(screen.getByTestId('tab-atividades')).toBeInTheDocument()
    expect(screen.getByTestId('tab-historico')).toBeInTheDocument()

    // Default = resumo: mostra honorários e docs vinculados, NÃO mostra timeline
    expect(screen.getByTestId('painel-resumo')).toBeInTheDocument()
    expect(screen.getByTestId('honorarios-card')).toBeInTheDocument()
    expect(screen.queryByTestId('painel-historico')).not.toBeInTheDocument()
    expect(screen.queryByTestId('timeline')).not.toBeInTheDocument()
  })

  it('clicar em "Histórico" troca para o painel correspondente', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByTestId('caso-tabs')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('tab-historico'))

    expect(screen.getByTestId('painel-historico')).toBeInTheDocument()
    expect(screen.getByTestId('timeline')).toBeInTheDocument()
    expect(screen.queryByTestId('painel-resumo')).not.toBeInTheDocument()
  })

  it('clicar em "Atividades" mostra prazos', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByTestId('caso-tabs')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('tab-atividades'))
    expect(screen.getByTestId('painel-atividades')).toBeInTheDocument()
    expect(screen.queryByTestId('painel-resumo')).not.toBeInTheDocument()
  })

  it('lê tab inicial de ?tab= na URL', async () => {
    renderPage('/casos/1?tab=historico')
    await waitFor(() => expect(screen.getByTestId('caso-tabs')).toBeInTheDocument())
    expect(screen.getByTestId('painel-historico')).toBeInTheDocument()
    expect(screen.queryByTestId('painel-resumo')).not.toBeInTheDocument()
  })

  it('tab inválida na URL cai pro default (resumo)', async () => {
    renderPage('/casos/1?tab=qualquer-coisa')
    await waitFor(() => expect(screen.getByTestId('caso-tabs')).toBeInTheDocument())
    expect(screen.getByTestId('painel-resumo')).toBeInTheDocument()
  })

  it('aria-selected reflete tab ativa', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByTestId('caso-tabs')).toBeInTheDocument())
    expect(screen.getByTestId('tab-resumo')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('tab-historico')).toHaveAttribute('aria-selected', 'false')

    fireEvent.click(screen.getByTestId('tab-historico'))
    expect(screen.getByTestId('tab-historico')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('tab-resumo')).toHaveAttribute('aria-selected', 'false')
  })
})
