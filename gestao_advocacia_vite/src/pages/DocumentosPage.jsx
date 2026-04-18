// src/pages/DocumentosPage.jsx
import React, { useState, useCallback, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import DocumentoList from '../DocumentoList.jsx' // Ajuste o caminho se DocumentoList.jsx não estiver em src/
import DocumentoForm from '../DocumentoForm.jsx' // Ajuste o caminho se DocumentoForm.jsx não estiver em src/
import BotaoAdicionar from '../components/BotaoAdicionar.jsx' // Ajuste o caminho se BotaoAdicionar.jsx não estiver em src/components/
import { API_URL } from '../config.js' // Ajuste o caminho se config.js não estiver em src/

function DocumentosPage() {
  const navigate = useNavigate()
  const params = useParams() // Para pegar :documentoId da URL
  const location = useLocation() // Para verificar a rota atual e determinar o modo
  const [refreshKey, setRefreshKey] = useState(0) // Para forçar a atualização da lista
  const [documentoParaEditar, setDocumentoParaEditar] = useState(null)
  const [loadingItem, setLoadingItem] = useState(false) // Estado para carregamento do item para edição

  // Determina se o formulário deve ser mostrado e em qual modo com base na URL
  const urlPath = location.pathname.toLowerCase()
  const mostrarFormulario =
    urlPath.includes('/documentos/novo') || urlPath.startsWith('/documentos/editar/')
  const modoFormulario = urlPath.includes('/documentos/novo')
    ? 'novo'
    : urlPath.startsWith('/documentos/editar/')
      ? 'editar'
      : null
  // Busca metadados do documento para edição se estiver no modo de edição e documentoId estiver presente
  useEffect(() => {
    if (modoFormulario === 'editar' && params.documentoId) {
      setLoadingItem(true)
      // Assumindo que sua API tem um endpoint para buscar metadados de um documento por ID.
      // Se não tiver, o DocumentoForm pode precisar apenas do ID e o DocumentoList já passou os dados.
      // No entanto, buscar aqui garante dados mais recentes.
      fetch(`${API_URL}/documentos/${params.documentoId}`) // Crie este endpoint na sua API se não existir
        .then((response) => {
          if (!response.ok) {
            console.error(
              `DocumentosPage: Falha ao buscar metadados do documento ${params.documentoId}. Status: ${response.status}`
            )
            throw new Error('Falha ao buscar metadados do documento para edição.')
          }
          return response.json()
        })
        .then((data) => {
          setDocumentoParaEditar(data)
        })
        .catch((error) => {
          console.error('DocumentosPage: Erro ao buscar metadados do documento:', error)
          navigate('/documentos') // Volta para a lista em caso de erro
        })
        .finally(() => {
          setLoadingItem(false)
        })
    } else if (modoFormulario === 'novo') {
      setDocumentoParaEditar(null) // Garante que não há dados de edição anteriores
    }
  }, [modoFormulario, params.documentoId, navigate])

  const handleAdicionarClick = () => {
    setDocumentoParaEditar(null) // Limpa qualquer estado de edição anterior
    navigate('/documentos/novo')
  }

  const handleEditarDocumento = (documento) => {
    // Para documentos, o DocumentoForm lidará principalmente com metadados.
    // A navegação acionará o useEffect para buscar os metadados se necessário.
    navigate(`/documentos/editar/${documento.id}`)
  }

  const handleFormularioFechado = useCallback(() => {
    setRefreshKey((prevKey) => prevKey + 1)
    setDocumentoParaEditar(null) // Limpa o estado de edição
    navigate('/documentos') // Volta para a lista após fechar/salvar o formulário
  }, [navigate])

  if (loadingItem && modoFormulario === 'editar') {
    return (
      <div className="d-flex justify-content-center align-items-center p-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">A carregar metadados...</span>
        </div>
        <span className="ms-3 text-muted">A carregar metadados do documento...</span>
      </div>
    )
  }

  if (mostrarFormulario) {
    return (
      <DocumentoForm
        documentoParaEditar={documentoParaEditar} // Se for novo, será null
        onDocumentoChange={handleFormularioFechado}
        onCancel={() => {
          setDocumentoParaEditar(null)
          navigate('/documentos')
        }}
      />
    )
  }
  return (
    <>
      <BotaoAdicionar texto="Adicionar Novo Documento" onClick={handleAdicionarClick} />
      <DocumentoList key={refreshKey} onEditDocumento={handleEditarDocumento} />
    </>
  )
}

export default DocumentosPage
