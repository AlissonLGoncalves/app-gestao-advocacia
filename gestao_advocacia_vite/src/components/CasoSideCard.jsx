/**
 * CasoSideCard — card compacto pra sidebar do detalhe do caso (Epic #7 / #181).
 *
 * Wrapper consistente: cabeçalho com título + ícone, ação opcional no
 * canto direito (link ou botão), e corpo livre (children). Padroniza
 * espaçamento e estilo dos cards laterais. Redesign Stitch: usa os tokens
 * globais (--line, --text-*, --primary) em vez de cores fixas.
 */

import React from 'react'

export default function CasoSideCard({ titulo, icon: Icon, acao, children, dataTestid }) {
  return (
    <div className="card mb-3" data-testid={dataTestid}>
      <div
        className="card-header d-flex justify-content-between align-items-center py-2 px-3"
        style={{ borderBottom: '1px solid var(--line-soft)' }}
      >
        <div className="d-flex align-items-center gap-2">
          {Icon && <Icon style={{ width: 16, height: 16, color: 'var(--primary)' }} aria-hidden />}
          <strong className="small" style={{ color: 'var(--text-1)' }}>
            {titulo}
          </strong>
        </div>
        {acao}
      </div>
      <div className="card-body p-3" style={{ fontSize: '0.85rem', color: 'var(--text-2)' }}>
        {children}
      </div>
    </div>
  )
}
