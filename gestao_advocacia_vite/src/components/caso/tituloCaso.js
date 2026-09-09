// Redesign Stitch (TELA 3) — título e linha de meta do cabeçalho do caso.
// Separado do componente pra manter o Fast Refresh e permitir teste puro.

import { siglaTribunalDoCaso } from './tribunalDoCaso.js'

/** "{cliente} × {parte contrária}" (heurística da lista, #207); senão o título. */
export function tituloDoCaso(caso) {
  if (!caso) return ''
  const cliente = (caso.cliente_nome || caso.cliente?.nome_razao_social || '').trim()
  const contraria = (caso.parte_contraria || '').trim()
  if (cliente && contraria) return `${cliente} × ${contraria}`
  return caso.titulo || cliente || contraria || `Caso #${caso.id}`
}

/** ["TJPR", "3ª Vara Cível", "Curitiba", "Ação de cobrança"] — só o que existir. */
export function linhaMetaDoCaso(caso, publicacoes = []) {
  if (!caso) return []
  const sigla = siglaTribunalDoCaso(caso, publicacoes)
  const vara = (caso.vara_juizo || '').trim()
  const comarca = (caso.comarca || '').trim()
  const assunto = (caso.tipo_acao || caso.area_direito || '').trim()
  const partes = [sigla, vara]
  if (comarca && !vara.toLowerCase().includes(comarca.toLowerCase())) partes.push(comarca)
  partes.push(assunto)
  return partes.filter(Boolean)
}
