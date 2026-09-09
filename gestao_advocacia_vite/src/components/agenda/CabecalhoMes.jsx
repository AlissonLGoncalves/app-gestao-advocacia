// src/components/agenda/CabecalhoMes.jsx
// Cabecalho do calendario mensal (redesign Stitch): navegacao do mes,
// contagem "{n} prazos · {n} audiências" e chips de filtro por familia.
// Nao sabe nada de FullCalendar — o pai liga onAnterior/onProximo na API.
import React from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { CHIPS } from './agendaHelpers.js'

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`

function CabecalhoMes({ titulo, contagem, chip, onChip, onAnterior, onProximo, onHoje }) {
  const prazos = contagem?.prazos ?? 0
  const audiencias = contagem?.audiencias ?? 0
  return (
    <div className="ag-mes" data-testid="cabecalho-mes">
      <div className="ag-mes-nav">
        <button
          type="button"
          className="ag-icon-btn"
          aria-label="Mês anterior"
          onClick={onAnterior}
        >
          <ChevronLeftIcon />
        </button>
        <h3 className="ag-mes-titulo">{titulo}</h3>
        <button type="button" className="ag-icon-btn" aria-label="Próximo mês" onClick={onProximo}>
          <ChevronRightIcon />
        </button>
        {onHoje && (
          <button type="button" className="ag-link-btn" onClick={onHoje}>
            Hoje
          </button>
        )}
        <span className="ag-mes-contagem tabular" data-testid="contagem-mes">
          {plural(prazos, 'prazo', 'prazos')} · {plural(audiencias, 'audiência', 'audiências')}
        </span>
      </div>
      <div className="ag-chips" role="group" aria-label="Filtrar por tipo">
        {CHIPS.map((c) => (
          <button
            key={c.key}
            type="button"
            className={`ag-chip${chip === c.key ? ' is-active' : ''}`}
            aria-pressed={chip === c.key}
            onClick={() => onChip?.(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default CabecalhoMes
