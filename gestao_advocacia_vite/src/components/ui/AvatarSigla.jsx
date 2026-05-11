import React from 'react'
import { corPorNome, iniciaisDoNome } from '../../utils/avatarColor.js'

// Pill circular com iniciais (max 2) do responsavel. Cor estavel via hash do nome.
// Props:
//   nome: string completo (preferido) — usado para iniciais e cor
//   iniciais: opcional, sobrescreve calculo (caso backend ja serialize)
//   size: 'sm' | 'md' (default: 'sm', 22px) — 'md' = 28px
//   title: tooltip opcional (default: nome completo)
export default function AvatarSigla({ nome, iniciais, size = 'sm', title }) {
  const letras = iniciais || iniciaisDoNome(nome)
  if (!letras) return null

  const cor = corPorNome(nome || letras)
  const dim = size === 'md' ? 28 : 22
  const fontSize = size === 'md' ? '0.72rem' : '0.62rem'

  return (
    <span
      title={title || nome || letras}
      aria-label={`Responsavel: ${nome || letras}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: dim,
        height: dim,
        borderRadius: '50%',
        backgroundColor: cor.bg,
        color: cor.fg,
        fontSize,
        fontWeight: 600,
        letterSpacing: '0.02em',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {letras}
    </span>
  )
}
