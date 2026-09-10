// src/components/agenda/CardItemDia.jsx
// Card de um compromisso do dia (painel lateral e visao "Hoje").
// Le dados do caso pela lista de casos da pagina (DTO de itens-agenda
// so traz caso_id). Botoes ligam SEMPRE em fluxo existente:
//   - "Abrir no tribunal ↗"  → portal de consulta do tribunal (utils/linkTribunal)
//   - "Responder com peça"   → TratarPrazoModal (tarefa) / editor (evento)
//   - "Concluir"             → PATCH /itens-agenda/{id}/concluir (mesmo do Kanban)
import React from 'react'
import { toast } from 'react-toastify'
import {
  ArrowTopRightOnSquareIcon,
  CheckIcon,
  ScaleIcon,
  DocumentTextIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline'
import { getProvidencia } from '../../utils/providencia.js'
import {
  horaDoItem,
  urgenciaDoItem,
  ehAudiencia,
  resolverCaso,
  destinoTribunalDoItem,
} from './agendaHelpers.js'

const COR_PROV = {
  danger: 'ag-badge-danger',
  warning: 'ag-badge-warning',
  secondary: 'ag-badge-muted',
}

function CardItemDia({ item, casos, hoje, onAbrir, onResponder, onConcluir }) {
  const hora = horaDoItem(item)
  const urgencia = urgenciaDoItem(item, hoje)
  const audiencia = ehAudiencia(item)
  const prov = getProvidencia(item.tipo_providencia)
  const caso = resolverCaso(item, casos)
  const destino = destinoTribunalDoItem(item, casos)
  const concluido = urgencia === 'concluido' || urgencia === 'cancelado'
  const ehTarefa = item.tipo === 'tarefa'

  const abrirNoTribunal = async () => {
    if (!destino) return
    try {
      await navigator.clipboard?.writeText(destino.numeroProcesso)
      toast.info(`Nº ${destino.numeroProcesso} copiado — cole na busca do ${destino.nome}.`)
    } catch {
      /* clipboard indisponivel: abre mesmo assim */
    }
    window.open(destino.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <article
      className={`ag-card ag-card--${urgencia}`}
      data-testid="card-item-dia"
      data-urgencia={urgencia}
    >
      <div className="ag-card-topo">
        <span className="ag-card-hora tabular">{hora || 'Dia inteiro'}</span>
        {audiencia && (
          <span className="ag-badge ag-badge-audiencia">
            <ScaleIcon aria-hidden="true" />
            Audiência
          </span>
        )}
        {prov && !audiencia && (
          <span
            className={`ag-badge ${COR_PROV[prov.cor] || 'ag-badge-muted'}`}
            title={prov.descricao}
            data-testid="badge-providencia-dia"
          >
            {prov.label}
          </span>
        )}
        {urgencia === 'vencido' && <span className="ag-badge ag-badge-danger">Vencido</span>}
        {concluido && <span className="ag-badge ag-badge-muted">{item.status}</span>}
      </div>

      <button
        type="button"
        className={`ag-card-titulo${concluido ? ' is-done' : ''}`}
        onClick={() => onAbrir?.(item)}
        title={ehTarefa ? 'Tratar prazo' : 'Editar compromisso'}
      >
        {item.titulo}
      </button>

      {caso.partes && <div className="ag-card-partes">{caso.partes}</div>}
      {caso.numeroProcesso && <div className="ag-card-processo tabular">{caso.numeroProcesso}</div>}

      {!concluido && (
        <div className="ag-card-acoes">
          {destino && (
            <button
              type="button"
              className="ag-btn-quiet"
              onClick={abrirNoTribunal}
              title={`Abre a consulta do ${destino.nome} e copia o nº do processo`}
            >
              Abrir no tribunal
              <ArrowTopRightOnSquareIcon aria-hidden="true" />
            </button>
          )}
          {ehTarefa ? (
            <button type="button" className="ag-btn-quiet" onClick={() => onResponder?.(item)}>
              <DocumentTextIcon aria-hidden="true" />
              Responder com peça
            </button>
          ) : (
            <button type="button" className="ag-btn-quiet" onClick={() => onAbrir?.(item)}>
              <PencilSquareIcon aria-hidden="true" />
              Editar
            </button>
          )}
          <button
            type="button"
            className="ag-btn-quiet ag-btn-quiet--ok"
            onClick={() => onConcluir?.(item)}
          >
            <CheckIcon aria-hidden="true" />
            Concluir
          </button>
        </div>
      )}
    </article>
  )
}

export default CardItemDia
