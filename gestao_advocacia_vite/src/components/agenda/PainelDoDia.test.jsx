/**
 * Painel do dia (redesign Stitch): cabecalho "{dia} de {mês}" + contagem,
 * cards com hora/badge/partes/nº do processo e acoes, estado vazio com
 * "Novo item neste dia".
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

import PainelDoDia from './PainelDoDia.jsx'

const HOJE = '2026-09-08'
const CASOS = [
  {
    id: 7,
    titulo: 'Cobrança',
    numero_processo: '0001234-56.2026.8.16.0001',
    parte_contraria: 'Banco Alfa S.A.',
    cliente: { id: 1, nome_razao_social: 'Maria Silva' },
  },
]
const ITENS = [
  {
    id: 1,
    titulo: 'Contestar ação',
    tipo: 'tarefa',
    categoria: 'Prazo',
    status: 'Pendente',
    data_vencimento: HOJE,
    caso_id: 7,
    tipo_providencia: 'contestacao_15d',
  },
  {
    id: 2,
    titulo: 'Audiência de instrução',
    tipo: 'evento',
    categoria: 'Audiencia',
    status: 'Pendente',
    data_inicio: `${HOJE}T14:00:00`,
    caso_id: 7,
  },
]

describe('PainelDoDia', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mostra dia, contagem e os cards com dados do caso', () => {
    render(<PainelDoDia dataYmd={HOJE} itens={ITENS} casos={CASOS} hoje={HOJE} />)
    expect(screen.getByText('8 de setembro')).toBeInTheDocument()
    expect(screen.getByTestId('contagem-dia')).toHaveTextContent('2 compromissos')
    expect(screen.getAllByTestId('card-item-dia')).toHaveLength(2)
    // Prazo: dia inteiro + badge de providência + cliente × parte + nº CNJ
    expect(screen.getByText('Dia inteiro')).toBeInTheDocument()
    expect(screen.getByTestId('badge-providencia-dia')).toHaveTextContent('Contestação')
    expect(screen.getAllByText('Maria Silva × Banco Alfa S.A.')).toHaveLength(2)
    expect(screen.getAllByText('0001234-56.2026.8.16.0001')).toHaveLength(2)
    // Audiência: hora + badge
    expect(screen.getByText('14:00')).toBeInTheDocument()
    expect(screen.getByText('Audiência')).toBeInTheDocument()
  })

  it('acoes ligam nos callbacks certos (responder, concluir, abrir)', () => {
    const onResponder = vi.fn()
    const onConcluir = vi.fn()
    const onAbrir = vi.fn()
    render(
      <PainelDoDia
        dataYmd={HOJE}
        itens={[ITENS[0]]}
        casos={CASOS}
        hoje={HOJE}
        onResponder={onResponder}
        onConcluir={onConcluir}
        onAbrir={onAbrir}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Responder com peça/i }))
    expect(onResponder).toHaveBeenCalledWith(ITENS[0])
    fireEvent.click(screen.getByRole('button', { name: /Concluir/i }))
    expect(onConcluir).toHaveBeenCalledWith(ITENS[0])
    fireEvent.click(screen.getByRole('button', { name: 'Contestar ação' }))
    expect(onAbrir).toHaveBeenCalledWith(ITENS[0])
    // Tribunal deduzido do CNJ (TJPR) → botão presente
    expect(screen.getByRole('button', { name: /Abrir no tribunal/i })).toBeInTheDocument()
  })

  it('sem numero CNJ mapeado, "Abrir no tribunal" fica de fora (nunca botão morto)', () => {
    render(
      <PainelDoDia
        dataYmd={HOJE}
        itens={[{ ...ITENS[0], caso_id: null }]}
        casos={CASOS}
        hoje={HOJE}
      />
    )
    expect(screen.queryByRole('button', { name: /Abrir no tribunal/i })).not.toBeInTheDocument()
  })

  it('vazio: frase + "Novo item neste dia" com a data do painel', () => {
    const onNovoNoDia = vi.fn()
    render(
      <PainelDoDia
        dataYmd="2026-09-12"
        itens={[]}
        casos={[]}
        hoje={HOJE}
        onNovoNoDia={onNovoNoDia}
      />
    )
    expect(screen.getByText('12 de setembro')).toBeInTheDocument()
    expect(screen.getByTestId('contagem-dia')).toHaveTextContent('0 compromissos')
    expect(screen.getByText('Nada marcado para este dia.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Novo item neste dia/i }))
    expect(onNovoNoDia).toHaveBeenCalledWith('2026-09-12')
  })
})
