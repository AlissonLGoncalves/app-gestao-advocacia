// Entrega 1 (destravar) — "Abrir no tribunal".
//
// Princípio do produto: o app NÃO compete com o PJe/eproc/Projudi (eles são a
// fonte da verdade dos autos e sempre serão mais completos). O papel dele é
// juntar o que está espalhado em 4 sistemas e LEVAR você até o certo em 1
// clique — em vez de te obrigar a lembrar qual sistema é, achar a aba e
// redigitar o número.
//
// Ordem de preferência:
//   1. `link` da própria publicação (vem da ComunicaAPI/DJEN — é o oficial);
//   2. página de consulta pública do tribunal, com o nº do processo copiado
//      pra área de transferência (é colar e buscar).
//
// Deliberadamente NÃO montamos deep-link com parâmetros por tribunal: cada
// sistema usa um formato próprio e muitos exigem sessão — link quebrado seria
// pior que nenhum. Entrada de consulta + número copiado funciona sempre.

const PORTAIS = {
  TJPR: { nome: 'Projudi/TJPR', url: 'https://projudi.tjpr.jus.br/projudi/' },
  TJSC: { nome: 'eproc/TJSC', url: 'https://eproc1g.tjsc.jus.br/eproc/' },
  TJSP: { nome: 'e-SAJ/TJSP', url: 'https://esaj.tjsp.jus.br/cpopg/open.do' },
  TJMG: { nome: 'PJe/TJMG', url: 'https://pje-consulta-publica.tjmg.jus.br/' },
  TRF4: { nome: 'eproc/TRF4', url: 'https://eproc.trf4.jus.br/eproc2trf4/' },
  TRT9: { nome: 'PJe/TRT9', url: 'https://pje.trt9.jus.br/consultaprocessual/' },
  TST: { nome: 'TST', url: 'https://consultaprocessual.tst.jus.br/' },
}

/** Portal do tribunal da publicação (ou null se a sigla for desconhecida). */
export function portalDoTribunal(sigla) {
  if (!sigla) return null
  return PORTAIS[String(sigla).toUpperCase().trim()] || null
}

/**
 * Destino pra abrir a publicação/processo na origem.
 * Retorna { url, nome, precisaColar } ou null quando não há para onde ir.
 * `precisaColar` = true quando caímos na consulta pública (o nº vai pro
 * clipboard, porque o usuário vai ter que colar na busca do tribunal).
 */
export function destinoNoTribunal(pub) {
  if (!pub) return null
  if (pub.link) {
    return {
      url: pub.link,
      nome: pub.sigla_tribunal || 'tribunal',
      precisaColar: false,
    }
  }
  const portal = portalDoTribunal(pub.sigla_tribunal)
  if (!portal) return null
  return { url: portal.url, nome: portal.nome, precisaColar: true }
}
