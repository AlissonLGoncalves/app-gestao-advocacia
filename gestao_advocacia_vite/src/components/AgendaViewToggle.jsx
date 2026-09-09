// src/components/AgendaViewToggle.jsx
//
// Seletor de visao UNIFICADO da Agenda (toggle segmentado — redesign
// Stitch). As 4 visoes vivem TODAS em /agenda como abas da MESMA fonte
// (itens-agenda):
//
//   Hoje       → /agenda?view=hoje         (fila do dia, por hora)
//   Calendario → /agenda?view=calendario   (mes + painel do dia)
//   Kanban     → /agenda?view=kanban       (workflow drag-drop de tarefas)
//   Lista      → /agenda?view=lista        (tabela unificada)
//
// O antigo /prazos redireciona pra /agenda?view=kanban (mantem links).
import React from 'react'
import { useNavigate } from 'react-router'
import {
  SunIcon,
  CalendarDaysIcon,
  ViewColumnsIcon,
  ListBulletIcon,
} from '@heroicons/react/24/outline'

const VIEWS = [
  { key: 'hoje', label: 'Hoje', icon: SunIcon, rota: '/agenda?view=hoje' },
  {
    key: 'calendario',
    label: 'Calendário',
    icon: CalendarDaysIcon,
    rota: '/agenda?view=calendario',
  },
  { key: 'kanban', label: 'Kanban', icon: ViewColumnsIcon, rota: '/agenda?view=kanban' },
  { key: 'lista', label: 'Lista', icon: ListBulletIcon, rota: '/agenda?view=lista' },
]

// current: 'hoje' | 'calendario' | 'kanban' | 'lista'
// onLocalChange: opcional — como as visoes vivem na MESMA pagina (/agenda),
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
    <div className="ag-seg" role="group" aria-label="Modo de visualização da agenda">
      {VIEWS.map((v) => {
        const Icon = v.icon
        const ativo = v.key === current
        return (
          <button
            key={v.key}
            type="button"
            className={`ag-seg-btn${ativo ? ' is-active' : ''}`}
            onClick={() => handleClick(v)}
            aria-pressed={ativo}
          >
            <Icon aria-hidden="true" />
            {v.label}
          </button>
        )
      })}
    </div>
  )
}

export default AgendaViewToggle
