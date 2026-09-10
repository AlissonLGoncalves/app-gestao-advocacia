// Redesign Stitch (TELA 3) — checklist "O que falta", DERIVADO de dados reais.
//
// Cada item só entra quando a API devolve o dado que permite decidir
// (nada de checkbox manual). Concluído = check verde riscado; pendente =
// caixa vazia com a ação que resolve (link de rota ou botão da página).
//
// Fontes:
//   - procuracoes/documentos: GET /casos/{id}/documentos (ProcuracaoAnalise)
//     + GET /documentos?caso_id (arquivo cujo nome cita "procuração")
//   - cliente: GET /clientes/{id} (cpf_cnpj real + endereço mínimo)
//   - proximoPasso: ItemAgenda.peticao_cumpridora_id
//   - contratos: GET /casos/{id}/documentos (ContratoHonorario)

const RE_PROCURACAO = /procura[cç][aã]o/i

export function clienteCompleto(cliente) {
  if (!cliente) return false
  const doc = String(cliente.cpf_cnpj || '').trim()
  const temDoc = !!doc && !cliente.dados_pendentes
  const temEndereco = !!(cliente.cep || cliente.rua || cliente.cidade)
  return temDoc && temEndereco
}

export function temProcuracao({ procuracoes = [], documentos = [] } = {}) {
  if (Array.isArray(procuracoes) && procuracoes.length > 0) return true
  return (Array.isArray(documentos) ? documentos : []).some((d) =>
    RE_PROCURACAO.test(d?.nome_arquivo || d?.titulo || '')
  )
}

/**
 * @param {object} ctx
 * @param {object|undefined} ctx.cliente — undefined = ainda não carregado (item omitido)
 * @param {Array|undefined} ctx.procuracoes
 * @param {Array|undefined} ctx.contratos
 * @param {Array|undefined} ctx.documentos
 * @param {object|null} ctx.proximoPasso
 * @param {number|string} ctx.casoId
 * @returns {Array<{id, label, concluido, acao: {tipo:'link', to, label} | {tipo:'botao', id, label}}>}
 */
export function derivarChecklist({
  cliente,
  procuracoes,
  contratos,
  documentos,
  proximoPasso,
  casoId,
} = {}) {
  const itens = []
  const docsCarregados = Array.isArray(procuracoes) || Array.isArray(documentos)

  if (docsCarregados) {
    itens.push({
      id: 'procuracao',
      label: 'Procuração no processo',
      concluido: temProcuracao({ procuracoes, documentos }),
      acao: {
        tipo: 'link',
        to: `/casos/detalhe/${casoId}?tab=historico`,
        label: 'Anexar',
      },
    })
  }

  if (cliente !== undefined) {
    itens.push({
      id: 'cliente',
      label: 'Cliente com CPF/CNPJ e endereço',
      concluido: clienteCompleto(cliente),
      acao: cliente?.id
        ? { tipo: 'link', to: `/clientes/editar/${cliente.id}`, label: 'Completar' }
        : { tipo: 'link', to: '/clientes', label: 'Completar' },
    })
  }

  if (proximoPasso) {
    itens.push({
      id: 'peca',
      label: 'Peça vinculada ao prazo',
      concluido: !!proximoPasso.peticao_cumpridora_id,
      acao: { tipo: 'botao', id: 'responder', label: 'Vincular' },
    })
  }

  if (Array.isArray(contratos)) {
    itens.push({
      id: 'contrato',
      label: 'Contrato de honorários',
      concluido: contratos.length > 0,
      acao: { tipo: 'botao', id: 'contrato', label: 'Criar' },
    })
  }

  return itens
}
