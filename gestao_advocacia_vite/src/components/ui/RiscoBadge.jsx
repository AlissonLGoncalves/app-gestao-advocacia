import React from 'react'
import { calcularRiscoDjen, RISCO_META } from '../../utils/djenRisco.js'

// Badge de risco para publicacao DJEN. Aceita objeto pub ou nivel direto.
// Props:
//   pub: objeto da publicacao (preferido — calcula automaticamente)
//   nivel: 'alto' | 'medio' | 'baixo' | 'desconhecido' (override)
//   compacto: boolean — sem texto, so icone+cor (default false)
//
// 'desconhecido' (importante=null) e 'baixo' nao renderizam por padrao
// pra evitar poluicao visual. Use mostrarBaixo/mostrarDesconhecido se
// quiser exibir explicitamente (ex: pagina de triagem).
export default function RiscoBadge({
  pub,
  nivel,
  compacto = false,
  mostrarBaixo = false,
  mostrarDesconhecido = false,
}) {
  const r = nivel || calcularRiscoDjen(pub)
  const meta = RISCO_META[r]
  if (!meta) return null
  if (r === 'desconhecido' && !mostrarDesconhecido) return null
  if (r === 'baixo' && !mostrarBaixo) return null

  const className = `badge bg-${meta.cor}-subtle text-${meta.cor}-emphasis d-inline-flex align-items-center gap-1`
  const style = { fontSize: '0.68rem', fontWeight: 600 }

  return (
    <span
      className={className}
      style={style}
      title={`Risco: ${meta.label}`}
      data-testid={`risco-badge-${r}`}
    >
      {meta.icon && <span aria-hidden="true">{meta.icon}</span>}
      {!compacto && <span>{meta.label}</span>}
    </span>
  )
}
