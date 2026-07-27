import { describe, it, expect } from 'vitest'
import { destinoNoTribunal, portalDoTribunal } from './linkTribunal.js'

describe('portalDoTribunal', () => {
  it('conhece os tribunais em uso', () => {
    for (const sigla of ['TJPR', 'TJSC', 'TJSP', 'TJMG', 'TRF4', 'TRT9', 'TST']) {
      const p = portalDoTribunal(sigla)
      expect(p, `faltou ${sigla}`).toBeTruthy()
      expect(p.url).toMatch(/^https:\/\//)
    }
  })

  it('aceita sigla em caixa baixa / com espaço', () => {
    expect(portalDoTribunal(' tjsp ').nome).toContain('TJSP')
  })

  it('retorna null pra sigla desconhecida (melhor nenhum link que link errado)', () => {
    expect(portalDoTribunal('TJXX')).toBeNull()
    expect(portalDoTribunal('')).toBeNull()
  })
})

describe('destinoNoTribunal', () => {
  it('prefere o link oficial da publicação quando existe', () => {
    const d = destinoNoTribunal({ link: 'https://dje.exemplo/pub/1', sigla_tribunal: 'TJSP' })
    expect(d.url).toBe('https://dje.exemplo/pub/1')
    expect(d.precisaColar).toBe(false)
  })

  it('sem link, cai na consulta pública e sinaliza que precisa colar o nº', () => {
    const d = destinoNoTribunal({ sigla_tribunal: 'TJMG' })
    expect(d.url).toContain('tjmg.jus.br')
    expect(d.precisaColar).toBe(true)
  })

  it('sem link e sem tribunal conhecido, não oferece destino', () => {
    expect(destinoNoTribunal({ sigla_tribunal: 'TJXX' })).toBeNull()
    expect(destinoNoTribunal(null)).toBeNull()
  })
})
