import React from 'react'

// Pill numerico usado nos itens da sidebar. Cor por severidade:
//   danger  (vermelho) — atrasado/urgente (prazos vencidos, recebimentos vencidos)
//   warning (laranja)  — pendente de atencao (DJEN sem triagem)
//   info    (azul)     — informativo (hoje, contagem neutra)
const CORES = {
  danger: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
}

// Props:
//   count: numero — nao renderiza quando 0 ou ausente
//   cor: 'danger' | 'warning' | 'info' (default: 'danger')
//   max: limite superior antes do "+" (default: 99)
export default function MenuItemBadge({ count, cor = 'danger', max = 99 }) {
  if (!count || count <= 0) return null
  const bg = CORES[cor] || CORES.danger
  return (
    <span
      style={{
        backgroundColor: bg,
        color: '#fff',
        borderRadius: '10px',
        fontSize: '0.65rem',
        fontWeight: 700,
        minWidth: '18px',
        padding: '1px 5px',
        textAlign: 'center',
        lineHeight: '16px',
      }}
    >
      {count > max ? `${max}+` : count}
    </span>
  )
}
