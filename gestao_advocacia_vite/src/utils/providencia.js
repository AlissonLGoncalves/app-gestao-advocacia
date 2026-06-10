// Issue #304 — mapeia a regra do calculador de prazo do backend
// (djen_prazo_calculator._REGRAS) pra um rótulo acionável na UI e
// palavras-chave pra sugerir o modelo de peça certo no "Gerar peça".
//
// Mantém os nomes em sincronia com o backend: se uma regra nova for
// criada lá, cai no fallback aqui (label genérico) sem quebrar nada.

export const PROVIDENCIAS = {
  contestacao_15d: {
    label: 'Contestação',
    descricao: 'Citação/intimação para apresentar defesa',
    keywords: ['contesta', 'defesa'],
    cor: 'danger',
  },
  recurso_15d: {
    label: 'Recurso',
    descricao: 'Decisão/sentença com prazo recursal correndo',
    keywords: ['recurso', 'apela', 'agravo'],
    cor: 'danger',
  },
  cumprimento_sentenca_15d: {
    label: 'Cumprimento de sentença',
    descricao: 'Pagamento voluntário / cumprimento sob pena de multa',
    keywords: ['cumprimento', 'impugna'],
    cor: 'danger',
  },
  manifestacao_15d: {
    label: 'Manifestação',
    descricao: 'Manifestar-se nos autos (réplica, provas, impugnação...)',
    keywords: ['manifesta', 'replica', 'réplica', 'impugna'],
    cor: 'warning',
  },
  audiencia_7d: {
    label: 'Audiência',
    descricao: 'Audiência designada — preparar e comparecer',
    keywords: ['audiencia', 'audiência'],
    cor: 'warning',
  },
  embargos_declaracao_5d: {
    label: 'Embargos de declaração',
    descricao: 'Prazo de 5 dias para embargar',
    keywords: ['embargos'],
    cor: 'danger',
  },
  sentenca_revisao_15d: {
    label: 'Analisar sentença',
    descricao: 'Sentença publicada — avaliar se recorre',
    keywords: ['recurso', 'apela'],
    cor: 'warning',
  },
  decisao_despacho_5d: {
    label: 'Cumprir decisão/despacho',
    descricao: 'Decisão ou despacho com providência a cumprir',
    keywords: ['manifesta', 'peticao', 'petição'],
    cor: 'secondary',
  },
  fallback_conservador_5d: {
    label: 'Verificar providência',
    descricao: 'Tipo não identificado — confira a publicação',
    keywords: [],
    cor: 'secondary',
  },
}

export function getProvidencia(tipoProvidencia) {
  if (!tipoProvidencia) return null
  return (
    PROVIDENCIAS[tipoProvidencia] || {
      label: 'Verificar providência',
      descricao: 'Regra não mapeada na UI',
      keywords: [],
      cor: 'secondary',
    }
  )
}

// Ordena modelos de documento colocando primeiro os que casam com as
// keywords da providência (match no título ou tipo do modelo).
export function ordenarModelosPorProvidencia(modelos, tipoProvidencia) {
  const prov = getProvidencia(tipoProvidencia)
  if (!prov || !prov.keywords.length) return modelos
  const casa = (m) => {
    const alvo = `${m.titulo || ''} ${m.tipo || ''}`.toLowerCase()
    return prov.keywords.some((k) => alvo.includes(k))
  }
  return [...modelos].sort((a, b) => (casa(b) ? 1 : 0) - (casa(a) ? 1 : 0))
}
