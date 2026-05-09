/**
 * CasoSideCard — card compacto pra sidebar do detalhe do caso (Epic #7 / #181).
 *
 * Wrapper consistente: cabeçalho com título + ícone, ação opcional no
 * canto direito (link ou botão), e corpo livre (children). Padroniza
 * espaçamento e estilo dos cards laterais.
 */

import React from 'react'

export default function CasoSideCard({ titulo, icon: Icon, acao, children, dataTestid }) {
  return (
    <div className="card shadow-sm mb-3" data-testid={dataTestid}>
      <div
        className="card-header bg-light d-flex justify-content-between align-items-center py-2 px-3"
        style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
      >
        <div className="d-flex align-items-center gap-2">
          {Icon && <Icon style={{ width: 16, height: 16, color: '#0d6efd' }} />}
          <strong className="small text-primary">{titulo}</strong>
        </div>
        {acao}
      </div>
      <div className="card-body p-3" style={{ fontSize: '0.85rem' }}>
        {children}
      </div>
    </div>
  )
}
