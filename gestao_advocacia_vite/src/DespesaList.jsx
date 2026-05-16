// src/DespesaList.jsx
import React, { useState, useEffect, useCallback } from 'react'
import {
  PencilSquareIcon,
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowsUpDownIcon,
  FunnelIcon,
  DocumentArrowDownIcon,
  BanknotesIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'react-toastify'
import { exportarParaPDF } from './utils/pdfGenerator.js'
import { api } from './api/client.js'
import { deleteDespesa, listDespesas, marcarDespesaPaga } from './api/financeiro.js'
import { useConfirm } from './hooks/useConfirm.jsx'
import useListData from './hooks/useListData.js'
import EmptyState from './components/EmptyState.jsx'

function DespesaList({ onEditDespesa, refreshKey }) {
  const { confirm, ConfirmDialog } = useConfirm()
  const [clientes, setClientes] = useState([])
  const [casos, setCasos] = useState([])
  const [deletingId, setDeletingId] = useState(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [clienteFilter, setClienteFilter] = useState('')
  const [casoFilter, setCasoFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  // Quick filters (mesma logica da RecebimentoList): filtragem local sobre
  // o resultado do backend pra resposta instantanea.
  const [quickFilter, setQuickFilter] = useState('todos') // todos|programadas|atrasadas|pagas
  const [markingPaidId, setMarkingPaidId] = useState(null)
  const [dataVencimentoInicio, setDataVencimentoInicio] = useState('')
  const [dataVencimentoFim, setDataVencimentoFim] = useState('')
  const [dataDespesaInicio, setDataDespesaInicio] = useState('')
  const [dataDespesaFim, setDataDespesaFim] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const [sortConfig, setSortConfig] = useState({ key: 'data_vencimento', direction: 'desc' })

  const fetchClientesECasosParaFiltro = useCallback(async () => {
    const hasToken =
      localStorage.getItem('token') ||
      localStorage.getItem('access_token') ||
      localStorage.getItem('auth_token')
    if (!hasToken) {
      // Não é ideal mostrar toast aqui, pois o fetch principal também verificará
      console.warn('DespesaList: Token não encontrado para fetchClientesECasosParaFiltro.')
      return
    }

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
      console.error('DespesaList: Erro ao buscar clientes/casos para filtro:', err)
      toast.error(`Erro ao carregar dados para filtros: ${err.message}`)
    }
  }, [clienteFilter])

  const fetchDespesas = useCallback(async () => {
    const hasToken =
      localStorage.getItem('token') ||
      localStorage.getItem('access_token') ||
      localStorage.getItem('auth_token')
    if (!hasToken) {
      toast.error('Sessão expirada ou inválida.')
      throw new Error('Autenticação necessária. Por favor, faça login.')
    }

    const params = {
      sort_by: sortConfig.key,
      sort_order: sortConfig.direction,
      search: searchTerm,
      status: statusFilter,
      data_vencimento_inicio: dataVencimentoInicio,
      data_vencimento_fim: dataVencimentoFim,
      data_despesa_inicio: dataDespesaInicio,
      data_despesa_fim: dataDespesaFim,
    }

    if (casoFilter) {
      params.caso_id = casoFilter === 'DESPESA_GERAL' ? -1 : casoFilter
    }

    return listDespesas(params)
  }, [
    searchTerm,
    clienteFilter,
    casoFilter,
    statusFilter,
    dataVencimentoInicio,
    dataVencimentoFim,
    dataDespesaInicio,
    dataDespesaFim,
    sortConfig,
  ])

  const handleFetchError = useCallback((err) => {
    console.error('DespesaList: Erro detalhado ao buscar despesas:', err)
    if (!err.message.includes('Autenticação')) {
      toast.error(`Erro ao carregar despesas: ${err.message}`)
    }
  }, [])

  const {
    items: despesas,
    loading,
    error,
    setError,
    refetch: fetchDespesasLista,
  } = useListData({
    fetcher: fetchDespesas,
    mapData: (data) => data,
    errorPrefix: 'Erro ao carregar despesas',
    onError: handleFetchError,
    refreshKey,
  })

  useEffect(() => {
    fetchClientesECasosParaFiltro()
  }, [fetchClientesECasosParaFiltro])

  /**
   * Marcar despesa como Paga inline.
   */
  const handleMarcarPaga = async (despesa) => {
    if (markingPaidId) return
    setMarkingPaidId(despesa.id)
    try {
      await marcarDespesaPaga(despesa.id, {
        descricao: despesa.descricao,
        valor: despesa.valor,
        status: 'Pago',
      })
      toast.success(`"${despesa.descricao}" marcada como Paga.`)
      fetchDespesasLista()
    } catch (err) {
      toast.error(`Erro ao marcar como paga: ${err.message}`)
    } finally {
      setMarkingPaidId(null)
    }
  }

  // Filtragem local pelo quickFilter — instantanea
  const hojeISO = new Date().toISOString().split('T')[0]
  const despesasFiltradas = React.useMemo(() => {
    if (quickFilter === 'todos') return despesas
    return despesas.filter((d) => {
      const status = d.status || (d.pago ? 'Pago' : 'Pendente')
      const venc = d.data_vencimento
      if (quickFilter === 'programadas') {
        return status !== 'Pago' && status !== 'Cancelado' && venc && venc >= hojeISO
      }
      if (quickFilter === 'atrasadas') {
        return status !== 'Pago' && status !== 'Cancelado' && venc && venc < hojeISO
      }
      if (quickFilter === 'pagas') {
        return status === 'Pago'
      }
      return true
    })
  }, [despesas, quickFilter, hojeISO])

  const handleDeleteClick = async (id) => {
    const hasToken =
      localStorage.getItem('token') ||
      localStorage.getItem('access_token') ||
      localStorage.getItem('auth_token')
    if (!hasToken) {
      toast.error('Autenticação expirada. Faça login novamente.')
      return
    }

    const ok = await confirm(
      `Tem certeza que deseja excluir a despesa ID ${id}?`,
      'Excluir despesa'
    )
    if (ok) {
      setDeletingId(id)
      setError(null)
      try {
        await deleteDespesa(id)
        toast.success(`Despesa ID ${id} excluída com sucesso!`)
        fetchDespesasLista()
      } catch (err) {
        console.error(`DespesaList: Erro ao deletar despesa ${id}:`, err)
        setError(`Erro ao deletar despesa: ${err.message}`)
        toast.error(`Erro ao deletar despesa: ${err.message}`)
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

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Pago':
      case 'Paga':
        return 'bg-success-subtle text-success-emphasis'
      case 'Pendente':
      case 'A Pagar':
        return 'bg-warning-subtle text-warning-emphasis'
      case 'Vencido':
      case 'Vencida':
        return 'bg-danger-subtle text-danger-emphasis'
      case 'Cancelado':
      case 'Cancelada':
        return 'bg-secondary-subtle text-secondary-emphasis'
      case 'Em Negociacao':
        return 'bg-info-subtle text-info-emphasis'
      default:
        return 'bg-light text-dark'
    }
  }

  const resetFilters = () => {
    setSearchTerm('')
    setClienteFilter('')
    setCasoFilter('')
    setStatusFilter('')
    setDataVencimentoInicio('')
    setDataVencimentoFim('')
    setDataDespesaInicio('')
    setDataDespesaFim('')
    setQuickFilter('todos')
    setShowFilters(false)
  }

  const handleExportPDF = () => {
    if (despesas.length === 0) {
      toast.warn('Não existem dados para exportar com os filtros atuais.')
      return
    }

    const headers = [
      'Descrição',
      'Caso Associado',
      'Valor',
      'Vencimento',
      'Data da Despesa',
      'Status',
    ]
    const dados = despesas.map((d) => {
      const valorStr =
        typeof d.valor === 'number' || (typeof d.valor === 'string' && !isNaN(parseFloat(d.valor)))
          ? parseFloat(d.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
          : 'N/A'

      return [
        d.descricao || '-',
        d.caso_titulo || 'Despesa Geral',
        valorStr,
        d.data_vencimento ? new Date(d.data_vencimento).toLocaleDateString('pt-BR') : '-',
        d.data_despesa ? new Date(d.data_despesa).toLocaleDateString('pt-BR') : '-',
        d.status || '-',
      ]
    })

    exportarParaPDF('Relatório de Despesas', headers, dados, 'relatorio_despesas.pdf')
    toast.success('PDF gerado com sucesso!')
  }

  if (loading && despesas.length === 0) {
    return (
      <div className="d-flex justify-content-center align-items-center p-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">A carregar despesas...</span>
        </div>
        <span className="ms-3 text-muted">A carregar despesas...</span>
      </div>
    )
  }

  if (error && despesas.length === 0) {
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
        <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap">
          <h6 className="mb-0 text-secondary me-3">Filtros e Busca de Despesas</h6>
          <div>
            <button
              className="btn btn-sm btn-outline-danger py-1 px-2 me-2 d-inline-flex align-items-center"
              onClick={handleExportPDF}
              title="Gerar e Baixar Relatório em PDF das despesas listadas"
            >
              <DocumentArrowDownIcon style={{ width: '16px', height: '16px' }} className="me-1" />
              Exportar PDF
            </button>
            <button
              className="btn btn-sm btn-outline-secondary py-1 px-2 d-inline-flex align-items-center"
              onClick={() => setShowFilters(!showFilters)}
              aria-expanded={showFilters}
              aria-controls="filtrosAvancadosDespesas"
            >
              <FunnelIcon style={{ width: '16px', height: '16px' }} className="me-1" />
              {showFilters ? 'Ocultar Avançados' : 'Mostrar Avançados'}
            </button>
          </div>
        </div>
        <div className="row g-2 align-items-end">
          <div className="col-lg-3 col-md-6">
            <label htmlFor="searchTermDesp" className="form-label form-label-sm visually-hidden">
              Buscar
            </label>
            <input
              type="text"
              id="searchTermDesp"
              className="form-control form-control-sm"
              placeholder="Buscar por Descrição/Categoria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="col-lg-2 col-md-6">
            <label
              htmlFor="clienteFilterDespList"
              className="form-label form-label-sm visually-hidden"
            >
              Filtrar Casos por Cliente
            </label>
            <select
              id="clienteFilterDespList"
              className="form-select form-select-sm"
              value={clienteFilter}
              onChange={(e) => {
                setClienteFilter(e.target.value)
                setCasoFilter('')
              }}
            >
              <option value="">Todos Clientes (para Casos)</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome_razao_social}
                </option>
              ))}
            </select>
          </div>
          <div className="col-lg-3 col-md-6">
            <label
              htmlFor="casoFilterDespList"
              className="form-label form-label-sm visually-hidden"
            >
              Filtrar por Caso
            </label>
            <select
              id="casoFilterDespList"
              className="form-select form-select-sm"
              value={casoFilter}
              onChange={(e) => setCasoFilter(e.target.value)}
              disabled={!clienteFilter && casos.length === 0}
            >
              <option value="">Todos os Casos/Despesas Gerais</option>
              <option value="DESPESA_GERAL">Apenas Despesas Gerais (Sem Caso)</option>
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
          <div className="col-lg-2 col-md-6">
            <label
              htmlFor="statusFilterDespList"
              className="form-label form-label-sm visually-hidden"
            >
              Status
            </label>
            <select
              id="statusFilterDespList"
              className="form-select form-select-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Todos os Status</option>
              <option value="A Pagar">A Pagar</option>
              <option value="Paga">Paga</option>
              <option value="Vencida">Vencida</option>
              <option value="Cancelada">Cancelada</option>
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
        {showFilters && (
          <div className="mt-3 pt-3 border-top" id="filtrosAvancadosDespesas">
            <div className="row g-2 align-items-center mb-2">
              <div className="col-md-3 col-sm-6">
                <label
                  htmlFor="dataVencimentoInicioDespList"
                  className="form-label form-label-sm mb-1"
                >
                  Vencimento De:
                </label>
                <input
                  type="date"
                  id="dataVencimentoInicioDespList"
                  className="form-control form-control-sm"
                  value={dataVencimentoInicio}
                  onChange={(e) => setDataVencimentoInicio(e.target.value)}
                />
              </div>
              <div className="col-md-3 col-sm-6">
                <label
                  htmlFor="dataVencimentoFimDespList"
                  className="form-label form-label-sm mb-1"
                >
                  Vencimento Até:
                </label>
                <input
                  type="date"
                  id="dataVencimentoFimDespList"
                  className="form-control form-control-sm"
                  value={dataVencimentoFim}
                  onChange={(e) => setDataVencimentoFim(e.target.value)}
                />
              </div>
              <div className="col-md-3 col-sm-6">
                <label htmlFor="dataDespesaInicioList" className="form-label form-label-sm mb-1">
                  Data Despesa De:
                </label>
                <input
                  type="date"
                  id="dataDespesaInicioList"
                  className="form-control form-control-sm"
                  value={dataDespesaInicio}
                  onChange={(e) => setDataDespesaInicio(e.target.value)}
                />
              </div>
              <div className="col-md-3 col-sm-6">
                <label htmlFor="dataDespesaFimList" className="form-label form-label-sm mb-1">
                  Data Despesa Até:
                </label>
                <input
                  type="date"
                  id="dataDespesaFimList"
                  className="form-control form-control-sm"
                  value={dataDespesaFim}
                  onChange={(e) => setDataDespesaFim(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {error && despesas.length > 0 && (
        <div className="alert alert-warning m-3 small" role="alert">
          Erro ao atualizar a lista: {error}. Exibindo dados anteriores.
        </div>
      )}

      {/* Quick filters (mesma logica RecebimentoList) */}
      <div className="px-3 py-2 border-bottom bg-white d-flex flex-wrap gap-2 align-items-center">
        <span className="small text-muted me-1">Mostrar:</span>
        {[
          { value: 'todos', label: 'Todas', icon: null },
          { value: 'programadas', label: 'Programadas', icon: ClockIcon },
          { value: 'atrasadas', label: 'Atrasadas', icon: ExclamationTriangleIcon },
          { value: 'pagas', label: 'Pagas', icon: CheckCircleIcon },
        ].map((opt) => {
          const ativo = quickFilter === opt.value
          const Icon = opt.icon
          return (
            <button
              key={opt.value}
              type="button"
              className={`btn btn-sm ${ativo ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setQuickFilter(opt.value)}
            >
              {Icon && <Icon style={{ width: 14, height: 14 }} className="me-1" />}
              {opt.label}
            </button>
          )
        })}
        <small className="ms-auto text-muted">
          {despesasFiltradas.length} de {despesas.length}
        </small>
      </div>

      <div className="table-responsive">
        <table className="table table-hover table-striped table-sm mb-0 align-middle">
          <thead className="table-light">
            <tr>
              <th onClick={() => requestSort('descricao')} style={{ cursor: 'pointer' }}>
                Descrição {getSortIcon('descricao')}
              </th>
              <th onClick={() => requestSort('fornecedor')} style={{ cursor: 'pointer' }}>
                Fornecedor {getSortIcon('fornecedor')}
              </th>
              <th onClick={() => requestSort('caso_titulo')} style={{ cursor: 'pointer' }}>
                Caso {getSortIcon('caso_titulo')}
              </th>
              <th
                className="text-end"
                onClick={() => requestSort('valor')}
                style={{ cursor: 'pointer' }}
              >
                Valor {getSortIcon('valor')}
              </th>
              <th onClick={() => requestSort('data_vencimento')} style={{ cursor: 'pointer' }}>
                Vencimento {getSortIcon('data_vencimento')}
              </th>
              <th onClick={() => requestSort('data_pagamento')} style={{ cursor: 'pointer' }}>
                Pagamento {getSortIcon('data_pagamento')}
              </th>
              <th onClick={() => requestSort('status')} style={{ cursor: 'pointer' }}>
                Status {getSortIcon('status')}
              </th>
              <th className="text-center" style={{ width: '140px' }}>
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && despesas.length > 0 && (
              <tr>
                <td colSpan="8" className="text-center p-4">
                  <div className="spinner-border spinner-border-sm text-primary" role="status">
                    <span className="visually-hidden">A atualizar...</span>
                  </div>
                </td>
              </tr>
            )}
            {!loading && despesasFiltradas.length === 0 && !error && (
              <tr>
                <td colSpan="8">
                  <EmptyState
                    icon={BanknotesIcon}
                    title={
                      quickFilter !== 'todos'
                        ? `Nenhuma despesa ${
                            quickFilter === 'programadas'
                              ? 'programada'
                              : quickFilter === 'atrasadas'
                                ? 'atrasada'
                                : 'paga'
                          }`
                        : 'Nenhuma despesa registrada'
                    }
                    description={
                      quickFilter !== 'todos'
                        ? 'Ajuste os filtros ou troque o atalho acima.'
                        : 'Registre despesas operacionais, custas processuais e outros gastos.'
                    }
                    actionLabel="Nova Despesa"
                    onAction={() => onEditDespesa(null)}
                    filtered={
                      quickFilter !== 'todos' ||
                      !!(
                        searchTerm ||
                        clienteFilter ||
                        statusFilter ||
                        dataVencimentoInicio ||
                        dataVencimentoFim ||
                        dataDespesaInicio ||
                        dataDespesaFim
                      )
                    }
                    onClearFilters={resetFilters}
                  />
                </td>
              </tr>
            )}
            {despesasFiltradas.map((d) => {
              const statusEfetivo = d.status || (d.pago ? 'Pago' : 'Pendente')
              const podeMarcarPago = statusEfetivo !== 'Pago' && statusEfetivo !== 'Cancelado'
              return (
                <tr key={d.id}>
                  <td className="px-3 py-2">
                    <div>{d.descricao}</div>
                    <div className="d-flex flex-wrap gap-1 mt-1">
                      {d.recorrencia_id && d.numero_parcela ? (
                        <span
                          className="badge bg-info-subtle text-info-emphasis"
                          style={{ fontSize: '0.65rem' }}
                          title="Parte de uma serie de despesas"
                        >
                          <ArrowPathIcon style={{ width: 10, height: 10 }} className="me-1" />
                          Parcela {d.numero_parcela}
                        </span>
                      ) : null}
                      {d.categoria && (
                        <span
                          className="badge bg-light text-muted border"
                          style={{ fontSize: '0.65rem' }}
                        >
                          {d.categoria}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">{d.fornecedor || '-'}</td>
                  <td className="px-3 py-2">{d.caso_titulo || '-'}</td>
                  <td className="px-3 py-2 text-end">
                    {typeof d.valor === 'number' ||
                    (typeof d.valor === 'string' && !isNaN(parseFloat(d.valor)))
                      ? parseFloat(d.valor).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })
                      : 'N/A'}
                  </td>
                  <td className="px-3 py-2">
                    {d.data_vencimento ? (
                      <span
                        className={
                          podeMarcarPago && d.data_vencimento < hojeISO
                            ? 'text-danger fw-semibold'
                            : ''
                        }
                      >
                        {new Date(d.data_vencimento).toLocaleDateString('pt-BR')}
                      </span>
                    ) : (
                      <small className="text-muted">sem vencimento</small>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {d.data_pagamento
                      ? new Date(d.data_pagamento).toLocaleDateString('pt-BR')
                      : d.data_despesa && statusEfetivo === 'Pago'
                        ? new Date(d.data_despesa).toLocaleDateString('pt-BR')
                        : '-'}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`badge fs-xs ${getStatusBadge(statusEfetivo)}`}>
                      {statusEfetivo}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {podeMarcarPago && (
                      <button
                        onClick={() => handleMarcarPaga(d)}
                        className="btn btn-sm btn-outline-success me-1 p-1 lh-1"
                        title="Marcar como Paga (preenche data_pagamento=hoje)"
                        disabled={markingPaidId === d.id || deletingId === d.id}
                        style={{
                          width: '30px',
                          height: '30px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {markingPaidId === d.id ? (
                          <div
                            className="spinner-border spinner-border-sm"
                            role="status"
                            style={{ width: '1rem', height: '1rem' }}
                          />
                        ) : (
                          <CheckCircleIcon style={{ width: '16px', height: '16px' }} />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => onEditDespesa(d)}
                      className="btn btn-sm btn-outline-primary me-1 p-1 lh-1"
                      title="Editar"
                      style={{
                        width: '30px',
                        height: '30px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      disabled={deletingId === d.id}
                    >
                      <PencilSquareIcon style={{ width: '16px', height: '16px' }} />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(d.id)}
                      className="btn btn-sm btn-outline-danger p-1 lh-1"
                      title="Deletar"
                      style={{
                        width: '30px',
                        height: '30px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      disabled={deletingId === d.id}
                    >
                      {deletingId === d.id ? (
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
              )
            })}
          </tbody>
        </table>
      </div>
      {!loading && despesasFiltradas.length > 0 && (
        <div className="card-footer bg-light text-muted p-2 text-end small">
          {despesasFiltradas.length} despesa(s) listada(s)
          {quickFilter !== 'todos' &&
            ` (${despesas.length - despesasFiltradas.length} ocultas pelo filtro)`}
        </div>
      )}
    </div>
  )
}

export default DespesaList
