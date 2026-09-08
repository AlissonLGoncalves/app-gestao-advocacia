import React from 'react'
import { CheckCircleIcon } from '@heroicons/react/24/outline'

/**
 * Estado vazio da fila como recompensa: check verde, "Tudo em dia." e um
 * botao. Banco totalmente vazio (0 casos, 0 clientes) vira onboarding.
 */
function TudoEmDia({ bancoVazio, onNavegar }) {
  return (
    <section className="dh-vazio" aria-live="polite">
      <CheckCircleIcon className="dh-vazio__check" aria-hidden="true" />
      <h2>Tudo em dia.</h2>
      {bancoVazio ? (
        <>
          <p>Comece cadastrando seu primeiro caso.</p>
          <button
            type="button"
            className="dh-btn dh-btn--primario"
            onClick={() => onNavegar('/casos/novo')}
          >
            Novo caso
          </button>
        </>
      ) : (
        <>
          <p>Nenhum prazo, nenhuma publicação pendente. Amanhã às 7h o DJEN será lido de novo.</p>
          <button
            type="button"
            className="dh-btn dh-btn--contorno"
            onClick={() => onNavegar('/casos')}
          >
            Ver casos
          </button>
        </>
      )}
    </section>
  )
}

export default TudoEmDia
