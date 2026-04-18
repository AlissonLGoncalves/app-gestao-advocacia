// src/ClienteList.jsx
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_URL } from './config.js'
import {
  PencilSquareIcon,
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowsUpDownIcon,
  InformationCircleIcon,
  BriefcaseIcon,
  ChevronUpIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'react-toastify'
import GerarDocumentoModal from './components/GerarDocumentoModal.jsx'

function ClienteList({ onEditCliente, refreshKey }) {
  const navigate = useNavigate()
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [clienteDocumento, setClienteDocumento] = useState(null) // cliente selecionado para gerar doc

  const [searchTerm, setSearchTerm] = useState('')
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('')
  const [tipoPessoaFilter, setTipoPessoaFilter] = useState('')

  const [sortConfig, setSortConfig] = useState({ key: 'nome_razao_social', direction: 'asc' })

  // Estados para exibição dos Casos/Processos (CRM View)
  const [expandedRowId, setExpandedRowId] = useState(null)
  const [clienteCasos, setClienteCasos] = useState({})
  const [loadingCasos, setLoadingCasos] = useState({})

  const abrirCasosDoCliente = (clienteId) => {
    navigate(`/casos?cliente_id=${clienteId}`)
  }

  const fetchClientes = useCallback(async () => {
    setLoading(true)
    setError('')

    const token = localStorage.getItem('token')
    if (!token) {
      setError('Autenticação necessária.')
      setLoading(false)
      toast.error('Sessão expirada ou inválida. Por favor, faça login novamente.')
      // Idealmente, redirecionar para login
      return
    }
    const authHeaders = { Authorization: `Bearer ${token}` }

    let url = `${API_URL}/clientes/?sort_by=${sortConfig.key}&sort_order=${sortConfig.direction}` // Adicionada barra final
    if (appliedSearchTerm) {
      url += `&search=${encodeURIComponent(appliedSearchTerm)}`
    }
    if (tipoPessoaFilter) {
      url += `&tipo_pessoa=${encodeURIComponent(tipoPessoaFilter)}`
    }

    try {
      const response = await fetch(url, { headers: authHeaders })
      if (!response.ok) {
        const resData = await response.json().catch(() => ({}))
        console.error('ClienteList: Erro da API ao buscar clientes:', resData)
        throw new Error(resData.erro || `Erro HTTP: ${response.status} ao buscar clientes`)
      }
      const data = await response.json()
      setClientes(Array.isArray(data) ? data : data.clientes || [])
    } catch (err) {
      console.error('ClienteList: Erro detalhado ao buscar clientes:', err)
      setError(`Erro ao carregar clientes: ${err.message}`)
      if (!err.message.includes('Autenticação')) {
        // Evita duplicar toast se já foi de token
        toast.error(`Erro ao carregar clientes: ${err.message}`)
      }
    } finally {
      setLoading(false)
    }
  }, [appliedSearchTerm, tipoPessoaFilter, sortConfig])

  useEffect(() => {
    fetchClientes()
  }, [fetchClientes, refreshKey])

  const handleToggleExpand = async (clienteId) => {
    if (expandedRowId === clienteId) {
      setExpandedRowId(null)
      return
    }
    setExpandedRowId(clienteId)

    if (!clienteCasos[clienteId]) {
      setLoadingCasos((prev) => ({ ...prev, [clienteId]: true }))
      try {
        const token = localStorage.getItem('token')
        const res = await fetch(`${API_URL}/casos?cliente_id=${clienteId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setClienteCasos((prev) => ({ ...prev, [clienteId]: data }))
        }
      } catch (e) {
        toast.error('Erro ao carregar casos do cliente.')
      } finally {
        setLoadingCasos((prev) => ({ ...prev, [clienteId]: false }))
      }
    }
  }

  const handleDeleteClick = async (id) => {
    const token = localStorage.getItem('token')
    if (!token) {
      toast.error('Autenticação expirada. Faça login novamente.')
      return
    }
    const authHeaders = { Authorization: `Bearer ${token}` }

    if (
      window.confirm(
        `Tem certeza que deseja excluir o cliente ID ${id}? Esta ação pode ser irreversível e afetar registos associados (casos, recebimentos, etc.).`
      )
    ) {
      setDeletingId(id)
      setError(null)
      try {
        const response = await fetch(`${API_URL}/clientes/${id}`, {
          method: 'DELETE',
          headers: authHeaders,
        })
        if (!response.ok) {
          const resData = await response.json().catch(() => ({}))
          console.error('ClienteList: Erro da API ao deletar cliente:', resData)
          if (
            response.status === 409 ||
            (resData.erro && resData.erro.toLowerCase().includes('associados'))
          ) {
            toast.error(
              resData.erro ||
                'Não é possível deletar o cliente pois existem registos associados a ele.'
            )
          } else {
            throw new Error(resData.erro || `Erro HTTP: ${response.status}`)
          }
        } else {
          toast.success(`Cliente ID ${id} excluído com sucesso!`)
          fetchClientes()
        }
      } catch (err) {
        console.error(`ClienteList: Erro ao deletar cliente ${id}:`, err)
        setError(`Erro ao deletar cliente: ${err.message}`)
        if (!err.message.toLowerCase().includes('associados')) {
          toast.error(`Erro ao deletar cliente: ${err.message}`)
        }
      } finally {
        setDeletingId(null)
      }
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

  const handleSearch = () => {
    setAppliedSearchTerm(searchTerm)
  }

  const resetFilters = () => {
    setSearchTerm('')
    setAppliedSearchTerm('')
    setTipoPessoaFilter('')
  }

  if (loading && clientes.length === 0) {
    return (
      <div className="d-flex justify-content-center align-items-center p-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">A carregar clientes...</span>
        </div>
        <span className="ms-3 text-muted">A carregar clientes...</span>
      </div>
    )
  }

  if (error && clientes.length === 0) {
    return (
      <div className="alert alert-danger m-3 small" role="alert">
        {error}
      </div>
    )
  }
  return (
    <div className="card shadow-sm">
      <div className="card-header bg-light p-3">
        <div className="row g-2 align-items-end">
          <div className="col-lg-5 col-md-6">
            <label
              htmlFor="searchTermClienteList"
              className="form-label form-label-sm visually-hidden"
            >
              Buscar
            </label>
            <div className="input-group input-group-sm">
              <input
                type="text"
                id="searchTermClienteList"
                className="form-control form-control-sm"
                placeholder="Buscar por Nome, CPF/CNPJ, Email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch()
                }}
              />
              <button className="btn btn-primary btn-sm" onClick={handleSearch}>
                Buscar
              </button>
            </div>
          </div>
          <div className="col-lg-4 col-md-6">
            <label
              htmlFor="tipoPessoaFilterClienteList"
              className="form-label form-label-sm visually-hidden"
            >
              Tipo
            </label>
            <select
              id="tipoPessoaFilterClienteList"
              className="form-select form-select-sm"
              value={tipoPessoaFilter}
              onChange={(e) => setTipoPessoaFilter(e.target.value)}
            >
              <option value="">Todos os Tipos</option>
              <option value="PF">Pessoa Física (PF)</option>
              <option value="PJ">Pessoa Jurídica (PJ)</option>
            </select>
          </div>
          <div className="col-lg-3 col-md-12 text-lg-end mt-2 mt-lg-0">
            <button
              onClick={resetFilters}
              className="btn btn-sm btn-outline-secondary py-1 px-2 w-100"
            >
              Limpar Filtros
            </button>
          </div>
        </div>
      </div>

      {error && clientes.length > 0 && (
        <div className="alert alert-warning m-3 small" role="alert">
          Erro ao atualizar a lista: {error}. Exibindo dados anteriores.
        </div>
      )}

      <div className="table-responsive">
        <table className="table table-hover table-striped table-sm mb-0 align-middle">
          <thead className="table-light">
            <tr>
              <th onClick={() => requestSort('nome_razao_social')} style={{ cursor: 'pointer' }}>
                Nome / Razão Social {getSortIcon('nome_razao_social')}
              </th>
              <th onClick={() => requestSort('cpf_cnpj')} style={{ cursor: 'pointer' }}>
                CPF / CNPJ Principal {getSortIcon('cpf_cnpj')}
              </th>
              <th onClick={() => requestSort('tipo_pessoa')} style={{ cursor: 'pointer' }}>
                Tipo {getSortIcon('tipo_pessoa')}
              </th>
              <th>Email</th>
              <th>Telefone</th>
              <th className="text-center" style={{ width: '150px' }}>
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && clientes.length > 0 && (
              <tr>
                <td colSpan="6" className="text-center p-4">
                  <div className="spinner-border spinner-border-sm text-primary" role="status">
                    <span className="visually-hidden">A atualizar...</span>
                  </div>
                </td>
              </tr>
            )}
            {!loading && clientes.length === 0 && !error && (
              <tr>
                <td colSpan="6" className="text-center text-muted p-4">
                  Nenhum cliente encontrado com os filtros aplicados.
                </td>
              </tr>
            )}
            {clientes.map((cliente) => (
              <React.Fragment key={cliente.id}>
                <tr className={expandedRowId === cliente.id ? 'table-active' : ''}>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="btn btn-link p-0 align-baseline fw-semibold text-decoration-underline"
                      onClick={() => abrirCasosDoCliente(cliente.id)}
                      title="Abrir casos/processos deste cliente"
                    >
                      {cliente.nome_razao_social}
                    </button>
                    {cliente.tipo_pessoa === 'PJ' &&
                      (cliente.cnpj_secundario || cliente.cnpj_terciario) && (
                        <InformationCircleIcon
                          className="ms-1 text-info d-inline"
                          style={{ width: '16px', height: '16px', cursor: 'help' }}
                          title={`CNPJs Adicionais: ${[cliente.cnpj_secundario, cliente.cnpj_terciario].filter(Boolean).join(', ')}`}
                        />
                      )}
                  </td>
                  <td className="px-3 py-2">{cliente.cpf_cnpj}</td>
                  <td className="px-3 py-2">{cliente.tipo_pessoa}</td>
                  <td className="px-3 py-2">{cliente.email || '-'}</td>
                  <td className="px-3 py-2">{cliente.telefone || '-'}</td>
                  <td className="px-3 py-2 text-center text-nowrap">
                    <button
                      onClick={() => handleToggleExpand(cliente.id)}
                      className={`btn btn-sm me-1 p-1 lh-1 ${expandedRowId === cliente.id ? 'btn-primary' : 'btn-outline-secondary'}`}
                      title="Ver Processos / Casos"
                      style={{
                        width: '30px',
                        height: '30px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {expandedRowId === cliente.id ? (
                        <ChevronUpIcon style={{ width: '16px', height: '16px' }} />
                      ) : (
                        <BriefcaseIcon style={{ width: '16px', height: '16px' }} />
                      )}
                    </button>
                    <button
                      onClick={() => onEditCliente(cliente)}
                      className="btn btn-sm btn-outline-primary me-1 p-1 lh-1"
                      title="Editar Cliente"
                      disabled={deletingId === cliente.id}
                      style={{
                        width: '30px',
                        height: '30px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <PencilSquareIcon style={{ width: '16px', height: '16px' }} />
                    </button>
                    <button
                      onClick={() => setClienteDocumento(cliente)}
                      className="btn btn-sm btn-outline-success me-1 p-1 lh-1"
                      title="Gerar Documento Jurídico"
                      disabled={deletingId === cliente.id}
                      style={{
                        width: '30px',
                        height: '30px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <DocumentTextIcon style={{ width: '16px', height: '16px' }} />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(cliente.id)}
                      className="btn btn-sm btn-outline-danger p-1 lh-1"
                      title="Deletar Cliente"
                      disabled={deletingId === cliente.id}
                      style={{
                        width: '30px',
                        height: '30px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {deletingId === cliente.id ? (
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
                {expandedRowId === cliente.id && (
                  <tr>
                    <td colSpan="6" className="p-0 border-bottom-0">
                      <div
                        className="bg-light px-4 py-3 border-bottom shadow-inner"
                        style={{ boxShadow: 'inset 0 3px 6px rgba(0,0,0,0.04)' }}
                      >
                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <h6 className="mb-0 text-primary fw-bold">
                            Processos e Casos ({clienteCasos[cliente.id]?.length || 0})
                          </h6>
                          <button
                            className="btn btn-sm btn-primary d-flex align-items-center gap-1"
                            onClick={() => navigate(`/casos/novo?cliente_id=${cliente.id}`)}
                          >
                            <BriefcaseIcon style={{ width: '14px', height: '14px' }} /> Novo
                            Processo
                          </button>
                        </div>

                        {loadingCasos[cliente.id] ? (
                          <div className="text-center py-3">
                            <span className="spinner-border spinner-border-sm text-primary"></span>
                          </div>
                        ) : clienteCasos[cliente.id] && clienteCasos[cliente.id].length > 0 ? (
                          <div className="card shadow-sm border-0">
                            <ul className="list-group list-group-flush small">
                              {clienteCasos[cliente.id].map((caso) => (
                                <li
                                  key={caso.id}
                                  className="list-group-item list-group-item-action d-flex justify-content-between align-items-center px-3 py-2 cursor-pointer"
                                  onClick={() => navigate(`/casos/detalhe/${caso.id}`)}
                                >
                                  <div>
                                    <span className="fw-semibold text-dark text-decoration-none">
                                      {caso.titulo}
                                    </span>
                                    {caso.numero_processo && (
                                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                                        {caso.numero_processo}
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <span
                                      className={`badge ${caso.status === 'Encerrado' || caso.status === 'Arquivado' ? 'bg-secondary' : 'bg-success'}`}
                                    >
                                      {caso.status}
                                    </span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <p className="text-muted small fst-italic mb-0 bg-white border border-dashed rounded p-3 text-center">
                            Nenhum caso documentado no CRM para este cliente. Pode cadastrar o
                            primeiro!
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {!loading && clientes.length > 0 && (
        <div className="card-footer bg-light text-muted p-2 text-end small">
          {clientes.length} cliente(s) encontrado(s)
        </div>
      )}

      {clienteDocumento && (
        <GerarDocumentoModal cliente={clienteDocumento} onClose={() => setClienteDocumento(null)} />
      )}
    </div>
  )
}

export default ClienteList
