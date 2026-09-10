import { describe, it, expect } from 'vitest'
import {
  ymdDoItem,
  horaDoItem,
  urgenciaDoItem,
  familiaDoItem,
  filtrarPorChip,
  itensDoDia,
  contarMes,
  tituloMes,
  tituloDia,
  resolverCaso,
  siglaTribunalDoNumero,
  destinoTribunalDoItem,
  somarDias,
} from './agendaHelpers.js'

const HOJE = '2026-09-08'

describe('agendaHelpers — datas', () => {
  it('ymdDoItem prioriza data_inicio e ignora fuso', () => {
    expect(ymdDoItem({ data_inicio: '2026-09-10T14:00:00', data_vencimento: '2026-09-11' })).toBe(
      '2026-09-10'
    )
    expect(ymdDoItem({ data_vencimento: '2026-09-11' })).toBe('2026-09-11')
    expect(ymdDoItem({})).toBeNull()
  })

  it('horaDoItem devolve HH:MM ou null (dia inteiro)', () => {
    expect(horaDoItem({ data_inicio: '2026-09-10T14:30:00' })).toBe('14:30')
    expect(horaDoItem({ data_vencimento: '2026-09-10' })).toBeNull()
  })

  it('somarDias atravessa o mes', () => {
    expect(somarDias('2026-09-30', 1)).toBe('2026-10-01')
  })

  it('tituloMes / tituloDia em pt-BR', () => {
    expect(tituloMes(new Date(2026, 8, 1))).toBe('Setembro 2026')
    expect(tituloDia('2026-09-08')).toBe('8 de setembro')
  })
})

describe('agendaHelpers — urgencia e familias', () => {
  it('classifica vencido / hoje / semana / normal / concluido', () => {
    expect(urgenciaDoItem({ status: 'Pendente', data_vencimento: '2026-09-01' }, HOJE)).toBe(
      'vencido'
    )
    expect(urgenciaDoItem({ status: 'Pendente', data_vencimento: HOJE }, HOJE)).toBe('hoje')
    expect(urgenciaDoItem({ status: 'Pendente', data_vencimento: '2026-09-12' }, HOJE)).toBe(
      'semana'
    )
    expect(urgenciaDoItem({ status: 'Pendente', data_vencimento: '2026-10-12' }, HOJE)).toBe(
      'normal'
    )
    expect(urgenciaDoItem({ status: 'Concluido', data_vencimento: '2026-09-01' }, HOJE)).toBe(
      'concluido'
    )
  })

  it('familiaDoItem: audiencia > prazo > tarefa', () => {
    expect(familiaDoItem({ categoria: 'Audiencia' })).toBe('audiencias')
    expect(familiaDoItem({ categoria: 'Prazo', tipo_providencia: 'audiencia_7d' })).toBe(
      'audiencias'
    )
    expect(familiaDoItem({ categoria: 'Prazo' })).toBe('prazos')
    expect(familiaDoItem({ categoria: 'Peticionamento' })).toBe('prazos')
    expect(familiaDoItem({ categoria: 'Reuniao' })).toBe('tarefas')
  })

  it('filtrarPorChip e contarMes', () => {
    const itens = [
      { id: 1, categoria: 'Prazo', data_vencimento: '2026-09-10' },
      { id: 2, categoria: 'Audiencia', data_inicio: '2026-09-11T10:00:00' },
      { id: 3, categoria: 'Reuniao', data_inicio: '2026-09-12T10:00:00' },
      { id: 4, categoria: 'Prazo', data_vencimento: '2026-10-10' },
    ]
    expect(filtrarPorChip(itens, 'todos')).toHaveLength(4)
    expect(filtrarPorChip(itens, 'prazos').map((i) => i.id)).toEqual([1, 4])
    expect(filtrarPorChip(itens, 'audiencias').map((i) => i.id)).toEqual([2])
    expect(filtrarPorChip(itens, 'tarefas').map((i) => i.id)).toEqual([3])
    expect(contarMes(itens, 2026, 9)).toEqual({ prazos: 1, audiencias: 1 })
  })

  it('itensDoDia ordena por hora e poe dia inteiro no fim', () => {
    const itens = [
      { id: 1, titulo: 'B', data_vencimento: HOJE },
      { id: 2, titulo: 'C', data_inicio: `${HOJE}T15:00:00` },
      { id: 3, titulo: 'A', data_inicio: `${HOJE}T09:00:00` },
      { id: 4, titulo: 'X', data_vencimento: '2026-09-09' },
    ]
    expect(itensDoDia(itens, HOJE).map((i) => i.id)).toEqual([3, 2, 1])
  })
})

describe('agendaHelpers — caso e tribunal', () => {
  const CASOS = [
    {
      id: 7,
      titulo: 'Cobrança Banco Alfa',
      numero_processo: '0001234-56.2026.8.16.0001',
      parte_contraria: 'Banco Alfa S.A.',
      cliente: { id: 1, nome_razao_social: 'Maria Silva' },
    },
  ]

  it('resolverCaso monta "cliente × parte" e numero do processo', () => {
    const r = resolverCaso({ caso_id: 7 }, CASOS)
    expect(r.partes).toBe('Maria Silva × Banco Alfa S.A.')
    expect(r.numeroProcesso).toBe('0001234-56.2026.8.16.0001')
  })

  it('resolverCaso cai pro titulo do caso sem cliente', () => {
    const r = resolverCaso({ caso_id: 9 }, [{ id: 9, titulo: 'Inventário' }])
    expect(r.partes).toBe('Inventário')
    expect(r.numeroProcesso).toBeNull()
  })

  it('siglaTribunalDoNumero deduz TJPR / TRT9 do CNJ', () => {
    expect(siglaTribunalDoNumero('0001234-56.2026.8.16.0001')).toBe('TJPR')
    expect(siglaTribunalDoNumero('0010542-88.2026.5.09.0012')).toBe('TRT9')
    expect(siglaTribunalDoNumero('abc')).toBeNull()
  })

  it('destinoTribunalDoItem: portal mapeado ou null', () => {
    expect(destinoTribunalDoItem({ caso_id: 7 }, CASOS)).toMatchObject({
      nome: 'Projudi/TJPR',
      numeroProcesso: '0001234-56.2026.8.16.0001',
    })
    expect(destinoTribunalDoItem({ caso_id: 99 }, CASOS)).toBeNull()
  })
})
