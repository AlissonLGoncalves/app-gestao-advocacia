import React, { useId } from 'react'

/**
 * PatronusLogo — marca hexagonal "P" em gradiente azul + wordmark.
 *
 * Base visual: docs/design/stitch-2026-09/logo-hex.svg (mesma marca do
 * public/favicon.svg). Sem dependencia de imagem externa: SVG inline, com
 * id de gradiente unico por instancia (useId) pra poder repetir na tela.
 *
 * Props:
 *   compact  — so o hexagono, sem wordmark (ex.: favicon, avatar, mobile)
 *   size     — lado do hexagono em px (default 40)
 *   tone     — 'light' (texto branco, sidebar/login) | 'dark' (texto escuro)
 *   tagline  — texto pequeno em caixa alta abaixo do nome (default "Sistema Jurídico")
 */
export default function PatronusLogo({
  compact = false,
  size = 40,
  tone = 'light',
  tagline = 'Sistema Jurídico',
  className = '',
}) {
  const gradId = useId()
  return (
    <div
      className={`patronus-logo patronus-logo-${tone} ${compact ? 'is-compact' : ''} ${className}`.trim()}
    >
      <svg
        className="patronus-logo-mark"
        viewBox="0 0 40 40"
        width={size}
        height={size}
        role="img"
        aria-label="Patronus"
        focusable="false"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#56A6FF" />
            <stop offset="50%" stopColor="#1F78FF" />
            <stop offset="100%" stopColor="#0A45C4" />
          </linearGradient>
        </defs>
        <polygon
          points="20,2 36,11 36,29 20,38 4,29 4,11"
          fill={`url(#${gradId})`}
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M14 11H22.5C26.6 11 29.5 13.7 29.5 17.5C29.5 21.3 26.6 24 22.5 24H18V29H14V11ZM18 14.5V20.5H22.3C24.5 20.5 25.8 19.3 25.8 17.5C25.8 15.7 24.5 14.5 22.3 14.5H18Z"
          fill="#FFFFFF"
          fillRule="evenodd"
        />
      </svg>
      {!compact && (
        <div className="patronus-logo-text">
          <span className="patronus-logo-name">Patronus</span>
          {tagline && <span className="patronus-logo-tagline">{tagline}</span>}
        </div>
      )}
    </div>
  )
}
