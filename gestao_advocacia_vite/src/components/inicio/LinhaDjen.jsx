import React from 'react'
import { NewspaperIcon } from '@heroicons/react/24/outline'
import { listarTribunais } from './montarFila.js'

/**
 * Uma linha discreta contando o que o DJEN capturou hoje as 7h — e o motivo
 * de abrir o Patronus antes do PJe. Sem OAB cadastrada, vira convite.
 */
function LinhaDjen({ captura, configurado, onNavegar }) {
  if (!configurado) {
    return (
      <p className="dh-djen dh-djen--convite">
        <NewspaperIcon aria-hidden="true" />
        <span>
          Ative o monitoramento do DJEN — cadastre sua OAB para receber publicações automaticamente.
        </span>
        <button
          type="button"
          className="dh-link"
          onClick={() => onNavegar('/djen?aba=oabs')}
          data-testid="djen-cadastrar-oab"
        >
          Cadastrar OAB
        </button>
      </p>
    )
  }

  const publicacoes = captura?.publicacoes || 0
  const vinculadas = captura?.vinculadas || 0
  const tribunais = listarTribunais(captura?.tribunais)

  let frase
  if (publicacoes === 0) {
    frase = 'Hoje às 7h: nenhuma publicação nova nos diários monitorados.'
  } else {
    const lidas = `${publicacoes} ${publicacoes === 1 ? 'publicação lida' : 'publicações lidas'}`
    frase = `Hoje às 7h: ${lidas}${tribunais ? ` em ${tribunais}` : ''} · ${vinculadas} ${
      vinculadas === 1 ? 'já vinculada a caso' : 'já vinculadas a casos'
    }.`
  }

  return (
    <p className="dh-djen">
      <NewspaperIcon aria-hidden="true" />
      <span>{frase}</span>
      <button type="button" className="dh-link" onClick={() => onNavegar('/djen')}>
        Ver intimações
      </button>
    </p>
  )
}

export default LinhaDjen
