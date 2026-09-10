import { describe, it, expect } from 'vitest'
import { clienteCompleto, derivarChecklist, temProcuracao } from './checklistCaso.js'

describe('checklistCaso — clienteCompleto', () => {
  it('exige CPF/CNPJ real e endereço mínimo', () => {
    expect(clienteCompleto(null)).toBe(false)
    expect(clienteCompleto({ cpf_cnpj: '123', cidade: 'Curitiba' })).toBe(true)
    expect(clienteCompleto({ cpf_cnpj: '123' })).toBe(false)
    expect(clienteCompleto({ cpf_cnpj: 'DJEN-1', dados_pendentes: true, cidade: 'X' })).toBe(false)
    expect(clienteCompleto({ cpf_cnpj: '', cep: '80000-000' })).toBe(false)
  })
})

describe('checklistCaso — temProcuracao', () => {
  it('conta ProcuracaoAnalise ou documento cujo nome cita procuração', () => {
    expect(temProcuracao({ procuracoes: [{ id: 1 }], documentos: [] })).toBe(true)
    expect(
      temProcuracao({ procuracoes: [], documentos: [{ nome_arquivo: 'Procuracao.pdf' }] })
    ).toBe(true)
    expect(temProcuracao({ procuracoes: [], documentos: [{ nome_arquivo: 'inicial.pdf' }] })).toBe(
      false
    )
    expect(temProcuracao()).toBe(false)
  })
})

describe('checklistCaso — derivarChecklist', () => {
  it('só inclui itens cujas fontes foram carregadas', () => {
    expect(derivarChecklist({})).toEqual([])
    const so = derivarChecklist({ contratos: [], casoId: 1 })
    expect(so.map((i) => i.id)).toEqual(['contrato'])
    expect(so[0].concluido).toBe(false)
    expect(so[0].acao).toEqual({ tipo: 'botao', id: 'contrato', label: 'Criar' })
  })

  it('deriva os 4 itens quando tudo está disponível', () => {
    const itens = derivarChecklist({
      casoId: 5,
      cliente: { id: 7, cpf_cnpj: '000', cidade: 'Curitiba' },
      procuracoes: [{ id: 1 }],
      documentos: [],
      contratos: [{ id: 3 }],
      proximoPasso: { id: 9, peticao_cumpridora_id: null },
    })
    expect(itens.map((i) => [i.id, i.concluido])).toEqual([
      ['procuracao', true],
      ['cliente', true],
      ['peca', false],
      ['contrato', true],
    ])
    expect(itens[0].acao.to).toBe('/casos/detalhe/5?tab=historico')
    expect(itens[1].acao.to).toBe('/clientes/editar/7')
    expect(itens[2].acao).toEqual({ tipo: 'botao', id: 'responder', label: 'Vincular' })
  })

  it('peça vinculada conta como concluída', () => {
    const itens = derivarChecklist({ proximoPasso: { id: 1, peticao_cumpridora_id: 42 } })
    expect(itens).toHaveLength(1)
    expect(itens[0].concluido).toBe(true)
  })
})
