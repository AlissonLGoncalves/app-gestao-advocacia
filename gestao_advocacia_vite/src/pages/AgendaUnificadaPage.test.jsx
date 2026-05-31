/**
 * Testa a unificação Agenda + Kanban: as 3 visões (Calendário, Kanban, Lista)
 * vivem todas em /agenda. Foco no que a unificação trouxe de novo — a aba
 * Kanban embutida em ?view=kanban (antes era a página separada /prazos).
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

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

import { listItensAgenda } from '../api/itensAgenda.js'
import AgendaUnificadaPage from './AgendaUnificadaPage.jsx'

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AgendaUnificadaPage />
    </MemoryRouter>
  )

describe('AgendaUnificadaPage — Kanban unificado', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'tok')
    listItensAgenda.mockResolvedValue([
      {
        id: 1,
        titulo: 'Contestar ação',
        tipo: 'tarefa',
        categoria: 'Prazo',
        status: 'Pendente',
        prioridade: 'Alta',
        data_vencimento: '2026-06-10',
      },
    ])
    // PrazosPage embutido busca /casos via fetch direto.
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
  })

  it('?view=kanban renderiza o board (colunas) e o botão "Novo Prazo"', async () => {
    renderAt('/agenda?view=kanban')
    // Colunas do Kanban (vocabulário legado do board)
    await screen.findByText('A Fazer')
    expect(screen.getByText('Em Andamento')).toBeInTheDocument()
    expect(screen.getByText('Concluído')).toBeInTheDocument()
    // Botão de criação do Kanban (não o "Novo item" do calendário)
    expect(screen.getByRole('button', { name: /Novo Prazo/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Novo item/i })).not.toBeInTheDocument()
  })

  it('?view=kanban esconde os filtros de tipo/status (são do Calendário/Lista)', async () => {
    renderAt('/agenda?view=kanban')
    await screen.findByText('A Fazer')
    expect(screen.queryByLabelText('Filtrar por tipo')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Filtrar por status')).not.toBeInTheDocument()
  })

  it('o card da tarefa carregada aparece no board', async () => {
    renderAt('/agenda?view=kanban')
    await waitFor(() => expect(screen.getByText('Contestar ação')).toBeInTheDocument())
    // toggle de visão sempre presente (3 abas na mesma rota)
    expect(screen.getByRole('button', { name: /Kanban/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Calendário/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Lista/i })).toBeInTheDocument()
  })
})
