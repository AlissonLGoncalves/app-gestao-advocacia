// src/pages/AgendaUnificadaPage.jsx
// Substituta da AgendaPage antiga (PR D3). Consome /v1/itens-agenda
// como fonte unica — mostra tarefas + eventos no mesmo calendar/list.
//
// Por que essa pagina existe:
//   Antes: usuario tinha que olhar 2 telas (/agenda e /prazos) pra
//   saber o que vence essa semana. Aqui ficam todos os compromissos
//   datados (eventos) + tarefas com data_vencimento.
//
// O que NAO entra aqui:
//   - Kanban de tarefas (continua em /prazos com drag-drop dedicado).
//     A unificacao backend (item_agenda) ja foi feita em D1/D2, entao
//     o kanban antigo continua valido — so muda a fonte (D4).
import React, { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import bootstrap5Plugin from '@fullcalendar/bootstrap5'
import ptBrLocale from '@fullcalendar/core/locales/pt-br'
import { toast } from 'react-toastify'
import { PlusIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import ItemAgendaForm from '../components/ItemAgendaForm.jsx'
import AgendaViewToggle from '../components/AgendaViewToggle.jsx'
import { listItensAgenda, deleteItemAgenda } from '../api/itensAgenda.js'

// Cores visuais por tipo+status. Centralizadas pra UI consistente entre
// calendar e list.
function classeDoItem(item) {
  if (item.status === 'Concluido') return 'fc-event-concluido'
  if (item.status === 'Cancelado') return 'fc-event-cancelado'
  // Vencido: data passada e ainda pendente
  const agora = new Date()
  const dataRelevante = item.data_inicio || item.data_vencimento
  if (dataRelevante && new Date(dataRelevante) < agora && item.status === 'Pendente') {
    return 'fc-event-vencido'
  }
  return item.tipo === 'tarefa' ? 'fc-event-tarefa' : 'fc-event-evento'
}

function formatDataBR(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: iso.includes('T') ? '2-digit' : undefined,
      minute: iso.includes('T') ? '2-digit' : undefined,
    })
  } catch {
    return iso
  }
}

const BADGE_STATUS = {
  Pendente: 'bg-secondary',
  'Em Andamento': 'bg-info text-dark',
  Concluido: 'bg-success',
  Cancelado: 'bg-dark',
}

function AgendaUnificadaPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [itens, setItens] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  // Visao vem da URL (?view=calendario|lista) pra navegacao coesa com o
  // toggle unificado (que tambem leva pro Kanban em /prazos). Fallback pra
  // preferencia salva, depois 'calendario'.
  const viewParam = searchParams.get('view')
  const viewMode =
    viewParam === 'lista' || viewParam === 'calendario'
      ? viewParam
      : localStorage.getItem('agenda_unificada_view') || 'calendario'
  const [filtroTipo, setFiltroTipo] = useState('todos') // todos | tarefa | evento
  const [filtroStatus, setFiltroStatus] = useState('ativos') // ativos | todos | pendentes | concluidos
  const [modalAberto, setModalAberto] = useState(false)
  const [itemEditar, setItemEditar] = useState(null)

  // Fetch unificado
  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (filtroTipo !== 'todos') params.tipo = filtroTipo
      if (filtroStatus === 'pendentes') params.status = 'Pendente'
      if (filtroStatus === 'concluidos') params.status = 'Concluido'
      const data = await listItensAgenda(params)
      let lista = Array.isArray(data) ? data : []
      // 'ativos' = nao Concluido nem Cancelado (default, esconde ruido)
      if (filtroStatus === 'ativos') {
        lista = lista.filter((i) => i.status !== 'Concluido' && i.status !== 'Cancelado')
      }
      setItens(lista)
    } catch (err) {
      console.error('AgendaUnificadaPage: erro ao carregar itens', err)
      toast.error(`Erro ao carregar itens: ${err?.message || 'desconhecido'}`)
    } finally {
      setLoading(false)
    }
  }, [filtroTipo, filtroStatus])

  useEffect(() => {
    carregar()
  }, [carregar, refreshKey])

  const handleViewChange = (mode) => {
    localStorage.setItem('agenda_unificada_view', mode)
    const params = new URLSearchParams(searchParams)
    params.set('view', mode)
    setSearchParams(params, { replace: true })
  }

  const handleAdicionarClick = () => {
    setItemEditar(null)
    setModalAberto(true)
  }

  const handleEditarClick = (item) => {
    setItemEditar(item)
    setModalAberto(true)
  }

  const handleExcluir = async (item) => {
    if (!window.confirm(`Excluir "${item.titulo}"? Esta ação não pode ser desfeita.`)) {
      return
    }
    try {
      await deleteItemAgenda(item.id)
      toast.success('Item excluído.')
      setRefreshKey((k) => k + 1)
    } catch (err) {
      console.error('AgendaUnificadaPage: erro ao excluir', err)
      toast.error(err?.message || 'Erro ao excluir.')
    }
  }

  const handleFormSalvo = () => {
    setModalAberto(false)
    setItemEditar(null)
    setRefreshKey((k) => k + 1)
  }

  // Adapta itens pra FullCalendar
  const eventosFullCalendar = itens
    .filter((i) => i.data_inicio || i.data_vencimento)
    .map((item) => {
      const start = item.data_inicio || item.data_vencimento
      const end = item.data_fim
      return {
        id: String(item.id),
        title: item.titulo,
        start,
        end,
        allDay: !start.includes('T'),
        extendedProps: { item },
        className: classeDoItem(item),
      }
    })

  const handleCalendarEventClick = (clickInfo) => {
    const item = clickInfo.event.extendedProps?.item
    if (item) handleEditarClick(item)
  }

  return (
    <div className="container-fluid py-3 px-3 px-lg-4">
      <div className="mb-3">
        <h2 className="h4 mb-1 fw-bold" style={{ fontFamily: 'var(--font-heading)' }}>
          Agenda
        </h2>
        <p className="text-muted small mb-0">
          Prazos, tarefas e compromissos num só lugar — alterne entre Calendário, Kanban e Lista.
        </p>
      </div>

      {/* Controles: view-mode (unificado) + filtros + ação */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div className="d-flex flex-wrap align-items-center gap-2">
          <AgendaViewToggle current={viewMode} onLocalChange={handleViewChange} />

          <select
            className="form-select form-select-sm"
            style={{ width: 'auto' }}
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            aria-label="Filtrar por tipo"
          >
            <option value="todos">Todos os tipos</option>
            <option value="tarefa">Só tarefas</option>
            <option value="evento">Só eventos</option>
          </select>

          <select
            className="form-select form-select-sm"
            style={{ width: 'auto' }}
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            aria-label="Filtrar por status"
          >
            <option value="ativos">Ativos (default)</option>
            <option value="pendentes">Só pendentes</option>
            <option value="concluidos">Só concluídos</option>
            <option value="todos">Todos</option>
          </select>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-sm rounded-pill px-3 shadow-sm"
          onClick={handleAdicionarClick}
        >
          <PlusIcon style={{ width: 15, height: 15 }} className="me-1 d-inline align-text-bottom" />
          Novo item
        </button>
      </div>

      {loading ? (
        <div className="d-flex justify-content-center align-items-center p-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Carregando agenda...</span>
          </div>
          <span className="ms-3 text-muted">Carregando itens da agenda...</span>
        </div>
      ) : viewMode === 'calendario' ? (
        <div className="p-1 bg-white rounded shadow-sm">
          <FullCalendar
            plugins={[
              dayGridPlugin,
              timeGridPlugin,
              interactionPlugin,
              listPlugin,
              bootstrap5Plugin,
            ]}
            themeSystem="bootstrap5"
            initialView="dayGridMonth"
            locale={ptBrLocale}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
            }}
            buttonText={{
              today: 'Hoje',
              month: 'Mês',
              week: 'Semana',
              day: 'Dia',
              list: 'Lista',
            }}
            events={eventosFullCalendar}
            eventClick={handleCalendarEventClick}
            height="auto"
            contentHeight="auto"
            navLinks
            eventTimeFormat={{
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            }}
          />
        </div>
      ) : (
        <ListaItens itens={itens} onEditar={handleEditarClick} onExcluir={handleExcluir} />
      )}

      {modalAberto && (
        <ItemAgendaForm
          itemParaEditar={itemEditar}
          onSalvo={handleFormSalvo}
          onCancel={() => {
            setModalAberto(false)
            setItemEditar(null)
          }}
          defaultTipo={filtroTipo === 'evento' ? 'evento' : 'tarefa'}
        />
      )}
    </div>
  )
}

// Tabela inline — separada pra reduzir tamanho do componente principal
// e facilitar leitura. Nao virou arquivo separado porque so faz sentido
// no contexto da AgendaUnificadaPage.
function ListaItens({ itens, onEditar, onExcluir }) {
  if (itens.length === 0) {
    return (
      <div className="text-center text-muted py-5 bg-white rounded shadow-sm">
        <p className="mb-1">Nenhum item encontrado.</p>
        <small>Ajuste os filtros ou clique em "Novo item" pra adicionar.</small>
      </div>
    )
  }
  return (
    <div className="bg-white rounded shadow-sm">
      <div className="table-responsive">
        <table className="table table-hover mb-0 align-middle">
          <thead className="table-light">
            <tr>
              <th>Título</th>
              <th>Tipo</th>
              <th>Categoria</th>
              <th>Quando</th>
              <th>Status</th>
              <th>Prioridade</th>
              <th style={{ width: '80px' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => (
              <tr key={item.id}>
                <td className="fw-medium">{item.titulo}</td>
                <td>
                  <span
                    className={`badge ${item.tipo === 'evento' ? 'bg-primary' : 'bg-warning text-dark'}`}
                  >
                    {item.tipo === 'evento' ? 'Evento' : 'Tarefa'}
                  </span>
                </td>
                <td>
                  <small className="text-muted">{item.categoria || '—'}</small>
                </td>
                <td>
                  <small>{formatDataBR(item.data_inicio || item.data_vencimento)}</small>
                </td>
                <td>
                  <span className={`badge ${BADGE_STATUS[item.status] || 'bg-secondary'}`}>
                    {item.status}
                  </span>
                </td>
                <td>
                  <small>{item.prioridade}</small>
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary me-1 p-1 lh-1"
                    onClick={() => onEditar(item)}
                    title="Editar"
                    style={{ width: 28, height: 28 }}
                  >
                    <PencilSquareIcon style={{ width: 14, height: 14 }} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger p-1 lh-1"
                    onClick={() => onExcluir(item)}
                    title="Excluir"
                    style={{ width: 28, height: 28 }}
                  >
                    <TrashIcon style={{ width: 14, height: 14 }} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AgendaUnificadaPage
