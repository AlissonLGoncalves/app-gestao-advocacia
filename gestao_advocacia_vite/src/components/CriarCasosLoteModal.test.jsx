/**
 * Issue #320 — runner client-side do lote: busca cada CNJ no tribunal e
 * cria o caso preenchido; pula já cadastrados; reporta erro por item;
 * deduplica cliente criado a partir do polo.
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warn: vi.fn(), warning: vi.fn() },
}))
vi.mock('../api/casos.js', () => ({
  buscarProcessoOnDemand: vi.fn(),
  createCaso: vi.fn(),
}))
vi.mock('../api/clientes.js', () => ({
  listClientes: vi.fn().mockResolvedValue([]),
  createCliente: vi.fn(),
}))

import { buscarProcessoOnDemand, createCaso } from '../api/casos.js'
import { createCliente } from '../api/clientes.js'
import CriarCasosLoteModal from './CriarCasosLoteModal.jsx'

const CNJ_A = '00000010000000000001'
const CNJ_B = '00000020000000000002'
const CNJ_C = '00000030000000000003'

const ok = (nomeAutor, cnj) => ({
  ja_cadastrado: null,
  resultado: {
    sucesso: true,
    cnj_normalizado: cnj,
    titulo_sugerido: `Ação de ${nomeAutor}`,
    classe_acao: 'Cível',
    polo_ativo: [{ nome: nomeAutor }],
    polo_passivo: [{ nome: 'Banco Réu' }],
    valor_causa: '1000',
  },
})

describe('CriarCasosLoteModal (#320)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createCaso.mockResolvedValue({ id: 99 })
    createCliente.mockResolvedValue({ id: 42 })
  })

  it('cria sequencialmente, pula já cadastrado e reporta erro por item', async () => {
    buscarProcessoOnDemand
      .mockResolvedValueOnce(ok('Maria Silva', CNJ_A))
      .mockResolvedValueOnce({ ja_cadastrado: { caso_id: 7 } })
      .mockRejectedValueOnce(new Error('Tribunal fora do ar'))
    const onItem = vi.fn()
    const onFim = vi.fn()
    render(
      <CriarCasosLoteModal
        cnjs={[CNJ_A, CNJ_B, CNJ_C]}
        onItemConcluido={onItem}
        onFinalizado={onFim}
        onClose={vi.fn()}
      />
    )
    fireEvent.click(await screen.findByTestId('btn-executar-lote'))

    await waitFor(() => expect(onFim).toHaveBeenCalledWith({ criados: 1, pulados: 1, erros: 1 }))
    expect(onItem).toHaveBeenCalledWith(
      CNJ_A,
      expect.objectContaining({ situacao: 'criado', caso_id: 99 })
    )
    expect(onItem).toHaveBeenCalledWith(
      CNJ_B,
      expect.objectContaining({ situacao: 'pulado', caso_id: 7 })
    )
    expect(onItem).toHaveBeenCalledWith(CNJ_C, expect.objectContaining({ situacao: 'erro' }))
    // caso criado com dados do tribunal e cliente do polo (autor default)
    expect(createCliente).toHaveBeenCalledWith({
      nome_razao_social: 'Maria Silva',
      tipo_pessoa: 'PF',
    })
    expect(createCaso).toHaveBeenCalledWith(
      expect.objectContaining({
        numero_processo: CNJ_A,
        cliente_id: 42,
        parte_contraria: 'Banco Réu',
        valor_causa: 1000,
      })
    )
    expect(screen.getByTestId('lote-resumo')).toHaveTextContent('1')
  })

  it('deduplica cliente criado a partir do mesmo nome de polo', async () => {
    buscarProcessoOnDemand
      .mockResolvedValueOnce(ok('Maria Silva', CNJ_A))
      .mockResolvedValueOnce(ok('Maria Silva', CNJ_B))
    render(
      <CriarCasosLoteModal
        cnjs={[CNJ_A, CNJ_B]}
        onItemConcluido={vi.fn()}
        onFinalizado={vi.fn()}
        onClose={vi.fn()}
      />
    )
    fireEvent.click(await screen.findByTestId('btn-executar-lote'))
    await waitFor(() => expect(createCaso).toHaveBeenCalledTimes(2))
    expect(createCliente).toHaveBeenCalledTimes(1) // mesmo polo → 1 cliente só
  })
})
