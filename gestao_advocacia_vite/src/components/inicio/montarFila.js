// Monta a "Sua fila de hoje" a partir do payload de GET /dashboard/home.
//
// Regras (spec Stitch 2026-09, TELA 1):
//   - UMA lista, ordenada por urgencia: vencido -> hoje -> esta semana.
//   - Cada linha e uma INSTRUCAO ("Tratar 3 publicacoes novas do TJPR").
//   - Uma unica acao por linha; quem decide qual botao e esta funcao.
//   - Concluidas de hoje ficam no fim, riscadas.
//
// Funcao pura: nada de React aqui, para ser testavel sem render.

import { destinoNoTribunal } from '../../utils/linkTribunal.js'

export const MAX_LINHAS_FILA = 7

const PESO_URGENCIA = { vencido: 0, hoje: 1, semana: 2 }
// Dentro da mesma urgencia: intimacoes primeiro (chegaram hoje e destravam
// o resto), depois prazos, eventos e, por ultimo, financeiro.
const PESO_FONTE = { intimacao: 0, tarefa: 1, evento: 2, financeiro: 3 }

const DIA_MS = 24 * 60 * 60 * 1000

const formatarDia = (valor) => {
  if (!valor) return ''
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(data)
}

const formatarHora = (valor) => {
  if (!valor) return ''
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(data)
}

const formatarMoeda = (valor) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(valor || 0)

const plural = (n, singular, pluralForma) => `${n} ${n === 1 ? singular : pluralForma}`

const juntarDetalhe = (partes) => partes.filter(Boolean).join(' · ')

/** Dias corridos entre hoje (00:00 local) e a data informada. */
const diasAteVencimento = (valor, agora) => {
  if (!valor) return null
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return null
  const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())
  const inicioData = new Date(data.getFullYear(), data.getMonth(), data.getDate())
  return Math.round((inicioData - inicioHoje) / DIA_MS)
}

function linhaIntimacao(grupo) {
  const n = grupo.quantidade || 0
  const tribunal = grupo.tribunal || 'DJEN'
  return {
    chave: `intimacao-${tribunal}`,
    fonte: 'intimacao',
    urgencia: 'hoje',
    titulo: `Tratar ${plural(n, 'publicação nova', 'publicações novas')} do ${tribunal}`,
    detalhe: juntarDetalhe([tribunal, `${n === 1 ? 'aguarda' : 'aguardam'} sua decisão no DJEN`]),
    acao: {
      tipo: 'navegar',
      rotulo: 'Tratar',
      destino: `/djen?tribunal=${encodeURIComponent(tribunal)}`,
    },
  }
}

function linhaTarefa(tarefa, agora) {
  const urgencia =
    tarefa.urgencia === 'vencido' ? 'vencido' : tarefa.urgencia === 'hoje' ? 'hoje' : 'semana'
  const dia = formatarDia(tarefa.data_vencimento)
  const vencimento =
    urgencia === 'vencido' ? `venceu ${dia}` : urgencia === 'hoje' ? 'vence hoje' : `vence ${dia}`

  const destino = destinoNoTribunal({
    link: tarefa.link_publicacao,
    sigla_tribunal: tarefa.tribunal,
  })
  const temProcesso = Boolean(tarefa.numero_processo || tarefa.link_publicacao)

  const acao =
    temProcesso && destino
      ? {
          tipo: 'tribunal',
          rotulo: 'Abrir no tribunal',
          url: destino.url,
          nomePortal: destino.nome,
          precisaColar: destino.precisaColar,
          numeroProcesso: tarefa.numero_processo || '',
        }
      : { tipo: 'concluir', rotulo: 'Concluir', itemId: tarefa.id }

  return {
    chave: `tarefa-${tarefa.id}`,
    fonte: 'tarefa',
    urgencia,
    diasAte: diasAteVencimento(tarefa.data_vencimento, agora),
    titulo: tarefa.caso_titulo ? `${tarefa.titulo} — ${tarefa.caso_titulo}` : tarefa.titulo,
    numeroProcesso: tarefa.numero_processo || '',
    detalhe: juntarDetalhe([tarefa.numero_processo, tarefa.tribunal, vencimento]),
    acao,
  }
}

function linhaEvento(evento) {
  const hora = formatarHora(evento.data_inicio)
  return {
    chave: `evento-${evento.id}`,
    fonte: 'evento',
    urgencia: 'hoje',
    titulo: `Confirmar ${evento.titulo}`,
    numeroProcesso: evento.numero_processo || '',
    detalhe: juntarDetalhe([
      hora ? `Hoje às ${hora}` : 'Hoje',
      evento.caso_titulo,
      evento.numero_processo,
      evento.tribunal,
    ]),
    acao: { tipo: 'navegar', rotulo: 'Abrir', destino: '/agenda' },
  }
}

function linhaFinanceiro(financeiro) {
  const n = financeiro.quantidade || 0
  return {
    chave: 'financeiro',
    fonte: 'financeiro',
    urgencia: 'vencido',
    titulo: plural(n, 'lançamento vencido', 'lançamentos vencidos'),
    detalhe: `${formatarMoeda(financeiro.valor_total)} em atraso`,
    acao: { tipo: 'navegar', rotulo: 'Ver', destino: '/financeiro' },
  }
}

function linhaConcluida(resolvida) {
  const rotulos = {
    tarefa: 'Prazo cumprido',
    evento: 'Evento realizado',
    publicacao: 'Publicação tratada',
  }
  return {
    chave: `resolvida-${resolvida.tipo}-${resolvida.id}`,
    fonte: resolvida.tipo,
    titulo: resolvida.titulo,
    detalhe: rotulos[resolvida.tipo] || 'Resolvido hoje',
  }
}

const ordenar = (a, b) =>
  PESO_URGENCIA[a.urgencia] - PESO_URGENCIA[b.urgencia] ||
  PESO_FONTE[a.fonte] - PESO_FONTE[b.fonte] ||
  (a.diasAte ?? 0) - (b.diasAte ?? 0)

/**
 * @param {object|null} dados payload de /dashboard/home
 * @param {Date} [agora]
 * @returns {{ pendentes: object[], concluidas: object[] }}
 *   `pendentes` ja vem ordenada e SEM corte (quem corta em 7 e a tela; a
 *   saudacao usa o total real).
 */
export function montarFila(dados, agora = new Date()) {
  if (!dados) return { pendentes: [], concluidas: [] }

  const pendentes = []

  ;(dados.fila_intimacoes_por_tribunal || [])
    .filter((grupo) => (grupo.quantidade || 0) > 0)
    .forEach((grupo) => pendentes.push(linhaIntimacao(grupo)))
  ;(dados.tarefas_prioritarias || [])
    .map((tarefa) => linhaTarefa(tarefa, agora))
    // "Esta semana" = ate 7 dias; alem disso nao e fila de hoje.
    .filter((linha) => linha.diasAte === null || linha.diasAte <= 7)
    .forEach((linha) => pendentes.push(linha))
  ;(dados.eventos_hoje || []).forEach((evento) => pendentes.push(linhaEvento(evento)))

  const financeiro = dados.resumo?.financeiro_vencido
  if (financeiro && (financeiro.quantidade || 0) > 0) {
    pendentes.push(linhaFinanceiro(financeiro))
  }

  pendentes.sort(ordenar)

  const concluidas = (dados.resolvidas_hoje || []).map(linhaConcluida)

  return { pendentes, concluidas }
}

export const saudacaoPorHora = (hora) => {
  if (hora < 12) return 'Bom dia'
  if (hora < 18) return 'Boa tarde'
  return 'Boa noite'
}

/** "TJPR, TRT9 e STJ" */
export const listarTribunais = (siglas) => {
  const lista = (siglas || []).filter(Boolean)
  if (lista.length === 0) return ''
  if (lista.length === 1) return lista[0]
  return `${lista.slice(0, -1).join(', ')} e ${lista[lista.length - 1]}`
}
