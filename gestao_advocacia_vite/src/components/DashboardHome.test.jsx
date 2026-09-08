import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import DashboardHome from './DashboardHome.jsx'
import { api } from '../api/client.js'
import { tratarItemAgenda } from '../api/itensAgenda.js'

vi.mock('../api/client.js', () => ({
  api: { get: vi.fn() },
}))
vi.mock('../api/itensAgenda.js', () => ({
  tratarItemAgenda: vi.fn(),
}))
vi.mock('react-toastify', () => ({
  toast: { info: vi.fn(), error: vi.fn() },
}))

const mockNavigate = vi.fn()
vi.mock('react-router', async (importOriginal) => {
  const original = await importOriginal()
  return { ...original, useNavigate: () => mockNavigate }
})

const SAUDACAO = /^Bo(m dia|a tarde|a noite), Alisson\.$/

const respostaBase = {
  resumo: {
    clientes: 12,
    casos_ativos: 8,
    intimacoes_pendentes: 3,
    prazos_urgentes: 1,
    financeiro_vencido: { quantidade: 0, valor_total: 0 },
  },
  hoje: { prazos: 1, eventos: 1, publicacoes: 3 },
  tarefas_prioritarias: [
    {
      id: 4,
      titulo: 'Protocolar contestação',
      categoria: 'Prazo',
      urgencia: 'hoje',
      data_vencimento: '2026-09-08T12:00:00',
      caso_titulo: 'Silva × Banco Alfa',
      numero_processo: null,
      tribunal: null,
      link_publicacao: null,
    },
  ],
  eventos_hoje: [
    {
      id: 7,
      titulo: 'audiência una',
      data_inicio: '2026-09-08T14:00:00',
      caso_titulo: 'Reclamação trabalhista',
      numero_processo: '0010928-12.2026.5.09.0002',
      tribunal: 'TRT9',
    },
  ],
  fila_intimacoes_por_tribunal: [{ tribunal: 'TJPR', quantidade: 3 }],
  progresso_hoje: { resolvidas: 1, total: 4 },
  resolvidas_hoje: [{ id: 2, titulo: 'Revisar minuta de agravo', tipo: 'tarefa' }],
  sequencia_dias: 7,
  semana: { intimacoes_tratadas: 23, prazos_perdidos: 0 },
  captura_hoje: { publicacoes: 12, tribunais: ['TJPR', 'TRT9', 'STJ'], vinculadas: 9 },
  publicacoes_recentes: [],
  monitoramento_djen_configurado: true,
}

const renderizar = () =>
  render(
    <MemoryRouter>
      <DashboardHome />
    </MemoryRouter>
  )

describe('DashboardHome (Seu dia)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('user', JSON.stringify({ username: 'Alisson' }))
  })

  it('monta saudacao, progresso, chip, linha do DJEN e fila ordenada', async () => {
    api.get.mockResolvedValue(respostaBase)
    renderizar()

    expect(await screen.findByText(SAUDACAO)).toBeInTheDocument()
    expect(
      screen.getByText('Você tem 3 coisas para resolver hoje. Comece pela primeira.')
    ).toBeInTheDocument()
    // X = 1 resolvida; Y = 1 + 3 pendentes.
    expect(screen.getByRole('progressbar', { name: '1 de 4 resolvidas' })).toBeInTheDocument()
    expect(screen.getByTestId('sequencia-chip')).toHaveTextContent('7 dias seguidos em dia')
    expect(
      screen.getByText(
        'Hoje às 7h: 12 publicações lidas em TJPR, TRT9 e STJ · 9 já vinculadas a casos.'
      )
    ).toBeInTheDocument()

    const linhas = screen.getAllByTestId('fila-linha')
    expect(linhas).toHaveLength(3)
    // Intimacoes primeiro (hoje), depois prazo de hoje, depois evento.
    expect(linhas[0]).toHaveTextContent('Tratar 3 publicações novas do TJPR')
    expect(linhas[1]).toHaveTextContent('Protocolar contestação — Silva × Banco Alfa')
    expect(linhas[2]).toHaveTextContent('Confirmar audiência una')

    // So a primeira linha usa o botao primario.
    const primarios = document.querySelectorAll('.dh-fila .dh-btn--primario')
    expect(primarios).toHaveLength(1)
    expect(primarios[0]).toHaveTextContent('Tratar')

    // Concluida de hoje riscada no fim.
    expect(screen.getByTestId('fila-concluida')).toHaveTextContent('Revisar minuta de agravo')
    expect(
      screen.getByText('Você tratou 23 intimações e não perdeu nenhum prazo.')
    ).toBeInTheDocument()

    // Nada da tela antiga.
    expect(screen.queryByText('Atenção agora')).not.toBeInTheDocument()
    expect(screen.queryByText('Últimas movimentações')).not.toBeInTheDocument()
    expect(screen.queryByText('Novo cliente')).not.toBeInTheDocument()

    expect(api.get).toHaveBeenCalledTimes(1)
    expect(api.get).toHaveBeenCalledWith('/dashboard/home')
  })

  it('"Tratar" leva para as intimacoes filtradas pelo tribunal', async () => {
    api.get.mockResolvedValue(respostaBase)
    renderizar()

    fireEvent.click(await screen.findByRole('button', { name: 'Tratar' }))
    expect(mockNavigate).toHaveBeenCalledWith('/djen?tribunal=TJPR')
  })

  it('"Concluir" trata o prazo e move a linha para concluidas sem recarregar', async () => {
    api.get.mockResolvedValue(respostaBase)
    tratarItemAgenda.mockResolvedValue({ id: 4, status: 'Concluido' })
    renderizar()

    fireEvent.click(await screen.findByRole('button', { name: 'Concluir' }))

    await waitFor(() => {
      expect(tratarItemAgenda).toHaveBeenCalledWith(4, { acao: 'cumpri' })
    })
    await waitFor(() => {
      expect(screen.getAllByTestId('fila-concluida')).toHaveLength(2)
    })
    expect(screen.getAllByTestId('fila-linha')).toHaveLength(2)
    expect(screen.getByRole('progressbar', { name: '2 de 4 resolvidas' })).toBeInTheDocument()
    expect(
      screen.getByText('Você tem 2 coisas para resolver hoje. Comece pela primeira.')
    ).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledTimes(1)
  })

  it('sem OAB cadastrada convida a ativar o DJEN', async () => {
    api.get.mockResolvedValue({
      ...respostaBase,
      monitoramento_djen_configurado: false,
      captura_hoje: { publicacoes: 0, tribunais: [], vinculadas: 0 },
    })
    renderizar()

    expect(await screen.findByText(/Ative o monitoramento do DJEN/)).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('djen-cadastrar-oab'))
    expect(mockNavigate).toHaveBeenCalledWith('/djen?aba=oabs')
  })

  it('mostra "Tudo em dia." quando a fila esta vazia, mantendo o chip', async () => {
    api.get.mockResolvedValue({
      ...respostaBase,
      tarefas_prioritarias: [],
      eventos_hoje: [],
      fila_intimacoes_por_tribunal: [],
      resolvidas_hoje: [],
      progresso_hoje: { resolvidas: 0, total: 0 },
    })
    renderizar()

    expect(await screen.findByText('Tudo em dia.')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Nenhum prazo, nenhuma publicação pendente. Amanhã às 7h o DJEN será lido de novo.'
      )
    ).toBeInTheDocument()
    expect(screen.getByTestId('sequencia-chip')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Ver casos' }))
    expect(mockNavigate).toHaveBeenCalledWith('/casos')
  })

  it('com banco vazio convida a cadastrar o primeiro caso', async () => {
    api.get.mockResolvedValue({
      ...respostaBase,
      resumo: { ...respostaBase.resumo, clientes: 0, casos_ativos: 0 },
      tarefas_prioritarias: [],
      eventos_hoje: [],
      fila_intimacoes_por_tribunal: [],
      resolvidas_hoje: [],
      sequencia_dias: 0,
      semana: { intimacoes_tratadas: 0, prazos_perdidos: 0 },
      monitoramento_djen_configurado: false,
    })
    renderizar()

    expect(await screen.findByText('Comece cadastrando seu primeiro caso.')).toBeInTheDocument()
    expect(screen.queryByTestId('sequencia-chip')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Novo caso' }))
    expect(mockNavigate).toHaveBeenCalledWith('/casos/novo')
  })

  it('mostra erro com botao de tentar novamente', async () => {
    api.get.mockRejectedValueOnce(new Error('Falha de rede'))
    api.get.mockResolvedValueOnce(respostaBase)
    renderizar()

    expect(await screen.findByRole('alert')).toHaveTextContent('Falha de rede')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText(SAUDACAO)).toBeInTheDocument()
  })
})
