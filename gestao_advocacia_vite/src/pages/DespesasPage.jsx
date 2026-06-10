// src/pages/DespesasPage.jsx
import React, { useState, useCallback, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import DespesaList from '../components/DespesaList.jsx' // Ajuste o caminho se DespesaList.jsx não estiver em src/
import DespesaForm from '../components/DespesaForm.jsx' // Ajuste o caminho se DespesaForm.jsx não estiver em src/
import BotaoAdicionar from '../components/BotaoAdicionar.jsx' // Ajuste o caminho se BotaoAdicionar.jsx não estiver em src/components/
import { getDespesa } from '../api/financeiro.js'

function DespesasPage() {
  const navigate = useNavigate()
  const params = useParams() // Para pegar :despesaId da URL
  const location = useLocation() // Para verificar a rota atual e determinar o modo
  const [refreshKey, setRefreshKey] = useState(0) // Para forçar a atualização da lista
  const [despesaParaEditar, setDespesaParaEditar] = useState(null)
  const [loadingItem, setLoadingItem] = useState(false) // Estado para carregamento do item para edição

  // Determina se o formulário deve ser mostrado e em qual modo com base na URL
  const urlPath = location.pathname.toLowerCase()
  const mostrarFormulario =
    urlPath.includes('/despesas/novo') || urlPath.startsWith('/despesas/editar/')
  const modoFormulario = urlPath.includes('/despesas/novo')
    ? 'novo'
    : urlPath.startsWith('/despesas/editar/')
      ? 'editar'
      : null
  // Busca dados da despesa para edição se estiver no modo de edição e despesaId estiver presente
  useEffect(() => {
    if (modoFormulario === 'editar' && params.despesaId) {
      setLoadingItem(true)
      getDespesa(params.despesaId)
        .then((data) => {
          setDespesaParaEditar(data)
        })
        .catch((error) => {
          console.error('DespesasPage: Erro ao buscar despesa:', error)
          navigate('/despesas') // Volta para a lista em caso de erro
        })
        .finally(() => {
          setLoadingItem(false)
        })
    } else if (modoFormulario === 'novo') {
      setDespesaParaEditar(null) // Garante que não há dados de edição anteriores
    }
  }, [modoFormulario, params.despesaId, navigate])

  const handleAdicionarClick = () => {
    setDespesaParaEditar(null) // Limpa qualquer estado de edição anterior
    navigate('/despesas/novo')
  }

  const handleEditarDespesa = (despesa) => {
    navigate(`/despesas/editar/${despesa.id}`)
  }

  const handleFormularioFechado = useCallback(() => {
    setRefreshKey((prevKey) => prevKey + 1)
    setDespesaParaEditar(null) // Limpa o estado de edição
    navigate('/despesas') // Volta para a lista após fechar/salvar o formulário
  }, [navigate])

  if (loadingItem && modoFormulario === 'editar') {
    return (
      <div className="d-flex justify-content-center align-items-center p-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">A carregar despesa...</span>
        </div>
        <span className="ms-3 text-muted">A carregar dados da despesa...</span>
      </div>
    )
  }

  if (mostrarFormulario) {
    return (
      <DespesaForm
        despesaParaEditar={despesaParaEditar} // Se for novo, será null
        onDespesaChange={handleFormularioFechado}
        onCancel={() => {
          setDespesaParaEditar(null)
          navigate('/despesas')
        }}
      />
    )
  }
  return (
    <>
      <BotaoAdicionar texto="Adicionar Nova Despesa" onClick={handleAdicionarClick} />
      <DespesaList key={refreshKey} onEditDespesa={handleEditarDespesa} />
    </>
  )
}

export default DespesasPage
