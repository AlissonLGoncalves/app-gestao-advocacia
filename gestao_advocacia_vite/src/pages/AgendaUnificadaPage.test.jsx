/**
 * Agenda unificada: as 4 visões (Hoje, Calendário, Kanban, Lista) vivem
 * todas em /agenda. Cobre o Kanban embutido (?view=kanban), o calendário
 * com painel do dia (redesign Stitch), a visão Hoje e o estado vazio.
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn(), warning: vi.fn() },
}))

vi.mock('../api/itensAgenda.js', () => ({
  listItensAgenda: vi.fn(),
  createItemAgenda: vi.fn(),
  updateItemAgenda: vi.fn(),
  deleteItemAgenda: vi.fn(),
  reorderItensAgenda: vi.fn(),
  validarPrazoItemAgenda: vi.fn(),
  concluirItemAgenda: vi.fn(),
}))

vi.mock('../api/casos.js', () => ({
  listCasos: vi.fn().mockResolvedValue([]),
}))

// FullCalendar não calcula layout em jsdom (dateClick depende de hit-test).
// Stub com um botão por dia cobre o contrato: clique → onDiaClick(ymd).
vi.mock('../components/CalendarView.jsx', () => ({
  default: ({ eventos, diaSelecionado, onDiaClick }) => (
    <div data-testid="calendar-stub" data-dia={diaSelecionado} data-eventos={eventos.length}>
      <button type="button" onClick={() => onDiaClick('2026-06-10')}>
        dia-10
      </button>
      <button type="button" onClick={() => onDiaClick('2026-06-11')}>
        dia-11
      </button>
    </div>
  ),
}))

import { listItensAgenda, concluirItemAgenda } from '../api/itensAgenda.js'
import AgendaUnificadaPage from './AgendaUnificadaPage.jsx'

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AgendaUnificadaPage />
    </MemoryRouter>
  )

const ITEM = {
  id: 1,
  titulo: 'Contestar ação',
  tipo: 'tarefa',
  categoria: 'Prazo',
  status: 'Pendente',
  prioridade: 'Alta',
  data_vencimento: '2026-06-10',
}

describe('AgendaUnificadaPage — Kanban unificado', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    localStorage.setItem('token', 'tok')
    listItensAgenda.mockResolvedValue([ITEM])
    // PrazosPage embutido busca /casos via fetch direto.
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
  })

  it('?view=kanban renderiza o board (colunas) e o botão "Novo Prazo"', async () => {
    renderAt('/agenda?view=kanban')
    // Colunas do Kanban (vocabulário persistido pelo backend)
    await screen.findByText('A Fazer')
    expect(screen.getByText('Em Andamento')).toBeInTheDocument()
    expect(screen.getByText('Concluído')).toBeInTheDocument()
    // Botão de criação do Kanban (não o "Novo item" do calendário)
    expect(screen.getByRole('button', { name: /Novo Prazo/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Novo item/i })).not.toBeInTheDocument()
  })

  it('?view=kanban esconde os filtros de status (são da Lista)', async () => {
    renderAt('/agenda?view=kanban')
    await screen.findByText('A Fazer')
    expect(screen.queryByLabelText('Filtrar por status')).not.toBeInTheDocument()
  })

  it('o card da tarefa carregada aparece no board e o toggle tem as 4 visões', async () => {
    renderAt('/agenda?view=kanban')
    await waitFor(() => expect(screen.getByText('Contestar ação')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Hoje/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Kanban/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Calendário/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Lista/i })).toBeInTheDocument()
  })
})

describe('AgendaUnificadaPage — Calendário + painel do dia', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    localStorage.setItem('token', 'tok')
    listItensAgenda.mockResolvedValue([ITEM])
  })

  it('cabeçalho, cabeçalho do mês, calendário e painel; clique no dia seleciona no painel', async () => {
    renderAt('/agenda?view=calendario')
    expect(screen.getByRole('heading', { name: 'Agenda', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Prazos, audiências e tarefas')).toBeInTheDocument()
    await screen.findByTestId('calendar-stub')
    expect(screen.getByTestId('cabecalho-mes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Novo item' })).toBeInTheDocument()
    // Painel começa em "hoje" (sem itens nesse dia) → vazio
    expect(screen.getByTestId('painel-vazio')).toBeInTheDocument()
    // Clica no dia 10/06 → o prazo aparece no painel
    fireEvent.click(screen.getByRole('button', { name: 'dia-10' }))
    expect(screen.getByText('10 de junho')).toBeInTheDocument()
    expect(screen.getByTestId('contagem-dia')).toHaveTextContent('1 compromisso')
    expect(screen.getByTestId('card-item-dia')).toHaveTextContent('Contestar ação')
    // Dia sem nada → vazio de novo
    fireEvent.click(screen.getByRole('button', { name: 'dia-11' }))
    expect(screen.getByTestId('painel-vazio')).toBeInTheDocument()
  })

  it('chip "Audiências" filtra os eventos do calendário', async () => {
    renderAt('/agenda?view=calendario')
    const cal = await screen.findByTestId('calendar-stub')
    expect(cal).toHaveAttribute('data-eventos', '1')
    fireEvent.click(screen.getByRole('button', { name: 'Audiências' }))
    expect(screen.getByTestId('calendar-stub')).toHaveAttribute('data-eventos', '0')
  })

  it('"Concluir" no painel chama o endpoint de concluir e recarrega', async () => {
    concluirItemAgenda.mockResolvedValue({})
    renderAt('/agenda?view=calendario')
    await screen.findByTestId('calendar-stub')
    fireEvent.click(screen.getByRole('button', { name: 'dia-10' }))
    fireEvent.click(screen.getByRole('button', { name: /Concluir/i }))
    await waitFor(() => expect(concluirItemAgenda).toHaveBeenCalledWith(1))
    await waitFor(() => expect(listItensAgenda).toHaveBeenCalledTimes(2))
  })

  it('"Responder com peça" abre o TratarPrazoModal', async () => {
    renderAt('/agenda?view=calendario')
    await screen.findByTestId('calendar-stub')
    fireEvent.click(screen.getByRole('button', { name: 'dia-10' }))
    fireEvent.click(screen.getByRole('button', { name: /Responder com peça/i }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })
})

describe('AgendaUnificadaPage — Hoje e estado vazio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    localStorage.setItem('token', 'tok')
  })

  it('?view=hoje mostra a fila do dia com o vencido no topo', async () => {
    listItensAgenda.mockResolvedValue([ITEM])
    renderAt('/agenda?view=hoje')
    await screen.findByTestId('visao-hoje')
    expect(screen.getByTestId('bloco-vencidos')).toHaveTextContent('Contestar ação')
  })

  it('agenda vazia: frase + "Novo item" (único primário)', async () => {
    listItensAgenda.mockResolvedValue([])
    renderAt('/agenda?view=calendario')
    await screen.findByTestId('agenda-vazia')
    expect(screen.getByText('Sua agenda está vazia.')).toBeInTheDocument()
    expect(
      screen.getByText('Prazos criados a partir das intimações aparecem aqui automaticamente.')
    ).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Novo item/i })).toHaveLength(1)
  })
})
