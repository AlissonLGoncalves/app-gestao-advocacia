// src/DocumentoList.jsx
import React, { useState, useEffect, useCallback } from 'react'
import {
  PencilSquareIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowsUpDownIcon,
  EyeIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'react-toastify'
import { api } from './api/client.js'
import { deleteDocumento, downloadDocumento, listDocumentos } from './api/documentos.js'
import { useConfirm } from './hooks/useConfirm.jsx'
import useListData from './hooks/useListData.js'
import EmptyState from './components/EmptyState.jsx'

function DocumentoList({ onEditDocumento, refreshKey }) {
  const { confirm, ConfirmDialog } = useConfirm()
  const [clientes, setClientes] = useState([])
  const [casos, setCasos] = useState([])
  const [deletingId, setDeletingId] = useState(null)
  const [previewDoc, setPreviewDoc] = useState(null)
  const [previewBlobUrl, setPreviewBlobUrl] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const [searchTerm, setSearchTerm] = useState('')
  const [clienteFilter, setClienteFilter] = useState('')
  const [casoFilter, setCasoFilter] = useState('')

  const [sortConfig, setSortConfig] = useState({ key: 'data_upload', direction: 'desc' })

  const fetchClientesECasosParaFiltro = useCallback(async () => {
    try {
      const clientesData = await api.get('/clientes/?sort_by=nome_razao_social&order=asc')
      setClientes(clientesData.clientes || [])
      let casosUrl = '/casos/?sort_by=titulo&order=asc'
      if (clienteFilter) {
        casosUrl += `&cliente_id=${clienteFilter}`
      }
      const casosData = await api.get(casosUrl)
      setCasos(casosData.casos || [])
    } catch (err) {
      console.error('DocumentoList: Erro ao buscar clientes/casos para filtro:', err)
      toast.error(`Erro ao carregar dados para filtros de documentos: ${err.message}`)
    }
  }, [clienteFilter])

  const fetchDocumentos = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      toast.error('Sessão expirada ou inválida.')
      throw new Error('Autenticação necessária. Por favor, faça login.')
    }

    const params = {
      sort_by: sortConfig.key,
      sort_order: sortConfig.direction,
    }

    if (searchTerm) {
      params.search = searchTerm
    }

    if (casoFilter) {
      if (casoFilter === 'DOCUMENTO_GERAL_CLIENTE' && clienteFilter) {
        params.cliente_id = clienteFilter
        params.sem_caso = true
      } else if (casoFilter !== 'DOCUMENTO_GERAL_CLIENTE') {
        params.caso_id = casoFilter
      }
    } else if (clienteFilter) {
      params.cliente_id = clienteFilter
    }

    return listDocumentos(null, params)
  }, [searchTerm, clienteFilter, casoFilter, sortConfig])

  const handleFetchError = useCallback((err) => {
    console.error('DocumentoList: Erro detalhado ao buscar documentos:', err)
    if (!err.message.includes('Autenticação')) {
      toast.error(`Erro ao carregar documentos: ${err.message}`)
    }
  }, [])

  const {
    items: documentos,
    loading,
    error,
    setError,
    refetch: fetchDocumentosLista,
  } = useListData({
    fetcher: fetchDocumentos,
    mapData: (data) => data.documentos || [],
    errorPrefix: 'Erro ao carregar documentos',
    onError: handleFetchError,
    refreshKey,
  })

  useEffect(() => {
    fetchClientesECasosParaFiltro()
  }, [fetchClientesECasosParaFiltro])

  const handleDeleteClick = async (id) => {
    const token = localStorage.getItem('token')
    if (!token) {
      toast.error('Autenticação expirada. Faça login novamente.')
      return
    }

    const ok = await confirm(
      `Tem certeza que deseja excluir o documento ID ${id}? Esta ação também removerá o arquivo físico do servidor.`,
      'Excluir documento'
    )
    if (ok) {
      setDeletingId(id)
      setError(null)
      try {
        await deleteDocumento(id)
        toast.success(`Documento ID ${id} excluído com sucesso!`)
        fetchDocumentosLista()
      } catch (err) {
        console.error(`DocumentoList: Erro ao deletar documento ${id}:`, err)
        setError(`Erro ao deletar documento: ${err.message}`)
        toast.error(`Erro ao deletar documento: ${err.message}`)
      } finally {
        setDeletingId(null)
      }
    }
  }

  const handleDownloadClick = async (docId, fileName) => {
    try {
      const blob = await downloadDocumento(docId)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(`Erro ao baixar documento: ${err.message}`)
    }
  }

  const closePreview = () => {
    setPreviewBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setPreviewDoc(null)
    setPreviewLoading(false)
  }

  const handlePreviewClick = async (doc) => {
    setPreviewDoc(doc)
    setPreviewBlobUrl(null)
    setPreviewLoading(true)
    try {
      const blob = await downloadDocumento(doc.id)
      const ext = doc.nome_original_arquivo.split('.').pop().toLowerCase()
      const mimeMap = {
        pdf: 'application/pdf',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
        svg: 'image/svg+xml',
        bmp: 'image/bmp',
      }
      const typed = mimeMap[ext] ? new Blob([blob], { type: mimeMap[ext] }) : blob
      setPreviewBlobUrl(URL.createObjectURL(typed))
    } catch {
      toast.error('Erro ao carregar pré-visualização.')
      setPreviewDoc(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  const requestSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const getSortIcon = (key) => {
    const iconStyle = {
      width: '14px',
      height: '14px',
      display: 'inline',
      verticalAlign: 'text-bottom',
      marginLeft: '4px',
    }
    if (sortConfig.key !== key) return <ArrowsUpDownIcon className="text-muted" style={iconStyle} />
    if (sortConfig.direction === 'asc')
      return <ArrowUpIcon className="text-primary" style={iconStyle} />
    return <ArrowDownIcon className="text-primary" style={iconStyle} />
  }

  const formatBytes = (bytes, decimals = 2) => {
    if (!bytes || bytes === 0) return '0 Bytes'
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
  }

  const resetFilters = () => {
    setSearchTerm('')
    setClienteFilter('')
    setCasoFilter('')
  }

  if (loading && documentos.length === 0) {
    return (
      <div className="d-flex justify-content-center align-items-center p-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">A carregar documentos...</span>
        </div>
        <span className="ms-3 text-muted">A carregar documentos...</span>
      </div>
    )
  }

  if (error && documentos.length === 0) {
    return (
      <div className="alert alert-danger m-3 small" role="alert">
        {error}
      </div>
    )
  }
  const previewExt = previewDoc?.nome_original_arquivo?.split('.').pop().toLowerCase() ?? ''
  const isPreviewImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(previewExt)
  const isPreviewPdf = previewExt === 'pdf'

  return (
    <>
      {previewDoc && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1060 }}
          tabIndex="-1"
          onClick={(e) => {
            if (e.target === e.currentTarget) closePreview()
          }}
        >
          <div
            className="modal-dialog modal-xl modal-dialog-centered"
            style={{ maxHeight: '95vh' }}
          >
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '12px' }}>
              <div className="modal-header border-bottom py-2 px-4">
                <h6
                  className="modal-title fw-semibold mb-0 text-truncate"
                  style={{ maxWidth: '65%' }}
                >
                  {previewDoc.nome_original_arquivo}
                </h6>
                <div className="d-flex align-items-center gap-2">
                  <button
                    className="btn btn-sm btn-outline-success"
                    onClick={() =>
                      handleDownloadClick(previewDoc.id, previewDoc.nome_original_arquivo)
                    }
                  >
                    <ArrowDownTrayIcon style={{ width: 13, height: 13 }} className="me-1" />
                    Download
                  </button>
                  <button className="btn-close" onClick={closePreview} />
                </div>
              </div>
              <div
                className="modal-body p-0 d-flex align-items-center justify-content-center"
                style={{ minHeight: '60vh', overflow: 'hidden', borderRadius: '0 0 12px 12px' }}
              >
                {previewLoading && (
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Carregando...</span>
                  </div>
                )}
                {!previewLoading && previewBlobUrl && isPreviewPdf && (
                  <iframe
                    src={previewBlobUrl}
                    title={previewDoc.nome_original_arquivo}
                    style={{
                      width: '100%',
                      height: '82vh',
                      border: 'none',
                      borderRadius: '0 0 12px 12px',
                    }}
                  />
                )}
                {!previewLoading && previewBlobUrl && isPreviewImage && (
                  <div className="p-3" style={{ maxHeight: '82vh', overflow: 'auto' }}>
                    <img
                      src={previewBlobUrl}
                      alt={previewDoc.nome_original_arquivo}
                      style={{
                        maxWidth: '100%',
                        maxHeight: '78vh',
                        objectFit: 'contain',
                        borderRadius: '8px',
                      }}
                    />
                  </div>
                )}
                {!previewLoading && previewBlobUrl && !isPreviewPdf && !isPreviewImage && (
                  <div className="text-center py-5 px-4">
                    <DocumentTextIcon
                      style={{
                        width: 52,
                        height: 52,
                        color: '#d1d5db',
                        display: 'block',
                        margin: '0 auto 16px',
                      }}
                    />
                    <p className="text-muted mb-3">
                      Pré-visualização não disponível para este tipo de arquivo.
                    </p>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() =>
                        handleDownloadClick(previewDoc.id, previewDoc.nome_original_arquivo)
                      }
                    >
                      <ArrowDownTrayIcon style={{ width: 14, height: 14 }} className="me-1" />
                      Fazer download
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="card shadow-sm">
        {ConfirmDialog}
        <div className="card-header bg-light p-3">
          <h6 className="mb-2 text-secondary">Filtros e Busca de Documentos</h6>
          <div className="row g-2 align-items-end">
            <div className="col-lg-4 col-md-6">
              <label
                htmlFor="searchTermDocList"
                className="form-label form-label-sm visually-hidden"
              >
                Buscar
              </label>
              <input
                type="text"
                id="searchTermDocList"
                className="form-control form-control-sm"
                placeholder="Buscar por Nome do Arquivo/Descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="col-lg-3 col-md-6">
              <label
                htmlFor="clienteFilterDocList"
                className="form-label form-label-sm visually-hidden"
              >
                Filtrar por Cliente
              </label>
              <select
                id="clienteFilterDocList"
                className="form-select form-select-sm"
                value={clienteFilter}
                onChange={(e) => {
                  setClienteFilter(e.target.value)
                  setCasoFilter('')
                }}
              >
                <option value="">Todos os Clientes</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome_razao_social}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-lg-3 col-md-6">
              <label
                htmlFor="casoFilterDocList"
                className="form-label form-label-sm visually-hidden"
              >
                Filtrar por Caso
              </label>
              <select
                id="casoFilterDocList"
                className="form-select form-select-sm"
                value={casoFilter}
                onChange={(e) => setCasoFilter(e.target.value)}
                disabled={!clienteFilter && casos.length === 0}
              >
                <option value="">Todos os Casos/Documentos do Cliente</option>
                {clienteFilter && (
                  <option value="DOCUMENTO_GERAL_CLIENTE">
                    Apenas Documentos do Cliente (Sem Caso)
                  </option>
                )}
                {(clienteFilter
                  ? casos.filter((c) => String(c.cliente_id) === clienteFilter)
                  : casos
                ).map((cs) => (
                  <option key={cs.id} value={cs.id}>
                    {cs.titulo}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-lg-2 col-md-12 text-lg-end mt-2 mt-lg-0">
              <button
                onClick={resetFilters}
                className="btn btn-sm btn-outline-secondary py-1 px-2 w-100"
              >
                Limpar Filtros
              </button>
            </div>
          </div>
        </div>

        {error && documentos.length > 0 && (
          <div className="alert alert-warning m-3 small" role="alert">
            Erro ao atualizar a lista: {error}. Exibindo dados anteriores.
          </div>
        )}

        <div className="table-responsive">
          <table className="table table-hover table-striped table-sm mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th
                  onClick={() => requestSort('nome_original_arquivo')}
                  style={{ cursor: 'pointer' }}
                >
                  Nome Arquivo {getSortIcon('nome_original_arquivo')}
                </th>
                <th onClick={() => requestSort('descricao')} style={{ cursor: 'pointer' }}>
                  Descrição {getSortIcon('descricao')}
                </th>
                <th onClick={() => requestSort('cliente_nome')} style={{ cursor: 'pointer' }}>
                  Cliente {getSortIcon('cliente_nome')}
                </th>
                <th onClick={() => requestSort('caso_titulo')} style={{ cursor: 'pointer' }}>
                  Caso {getSortIcon('caso_titulo')}
                </th>
                <th onClick={() => requestSort('data_upload')} style={{ cursor: 'pointer' }}>
                  Upload {getSortIcon('data_upload')}
                </th>
                <th onClick={() => requestSort('tamanho_bytes')} style={{ cursor: 'pointer' }}>
                  Tamanho {getSortIcon('tamanho_bytes')}
                </th>
                <th className="text-center" style={{ width: '120px' }}>
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && documentos.length > 0 && (
                <tr>
                  <td colSpan="7" className="text-center p-4">
                    <div className="spinner-border spinner-border-sm text-primary" role="status">
                      <span className="visually-hidden">A atualizar...</span>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && documentos.length === 0 && !error && (
                <tr>
                  <td colSpan="7">
                    <EmptyState
                      icon={DocumentTextIcon}
                      title="Nenhum documento armazenado"
                      description="Faça upload de contratos, procurações e outros documentos do caso."
                      actionLabel="Novo Documento"
                      onAction={() => onEditDocumento(null)}
                      filtered={!!(searchTerm || clienteFilter || casoFilter)}
                      onClearFilters={resetFilters}
                    />
                  </td>
                </tr>
              )}
              {documentos.map((doc) => (
                <tr key={doc.id}>
                  <td
                    className="px-3 py-2 text-truncate"
                    style={{ maxWidth: '200px' }}
                    title={doc.nome_original_arquivo}
                  >
                    {doc.nome_original_arquivo}
                  </td>
                  <td
                    className="px-3 py-2 text-truncate"
                    style={{ maxWidth: '250px' }}
                    title={doc.descricao}
                  >
                    {doc.descricao || '-'}
                  </td>
                  <td className="px-3 py-2">{doc.cliente_nome || '-'}</td>
                  <td className="px-3 py-2">
                    {doc.caso_titulo || (doc.cliente_id ? 'Documento do Cliente (Geral)' : '-')}
                  </td>
                  <td className="px-3 py-2">
                    {doc.data_upload ? new Date(doc.data_upload).toLocaleDateString('pt-BR') : '-'}
                  </td>
                  <td className="px-3 py-2">{formatBytes(doc.tamanho_bytes)}</td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => handlePreviewClick(doc)}
                      className="btn btn-sm btn-outline-info me-1 p-1 lh-1"
                      title="Pré-visualizar"
                      style={{
                        width: '30px',
                        height: '30px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <EyeIcon style={{ width: '16px', height: '16px' }} />
                    </button>
                    <button
                      onClick={() => handleDownloadClick(doc.id, doc.nome_original_arquivo)}
                      className="btn btn-sm btn-outline-success me-1 p-1 lh-1"
                      title="Download"
                      style={{
                        width: '30px',
                        height: '30px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <ArrowDownTrayIcon style={{ width: '16px', height: '16px' }} />
                    </button>
                    <button
                      onClick={() => onEditDocumento(doc)}
                      className="btn btn-sm btn-outline-primary me-1 p-1 lh-1"
                      title="Editar Metadados"
                      style={{
                        width: '30px',
                        height: '30px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      disabled={deletingId === doc.id}
                    >
                      <PencilSquareIcon style={{ width: '16px', height: '16px' }} />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(doc.id)}
                      className="btn btn-sm btn-outline-danger p-1 lh-1"
                      title="Deletar"
                      style={{
                        width: '30px',
                        height: '30px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      disabled={deletingId === doc.id}
                    >
                      {deletingId === doc.id ? (
                        <div
                          className="spinner-border spinner-border-sm"
                          role="status"
                          style={{ width: '1rem', height: '1rem' }}
                        ></div>
                      ) : (
                        <TrashIcon style={{ width: '16px', height: '16px' }} />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && documentos.length > 0 && (
          <div className="card-footer bg-light text-muted p-2 text-end small">
            {documentos.length} documento(s) encontrado(s)
          </div>
        )}
      </div>
    </>
  )
}

export default DocumentoList
