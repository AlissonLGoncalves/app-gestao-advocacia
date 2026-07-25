import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
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
// Stub do ItemAgendaForm: expoe o casoFixo recebido pra validar que o prazo
// nasce travado no caso, sem depender da implementacao interna do form.
vi.mock('../components/ItemAgendaForm.jsx', () => ({
  default: ({ casoFixo, itemParaEditar, defaultTipo }) => (
    <div data-testid="item-agenda-form">
      <span data-testid="form-caso-label">{casoFixo?.label}</span>
      <span data-testid="form-modo">{itemParaEditar ? 'editar' : 'novo'}</span>
      <span data-testid="form-tipo">{defaultTipo}</span>
    </div>
  ),
}))
vi.mock('../components/RecebimentosCasoCard.jsx', () => ({
  default: () => <div data-testid="recebimentos-caso-card" />,
}))
vi.mock('../components/ContratoFormModal.jsx', () => ({
  default: () => <div data-testid="contrato-form-modal" />,
}))
vi.mock('../api/itensAgenda.js', () => ({
  listItensAgenda: vi.fn().mockResolvedValue([]),
  concluirItemAgenda: vi.fn(),
  deleteItemAgenda: vi.fn(),
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

    // Fase 3: honorários saíram do Resumo (têm aba Financeiro própria)
    expect(screen.getByTestId('painel-resumo')).toBeInTheDocument()
    expect(screen.queryByTestId('honorarios-card')).not.toBeInTheDocument()
    expect(screen.getByTestId('tab-financeiro')).toBeInTheDocument()
    expect(screen.queryByTestId('painel-historico')).not.toBeInTheDocument()
    expect(screen.queryByTestId('timeline')).not.toBeInTheDocument()
  })

  it('Fase 3: aba Financeiro mostra honorários + recebimentos do caso', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByTestId('caso-tabs')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('tab-financeiro'))
    expect(await screen.findByTestId('conteudo-financeiro')).toBeInTheDocument()
    expect(screen.getByTestId('honorarios-card')).toBeInTheDocument()
    expect(screen.getByTestId('recebimentos-caso-card')).toBeInTheDocument()
  })

  it('Fase 3: "+ Novo" abre prazo/audiência com caso travado e link Agenda do caso', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByTestId('btn-mais-caso')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('mais-audiencia'))
    // ItemAgendaForm (stub) abre com defaultTipo evento
    expect(await screen.findByTestId('item-agenda-form')).toHaveTextContent('evento')
    // link da agenda filtrada
    expect(screen.getByRole('link', { name: /Agenda do caso/i })).toHaveAttribute(
      'href',
      expect.stringContaining('/agenda?caso=')
    )
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

  // Prazo dentro do caso (sem ir ao Kanban global)
  it('"Novo Prazo" na aba Atividades abre o form com o caso travado', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByTestId('caso-tabs')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('tab-atividades'))
    expect(screen.getByTestId('painel-atividades')).toBeInTheDocument()
    // form fechado inicialmente
    expect(screen.queryByTestId('item-agenda-form')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('btn-novo-prazo-caso'))

    // form abre, em modo "novo", com o caso pre-fixado (label = numero do processo)
    const form = await screen.findByTestId('item-agenda-form')
    expect(form).toBeInTheDocument()
    expect(screen.getByTestId('form-modo')).toHaveTextContent('novo')
    expect(screen.getByTestId('form-caso-label')).toHaveTextContent('0001234-56.2026.8.16.0075')
  })
})
