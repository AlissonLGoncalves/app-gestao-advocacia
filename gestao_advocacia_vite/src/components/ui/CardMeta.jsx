import React from 'react'
import AvatarSigla from './AvatarSigla.jsx'
import PrioridadeBadge from './PrioridadeBadge.jsx'
import StatusBadge from './StatusBadge.jsx'

// Composicao padrao de microtags para cards/linhas. Ordem visual: status, prioridade, avatar.
// Props:
//   status: string (opcional) — passa pro StatusBadge
//   statusTipo: 'caso' | 'tarefa' (default: 'caso')
//   prioridade: string (opcional) — passa pro PrioridadeBadge
//   responsavelNome: string (opcional) — passa pro AvatarSigla
//   responsavelIniciais: string (opcional) — sobrescreve calculo
//   avatarSize: 'sm' | 'md'
//   className: string opcional pra wrapper
export default function CardMeta({
  status,
  statusTipo = 'caso',
  prioridade,
  responsavelNome,
  responsavelIniciais,
  avatarSize = 'sm',
  className = '',
}) {
  return (
    <span
      className={`d-inline-flex align-items-center gap-2 ${className}`}
      style={{ flexWrap: 'wrap' }}
    >
      <StatusBadge tipo={statusTipo} valor={status} />
      <PrioridadeBadge prioridade={prioridade} />
      <AvatarSigla
        nome={responsavelNome}
        iniciais={responsavelIniciais}
        size={avatarSize}
      />
    </span>
  )
}
