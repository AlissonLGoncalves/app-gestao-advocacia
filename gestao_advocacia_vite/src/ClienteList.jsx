// src/ClienteList.jsx
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_URL } from './config.js'
import { deleteCliente, listClientes } from './api/clientes.js'
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
  UsersIcon,
  FunnelIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'react-toastify'
import GerarDocumentoModal from './components/GerarDocumentoModal.jsx'
import { useConfirm } from './hooks/useConfirm.jsx'
import EmptyState from './components/EmptyState.jsx'

function ClienteList({ onEditCliente, refreshKey }) {
  const navigate = useNavigate()
  const { confirm, ConfirmDialog } = useConfirm()
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [clienteDocumento, setClienteDocumento] = useState(null) // cliente selecionado para gerar doc

  const [searchTerm, setSearchTerm] = useState('')
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('')
  const [tipoPessoaFilter, setTipoPessoaFilter] = useState('')
  const [cidadeFilter, setCidadeFilter] = useState('')
  const [estadoFilter, setEstadoFilter] = useState('')
  const [profissaoFilter, setProfissaoFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)

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

    try {
      const data = await listClientes({
        sort_by: sortConfig.key,
        sort_order: sortConfig.direction,
        search: appliedSearchTerm,
        tipo_pessoa: tipoPessoaFilter,
        cidade: cidadeFilter,
        estado: estadoFilter,
        profissao: profissaoFilter,
      })
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
  }, [appliedSearchTerm, tipoPessoaFilter, cidadeFilter, estadoFilter, profissaoFilter, sortConfig])

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
    const ok = await confirm(
      `Tem certeza que deseja excluir o cliente ID ${id}? Esta ação pode ser irreversível e afetar registos associados (casos, recebimentos, etc.).`,
      'Excluir cliente'
    )
    if (ok) {
      setDeletingId(id)
      setError(null)
      try {
        await deleteCliente(id)
        toast.success(`Cliente ID ${id} excluído com sucesso!`)
        fetchClientes()
      } catch (err) {
        const resData = err.payload || {}
        console.error(`ClienteList: Erro ao deletar cliente ${id}:`, err)
        if (
          err.status === 409 ||
          (resData.erro && resData.erro.toLowerCase().includes('associados'))
        ) {
          toast.error(
            resData.erro ||
              'Não é possível deletar o cliente pois existem registos associados a ele.'
          )
        } else {
          setError(`Erro ao deletar cliente: ${err.message}`)
          if (!err.message.toLowerCase().includes('associados')) {
            toast.error(`Erro ao deletar cliente: ${err.message}`)
          }
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
    setCidadeFilter('')
    setEstadoFilter('')
    setProfissaoFilter('')
    setShowFilters(false)
  }

  const filtrosAtivos = [
    appliedSearchTerm && {
      label: `Busca: ${appliedSearchTerm}`,
      clear: () => {
        setSearchTerm('')
        setAppliedSearchTerm('')
      },
    },
    tipoPessoaFilter && {
      label: `Tipo: ${tipoPessoaFilter}`,
      clear: () => setTipoPessoaFilter(''),
    },
    cidadeFilter && { label: `Cidade: ${cidadeFilter}`, clear: () => setCidadeFilter('') },
    estadoFilter && { label: `UF: ${estadoFilter}`, clear: () => setEstadoFilter('') },
    profissaoFilter && {
      label: `Profissão: ${profissaoFilter}`,
      clear: () => setProfissaoFilter(''),
    },
  ].filter(Boolean)

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
      {ConfirmDialog}
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
            <div className="btn-group w-100" role="group">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary py-1 px-2 d-inline-flex align-items-center justify-content-center"
                onClick={() => setShowFilters((v) => !v)}
                aria-expanded={showFilters}
                aria-controls="filtrosAvancadosClientes"
              >
                <FunnelIcon style={{ width: 14, height: 14 }} className="me-1" />
                {showFilters ? 'Ocultar' : 'Avançados'}
              </button>
              <button
                type="button"
                onClick={resetFilters}
                className="btn btn-sm btn-outline-secondary py-1 px-2"
              >
                Limpar
              </button>
            </div>
          </div>
        </div>

        {showFilters && (
          <div className="mt-3 pt-3 border-top" id="filtrosAvancadosClientes">
            <div className="row g-2 align-items-center mb-2">
              <div className="col-md-5 col-sm-6">
                <label className="form-label form-label-sm mb-1">Cidade</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="contém..."
                  value={cidadeFilter}
                  onChange={(e) => setCidadeFilter(e.target.value)}
                />
              </div>
              <div className="col-md-2 col-sm-6">
                <label className="form-label form-label-sm mb-1">UF</label>
                <input
                  type="text"
                  maxLength={2}
                  className="form-control form-control-sm text-uppercase"
                  value={estadoFilter}
                  onChange={(e) => setEstadoFilter(e.target.value.toUpperCase())}
                />
              </div>
              <div className="col-md-5 col-sm-12">
                <label className="form-label form-label-sm mb-1">Profissão (PF)</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="contém..."
                  value={profissaoFilter}
                  onChange={(e) => setProfissaoFilter(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {filtrosAtivos.length > 0 && (
          <div className="mt-3 pt-3 border-top d-flex flex-wrap gap-2 align-items-center">
            <small className="text-muted me-1">Filtros ativos:</small>
            {filtrosAtivos.map((f, idx) => (
              <span
                key={idx}
                className="badge bg-primary-subtle text-primary-emphasis d-inline-flex align-items-center gap-1"
                style={{ fontSize: '0.72rem', padding: '4px 8px' }}
              >
                {f.label}
                <button
                  type="button"
                  className="btn btn-sm p-0 border-0 bg-transparent text-primary-emphasis"
                  onClick={f.clear}
                  aria-label="Remover filtro"
                  style={{ lineHeight: 1 }}
                >
                  <XMarkIcon style={{ width: 12, height: 12 }} />
                </button>
              </span>
            ))}
          </div>
        )}
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
                <td colSpan="6">
                  <EmptyState
                    icon={UsersIcon}
                    title="Nenhum cliente cadastrado"
                    description="Comece adicionando o primeiro cliente do escritório."
                    actionLabel="Novo Cliente"
                    onAction={() => onEditCliente(null)}
                    filtered={!!(searchTerm || tipoPessoaFilter)}
                    onClearFilters={resetFilters}
                  />
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
