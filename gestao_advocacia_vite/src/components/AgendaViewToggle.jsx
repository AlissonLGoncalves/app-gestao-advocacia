// src/components/AgendaViewToggle.jsx
//
// Seletor de visao UNIFICADO da Agenda. As 3 visoes vivem TODAS em /agenda
// como abas da MESMA fonte (itens-agenda), acessadas por este toggle coeso:
//
//   Calendario → /agenda?view=calendario   (eventos + tarefas datadas)
//   Kanban     → /agenda?view=kanban        (workflow drag-drop de tarefas)
//   Lista      → /agenda?view=lista         (tabela unificada)
//
// O antigo /prazos agora redireciona pra /agenda?view=kanban (mantem links).
import React from 'react'
import { useNavigate } from 'react-router'
import { CalendarDaysIcon, ViewColumnsIcon, ListBulletIcon } from '@heroicons/react/24/outline'

const VIEWS = [
  {
    key: 'calendario',
    label: 'Calendário',
    icon: CalendarDaysIcon,
    rota: '/agenda?view=calendario',
  },
  { key: 'kanban', label: 'Kanban', icon: ViewColumnsIcon, rota: '/agenda?view=kanban' },
  { key: 'lista', label: 'Lista', icon: ListBulletIcon, rota: '/agenda?view=lista' },
]

// current: 'calendario' | 'kanban' | 'lista'
// onLocalChange: opcional — como as 3 visoes vivem na MESMA pagina (/agenda),
//   o pai troca localmente (sem reload). Se nao passado, navega pela rota.
function AgendaViewToggle({ current, onLocalChange }) {
  const navigate = useNavigate()

  const handleClick = (view) => {
    if (view.key === current) return
    if (onLocalChange) {
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
