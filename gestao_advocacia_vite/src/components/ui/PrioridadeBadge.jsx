import React from 'react'

// Mapeamento extraido de PrazosPage.getCorPrioridade — agora fonte unica.
const COR_POR_PRIORIDADE = {
  Urgente: 'danger',
  Alta: 'warning',
  Normal: 'secondary',
  Baixa: 'info',
}

// Renderiza badge Bootstrap com cor por prioridade.
// "Normal" e omitido por padrao (sinal visual reservado pra prioridade real).
// Props:
//   prioridade: 'Urgente' | 'Alta' | 'Normal' | 'Baixa'
//   mostrarNormal: boolean — se true, renderiza badge cinza pra 'Normal'
export default function PrioridadeBadge({ prioridade, mostrarNormal = false }) {
  if (!prioridade) return null
  if (prioridade === 'Normal' && !mostrarNormal) return null

  const cor = COR_POR_PRIORIDADE[prioridade] || 'primary'
  return (
    <span
      className={`badge bg-${cor}-subtle text-${cor}`}
      style={{ fontSize: '0.68rem', fontWeight: 600 }}
    >
      {prioridade}
    </span>
  )
}
