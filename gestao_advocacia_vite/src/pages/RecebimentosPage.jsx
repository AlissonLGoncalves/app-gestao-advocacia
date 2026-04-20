// src/pages/RecebimentosPage.jsx
import React, { useState, useCallback, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import RecebimentoList from '../RecebimentoList.jsx' // Ajuste o caminho se RecebimentoList.jsx não estiver em src/
import RecebimentoForm from '../RecebimentoForm.jsx' // Ajuste o caminho se RecebimentoForm.jsx não estiver em src/
import BotaoAdicionar from '../components/BotaoAdicionar.jsx' // Ajuste o caminho se BotaoAdicionar.jsx não estiver em src/components/
import { getRecebimento } from '../api/financeiro.js'

function RecebimentosPage() {
  const navigate = useNavigate()
  const params = useParams() // Para pegar :recebimentoId da URL
  const location = useLocation() // Para verificar a rota atual e determinar o modo
  const [refreshKey, setRefreshKey] = useState(0) // Para forçar a atualização da lista
  const [recebimentoParaEditar, setRecebimentoParaEditar] = useState(null)
  const [loadingItem, setLoadingItem] = useState(false) // Estado para carregamento do item para edição

  // Determina se o formulário deve ser mostrado e em qual modo com base na URL
  const urlPath = location.pathname.toLowerCase()
  const mostrarFormulario =
    urlPath.includes('/recebimentos/novo') || urlPath.startsWith('/recebimentos/editar/')
  const modoFormulario = urlPath.includes('/recebimentos/novo')
    ? 'novo'
    : urlPath.startsWith('/recebimentos/editar/')
      ? 'editar'
      : null
  // Busca dados do recebimento para edição se estiver no modo de edição e recebimentoId estiver presente
  useEffect(() => {
    if (modoFormulario === 'editar' && params.recebimentoId) {
      setLoadingItem(true)
      getRecebimento(params.recebimentoId)
        .then((data) => {
          setRecebimentoParaEditar(data)
        })
        .catch((error) => {
          console.error('RecebimentosPage: Erro ao buscar recebimento:', error)
          navigate('/recebimentos') // Volta para a lista em caso de erro
        })
        .finally(() => {
          setLoadingItem(false)
        })
    } else if (modoFormulario === 'novo') {
      setRecebimentoParaEditar(null) // Garante que não há dados de edição anteriores
    }
  }, [modoFormulario, params.recebimentoId, navigate])

  const handleAdicionarClick = () => {
    setRecebimentoParaEditar(null) // Limpa qualquer estado de edição anterior
    navigate('/recebimentos/novo')
  }

  const handleEditarRecebimento = (recebimento) => {
    navigate(`/recebimentos/editar/${recebimento.id}`)
  }

  const handleFormularioFechado = useCallback(() => {
    setRefreshKey((prevKey) => prevKey + 1)
    setRecebimentoParaEditar(null) // Limpa o estado de edição
    navigate('/recebimentos') // Volta para a lista após fechar/salvar o formulário
  }, [navigate])

  if (loadingItem && modoFormulario === 'editar') {
    return (
      <div className="d-flex justify-content-center align-items-center p-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">A carregar recebimento...</span>
        </div>
        <span className="ms-3 text-muted">A carregar dados do recebimento...</span>
      </div>
    )
  }

  if (mostrarFormulario) {
    return (
      <RecebimentoForm
        recebimentoParaEditar={recebimentoParaEditar} // Se for novo, será null
        onRecebimentoChange={handleFormularioFechado}
        onCancel={() => {
          setRecebimentoParaEditar(null)
          navigate('/recebimentos')
        }}
      />
    )
  }
  return (
    <>
      <BotaoAdicionar texto="Adicionar Novo Recebimento" onClick={handleAdicionarClick} />
      <RecebimentoList key={refreshKey} onEditRecebimento={handleEditarRecebimento} />
    </>
  )
}

export default RecebimentosPage
