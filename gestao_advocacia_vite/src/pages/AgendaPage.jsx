import React, { useState, useCallback, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import EventoAgendaList from '../EventoAgendaList.jsx'
import EventoAgendaForm from '../EventoAgendaForm.jsx'
import CalendarView from '../components/CalendarView.jsx'
import { getEvento } from '../api/agenda.js'
import { CalendarDaysIcon, ListBulletIcon, PlusIcon } from '@heroicons/react/24/outline'

function AgendaPage() {
  const navigate = useNavigate()
  const params = useParams()
  const location = useLocation()
  const [refreshKey, setRefreshKey] = useState(0)
  const [eventoParaEditar, setEventoParaEditar] = useState(null)
  const [loadingItem, setLoadingItem] = useState(false)
  const [viewMode, setViewMode] = useState(
    () => localStorage.getItem('agenda_view') || 'calendario'
  )

  const urlPath = location.pathname.toLowerCase()
  const mostrarFormulario =
    urlPath.includes('/agenda/novo') || urlPath.startsWith('/agenda/editar/')
  const modoFormulario = urlPath.includes('/agenda/novo')
    ? 'novo'
    : urlPath.startsWith('/agenda/editar/')
      ? 'editar'
      : null

  useEffect(() => {
    if (modoFormulario === 'editar' && params.eventoId) {
      setLoadingItem(true)
      getEvento(params.eventoId)
        .then((data) => setEventoParaEditar(data))
        .catch(() => navigate('/agenda'))
        .finally(() => setLoadingItem(false))
    } else if (modoFormulario === 'novo') {
      setEventoParaEditar(null)
    }
  }, [modoFormulario, params.eventoId, navigate])

  const handleAdicionarClick = () => {
    setEventoParaEditar(null)
    navigate('/agenda/novo')
  }

  const handleEditarEvento = (evento) => navigate(`/agenda/editar/${evento.id}`)

  const handleFormularioFechado = useCallback(() => {
    setRefreshKey((k) => k + 1)
    setEventoParaEditar(null)
    navigate('/agenda')
  }, [navigate])

  const handleViewChange = (mode) => {
    setViewMode(mode)
    localStorage.setItem('agenda_view', mode)
  }

  if (loadingItem && modoFormulario === 'editar') {
    return (
      <div className="d-flex justify-content-center align-items-center p-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Carregando evento...</span>
        </div>
        <span className="ms-3 text-muted">Carregando dados do evento...</span>
      </div>
    )
  }

  if (mostrarFormulario) {
    return (
      <EventoAgendaForm
        eventoParaEditar={eventoParaEditar}
        onEventoChange={handleFormularioFechado}
        onCancel={() => {
          setEventoParaEditar(null)
          navigate('/agenda')
        }}
      />
    )
  }

  return (
    <div className="container-fluid py-3 px-3 px-lg-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div
          className="btn-group shadow-sm"
          role="group"
          aria-label="Modo de visualização da agenda"
        >
          <button
            type="button"
            className={`btn btn-sm ${viewMode === 'calendario' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => handleViewChange('calendario')}
          >
            <CalendarDaysIcon
              style={{ width: 15, height: 15, display: 'inline', marginRight: 5, marginBottom: 2 }}
            />
            Calendário
          </button>
          <button
            type="button"
            className={`btn btn-sm ${viewMode === 'lista' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => handleViewChange('lista')}
          >
            <ListBulletIcon
              style={{ width: 15, height: 15, display: 'inline', marginRight: 5, marginBottom: 2 }}
            />
            Lista
          </button>
        </div>

        {viewMode === 'lista' && (
          <button
            className="btn btn-primary btn-sm rounded-pill px-3 shadow-sm"
            onClick={handleAdicionarClick}
          >
            <PlusIcon
              style={{ width: 15, height: 15, display: 'inline', marginRight: 4, marginBottom: 2 }}
            />
            Novo Evento
          </button>
        )}
      </div>

      {viewMode === 'calendario' ? (
        <CalendarView key={refreshKey} />
      ) : (
        <EventoAgendaList key={refreshKey} onEditEvento={handleEditarEvento} />
      )}
    </div>
  )
}

export default AgendaPage
