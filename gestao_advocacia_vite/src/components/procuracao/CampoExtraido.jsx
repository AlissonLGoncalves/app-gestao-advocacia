import React from 'react'

const STATUS_CONFIG = {
  extracted: {
    icon: 'bi bi-check-circle-fill',
    color: 'text-success',
    label: 'Extraído',
  },
  warning: {
    icon: 'bi bi-exclamation-triangle-fill',
    color: 'text-warning',
    label: 'Extraído com alerta',
  },
  missing: {
    icon: 'bi bi-dash-circle-fill',
    color: 'text-secondary',
    label: 'Não detectado',
  },
}

function CampoExtraido({
  id,
  label,
  status = 'missing',
  warning,
  children,
  notDetectedHint = 'Não detectado — preencha manualmente',
}) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.missing

  return (
    <div className="mb-3">
      <label htmlFor={id} className="form-label form-label-sm d-flex align-items-center gap-2">
        <span>{label}</span>
        <i className={`${cfg.icon} ${cfg.color}`} title={cfg.label} aria-label={cfg.label}></i>
      </label>
      {children}
      {status === 'missing' && <div className="form-text">{notDetectedHint}</div>}
      {warning ? <div className="form-text text-warning">{warning}</div> : null}
    </div>
  )
}

export default CampoExtraido
