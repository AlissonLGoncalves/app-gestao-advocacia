import { describe, it, expect } from 'vitest'
import {
  acaoDoItem,
  chipVencimento,
  decursoPrazo,
  diasAte,
  pecaCabivelDoItem,
  selecionarProximoPasso,
} from './proximoPasso.js'

const HOJE = new Date('2026-09-08T09:00:00')

describe('proximoPasso — seleção', () => {
  it('retorna null sem itens em aberto', () => {
    expect(selecionarProximoPasso([])).toBeNull()
    expect(selecionarProximoPasso([{ id: 1, status: 'Concluido' }])).toBeNull()
    expect(selecionarProximoPasso([{ id: 2, status: 'Cancelado' }])).toBeNull()
  })

  it('pega o vencimento mais próximo, incluindo vencidos', () => {
    const itens = [
      { id: 1, status: 'Pendente', data_vencimento: '2026-09-20' },
      { id: 2, status: 'Pendente', data_vencimento: '2026-09-01' },
      { id: 3, status: 'Concluido', data_vencimento: '2026-08-01' },
    ]
    expect(selecionarProximoPasso(itens).id).toBe(2)
  })

  it('itens sem data ficam por último', () => {
    const itens = [
      { id: 1, status: 'Pendente', data_vencimento: null },
      { id: 2, status: 'Em Andamento', data_vencimento: '2026-10-01' },
    ]
    expect(selecionarProximoPasso(itens).id).toBe(2)
    expect(selecionarProximoPasso([itens[0]]).id).toBe(1)
  })
})

describe('proximoPasso — ação e peça', () => {
  it('traduz providência em verbo de ação', () => {
    expect(acaoDoItem({ tipo_providencia: 'contestacao_15d', titulo: 'x' })).toBe(
      'Apresentar contestação'
    )
    expect(acaoDoItem({ tipo_providencia: 'audiencia_7d' })).toBe('Comparecer à audiência')
  })

  it('sem providência usa o título do item', () => {
    expect(acaoDoItem({ titulo: 'Ligar para o cliente' })).toBe('Ligar para o cliente')
    expect(acaoDoItem(null)).toBe('')
  })

  it('peça cabível vem do label da providência', () => {
    expect(pecaCabivelDoItem({ tipo_providencia: 'contestacao_15d' })).toBe('Contestação')
    expect(pecaCabivelDoItem({ titulo: 'sem providência' })).toBeNull()
  })
})

describe('proximoPasso — datas', () => {
  it('diasAte conta em dias inteiros a partir de hoje', () => {
    expect(diasAte('2026-09-20', HOJE)).toBe(12)
    expect(diasAte('2026-09-08', HOJE)).toBe(0)
    expect(diasAte('2026-09-01', HOJE)).toBe(-7)
    expect(diasAte(null, HOJE)).toBeNull()
  })

  it('chipVencimento cobre futuro, hoje, amanhã e vencido', () => {
    expect(chipVencimento(12)).toEqual({ texto: 'em 12 dias', tom: 'muted' })
    expect(chipVencimento(3)).toEqual({ texto: 'em 3 dias', tom: 'primary' })
    expect(chipVencimento(1)).toEqual({ texto: 'amanhã', tom: 'warning' })
    expect(chipVencimento(0)).toEqual({ texto: 'hoje', tom: 'warning' })
    expect(chipVencimento(-1)).toEqual({ texto: 'vencido há 1 dia', tom: 'danger' })
    expect(chipVencimento(-7)).toEqual({ texto: 'vencido há 7 dias', tom: 'danger' })
    expect(chipVencimento(null)).toEqual({ texto: 'sem data', tom: 'muted' })
  })

  it('decursoPrazo calcula dia x de n e satura quando vencido', () => {
    expect(decursoPrazo({ prazo_dias_origem: 15, data_vencimento: '2026-09-20' }, HOJE)).toEqual({
      atual: 3,
      total: 15,
      pct: 20,
    })
    expect(decursoPrazo({ prazo_dias_origem: 15, data_vencimento: '2026-09-01' }, HOJE)).toEqual({
      atual: 15,
      total: 15,
      pct: 100,
    })
    expect(decursoPrazo({ data_vencimento: '2026-09-20' }, HOJE)).toBeNull()
    expect(decursoPrazo({ prazo_dias_origem: 15 }, HOJE)).toBeNull()
  })
})
