/**
 * Utilitarios pra processar HTML enviado por tribunais via DJEN.
 *
 * Os tribunais entregam o conteudo da intimacao em camadas — a maioria
 * envia HTML completo (com <html><head><style>), alguns codificam entidades
 * em camadas (&amp;lt;table&amp;gt;), outros mandam tabelas formatadas com
 * style/font/center.
 *
 * Estas helpers sao usadas em DjenPage.jsx (lista de publicacoes) e em
 * CasoTimeline.jsx (linha do tempo do caso). Centralizadas aqui pra evitar
 * duplicacao e garantir comportamento consistente.
 */

import DOMPurify from 'dompurify'

const HTML_ENTITY_MAP = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
}

/**
 * Decodifica entidades HTML em ate 5 camadas (alguns tribunais codificam
 * recursivamente: &amp;lt;table&amp;gt; -> &lt;table&gt; -> <table>).
 * Faz substituicao direta de string — sem usar elemento DOM intermediario,
 * que era um vetor de parsing desnecessario antes do DOMPurify.
 */
export const decodeHtmlEntities = (texto = '') => {
  if (!texto) return ''
  let atual = texto
  for (let i = 0; i < 5; i += 1) {
    const decodificado = atual
      .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCodePoint(parseInt(code, 16)))
      .replace(/&[a-zA-Z]+;/g, (m) => HTML_ENTITY_MAP[m] ?? m)
    if (decodificado === atual) break
    atual = decodificado
  }
  return atual
}

/**
 * Sanitiza HTML preservando formatacao tipica de tribunal (tabelas, cores,
 * estilos inline) e removendo qualquer execucao (script, iframe, on*).
 */
export const sanitizarHtmlTribunal = (texto = '') => {
  if (!texto) return ''
  return DOMPurify.sanitize(texto, {
    USE_PROFILES: { html: true },
    ADD_TAGS: [
      'style',
      'font',
      'center',
      'table',
      'thead',
      'tbody',
      'tfoot',
      'tr',
      'th',
      'td',
      'colgroup',
      'col',
      'caption',
      'br',
    ],
    ADD_ATTR: [
      'style',
      'class',
      'align',
      'bgcolor',
      'cellpadding',
      'cellspacing',
      'border',
      'width',
      'height',
      'valign',
      'colspan',
      'rowspan',
    ],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
    FORBID_ATTR: [/^on/i],
  })
}

/**
 * Extrai texto puro de um HTML — usado quando precisamos de preview curto
 * sem markup, ou em contextos que nao podem renderizar HTML.
 */
export const extrairTextoPlano = (html = '') => {
  if (!html) return ''
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim()
}

/**
 * Pipeline padrao: decodifica entidades + sanitiza. Use quando vai renderizar
 * via dangerouslySetInnerHTML.
 */
export const prepararHtmlTribunal = (texto = '') => {
  if (!texto) return ''
  return sanitizarHtmlTribunal(decodeHtmlEntities(texto))
}
