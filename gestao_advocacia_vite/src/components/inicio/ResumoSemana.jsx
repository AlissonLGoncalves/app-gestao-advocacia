import React from 'react'
import { ShieldCheckIcon } from '@heroicons/react/24/outline'

/** Card "Esta semana": uma frase, um link. */
function ResumoSemana({ semana, onNavegar }) {
  const tratadas = semana?.intimacoes_tratadas || 0
  const perdidos = semana?.prazos_perdidos || 0

  const parteTratadas =
    tratadas === 0
      ? 'Você ainda não tratou intimações esta semana'
      : `Você tratou ${tratadas} ${tratadas === 1 ? 'intimação' : 'intimações'}`
  const partePrazos =
    perdidos === 0
      ? ' e não perdeu nenhum prazo.'
      : ` e ${perdidos} ${perdidos === 1 ? 'prazo venceu' : 'prazos venceram'} sem tratamento.`

  return (
    <section className={`dh-semana ${perdidos > 0 ? 'dh-semana--alerta' : ''}`}>
      <span className="dh-semana__icone" aria-hidden="true">
        <ShieldCheckIcon />
      </span>
      <span className="dh-semana__texto">
        <small>Esta semana</small>
        <span>
          {parteTratadas}
          {partePrazos}
        </span>
      </span>
      {/* DjenPage ainda nao le ?aba=tratadas; a agenda e onde os prazos vivem. */}
      <button type="button" className="dh-link" onClick={() => onNavegar('/agenda')}>
        Ver resumo
      </button>
    </section>
  )
}

export default ResumoSemana
