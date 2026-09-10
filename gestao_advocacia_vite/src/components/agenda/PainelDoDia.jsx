// src/components/agenda/PainelDoDia.jsx
// Painel lateral do calendario (redesign Stitch): "{dia} de {mês}",
// "{n} compromissos" e um CardItemDia por item do dia selecionado.
// Vazio: uma frase + um botao outline "Novo item neste dia".
import React from 'react'
import { PlusIcon } from '@heroicons/react/24/outline'
import CardItemDia from './CardItemDia.jsx'
import { tituloDia, diaDaSemana, hojeYmd } from './agendaHelpers.js'

function PainelDoDia({
  dataYmd,
  itens,
  casos,
  hoje = hojeYmd(),
  onAbrir,
  onResponder,
  onConcluir,
  onNovoNoDia,
}) {
  const lista = itens || []
  const n = lista.length
  const ehHoje = dataYmd === hoje
  return (
    <aside className="ag-painel" data-testid="painel-do-dia" aria-label="Compromissos do dia">
      <header className="ag-painel-cabecalho">
        <p className="ag-painel-kicker">{ehHoje ? 'Hoje' : diaDaSemana(dataYmd)}</p>
        <h3 className="ag-painel-titulo">{tituloDia(dataYmd)}</h3>
        <span className="ag-painel-contagem tabular" data-testid="contagem-dia">
          {n} {n === 1 ? 'compromisso' : 'compromissos'}
        </span>
      </header>

      {n === 0 ? (
        <div className="ag-painel-vazio" data-testid="painel-vazio">
          <p>Nada marcado para este dia.</p>
          {onNovoNoDia && (
            <button
              type="button"
              className="btn btn-outline-primary btn-sm rounded-pill px-3"
              onClick={() => onNovoNoDia(dataYmd)}
            >
              <PlusIcon style={{ width: 14, height: 14 }} className="me-1" aria-hidden="true" />
              Novo item neste dia
            </button>
          )}
        </div>
      ) : (
        <div className="ag-painel-lista">
          {lista.map((item) => (
            <CardItemDia
              key={item.id}
              item={item}
              casos={casos}
              hoje={hoje}
              onAbrir={onAbrir}
              onResponder={onResponder}
              onConcluir={onConcluir}
            />
          ))}
        </div>
      )}
    </aside>
  )
}

export default PainelDoDia
