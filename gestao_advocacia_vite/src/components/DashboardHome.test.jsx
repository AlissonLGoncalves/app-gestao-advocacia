import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import DashboardHome from './DashboardHome.jsx'
import { api } from '../api/client.js'

vi.mock('../api/client.js', () => ({
  api: { get: vi.fn() },
}))

const respostaBase = {
  resumo: {
    clientes: 12,
    casos_ativos: 8,
    intimacoes_pendentes: 2,
    prazos_urgentes: 1,
    financeiro_vencido: {
      quantidade: 1,
      valor_total: 900,
      recebimentos_vencidos: 1,
      despesas_vencidas: 0,
    },
  },
  hoje: { prazos: 1, eventos: 2, publicacoes: 3 },
  tarefas_prioritarias: [
    {
      id: 4,
      titulo: 'Protocolar contestação',
      categoria: 'Prazo',
      urgencia: 'hoje',
      data_vencimento: '2026-08-03T12:00:00',
      caso_titulo: 'Ação de cobrança',
    },
  ],
  publicacoes_recentes: [
    {
      id: 9,
      data: '2026-08-03',
      tribunal: 'TJPR',
      resumo: 'Intimação para manifestação.',
      lida: false,
      cliente_nome: 'Cliente Exemplo',
    },
  ],
  monitoramento_djen_configurado: true,
}

describe('DashboardHome', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('user', JSON.stringify({ username: 'Alisson' }))
  })

  it('carrega uma unica visao consolidada e prioriza as acoes', async () => {
    api.get.mockResolvedValue(respostaBase)

    render(
      <MemoryRouter>
        <DashboardHome />
      </MemoryRouter>
    )

    expect(await screen.findByText('Bom dia, Alisson.')).toBeInTheDocument()
    expect(screen.getByText('2 publicações aguardam triagem')).toBeInTheDocument()
    expect(screen.getByText('Protocolar contestação')).toBeInTheDocument()
    expect(screen.getByText('Cliente Exemplo')).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledTimes(1)
    expect(api.get).toHaveBeenCalledWith('/dashboard/home')
  })

  it('mostra estado tranquilo quando nao ha nenhuma urgencia', async () => {
    api.get.mockResolvedValue({
      ...respostaBase,
      resumo: {
        ...respostaBase.resumo,
        intimacoes_pendentes: 0,
        financeiro_vencido: { quantidade: 0, valor_total: 0 },
      },
      tarefas_prioritarias: [],
      publicacoes_recentes: [],
    })

    render(
      <MemoryRouter>
        <DashboardHome />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Nenhuma urgência encontrada')).toBeInTheDocument()
    })
    expect(screen.getByText('Nenhuma publicação recente.')).toBeInTheDocument()
  })
})
