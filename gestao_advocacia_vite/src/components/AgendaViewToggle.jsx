// src/components/AgendaViewToggle.jsx
//
// Seletor de visao UNIFICADO da Agenda/Prazos. Antes /agenda e /prazos
// eram telas separadas e confusas; agora sao 3 visoes da MESMA coisa
// (itens-agenda), acessadas por este toggle coeso:
//
//   Calendario → /agenda?view=calendario   (eventos + tarefas datadas)
//   Kanban     → /prazos                    (workflow drag-drop de tarefas)
//   Lista      → /agenda?view=lista         (tabela unificada)
//
// Reusado em AgendaUnificadaPage e PrazosPage pra dar a sensacao de uma
// experiencia unica, sem reescrever o Kanban (1100 linhas).
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDaysIcon, ViewColumnsIcon, ListBulletIcon } from '@heroicons/react/24/outline'

const VIEWS = [
  {
    key: 'calendario',
    label: 'Calendário',
    icon: CalendarDaysIcon,
    rota: '/agenda?view=calendario',
  },
  { key: 'kanban', label: 'Kanban', icon: ViewColumnsIcon, rota: '/prazos' },
  { key: 'lista', label: 'Lista', icon: ListBulletIcon, rota: '/agenda?view=lista' },
]

// current: 'calendario' | 'kanban' | 'lista'
// onLocalChange: opcional — quando a visao alvo vive na MESMA pagina, o pai
//   pode tratar localmente (evita reload). Se nao passado, sempre navega.
function AgendaViewToggle({ current, onLocalChange }) {
  const navigate = useNavigate()

  const handleClick = (view) => {
    if (view.key === current) return
    // calendario e lista vivem em /agenda; kanban em /prazos.
    // Se o pai sabe tratar localmente (mesma rota), usa o callback.
    const mesmaRota =
      (current === 'calendario' || current === 'lista') &&
      (view.key === 'calendario' || view.key === 'lista')
    if (mesmaRota && onLocalChange) {
      onLocalChange(view.key)
    } else {
      navigate(view.rota)
    }
  }

  return (
    <div className="btn-group shadow-sm" role="group" aria-label="Modo de visualização da agenda">
      {VIEWS.map((v) => {
        const Icon = v.icon
        const ativo = v.key === current
        return (
          <button
            key={v.key}
            type="button"
            className={`btn btn-sm ${ativo ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => handleClick(v)}
            aria-pressed={ativo}
          >
            <Icon style={{ width: 15, height: 15 }} className="me-1 d-inline align-text-bottom" />
            {v.label}
          </button>
        )
      })}
    </div>
  )
}

export default AgendaViewToggle
