import { describe, it, expect } from 'vitest'
import { wrapPubParaModalCriar, extrairComarcaDoOrgao } from './djenModal.js'

describe('wrapPubParaModalCriar', () => {
  it('normaliza a pub crua no formato do modal (número, vara, classe, comarca, partes)', () => {
    const pub = {
      id: 728,
      numero_processo: '5024563-95.2026.8.24.0008',
      nome_orgao: '1ª Vara Cível da Comarca de Blumenau',
      nome_classe: 'PROCEDIMENTO COMUM CÍVEL',
      polo_ativo: 'EDMUR BERNARDES',
      polo_passivo: 'RÉU X | RÉU Y',
    }
    const w = wrapPubParaModalCriar(pub)
    // publicacao aninhada preservada (fix do pub.id que sumia)
    expect(w.publicacao).toBe(pub)
    expect(w.publicacao.id).toBe(728)
    expect(w.analise.numero_processo).toBe('5024563-95.2026.8.24.0008')
    expect(w.analise.vara).toBe('1ª Vara Cível da Comarca de Blumenau')
    expect(w.analise.classe_processual).toBe('PROCEDIMENTO COMUM CÍVEL')
    expect(w.analise.comarca).toBe('Blumenau')
    expect(w.analise.partes_autoras).toEqual(['EDMUR BERNARDES'])
    expect(w.analise.partes_reus).toEqual(['RÉU X', 'RÉU Y'])
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

describe('extrairComarcaDoOrgao', () => {
  it('extrai a comarca quando o órgão traz "Comarca de X"', () => {
    expect(extrairComarcaDoOrgao('1ª Vara Cível da Comarca de Blumenau')).toBe('Blumenau')
    expect(extrairComarcaDoOrgao('Vara Única da Comarca de São José dos Pinhais')).toBe(
      'São José dos Pinhais'
    )
  })

  it('retorna vazio quando não há o padrão (evita chute errado)', () => {
    expect(extrairComarcaDoOrgao('7ª Vara Federal de Londrina')).toBe('')
    expect(extrairComarcaDoOrgao('Juizado Especial Cível de Cornélio Procópio')).toBe('')
    expect(extrairComarcaDoOrgao('')).toBe('')
    expect(extrairComarcaDoOrgao(null)).toBe('')
  })
})
