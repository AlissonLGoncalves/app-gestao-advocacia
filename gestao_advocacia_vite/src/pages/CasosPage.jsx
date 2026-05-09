// src/pages/CasosPage.jsx
import React, { useState, useCallback, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import CasoList from '../CasoList.jsx' // Ajuste o caminho se CasoList.jsx não estiver em src/
import CasoForm from '../CasoForm.jsx' // Ajuste o caminho se CasoForm.jsx não estiver em src/
import BotaoAdicionar from '../components/BotaoAdicionar.jsx' // Ajuste o caminho se BotaoAdicionar.jsx não estiver em src/components/
import { getCaso } from '../api/casos.js'

function CasosPage() {
  const navigate = useNavigate()
  const params = useParams() // Para pegar :casoId da URL
  const location = useLocation() // Para verificar a rota atual e determinar o modo
  const [refreshKey, setRefreshKey] = useState(0) // Para forçar a atualização da lista
  const [casoParaEditar, setCasoParaEditar] = useState(null)
  const [loadingItem, setLoadingItem] = useState(false) // Estado para carregamento do item para edição

  // Determina se o formulário deve ser mostrado e em qual modo com base na URL
  const urlPath = location.pathname.toLowerCase() // Normaliza para minúsculas para segurança
  const mostrarFormulario = urlPath.includes('/casos/novo') || urlPath.startsWith('/casos/editar/')
  const modoFormulario = urlPath.includes('/casos/novo')
    ? 'novo'
    : urlPath.startsWith('/casos/editar/')
      ? 'editar'
      : null
  // Busca dados do caso para edição se estiver no modo de edição e casoId estiver presente
  useEffect(() => {
    if (modoFormulario === 'editar' && params.casoId) {
      setLoadingItem(true)
      getCaso(params.casoId)
        .then((data) => setCasoParaEditar(data))
        .catch((error) => {
          console.error('CasosPage: Erro ao buscar caso:', error)
          // Adicionar feedback para o utilizador, ex: toast
          navigate('/casos') // Volta para a lista em caso de erro
        })
        .finally(() => {
          setLoadingItem(false)
        })
    } else if (modoFormulario === 'novo') {
      setCasoParaEditar(null) // Garante que não há dados de edição anteriores
    }
  }, [modoFormulario, params.casoId, navigate])

  const handleAdicionarClick = () => {
    setCasoParaEditar(null) // Limpa qualquer estado de edição anterior
    navigate('/casos/novo')
  }

  const handleEditarCaso = (caso) => {
    navigate(`/casos/editar/${caso.id}`)
  }

  const handleFormularioFechado = useCallback(() => {
    setRefreshKey((prevKey) => prevKey + 1)
    setCasoParaEditar(null) // Limpa o estado de edição
    navigate('/casos') // Volta para a lista após fechar/salvar o formulário
  }, [navigate])

  if (loadingItem && modoFormulario === 'editar') {
    return (
      <div className="d-flex justify-content-center align-items-center p-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">A carregar caso...</span>
        </div>
        <span className="ms-3 text-muted">A carregar dados do caso...</span>
      </div>
    )
  }

  // Lê cliente_id da query string (ex: /casos/novo?cliente_id=3)
  const searchParams = new URLSearchParams(location.search)
  const clienteIdInicial = searchParams.get('cliente_id')

  if (mostrarFormulario) {
    return (
      <CasoForm
        casoParaEditar={casoParaEditar}
        clienteIdInicial={clienteIdInicial}
        onCasoChange={handleFormularioFechado}
        onCancel={() => {
          setCasoParaEditar(null)
          navigate('/casos')
        }}
      />
    )
  }
  return (
    <>
      <div className="d-flex gap-2 flex-wrap mb-3">
        <BotaoAdicionar texto="Adicionar Novo Caso" onClick={handleAdicionarClick} />
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => navigate('/casos/importar')}
          title="Triagem em lote: cole até 40 CNJs e veja o status de cada um"
        >
          Importar CNJs em lote
        </button>
      </div>
      <CasoList key={refreshKey} onEditCaso={handleEditarCaso} />
    </>
  )
}

export default CasosPage
