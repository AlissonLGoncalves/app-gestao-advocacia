import React from 'react'
import { CheckCircleIcon } from '@heroicons/react/24/outline'

/**
 * Chip discreto "N dias seguidos em dia". Estimulo sobrio: check, nao fogo.
 * Nao renderiza nada com menos de 1 dia.
 */
function SequenciaChip({ dias }) {
  const n = Number(dias) || 0
  if (n < 1) return null
  return (
    <span className="dh-chip" data-testid="sequencia-chip">
      <CheckCircleIcon aria-hidden="true" />
      {n} {n === 1 ? 'dia seguido' : 'dias seguidos'} em dia
    </span>
  )
}

export default SequenciaChip
