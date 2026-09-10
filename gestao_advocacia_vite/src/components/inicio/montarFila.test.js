import { describe, expect, it } from 'vitest'
import { listarTribunais, montarFila, saudacaoPorHora } from './montarFila.js'

const AGORA = new Date(2026, 8, 8, 9, 0, 0) // 08/09/2026 09:00 local

describe('montarFila', () => {
  it('retorna vazio sem payload', () => {
    expect(montarFila(null)).toEqual({ pendentes: [], concluidas: [] })
  })

  it('ordena por urgencia (vencido -> hoje -> semana) e por fonte dentro dela', () => {
    const { pendentes } = montarFila(
      {
        resumo: { financeiro_vencido: { quantidade: 2, valor_total: 1500 } },
        fila_intimacoes_por_tribunal: [
          { tribunal: 'TJPR', quantidade: 3 },
          { tribunal: 'TRT9', quantidade: 1 },
        ],
        tarefas_prioritarias: [
          {
            id: 1,
            titulo: 'Juntar procuração',
            urgencia: 'proximo',
            data_vencimento: '2026-09-11T12:00:00',
            caso_titulo: 'Ação trabalhista',
          },
          {
            id: 2,
            titulo: 'Contestar',
            urgencia: 'vencido',
            data_vencimento: '2026-09-05T12:00:00',
            caso_titulo: 'Silva × Banco Alfa',
            numero_processo: '0001234-56.2026.8.16.0001',
            tribunal: 'TJPR',
          },
          {
            id: 3,
            titulo: 'Prazo distante',
            urgencia: 'proximo',
            data_vencimento: '2026-10-20T12:00:00',
          },
        ],
        eventos_hoje: [{ id: 9, titulo: 'audiência', data_inicio: '2026-09-08T14:00:00' }],
      },
      AGORA
    )

    expect(pendentes.map((linha) => linha.chave)).toEqual([
      'tarefa-2',
      'financeiro',
      'intimacao-TJPR',
      'intimacao-TRT9',
      'evento-9',
      'tarefa-1',
    ])
    // Alem de 7 dias nao entra na fila de hoje.
    expect(pendentes.find((linha) => linha.chave === 'tarefa-3')).toBeUndefined()
  })

  it('escreve cada linha como instrucao com detalhe e uma acao', () => {
    const { pendentes } = montarFila(
      {
        fila_intimacoes_por_tribunal: [{ tribunal: 'TJPR', quantidade: 1 }],
        tarefas_prioritarias: [
          {
            id: 2,
            titulo: 'Contestar',
            urgencia: 'vencido',
            data_vencimento: '2026-09-05T12:00:00',
            caso_titulo: 'Silva × Banco Alfa',
            numero_processo: '0001234-56.2026.8.16.0001',
            tribunal: 'TJPR',
          },
        ],
        eventos_hoje: [
          { id: 9, titulo: 'audiência una', data_inicio: '2026-09-08T14:00:00', tribunal: 'TRT9' },
        ],
      },
      AGORA
    )

    const [tarefa, intimacao, evento] = pendentes
    expect(tarefa.titulo).toBe('Contestar — Silva × Banco Alfa')
    expect(tarefa.detalhe).toBe('0001234-56.2026.8.16.0001 · TJPR · venceu 05/09')
    expect(tarefa.acao).toMatchObject({
      tipo: 'tribunal',
      rotulo: 'Abrir no tribunal',
      precisaColar: true,
      numeroProcesso: '0001234-56.2026.8.16.0001',
    })
    expect(tarefa.acao.url).toContain('tjpr.jus.br')

    expect(intimacao.titulo).toBe('Tratar 1 publicação nova do TJPR')
    expect(intimacao.acao).toEqual({
      tipo: 'navegar',
      rotulo: 'Tratar',
      destino: '/djen?tribunal=TJPR',
    })

    expect(evento.titulo).toBe('Confirmar audiência una')
    expect(evento.detalhe).toBe('Hoje às 14:00 · TRT9')
    expect(evento.acao).toEqual({ tipo: 'navegar', rotulo: 'Abrir', destino: '/agenda' })
  })

  it('usa o link oficial da publicacao quando existe', () => {
    const { pendentes } = montarFila(
      {
        tarefas_prioritarias: [
          {
            id: 5,
            titulo: 'Manifestar',
            urgencia: 'hoje',
            data_vencimento: '2026-09-08T12:00:00',
            numero_processo: '0001234-56.2026.8.16.0001',
            tribunal: 'TJPR',
            link_publicacao: 'https://comunica.pje.jus.br/consulta?id=1',
          },
        ],
      },
      AGORA
    )
    expect(pendentes[0].acao).toMatchObject({
      tipo: 'tribunal',
      url: 'https://comunica.pje.jus.br/consulta?id=1',
      precisaColar: false,
    })
    expect(pendentes[0].detalhe).toBe('0001234-56.2026.8.16.0001 · TJPR · vence hoje')
  })

  it('cai em "Concluir" quando nao ha para onde ir no tribunal', () => {
    const { pendentes } = montarFila(
      {
        tarefas_prioritarias: [
          { id: 6, titulo: 'Ligar para cliente', urgencia: 'hoje', data_vencimento: null },
          {
            id: 7,
            titulo: 'Sem portal',
            urgencia: 'proximo',
            data_vencimento: '2026-09-10T12:00:00',
            numero_processo: '0000001-00.2026.8.99.0001',
            tribunal: 'TJXX',
          },
        ],
      },
      AGORA
    )
    expect(pendentes[0].acao).toEqual({ tipo: 'concluir', rotulo: 'Concluir', itemId: 6 })
    expect(pendentes[1].acao).toEqual({ tipo: 'concluir', rotulo: 'Concluir', itemId: 7 })
    expect(pendentes[1].urgencia).toBe('semana')
  })

  it('mapeia resolvidas de hoje como concluidas', () => {
    const { concluidas } = montarFila({
      resolvidas_hoje: [
        { id: 1, titulo: 'Contestação protocolada', tipo: 'tarefa' },
        { id: 2, titulo: 'Intimação TJPR', tipo: 'publicacao' },
      ],
    })
    expect(concluidas).toEqual([
      {
        chave: 'resolvida-tarefa-1',
        fonte: 'tarefa',
        titulo: 'Contestação protocolada',
        detalhe: 'Prazo cumprido',
      },
      {
        chave: 'resolvida-publicacao-2',
        fonte: 'publicacao',
        titulo: 'Intimação TJPR',
        detalhe: 'Publicação tratada',
      },
    ])
  })
})

describe('saudacaoPorHora', () => {
  it('escolhe pela hora local', () => {
    expect(saudacaoPorHora(6)).toBe('Bom dia')
    expect(saudacaoPorHora(11)).toBe('Bom dia')
    expect(saudacaoPorHora(12)).toBe('Boa tarde')
    expect(saudacaoPorHora(17)).toBe('Boa tarde')
    expect(saudacaoPorHora(18)).toBe('Boa noite')
    expect(saudacaoPorHora(23)).toBe('Boa noite')
  })
})

describe('listarTribunais', () => {
  it('junta com virgula e "e"', () => {
    expect(listarTribunais([])).toBe('')
    expect(listarTribunais(['TJPR'])).toBe('TJPR')
    expect(listarTribunais(['TJPR', 'TRT9'])).toBe('TJPR e TRT9')
    expect(listarTribunais(['TJPR', 'TRT9', 'STJ'])).toBe('TJPR, TRT9 e STJ')
  })
})
