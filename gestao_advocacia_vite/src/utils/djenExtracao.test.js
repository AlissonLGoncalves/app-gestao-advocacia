/**
 * Redesign Stitch (set/2026) — a zona "Extraído automaticamente" só pode
 * mostrar o que o tribunal realmente mandou. Estes testes travam a regra de
 * ouro: campo ausente devolve string vazia (a UI vira "—"), NUNCA um chute.
 */
import { describe, it, expect } from 'vitest'
import {
  TITULO_NAO_EXTRAIDO,
  assuntoDe,
  fmtDataCurta,
  numeroProcessoDe,
  partesDaPublicacao,
  prazoTexto,
  rotuloTipoSugerido,
} from './djenExtracao.js'

describe('fmtDataCurta', () => {
  it('formata ISO simples e datetime em dd/mm/aaaa', () => {
    expect(fmtDataCurta('2026-06-26')).toBe('26/06/2026')
    expect(fmtDataCurta('2026-06-26T15:30:00')).toBe('26/06/2026')
  })

  it('devolve vazio para nulo, vazio ou data inválida', () => {
    expect(fmtDataCurta(null)).toBe('')
    expect(fmtDataCurta('')).toBe('')
    expect(fmtDataCurta('nao-e-data')).toBe('')
  })

  it('não desloca o dia por fuso (meio-dia no ISO simples)', () => {
    expect(fmtDataCurta('2026-01-01')).toBe('01/01/2026')
  })
})

describe('partesDaPublicacao', () => {
  const CASOS = [{ id: 4, cliente_nome: 'Maria Silva', parte_contraria: 'Banco X' }]

  it('lê o cliente aninhado de GET /casos (cliente.nome_razao_social)', () => {
    const casos = [
      { id: 4, cliente: { id: 1, nome_razao_social: 'Maria Silva' }, parte_contraria: 'Banco X' },
    ]
    expect(partesDaPublicacao({ caso_id: 4 }, casos)).toMatchObject({
      texto: 'Maria Silva × Banco X',
      fonte: 'caso',
    })
  })

  it('prefere o caso vinculado (cliente × parte contrária)', () => {
    const r = partesDaPublicacao(
      { caso_id: 4, polo_ativo: 'MARIA S.', polo_passivo: 'BANCO' },
      CASOS
    )
    expect(r).toMatchObject({
      ativo: 'Maria Silva',
      passivo: 'Banco X',
      texto: 'Maria Silva × Banco X',
      fonte: 'caso',
    })
  })

  it('cai nos polos da publicação quando não há caso', () => {
    const r = partesDaPublicacao({ polo_ativo: 'João', polo_passivo: 'Município' })
    expect(r.texto).toBe('João × Município')
    expect(r.fonte).toBe('publicacao')
  })

  it('com um polo só, mostra o que existe (sem inventar o outro)', () => {
    expect(partesDaPublicacao({ polo_ativo: 'João' }).texto).toBe('João')
    expect(partesDaPublicacao({ polo_passivo: 'Município' }).texto).toBe('Município')
  })

  it('sem nada extraído devolve texto vazio', () => {
    expect(partesDaPublicacao({ polo_ativo: '', polo_passivo: '  ' }).texto).toBe('')
    expect(partesDaPublicacao(null).texto).toBe('')
  })

  it('caso_id apontando pra caso não carregado usa os polos da publicação', () => {
    const r = partesDaPublicacao({ caso_id: 99, polo_ativo: 'Ana', polo_passivo: 'Réu' }, CASOS)
    expect(r.texto).toBe('Ana × Réu')
    expect(r.fonte).toBe('publicacao')
  })
})

describe('numeroProcessoDe / assuntoDe', () => {
  it('prefere a máscara CNJ', () => {
    expect(
      numeroProcessoDe({
        numero_processo: '00077347620258160075',
        numero_processo_mascara: '0007734-76.2025.8.16.0075',
      })
    ).toBe('0007734-76.2025.8.16.0075')
  })

  it('usa o número cru quando não há máscara e vazio quando não há nada', () => {
    expect(numeroProcessoDe({ numero_processo: '123' })).toBe('123')
    expect(numeroProcessoDe({})).toBe('')
    expect(numeroProcessoDe(null)).toBe('')
  })

  it('assunto vem de nome_classe', () => {
    expect(assuntoDe({ nome_classe: 'Ação de cobrança' })).toBe('Ação de cobrança')
    expect(assuntoDe({})).toBe('')
  })
})

describe('prazoTexto', () => {
  it('monta providência · dias · vencimento', () => {
    expect(
      prazoTexto({ providencia: 'Contestação', dias: 15, data_vencimento: '2026-09-26' })
    ).toBe('Contestação · 15 dias · vence 26/09/2026')
  })

  it('omite as partes que faltam', () => {
    expect(prazoTexto({ providencia: 'Recurso' })).toBe('Recurso')
    expect(prazoTexto({ providencia: 'Recurso', dias: 5 })).toBe('Recurso · 5 dias')
  })

  it('sem providência (fallback do calculador) devolve vazio — não inventa prazo', () => {
    expect(prazoTexto(null)).toBe('')
    expect(prazoTexto({ dias: 15, data_vencimento: '2026-09-26' })).toBe('')
    expect(prazoTexto({ providencia: null, dias: 5 })).toBe('')
  })
})

describe('rotuloTipoSugerido', () => {
  it('traduz os tipos do backend e cai em "prazo" no desconhecido', () => {
    expect(rotuloTipoSugerido('prazo')).toBe('prazo')
    expect(rotuloTipoSugerido('audiencia')).toBe('audiência')
    expect(rotuloTipoSugerido('tarefa')).toBe('tarefa')
    expect(rotuloTipoSugerido('outro')).toBe('prazo')
    expect(rotuloTipoSugerido(undefined)).toBe('prazo')
  })
})

describe('TITULO_NAO_EXTRAIDO', () => {
  it('é o title do "—" — contrato com a UI e com os testes de tela', () => {
    expect(TITULO_NAO_EXTRAIDO).toBe('não extraído nesta publicação')
  })
})
