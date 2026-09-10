// src/components/agenda/agendaHelpers.js
// Helpers puros da Agenda (redesign Stitch, set/2026). Sem React, sem
// fetch — so calculo de datas, classificacao e resolucao de dados do caso.
//
// Vocabulario:
//   - urgencia: 'vencido' | 'hoje' | 'semana' | 'normal' | 'concluido' | 'cancelado'
//   - chip:     'todos' | 'prazos' | 'audiencias' | 'tarefas'
import { parseCNJ } from '../../utils/cnj.js'
import { portalDoTribunal } from '../../utils/linkTribunal.js'

/** Chips de filtro por familia (CabecalhoMes e Lista). */
export const CHIPS = [
  { key: 'todos', label: 'Todos' },
  { key: 'prazos', label: 'Prazos' },
  { key: 'audiencias', label: 'Audiências' },
  { key: 'tarefas', label: 'Tarefas' },
]

/** Visoes validas da Agenda (?view=). */
export const VIEW_KEYS = ['hoje', 'calendario', 'kanban', 'lista']

export const MESES_PT = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

const pad2 = (n) => String(n).padStart(2, '0')

/** Date local -> 'YYYY-MM-DD' (sem fuso). */
export function ymdLocal(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function hojeYmd() {
  return ymdLocal(new Date())
}

/** 'YYYY-MM-DD' + n dias -> 'YYYY-MM-DD'. */
export function somarDias(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + n)
  return ymdLocal(dt)
}

/** Dias inteiros entre dois 'YYYY-MM-DD' (b - a). */
export function diasEntre(a, b) {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((new Date(by, bm - 1, bd) - new Date(ay, am - 1, ad)) / 86400000)
}

/** Data de referencia do item (ISO ou 'YYYY-MM-DD') — evento usa inicio, tarefa usa vencimento. */
export function dataDoItem(item) {
  if (!item) return null
  return item.data_inicio || item.data_vencimento || null
}

/** 'YYYY-MM-DD' do item ou null. Le direto da string pra nao sofrer com fuso. */
export function ymdDoItem(item) {
  const raw = dataDoItem(item)
  if (!raw) return null
  const s = String(raw).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

/** 'HH:MM' quando o item tem hora; null quando e dia inteiro. */
export function horaDoItem(item) {
  const raw = dataDoItem(item)
  if (!raw || !String(raw).includes('T')) return null
  const hhmm = String(raw).slice(11, 16)
  return /^\d{2}:\d{2}$/.test(hhmm) ? hhmm : null
}

export function ehAudiencia(item) {
  return item?.categoria === 'Audiencia' || item?.tipo_providencia === 'audiencia_7d'
}

export function ehPrazo(item) {
  if (ehAudiencia(item)) return false
  return item?.categoria === 'Prazo' || item?.categoria === 'Peticionamento'
}

/** Classifica o item em uma das 4 famílias do chip de filtro. */
export function familiaDoItem(item) {
  if (ehAudiencia(item)) return 'audiencias'
  if (ehPrazo(item)) return 'prazos'
  return 'tarefas'
}

export function filtrarPorChip(itens, chip) {
  if (!chip || chip === 'todos') return itens
  return itens.filter((i) => familiaDoItem(i) === chip)
}

/** Urgencia visual do item relativa a `hoje` ('YYYY-MM-DD'). */
export function urgenciaDoItem(item, hoje = hojeYmd()) {
  if (!item) return 'normal'
  if (item.status === 'Concluido' || item.status === 'Concluído') return 'concluido'
  if (item.status === 'Cancelado') return 'cancelado'
  const d = ymdDoItem(item)
  if (!d) return 'normal'
  const diff = diasEntre(hoje, d)
  if (diff < 0) return 'vencido'
  if (diff === 0) return 'hoje'
  if (diff <= 7) return 'semana'
  return 'normal'
}

/** Itens de um dia, ordenados: com hora primeiro (por hora), depois dia inteiro. */
export function itensDoDia(itens, ymd) {
  return (itens || [])
    .filter((i) => ymdDoItem(i) === ymd)
    .sort((a, b) => {
      const ha = horaDoItem(a)
      const hb = horaDoItem(b)
      if (ha && hb) return ha.localeCompare(hb)
      if (ha) return -1
      if (hb) return 1
      return String(a.titulo || '').localeCompare(String(b.titulo || ''), 'pt-BR')
    })
}

/** Contagem de prazos e audiencias num mes (ano numerico, mes 1-12). */
export function contarMes(itens, ano, mes) {
  const prefixo = `${ano}-${pad2(mes)}`
  let prazos = 0
  let audiencias = 0
  for (const i of itens || []) {
    const d = ymdDoItem(i)
    if (!d || !d.startsWith(prefixo)) continue
    if (ehAudiencia(i)) audiencias += 1
    else if (ehPrazo(i)) prazos += 1
  }
  return { prazos, audiencias }
}

/** 'Setembro 2026' a partir de um Date. */
export function tituloMes(d) {
  const nome = MESES_PT[d.getMonth()]
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} ${d.getFullYear()}`
}

/** '8 de setembro' a partir de 'YYYY-MM-DD'. */
export function tituloDia(ymd) {
  if (!ymd) return ''
  const [, m, d] = ymd.split('-').map(Number)
  return `${d} de ${MESES_PT[m - 1]}`
}

/** 'Segunda-feira' a partir de 'YYYY-MM-DD'. */
export function diaDaSemana(ymd) {
  if (!ymd) return ''
  const [y, m, d] = ymd.split('-').map(Number)
  const nome = new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'long' })
  return nome.charAt(0).toUpperCase() + nome.slice(1)
}

/**
 * Dados do caso pro card: cliente, parte contraria, numero do processo.
 * O DTO de itens-agenda so traz caso_id — o resto vem da lista de casos
 * carregada pela pagina (mesma estrategia do Kanban).
 */
export function resolverCaso(item, casos) {
  const caso = item?.caso_id ? (casos || []).find((c) => c.id === item.caso_id) : null
  const clienteNome =
    item?.cliente_nome || caso?.cliente?.nome_razao_social || caso?.cliente_nome || null
  const numeroProcesso = item?.numero_processo || caso?.numero_processo || null
  const parteContraria = caso?.parte_contraria || null
  let partes = null
  if (clienteNome && parteContraria) partes = `${clienteNome} × ${parteContraria}`
  else if (clienteNome) partes = clienteNome
  else if (caso?.titulo) partes = caso.titulo
  return {
    casoId: caso?.id || item?.caso_id || null,
    clienteNome,
    parteContraria,
    numeroProcesso,
    tituloCaso: caso?.titulo || null,
    partes,
  }
}

/** Sigla do tribunal ('TJPR', 'TRT9'...) deduzida do numero CNJ, ou null. */
export function siglaTribunalDoNumero(numeroProcesso) {
  const info = parseCNJ(numeroProcesso || '')
  if (!info?.tribunalNome) return null
  const sigla = String(info.tribunalNome).split(' ')[0]
  return /^[A-Z]{2,4}\d{0,2}$/.test(sigla) ? sigla : null
}

/**
 * Destino "Abrir no tribunal" pra um item: portal de consulta publica do
 * tribunal deduzido do numero CNJ do caso. Retorna null quando nao ha
 * numero ou o tribunal nao esta mapeado (botao fica de fora — nunca morto).
 */
export function destinoTribunalDoItem(item, casos) {
  const { numeroProcesso } = resolverCaso(item, casos)
  if (!numeroProcesso) return null
  const sigla = siglaTribunalDoNumero(numeroProcesso)
  const portal = portalDoTribunal(sigla)
  if (!portal) return null
  return { url: portal.url, nome: portal.nome, numeroProcesso }
}
