// Redesign Stitch (TELA 3) — regras puras do card "Próximo passo".
//
// O card responde "o que fazer agora" a partir dos itens de agenda do caso:
// pega o PRÓXIMO item em aberto (incluindo vencidos), traduz a providência
// detectada pelo calculador de prazo em verbo de ação e calcula o decurso.
// Sem React aqui pra ficar testável e reutilizável.

import { getProvidencia } from '../../utils/providencia.js'

const STATUS_FECHADOS = new Set(['Concluido', 'Concluído', 'Cancelado'])

// Verbo de ação por providência (backend djen_prazo_calculator._REGRAS).
// Regras não mapeadas caem no label genérico de utils/providencia.js.
const ACAO_POR_PROVIDENCIA = {
  contestacao_15d: 'Apresentar contestação',
  recurso_15d: 'Interpor recurso',
  cumprimento_sentenca_15d: 'Cumprir a sentença',
  manifestacao_15d: 'Apresentar manifestação',
  audiencia_7d: 'Comparecer à audiência',
  embargos_declaracao_5d: 'Opor embargos de declaração',
  sentenca_revisao_15d: 'Analisar a sentença',
  decisao_despacho_5d: 'Cumprir decisão ou despacho',
  fallback_conservador_5d: 'Verificar providência',
}

export function itemEmAberto(item) {
  return !!item && !STATUS_FECHADOS.has(item.status)
}

/** Data ISO (YYYY-MM-DD ou datetime) -> Date ao meio-dia local (evita off-by-one). */
export function dataLocal(iso) {
  if (!iso) return null
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Dias entre hoje e a data (negativo = vencido). `hoje` injetável pra teste. */
export function diasAte(iso, hoje = new Date()) {
  const alvo = dataLocal(iso)
  if (!alvo) return null
  const base = new Date(hoje)
  base.setHours(12, 0, 0, 0)
  return Math.round((alvo.getTime() - base.getTime()) / 86400000)
}

export function formatDataBR(iso) {
  const d = dataLocal(iso)
  return d ? d.toLocaleDateString('pt-BR') : ''
}

/**
 * Próximo item em aberto do caso: ordena por vencimento crescente (vencidos
 * vêm primeiro, naturalmente). Itens sem data ficam por último — só entram se
 * não houver nenhum com data.
 */
export function selecionarProximoPasso(itens = []) {
  const abertos = (Array.isArray(itens) ? itens : []).filter(itemEmAberto)
  if (!abertos.length) return null
  const ordenados = [...abertos].sort((a, b) => {
    if (!a.data_vencimento && !b.data_vencimento) return 0
    if (!a.data_vencimento) return 1
    if (!b.data_vencimento) return -1
    return String(a.data_vencimento).localeCompare(String(b.data_vencimento))
  })
  return ordenados[0]
}

/** "Apresentar contestação" a partir da providência; sem providência, o título. */
export function acaoDoItem(item) {
  if (!item) return ''
  const acao = ACAO_POR_PROVIDENCIA[item.tipo_providencia]
  if (acao) return acao
  const prov = getProvidencia(item.tipo_providencia)
  if (prov && item.tipo_providencia) return prov.label
  return item.titulo || 'Tarefa sem título'
}

/** Nome da peça cabível (ex.: "Contestação") ou null quando não há providência. */
export function pecaCabivelDoItem(item) {
  if (!item?.tipo_providencia) return null
  const prov = getProvidencia(item.tipo_providencia)
  return prov?.label || null
}

/**
 * Chip de urgência: { texto, tom } com tom em 'danger' | 'warning' | 'primary' | 'muted'.
 */
export function chipVencimento(dias) {
  if (dias === null || dias === undefined) return { texto: 'sem data', tom: 'muted' }
  if (dias < 0) {
    const n = Math.abs(dias)
    return { texto: `vencido há ${n} dia${n === 1 ? '' : 's'}`, tom: 'danger' }
  }
  if (dias === 0) return { texto: 'hoje', tom: 'warning' }
  if (dias === 1) return { texto: 'amanhã', tom: 'warning' }
  return { texto: `em ${dias} dias`, tom: dias <= 7 ? 'primary' : 'muted' }
}

/**
 * Decurso do prazo: { atual, total, pct } quando o item tem prazo_dias_origem
 * e vencimento. Aproximação em dias corridos (a barra é só um indicador visual;
 * a contagem oficial vive no calculador do backend).
 */
export function decursoPrazo(item, hoje = new Date()) {
  const total = Number(item?.prazo_dias_origem)
  if (!item || !Number.isFinite(total) || total <= 0) return null
  const dias = diasAte(item.data_vencimento, hoje)
  if (dias === null) return null
  const atual = Math.min(total, Math.max(0, total - dias))
  return { atual, total, pct: Math.round((atual / total) * 100) }
}
