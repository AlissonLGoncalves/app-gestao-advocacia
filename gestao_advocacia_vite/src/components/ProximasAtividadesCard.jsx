/**
 * ProximasAtividadesCard — Epic #7 (#181).
 *
 * Card lateral do detalhe do caso mostrando até 5 próximas tarefas/prazos
 * (não concluídos), ordenados por vencimento ascendente. Usa as `prazos`
 * já carregadas pela CasoDetalhePage (filtra status != 'Concluído').
 *
 * Mostra badge de prioridade e quantos dias até vencimento (ou "vencido"
 * em vermelho). Click navega pro Kanban filtrado.
 */

import React from 'react'
import { Link } from 'react-router'
import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline'
import CasoSideCard from './CasoSideCard.jsx'

function diasAteVencimento(dataStr) {
  if (!dataStr) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const venc = new Date(`${dataStr}T12:00:00`)
  const diffMs = venc.getTime() - hoje.getTime()
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

function rotuloPrazo(dias) {
  if (dias === null) return ''
  if (dias < 0) return `Vencido há ${Math.abs(dias)}d`
  if (dias === 0) return 'Hoje'
  if (dias === 1) return 'Amanhã'
  return `Em ${dias}d`
}

function corPrazo(dias) {
  if (dias === null) return 'text-muted'
  if (dias < 0) return 'text-danger fw-semibold'
  if (dias <= 3) return 'text-warning fw-semibold'
  return 'text-muted'
}

const COR_PRIORIDADE = {
  Urgente: 'danger',
  Alta: 'warning',
  Normal: 'info',
  Baixa: 'secondary',
}

export default function ProximasAtividadesCard({ prazos = [] }) {
  // Filtra concluídos e ordena por vencimento crescente; sem data fica no fim
  const proximas = [...prazos]
    .filter((p) => p.status !== 'Concluído')
    .sort((a, b) => {
      if (!a.data_vencimento && !b.data_vencimento) return 0
      if (!a.data_vencimento) return 1
      if (!b.data_vencimento) return -1
      return a.data_vencimento.localeCompare(b.data_vencimento)
    })
    .slice(0, 5)

  return (
    <CasoSideCard
      titulo={`Próximas atividades${prazos.length ? ` (${proximas.length}/${prazos.length})` : ''}`}
      icon={ClipboardDocumentListIcon}
      acao={
        <Link
          to="/prazos"
          className="btn btn-sm btn-outline-primary py-0 px-2"
          style={{ fontSize: '0.7rem' }}
        >
          Kanban
        </Link>
      }
      dataTestid="proximas-atividades-card"
    >
      {proximas.length === 0 ? (
        <p className="text-muted fst-italic mb-0 small">Nenhuma tarefa pendente neste caso.</p>
      ) : (
        <ul className="list-unstyled mb-0">
          {proximas.map((p) => {
            const dias = diasAteVencimento(p.data_vencimento)
            const corP = COR_PRIORIDADE[p.prioridade] || 'secondary'
            return (
              <li
                key={p.id}
                className="border-bottom pb-2 mb-2"
                data-testid={`atividade-${p.id}`}
                style={{ borderColor: 'rgba(0,0,0,0.05)' }}
              >
                <div className="d-flex justify-content-between align-items-start gap-2">
                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                    <div className="text-truncate" style={{ fontSize: '0.82rem' }}>
                      {p.titulo}
                    </div>
                    <div className={`small ${corPrazo(dias)}`} style={{ fontSize: '0.72rem' }}>
                      {rotuloPrazo(dias) || 'Sem data'}
                    </div>
                  </div>
                  <span
                    className={`badge bg-${corP}-subtle text-dark`}
                    style={{ fontSize: '0.65rem' }}
                  >
                    {p.prioridade || 'Normal'}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </CasoSideCard>
  )
}
