// Redesign Stitch (set/2026) — campos "Extraído automaticamente" da caixa
// de intimações: Partes, Nº do processo, Assunto e Prazo.
//
// Regra de ouro: NUNCA inventar dado. Cada helper devolve string vazia
// quando o campo não existe na publicação; a UI mostra "—" com o title
// TITULO_NAO_EXTRAIDO. Tudo aqui vem do que o backend já serializa
// (to_dict + prazo_sugerido calculado pelo djen_prazo_calculator).

export const TITULO_NAO_EXTRAIDO = 'não extraído nesta publicação'

/** dd/mm/aaaa a partir de ISO (YYYY-MM-DD ou datetime). Vazio se inválido. */
export function fmtDataCurta(valor) {
  if (!valor) return ''
  const texto = String(valor).trim()
  const normalizado = /^\d{4}-\d{2}-\d{2}$/.test(texto) ? `${texto}T12:00:00` : texto
  const d = new Date(normalizado)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR')
}

/**
 * "Quem contra quem". Caso vinculado é a fonte preferida (cliente × parte
 * contrária); senão os polos extraídos da publicação.
 * Retorna { ativo, passivo, texto, fonte } — texto vazio quando não há nada.
 */
export function partesDaPublicacao(pub, casos = []) {
  if (!pub) return { ativo: '', passivo: '', texto: '', fonte: null }
  const casoVinc = pub.caso_id ? casos.find((c) => c.id === pub.caso_id) : null
  // GET /casos serializa o cliente como objeto aninhado; algumas rotas
  // (busca, dashboard) achatam em cliente_nome. Aceita as duas formas.
  const nomeCliente = casoVinc?.cliente_nome || casoVinc?.cliente?.nome_razao_social || ''
  const ativo = (nomeCliente || pub.polo_ativo || '').trim()
  const passivo = (casoVinc?.parte_contraria || pub.polo_passivo || '').trim()
  if (!ativo && !passivo) return { ativo: '', passivo: '', texto: '', fonte: null }
  const texto = ativo && passivo ? `${ativo} × ${passivo}` : ativo || passivo
  return { ativo, passivo, texto, fonte: casoVinc ? 'caso' : 'publicacao' }
}

/** Nº do processo com máscara CNJ quando houver. */
export function numeroProcessoDe(pub) {
  return (pub?.numero_processo_mascara || pub?.numero_processo || '').trim()
}

/** Assunto = classe processual informada pelo tribunal (nome_classe). */
export function assuntoDe(pub) {
  return (pub?.nome_classe || '').trim()
}

/**
 * "Contestação · 15 dias · vence 26/09/2026" a partir do `prazo_sugerido`
 * (listagem) ou da sugestão completa do endpoint /sugestao-tratamento.
 * Vazio quando o calculador não reconheceu providência (fallback).
 * Os dias são CORRIDOS (o calculador é conservador) — por isso o texto não
 * diz "úteis".
 */
export function prazoTexto(prazo) {
  if (!prazo || !prazo.providencia) return ''
  const partes = [prazo.providencia]
  if (prazo.dias) partes.push(`${prazo.dias} dias`)
  const venc = fmtDataCurta(prazo.data_vencimento)
  if (venc) partes.push(`vence ${venc}`)
  return partes.join(' · ')
}

/** Rótulo do tipo sugerido pra frase "registrar {tipo} de {providência}". */
export function rotuloTipoSugerido(tipo) {
  return { prazo: 'prazo', audiencia: 'audiência', tarefa: 'tarefa' }[tipo] || 'prazo'
}
