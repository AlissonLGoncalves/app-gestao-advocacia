import React from 'react'

/** Linha de progresso fina: "X de Y resolvidas". */
function ProgressoDia({ resolvidas, total }) {
  const feitas = Math.max(0, Number(resolvidas) || 0)
  const meta = Math.max(feitas, Number(total) || 0)
  const percentual = meta === 0 ? 0 : Math.round((feitas / meta) * 100)
  const rotulo = `${feitas} de ${meta} ${meta === 1 ? 'resolvida' : 'resolvidas'}`

  return (
    <div className="dh-progresso">
      <div
        className="dh-progresso__trilha"
        role="progressbar"
        aria-label={rotulo}
        aria-valuemin={0}
        aria-valuemax={meta}
        aria-valuenow={feitas}
      >
        <span className="dh-progresso__barra" style={{ width: `${percentual}%` }} />
      </div>
      <span className="dh-progresso__rotulo">{rotulo}</span>
    </div>
  )
}

export default ProgressoDia
