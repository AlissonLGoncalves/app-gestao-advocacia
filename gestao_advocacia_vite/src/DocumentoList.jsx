// src/DocumentoList.jsx
import React, { useState, useEffect, useCallback } from 'react'
import {
  PencilSquareIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowsUpDownIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'react-toastify'
import { api } from './api/client.js'
import { deleteDocumento, downloadDocumento, listDocumentos } from './api/documentos.js'

function DocumentoList({ onEditDocumento, refreshKey }) {
  const [documentos, setDocumentos] = useState([])
  const [clientes, setClientes] = useState([])
  const [casos, setCasos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)

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
    setLoading(true)
    setError('')
    const token = localStorage.getItem('token')
    if (!token) {
      setError('Autenticação necessária. Por favor, faça login.')
      setLoading(false)
      toast.error('Sessão expirada ou inválida.')
      return
    }
    try {
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

      const data = await listDocumentos(null, params)
      setDocumentos(data.documentos || [])
    } catch (err) {
      console.error('DocumentoList: Erro detalhado ao buscar documentos:', err)
      setError(`Erro ao carregar documentos: ${err.message}`)
      if (!err.message.includes('Autenticação')) {
        toast.error(`Erro ao carregar documentos: ${err.message}`)
      }
    } finally {
      setLoading(false)
    }
  }, [searchTerm, clienteFilter, casoFilter, sortConfig])

  useEffect(() => {
    fetchClientesECasosParaFiltro()
  }, [fetchClientesECasosParaFiltro])

  useEffect(() => {
    fetchDocumentos()
  }, [fetchDocumentos, refreshKey])

  const handleDeleteClick = async (id) => {
    const token = localStorage.getItem('token')
    if (!token) {
      toast.error('Autenticação expirada. Faça login novamente.')
      return
    }

    if (
      window.confirm(
        `Tem certeza que deseja excluir o documento ID ${id}? Esta ação também removerá o arquivo físico do servidor.`
      )
    ) {
      setDeletingId(id)
      setError(null)
      try {
        await deleteDocumento(id)
        toast.success(`Documento ID ${id} excluído com sucesso!`)
        fetchDocumentos()
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
  return (
    <div className="card shadow-sm">
      <div className="card-header bg-light p-3">
        <h6 className="mb-2 text-secondary">Filtros e Busca de Documentos</h6>
        <div className="row g-2 align-items-end">
          <div className="col-lg-4 col-md-6">
            <label htmlFor="searchTermDocList" className="form-label form-label-sm visually-hidden">
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
            <label htmlFor="casoFilterDocList" className="form-label form-label-sm visually-hidden">
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
                <td colSpan="7" className="text-center text-muted p-4">
                  Nenhum documento encontrado com os filtros aplicados.
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
  )
}

export default DocumentoList
