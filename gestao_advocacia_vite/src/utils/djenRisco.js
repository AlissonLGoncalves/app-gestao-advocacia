// Classifica publicacoes DJEN em 3 niveis de risco a partir dos campos
// ja serializados pelo backend (`importante` boolean + `tipo_comunicacao`).
//
// Estrategia derivada — nao depende de coluna nova no backend, reusa o
// trabalho do djen_classifier.py:
//   - importante === null  -> 'desconhecido' (sem badge — IA nao classificou)
//   - importante === false -> 'baixo'  (rotina segundo a IA)
//   - importante === true  + tipo critico -> 'alto'
//   - importante === true  + outro tipo   -> 'medio'
//
// Tipos criticos sao os que tipicamente geram decisao judicial ou prazo
// curto, exigindo atencao imediata.

const TIPOS_CRITICOS = [
  'sentenca',
  'sentença',
  'acordao',
  'acórdão',
  'decisao',
  'decisão',
  'audiencia',
  'audiência',
]

const normalizar = (s) => (s || '').toString().trim().toLowerCase()

// Retorna 'alto' | 'medio' | 'baixo' | 'desconhecido'. Exportado pra teste.
export function calcularRiscoDjen(pub) {
  if (!pub) return 'desconhecido'
  if (pub.importante === null || pub.importante === undefined) return 'desconhecido'
  if (pub.importante === false) return 'baixo'
  // importante === true: refina por tipo_comunicacao
  const tipo = normalizar(pub.tipo_comunicacao)
  if (tipo && TIPOS_CRITICOS.some((t) => tipo.includes(t))) return 'alto'
  return 'medio'
}

export const RISCO_META = {
  alto: { label: 'Alto', cor: 'danger', icon: '🚨' },
  medio: { label: 'Atenção', cor: 'warning', icon: '⚠️' },
  baixo: { label: 'Rotina', cor: 'secondary', icon: null },
  desconhecido: { label: '—', cor: 'light', icon: null },
}
