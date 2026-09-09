// src/components/CalendarView.jsx
// Calendario mensal da Agenda (redesign Stitch). Envolve o FullCalendar
// SEM a toolbar nativa — a navegacao vive no CabecalhoMes, que fala com
// a API do calendario via `calendarRef`. Tema todo por CSS (AgendaUnificadaPage.css).
//
// Props:
//   calendarRef   — ref pra FullCalendar (pai chama getApi().prev()/next()/today())
//   eventos       — itens ja adaptados pro FullCalendar ({id,title,start,allDay,className,extendedProps})
//   diaSelecionado— 'YYYY-MM-DD' destacado (painel do dia)
//   onDiaClick    — (ymd) clique numa celula
//   onEventoClick — (item) clique num evento
//   onMesChange   — (dateDoMes) disparado ao navegar (datesSet)
import React from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import ptBrLocale from '@fullcalendar/core/locales/pt-br'
import { ymdLocal } from './agenda/agendaHelpers.js'

function CalendarView({
  calendarRef,
  eventos,
  diaSelecionado,
  onDiaClick,
  onEventoClick,
  onMesChange,
}) {
  return (
    <div className="ag-cal" data-testid="calendar-view">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        locale={ptBrLocale}
        headerToolbar={false}
        events={eventos}
        height="auto"
        contentHeight="auto"
        fixedWeekCount={false}
        dayMaxEvents={3}
        moreLinkContent={(arg) => `+${arg.num}`}
        eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        eventDisplay="block"
        dayCellClassNames={(arg) =>
          diaSelecionado && ymdLocal(arg.date) === diaSelecionado ? ['ag-dia-selecionado'] : []
        }
        dateClick={(info) => onDiaClick?.(info.dateStr)}
        eventClick={(info) => {
          const item = info.event.extendedProps?.item
          if (item) onEventoClick?.(item)
        }}
        datesSet={(arg) => {
          // `view.currentStart` e o 1o dia do mes visivel (nao o 1o da grade)
          onMesChange?.(arg.view.currentStart)
        }}
      />
    </div>
  )
}

export default CalendarView
