import { describe, expect, it } from 'vitest'
import {
  agruparPorColuna,
  aplicarReorderEmTarefas,
  calcularReorder,
  localizarColuna,
} from './kanbanReorder.js'

const COLUNAS = ['A Fazer', 'Fazendo', 'Concluído']

const fixtureTarefas = () => [
  { id: 1, status: 'A Fazer', posicao: 1, titulo: 't1' },
  { id: 2, status: 'A Fazer', posicao: 2, titulo: 't2' },
  { id: 3, status: 'A Fazer', posicao: 3, titulo: 't3' },
  { id: 4, status: 'Fazendo', posicao: 1, titulo: 't4' },
]

describe('agruparPorColuna', () => {
  it('separa tarefas pelas colunas conhecidas preservando ordem', () => {
    const grupos = agruparPorColuna(fixtureTarefas(), COLUNAS)
    expect(grupos).toEqual({
      'A Fazer': [1, 2, 3],
      Fazendo: [4],
      Concluído: [],
    })
  })

  it('ignora tarefas com status fora da lista', () => {
    const tarefas = [{ id: 9, status: 'Arquivada', posicao: 1 }]
    expect(agruparPorColuna(tarefas, COLUNAS)).toEqual({
      'A Fazer': [],
      Fazendo: [],
      Concluído: [],
    })
  })
})

describe('localizarColuna', () => {
  it('retorna a propria string quando id eh nome de coluna', () => {
    expect(localizarColuna('Fazendo', [], COLUNAS)).toBe('Fazendo')
  })

  it('retorna o status da tarefa quando id eh numero', () => {
    expect(localizarColuna(2, fixtureTarefas(), COLUNAS)).toBe('A Fazer')
  })

  it('retorna null para id desconhecido', () => {
    expect(localizarColuna(999, fixtureTarefas(), COLUNAS)).toBeNull()
    expect(localizarColuna(null, fixtureTarefas(), COLUNAS)).toBeNull()
  })
})

describe('calcularReorder', () => {
  const grupos = () => ({
    'A Fazer': [1, 2, 3],
    Fazendo: [4],
    Concluído: [],
  })

  it('reordena dentro da mesma coluna', () => {
    const r = calcularReorder({
      grupos: grupos(),
      colunasIds: COLUNAS,
      activeId: 3,
      overId: 1,
      tarefas: fixtureTarefas(),
    })
    expect(r.novosGrupos['A Fazer']).toEqual([3, 1, 2])
    expect(r.payload).toEqual({ 'A Fazer': [3, 1, 2] })
  })

  it('move card entre colunas inserindo antes do over', () => {
    const r = calcularReorder({
      grupos: grupos(),
      colunasIds: COLUNAS,
      activeId: 1,
      overId: 4,
      tarefas: fixtureTarefas(),
    })
    expect(r.novosGrupos['A Fazer']).toEqual([2, 3])
    expect(r.novosGrupos['Fazendo']).toEqual([1, 4])
    expect(r.payload).toEqual({ 'A Fazer': [2, 3], Fazendo: [1, 4] })
  })

  it('move card para coluna vazia (drop sobre o id da coluna)', () => {
    const r = calcularReorder({
      grupos: grupos(),
      colunasIds: COLUNAS,
      activeId: 2,
      overId: 'Concluído',
      tarefas: fixtureTarefas(),
    })
    expect(r.novosGrupos['A Fazer']).toEqual([1, 3])
    expect(r.novosGrupos['Concluído']).toEqual([2])
    expect(r.payload).toEqual({ 'A Fazer': [1, 3], Concluído: [2] })
  })

  it('retorna null quando origem == destino e nada muda', () => {
    const r = calcularReorder({
      grupos: grupos(),
      colunasIds: COLUNAS,
      activeId: 1,
      overId: 1,
      tarefas: fixtureTarefas(),
    })
    expect(r).toBeNull()
  })

  it('retorna null quando over eh ausente ou desconhecido', () => {
    expect(
      calcularReorder({
        grupos: grupos(),
        colunasIds: COLUNAS,
        activeId: 1,
        overId: null,
        tarefas: fixtureTarefas(),
      })
    ).toBeNull()
    expect(
      calcularReorder({
        grupos: grupos(),
        colunasIds: COLUNAS,
        activeId: 1,
        overId: 999,
        tarefas: fixtureTarefas(),
      })
    ).toBeNull()
  })
})

describe('aplicarReorderEmTarefas', () => {
  it('atualiza status e posicao em sequencia', () => {
    const novosGrupos = {
      'A Fazer': [3, 1, 2],
      Fazendo: [4],
      Concluído: [],
    }
    const lista = aplicarReorderEmTarefas(fixtureTarefas(), novosGrupos, COLUNAS)
    const porId = Object.fromEntries(lista.map((t) => [t.id, t]))
    expect(porId[3]).toMatchObject({ status: 'A Fazer', posicao: 1 })
    expect(porId[1]).toMatchObject({ status: 'A Fazer', posicao: 2 })
    expect(porId[2]).toMatchObject({ status: 'A Fazer', posicao: 3 })
    expect(porId[4]).toMatchObject({ status: 'Fazendo', posicao: 1 })
  })

  it('move tarefa entre colunas atualizando o status', () => {
    const novosGrupos = {
      'A Fazer': [2, 3],
      Fazendo: [1, 4],
      Concluído: [],
    }
    const lista = aplicarReorderEmTarefas(fixtureTarefas(), novosGrupos, COLUNAS)
    const porId = Object.fromEntries(lista.map((t) => [t.id, t]))
    expect(porId[1]).toMatchObject({ status: 'Fazendo', posicao: 1 })
    expect(porId[4]).toMatchObject({ status: 'Fazendo', posicao: 2 })
  })

  it('preserva tarefas com status fora das colunas conhecidas', () => {
    const tarefas = [
      ...fixtureTarefas(),
      { id: 99, status: 'Arquivada', posicao: 1, titulo: 'arquivo' },
    ]
    const lista = aplicarReorderEmTarefas(
      tarefas,
      { 'A Fazer': [1, 2, 3], Fazendo: [4], Concluído: [] },
      COLUNAS
    )
    expect(lista.find((t) => t.id === 99)).toMatchObject({ status: 'Arquivada', posicao: 1 })
  })
})
