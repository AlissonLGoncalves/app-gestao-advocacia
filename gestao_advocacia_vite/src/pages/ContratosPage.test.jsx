/**
 * Fase 1 (auditoria UX) — a página de contratos deixou de ser read-only:
 * criar contrato (cliente derivado do caso) e emendar a geração de
 * parcelas logo após a criação.
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), warn: vi.fn() },
}))
vi.mock('../api/casos.js', () => ({
  listCasos: vi.fn(),
}))
vi.mock('../api/contratos.js', () => ({
  createContrato: vi.fn(),
  updateContrato: vi.fn(),
  deleteContrato: vi.fn(),
  gerarParcelasContrato: vi.fn(),
}))

import { listCasos } from '../api/casos.js'
import { createContrato, gerarParcelasContrato } from '../api/contratos.js'
import ContratosPage from './ContratosPage.jsx'

const CASOS = [
  {
    id: 7,
    titulo: 'Caso Teste',
    numero_processo: '0001-11.2026.8.16.0001',
    cliente_id: 3,
    cliente_nome: 'Maria',
  },
]

const renderPage = () =>
  render(
    <MemoryRouter>
      <ContratosPage />
    </MemoryRouter>
  )

describe('ContratosPage — criação e parcelas (Fase 1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'tok')
    listCasos.mockResolvedValue(CASOS)
    // fetchTudo da página usa fetch direto (contratos/clientes/casos)
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
  })

  it('botão "Novo contrato" abre o form; salvar cria e emenda o modal de parcelas', async () => {
    createContrato.mockResolvedValue({ id: 55, valor_total: 3000, caso_id: 7 })
    renderPage()
    fireEvent.click(await screen.findByTestId('btn-novo-contrato'))
    await screen.findByTestId('contrato-form-modal')

    // seleciona o caso (cliente é derivado dele)
    await screen.findByRole('option', { name: /Caso Teste/ })
    fireEvent.change(screen.getByTestId('contrato-caso-select'), { target: { value: '7' } })
    fireEvent.click(screen.getByTestId('btn-salvar-contrato'))

    await waitFor(() =>
      expect(createContrato).toHaveBeenCalledWith(
        expect.objectContaining({ caso_id: 7, cliente_id: 3, tipo_honorario: 'Fixo' })
      )
    )
    // contrato com valor → modal de parcelas abre na sequência
    expect(await screen.findByTestId('gerar-parcelas-modal')).toBeInTheDocument()
  })

  it('gerar parcelas envia quantidade e 1º vencimento', async () => {
    createContrato.mockResolvedValue({ id: 56, valor_total: 2000, caso_id: 7 })
    gerarParcelasContrato.mockResolvedValue({ message: 'ok' })
    renderPage()
    fireEvent.click(await screen.findByTestId('btn-novo-contrato'))
    await screen.findByRole('option', { name: /Caso Teste/ })
    fireEvent.change(screen.getByTestId('contrato-caso-select'), { target: { value: '7' } })
    fireEvent.click(screen.getByTestId('btn-salvar-contrato'))

    await screen.findByTestId('gerar-parcelas-modal')
    fireEvent.change(screen.getByTestId('input-qtd-parcelas'), { target: { value: '4' } })
    fireEvent.change(screen.getByTestId('input-primeiro-vencimento'), {
      target: { value: '2026-07-01' },
    })
    fireEvent.click(screen.getByTestId('btn-confirmar-parcelas'))

    await waitFor(() =>
      expect(gerarParcelasContrato).toHaveBeenCalledWith(56, {
        quantidade_parcelas: 4,
        primeiro_vencimento: '2026-07-01',
      })
    )
  })

  it('sem caso selecionado não envia (caso é obrigatório)', async () => {
    renderPage()
    fireEvent.click(await screen.findByTestId('btn-novo-contrato'))
    await screen.findByTestId('contrato-form-modal')
    fireEvent.click(screen.getByTestId('btn-salvar-contrato'))
    await waitFor(() => expect(createContrato).not.toHaveBeenCalled())
  })
})
