/**
 * Testes do RecebimentoForm "Robusto" (Fase 2).
 *
 * Foco nos comportamentos novos da Fase 2 — fluxos cobertos:
 *   - Cliente opcional: pode salvar sem (e backend recebe cliente_id=null)
 *   - Apos salvar sem cliente, modal pos-save aparece
 *   - Toggle Tipo: ao escolher PARCELADO, chama /recebimentos/serie
 *   - Botao "Novo" abre modal de cadastro rapido de cliente
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock('../api/client.js', () => ({
  api: { get: vi.fn().mockResolvedValue([]) },
}))

vi.mock('../api/financeiro.js', () => ({
  createRecebimento: vi.fn(),
  updateRecebimento: vi.fn(),
  createRecebimentoSerie: vi.fn(),
}))

vi.mock('../api/clientes.js', () => ({
  createCliente: vi.fn(),
}))

import { createRecebimento, updateRecebimento, createRecebimentoSerie } from '../api/financeiro.js'
import RecebimentoForm from './RecebimentoForm.jsx'

describe('RecebimentoForm robusto (Fase 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('permite salvar recebimento UNICO sem cliente e abre modal pos-save', async () => {
    createRecebimento.mockResolvedValue({ id: 42, descricao: 'PIX recebido' })

    render(<RecebimentoForm onRecebimentoChange={vi.fn()} onCancel={vi.fn()} />)

    // Aguarda carregar (mock devolve lista vazia)
    await waitFor(() => expect(screen.getByText('Sem cliente')).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText(/Descricao \*/i), {
      target: { value: 'PIX recebido' },
    })
    fireEvent.change(screen.getByLabelText(/Valor \(R\$\) \*/i), {
      target: { value: '500.00' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Adicionar Recebimento/i }))

    await waitFor(() => expect(createRecebimento).toHaveBeenCalledTimes(1))
    const payload = createRecebimento.mock.calls[0][0]
    expect(payload.cliente_id).toBeNull()
    expect(payload.caso_id).toBeNull()
    expect(payload.descricao).toBe('PIX recebido')
    expect(payload.valor).toBe(500)
    expect(payload.status).toBe('Pendente')

    // Modal pos-save aparece
    await waitFor(() => expect(screen.getByText(/Vincular um cliente\?/i)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Cadastrar novo/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Depois/i })).toBeInTheDocument()
  })

  it('toggle PARCELADO chama /recebimentos/serie com total_parcelas', async () => {
    createRecebimentoSerie.mockResolvedValue({
      recorrencia_id: 1,
      tipo: 'PARCELADO',
      total_geradas: 6,
      parcelas: Array.from({ length: 6 }, (_, i) => ({ id: i + 1 })),
    })

    render(<RecebimentoForm onRecebimentoChange={vi.fn()} onCancel={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Sem cliente')).toBeInTheDocument())

    // Toggle Parcelado
    fireEvent.click(screen.getByRole('button', { name: /Parcelado/i }))

    fireEvent.change(screen.getByLabelText(/Descricao \*/i), {
      target: { value: 'Acordo 6x' },
    })
    fireEvent.change(screen.getByLabelText(/Valor por parcela/i), {
      target: { value: '1000' },
    })
    fireEvent.change(screen.getByLabelText(/Numero de parcelas/i), {
      target: { value: '6' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Gerar 6 parcelas/i }))

    await waitFor(() => expect(createRecebimentoSerie).toHaveBeenCalledTimes(1))
    const payload = createRecebimentoSerie.mock.calls[0][0]
    expect(payload.tipo).toBe('PARCELADO')
    expect(payload.frequencia).toBe('MENSAL')
    expect(payload.valor_parcela).toBe(1000)
    expect(payload.total_parcelas).toBe(6)
    expect(payload.descricao).toBe('Acordo 6x')
    expect(createRecebimento).not.toHaveBeenCalled()
  })

  it('edicao pre-preenche cliente_id do backend e habilita salvar', async () => {
    updateRecebimento.mockResolvedValue({})

    render(
      <RecebimentoForm
        recebimentoParaEditar={{
          id: 7,
          descricao: 'Existente',
          valor: '1500.00',
          cliente_id: 5,
          caso_id: null,
          status: 'Pendente',
          categoria: 'Honorarios Advocaticios',
          data_vencimento: '2026-06-10',
          data_pagamento: null,
        }}
        onRecebimentoChange={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    await waitFor(() => expect(screen.getByLabelText(/Descricao \*/i).value).toBe('Existente'))
    // Edicao nao tem toggle Tipo (sempre UNICO)
    expect(screen.queryByRole('button', { name: /Recorrente/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Atualizar Recebimento/i }))
    await waitFor(() => expect(updateRecebimento).toHaveBeenCalledTimes(1))
    const [id, body] = updateRecebimento.mock.calls[0]
    expect(id).toBe(7)
    expect(body.cliente_id).toBe(5)
    expect(body.status).toBe('Pendente')
  })

  it('botao "Novo" abre o modal de cadastro rapido', async () => {
    render(<RecebimentoForm onRecebimentoChange={vi.fn()} onCancel={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Sem cliente')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Novo/i }))
    expect(await screen.findByText(/Cadastro rapido de cliente/i)).toBeInTheDocument()
  })

  it('mudar status pra Pago auto-preenche data_pagamento', async () => {
    render(<RecebimentoForm onRecebimentoChange={vi.fn()} onCancel={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Sem cliente')).toBeInTheDocument())

    const statusSelect = screen.getByLabelText(/Status \*/i)
    const dataPagInput = screen.getByLabelText(/Data de Pagamento/i)
    expect(dataPagInput.disabled).toBe(true)
    expect(dataPagInput.value).toBe('')

    fireEvent.change(statusSelect, { target: { value: 'Pago' } })
    await waitFor(() => expect(dataPagInput.disabled).toBe(false))
    expect(dataPagInput.value).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
