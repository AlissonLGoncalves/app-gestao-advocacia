// src/pages/AgendaPage.jsx
import React, { useState, useCallback, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import EventoAgendaList from '../EventoAgendaList.jsx' // Ajuste o caminho se EventoAgendaList.jsx não estiver em src/
import EventoAgendaForm from '../EventoAgendaForm.jsx' // Ajuste o caminho se EventoAgendaForm.jsx não estiver em src/
import BotaoAdicionar from '../components/BotaoAdicionar.jsx' // Ajuste o caminho se BotaoAdicionar.jsx não estiver em src/components/
import { API_URL } from '../config.js' // Ajuste o caminho se config.js não estiver em src/

function AgendaPage() {
  const navigate = useNavigate()
  const params = useParams() // Para pegar :eventoId da URL
  const location = useLocation() // Para verificar a rota atual e determinar o modo
  const [refreshKey, setRefreshKey] = useState(0) // Para forçar a atualização da lista
  const [eventoParaEditar, setEventoParaEditar] = useState(null)
  const [loadingItem, setLoadingItem] = useState(false) // Estado para carregamento do item para edição

  // Determina se o formulário deve ser mostrado e em qual modo com base na URL
  const urlPath = location.pathname.toLowerCase()
  const mostrarFormulario =
    urlPath.includes('/agenda/novo') || urlPath.startsWith('/agenda/editar/')
  const modoFormulario = urlPath.includes('/agenda/novo')
    ? 'novo'
    : urlPath.startsWith('/agenda/editar/')
      ? 'editar'
      : null
  // Busca dados do evento para edição se estiver no modo de edição e eventoId estiver presente
  useEffect(() => {
    if (modoFormulario === 'editar' && params.eventoId) {
      setLoadingItem(true)
      fetch(`${API_URL}/eventos/${params.eventoId}`)
        .then((response) => {
          if (!response.ok) {
            console.error(
              `AgendaPage: Falha ao buscar evento ${params.eventoId}. Status: ${response.status}`
            )
            throw new Error('Falha ao buscar evento para edição.')
          }
          return response.json()
        })
        .then((data) => {
          setEventoParaEditar(data)
        })
        .catch((error) => {
          console.error('AgendaPage: Erro ao buscar evento:', error)
          navigate('/agenda') // Volta para a lista em caso de erro
        })
        .finally(() => {
          setLoadingItem(false)
        })
    } else if (modoFormulario === 'novo') {
      setEventoParaEditar(null) // Garante que não há dados de edição anteriores
    }
  }, [modoFormulario, params.eventoId, navigate])

  const handleAdicionarClick = () => {
    setEventoParaEditar(null) // Limpa qualquer estado de edição anterior
    navigate('/agenda/novo')
  }

  const handleEditarEvento = (evento) => {
    navigate(`/agenda/editar/${evento.id}`)
  }

  const handleFormularioFechado = useCallback(() => {
    setRefreshKey((prevKey) => prevKey + 1)
    setEventoParaEditar(null) // Limpa o estado de edição
    navigate('/agenda') // Volta para a lista após fechar/salvar o formulário
  }, [navigate])

  if (loadingItem && modoFormulario === 'editar') {
    return (
      <div className="d-flex justify-content-center align-items-center p-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">A carregar evento...</span>
        </div>
        <span className="ms-3 text-muted">A carregar dados do evento...</span>
      </div>
    )
  }

  if (mostrarFormulario) {
    return (
      <EventoAgendaForm
        eventoParaEditar={eventoParaEditar} // Se for novo, será null
        onEventoChange={handleFormularioFechado}
        onCancel={() => {
          setEventoParaEditar(null)
          navigate('/agenda')
        }}
      />
    )
  }
  return (
    <>
      <BotaoAdicionar texto="Adicionar Novo Evento" onClick={handleAdicionarClick} />
      <EventoAgendaList key={refreshKey} onEditEvento={handleEditarEvento} />
    </>
  )
}

export default AgendaPage
