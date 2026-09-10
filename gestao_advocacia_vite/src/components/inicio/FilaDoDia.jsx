import React from 'react'
import { ArrowTopRightOnSquareIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { toast } from 'react-toastify'
import { MAX_LINHAS_FILA } from './montarFila.js'

const copiarNumero = async (numero) => {
  if (!numero) return
  try {
    await navigator.clipboard?.writeText(numero)
    toast.info(`Nº ${numero} copiado — cole na busca do tribunal.`)
  } catch {
    // Sem clipboard (http, permissao negada): o link abre mesmo assim.
  }
}

function BotaoAcao({ linha, primario, concluindo, onNavegar, onConcluir }) {
  const { acao } = linha
  const classe = `dh-btn ${primario ? 'dh-btn--primario' : 'dh-btn--contorno'}`

  if (acao.tipo === 'tribunal') {
    return (
      <a
        className={classe}
        href={acao.url}
        target="_blank"
        rel="noopener noreferrer"
        title={`Abrir ${acao.nomePortal}`}
        onClick={() => {
          if (acao.precisaColar) copiarNumero(acao.numeroProcesso)
        }}
      >
        {acao.rotulo}
        <ArrowTopRightOnSquareIcon aria-hidden="true" />
      </a>
    )
  }

  if (acao.tipo === 'concluir') {
    return (
      <button
        type="button"
        className={classe}
        disabled={concluindo}
        aria-busy={concluindo || undefined}
        onClick={() => onConcluir(linha)}
      >
        {concluindo ? 'Concluindo…' : acao.rotulo}
      </button>
    )
  }

  return (
    <button type="button" className={classe} onClick={() => onNavegar(acao.destino)}>
      {acao.rotulo}
    </button>
  )
}

/**
 * "Sua fila de hoje": UMA lista vertical, maximo 7 linhas pendentes, ordenada
 * por urgencia. So a primeira linha usa o botao primario. Concluidas de hoje
 * ficam no fim, riscadas — progresso visivel.
 */
function FilaDoDia({ pendentes, concluidas, concluindoChave, onNavegar, onConcluir }) {
  const visiveis = pendentes.slice(0, MAX_LINHAS_FILA)
  const ocultas = pendentes.length - visiveis.length

  return (
    <section className="dh-fila" aria-labelledby="dh-fila-titulo">
      <div className="dh-fila__cabecalho">
        <h2 id="dh-fila-titulo">Sua fila de hoje</h2>
        {pendentes.length > 0 && (
          <span className="dh-fila__contagem">
            {pendentes.length} {pendentes.length === 1 ? 'pendente' : 'pendentes'}
          </span>
        )}
      </div>

      <ul className="dh-fila__lista">
        {visiveis.map((linha, indice) => (
          <li
            key={linha.chave}
            className={`dh-linha dh-linha--${linha.urgencia}`}
            data-testid="fila-linha"
          >
            <span className="dh-linha__texto">
              <strong>{linha.titulo}</strong>
              <span className="dh-linha__detalhe">{linha.detalhe}</span>
            </span>
            <BotaoAcao
              linha={linha}
              primario={indice === 0}
              concluindo={concluindoChave === linha.chave}
              onNavegar={onNavegar}
              onConcluir={onConcluir}
            />
          </li>
        ))}

        {concluidas.map((linha) => (
          <li
            key={linha.chave}
            className="dh-linha dh-linha--concluida"
            data-testid="fila-concluida"
          >
            <CheckCircleIcon className="dh-linha__check" aria-hidden="true" />
            <span className="dh-linha__texto">
              <s>{linha.titulo}</s>
              <span className="dh-linha__detalhe">{linha.detalhe}</span>
            </span>
            <span className="dh-rotulo-concluido">Concluído</span>
          </li>
        ))}
      </ul>

      {ocultas > 0 && (
        <p className="dh-fila__rodape">
          Mais {ocultas} {ocultas === 1 ? 'item' : 'itens'} depois destes.{' '}
          <button type="button" className="dh-link" onClick={() => onNavegar('/agenda')}>
            Ver agenda
          </button>
        </p>
      )}
    </section>
  )
}

export default FilaDoDia
