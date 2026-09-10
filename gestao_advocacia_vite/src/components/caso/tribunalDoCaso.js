// Redesign Stitch (TELA 3) — "Abrir no tribunal ↗" no cabeçalho do caso.
//
// O modelo Caso não guarda a sigla do tribunal: inferimos do nº CNJ
// (utils/cnj.js) ou da publicação DJEN mais recente vinculada. O destino
// segue utils/linkTribunal.js: link oficial da publicação quando existe;
// senão, consulta pública do tribunal com o nº copiado.

import { parseCNJ } from '../../utils/cnj.js'
import { destinoNoTribunal, portalDoTribunal } from '../../utils/linkTribunal.js'

/** Sigla curta ("TJPR", "TRT9", "STJ") ou null. */
export function siglaTribunalDoCaso(caso, publicacoes = []) {
  const pubComSigla = (Array.isArray(publicacoes) ? publicacoes : []).find((p) => p?.sigla_tribunal)
  if (pubComSigla) return String(pubComSigla.sigla_tribunal).toUpperCase().trim()
  const info = parseCNJ(caso?.numero_processo || '')
  if (!info?.tribunalNome) return null
  // parseCNJ devolve "TRT9 (PR)" / "TRF4 (PR, RS, SC)" — fica só a sigla.
  const sigla = String(info.tribunalNome).split(/[\s(]/)[0]
  return sigla || null
}

/**
 * { url, nome, precisaColar } ou null quando não há para onde ir
 * (sem nº de processo e sem publicação com link).
 */
export function destinoTribunalDoCaso(caso, publicacoes = []) {
  const lista = Array.isArray(publicacoes) ? publicacoes : []
  const comLink = lista.find((p) => p?.link)
  if (comLink) return destinoNoTribunal(comLink)
  const sigla = siglaTribunalDoCaso(caso, lista)
  const portal = portalDoTribunal(sigla)
  if (!portal) return null
  return { url: portal.url, nome: portal.nome, precisaColar: true }
}
