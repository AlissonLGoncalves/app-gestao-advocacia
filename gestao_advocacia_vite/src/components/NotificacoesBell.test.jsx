/**
 * Testes do NotificacoesBell.
 * Cobre: badge de unread, abre/fecha dropdown, marcar como lida, navegar
 * pro link, marcar todas como lidas, estado vazio.
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../api/notificacoes.js', () => ({
  getNotificacoesUnreadCount: vi.fn(),
  listNotificacoes: vi.fn(),
  marcarNotificacaoLida: vi.fn(),
  marcarTodasNotificacoesLidas: vi.fn(),
}))

import {
  getNotificacoesUnreadCount,
  listNotificacoes,
  marcarNotificacaoLida,
  marcarTodasNotificacoesLidas,
} from '../api/notificacoes.js'
import NotificacoesBell from './NotificacoesBell.jsx'

const renderBell = () =>
  render(
    <MemoryRouter>
      <NotificacoesBell />
    </MemoryRouter>
  )

describe('NotificacoesBell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'fake-token')
    getNotificacoesUnreadCount.mockResolvedValue({ count: 0 })
    listNotificacoes.mockResolvedValue([])
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('mostra badge com count de nao-lidas', async () => {
    getNotificacoesUnreadCount.mockResolvedValue({ count: 5 })
    renderBell()
    await waitFor(() => expect(screen.getByText('5')).toBeInTheDocument())
  })

  it('mostra 99+ quando count > 99', async () => {
    getNotificacoesUnreadCount.mockResolvedValue({ count: 150 })
    renderBell()
    await waitFor(() => expect(screen.getByText('99+')).toBeInTheDocument())
  })

  it('nao mostra badge quando count = 0', async () => {
    getNotificacoesUnreadCount.mockResolvedValue({ count: 0 })
    renderBell()
    await waitFor(() => expect(getNotificacoesUnreadCount).toHaveBeenCalled())
    expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument()
  })

  it('abre dropdown ao clicar no sino e carrega lista', async () => {
    listNotificacoes.mockResolvedValue([
      {
        id: 1,
        tipo: 'recebimento_vencendo',
        severidade: 'warning',
        titulo: 'Recebimento vence em 3 dia(s)',
        mensagem: '"Honor" — R$ 1500,00',
        link: '/recebimentos/editar/42',
        lida: false,
        data_criacao: new Date().toISOString(),
      },
    ])

    renderBell()
    fireEvent.click(screen.getByLabelText('Notificações'))

    expect(await screen.findByText('Recebimento vence em 3 dia(s)')).toBeInTheDocument()
    expect(listNotificacoes).toHaveBeenCalledWith({ limit: 20 })
  })

  it('estado vazio mostra mensagem amigavel', async () => {
    listNotificacoes.mockResolvedValue([])
    renderBell()
    fireEvent.click(screen.getByLabelText('Notificações'))
    expect(await screen.findByText(/Sem notificações por aqui/i)).toBeInTheDocument()
  })

  it('clicar numa notif marca como lida e navega', async () => {
    listNotificacoes.mockResolvedValue([
      {
        id: 42,
        tipo: 'recebimento_atrasado',
        severidade: 'danger',
        titulo: 'Recebimento atrasado',
        mensagem: 'Test',
        link: '/recebimentos/editar/99',
        lida: false,
        data_criacao: new Date().toISOString(),
      },
    ])
    marcarNotificacaoLida.mockResolvedValue({})
    getNotificacoesUnreadCount.mockResolvedValue({ count: 1 })

    renderBell()
    fireEvent.click(screen.getByLabelText('Notificações'))

    const notif = await screen.findByText('Recebimento atrasado')
    fireEvent.click(notif)

    await waitFor(() => expect(marcarNotificacaoLida).toHaveBeenCalledWith(42))
    expect(mockNavigate).toHaveBeenCalledWith('/recebimentos/editar/99')
  })

  it('marcar todas como lidas chama endpoint e zera badge', async () => {
    getNotificacoesUnreadCount.mockResolvedValue({ count: 3 })
    listNotificacoes.mockResolvedValue([
      {
        id: 1,
        tipo: 't',
        severidade: 'warning',
        titulo: 'A',
        lida: false,
        data_criacao: '2026-01-01',
      },
      {
        id: 2,
        tipo: 't',
        severidade: 'warning',
        titulo: 'B',
        lida: false,
        data_criacao: '2026-01-01',
      },
    ])
    marcarTodasNotificacoesLidas.mockResolvedValue({ marcadas: 2 })

    renderBell()
    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument())
    fireEvent.click(screen.getByLabelText('Notificações'))
    await waitFor(() => expect(screen.getByText('A')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Marcar todas como lidas/i }))
    await waitFor(() => expect(marcarTodasNotificacoesLidas).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByText('3')).not.toBeInTheDocument())
  })
})
