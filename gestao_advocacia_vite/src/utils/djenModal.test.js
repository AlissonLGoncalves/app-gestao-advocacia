import { describe, it, expect } from 'vitest'
import { wrapPubParaModalCriar } from './djenModal.js'

describe('wrapPubParaModalCriar', () => {
  it('normaliza a pub crua no formato do modal (número, vara, partes)', () => {
    const pub = {
      id: 728,
      numero_processo: '0000001-11.2026.8.24.0008',
      nome_orgao: '1a Vara Cível da Comarca de Blumenau',
      polo_ativo: 'AUTOR A | AUTOR B',
      polo_passivo: 'RÉU X',
    }
    const w = wrapPubParaModalCriar(pub)
    // publicacao aninhada preservada (fix do pub.id que sumia)
    expect(w.publicacao).toBe(pub)
    expect(w.publicacao.id).toBe(728)
    expect(w.analise.numero_processo).toBe('0000001-11.2026.8.24.0008')
    expect(w.analise.vara).toBe('1a Vara Cível da Comarca de Blumenau')
    expect(w.analise.partes_autoras).toEqual(['AUTOR A', 'AUTOR B'])
    expect(w.analise.partes_reus).toEqual(['RÉU X'])
  })

  it('lida com publicação sem partes/campos', () => {
    const w = wrapPubParaModalCriar({ id: 1 })
    expect(w.publicacao.id).toBe(1)
    expect(w.analise.numero_processo).toBe('')
    expect(w.analise.partes_autoras).toEqual([])
    expect(w.analise.partes_reus).toEqual([])
  })

  it('não quebra com pub null/undefined', () => {
    const w = wrapPubParaModalCriar(undefined)
    expect(w.publicacao).toEqual({})
    expect(w.analise.partes_autoras).toEqual([])
  })
})
