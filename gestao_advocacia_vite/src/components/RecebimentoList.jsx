// Arquivo: src/RecebimentoList.jsx
import React, { useState, useEffect, useCallback } from 'react'
import {
  PencilSquareIcon,
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowsUpDownIcon,
  FunnelIcon,
  DocumentArrowDownIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'react-toastify'
import { exportarParaPDF } from '../utils/pdfGenerator.js'
import { api } from '../api/client.js'
import { deleteRecebimento, listRecebimentos, marcarRecebimentoPago } from '../api/financeiro.js'
import { listEmissoesNFSe } from '../api/nfse.js'
import { useConfirm } from '../hooks/useConfirm.jsx'
import useListData from '../hooks/useListData.js'
import EmptyState from './EmptyState.jsx'
import EmitirNFSeButton from './EmitirNFSeButton.jsx'

function RecebimentoList({ onEditRecebimento, refreshKey }) {
  const { confirm, ConfirmDialog } = useConfirm()
  const [clientes, setClientes] = useState([])
  const [casos, setCasos] = useState([])
  const [deletingId, setDeletingId] = useState(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [clienteFilter, setClienteFilter] = useState('')
  const [casoFilter, setCasoFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  // "Programados" = status="Programado" (explicito) OU pendentes com
  // vencimento futuro/sem data (legado, antes do status existir).
  // Filtro rapido botaozinho.
  const [quickFilter, setQuickFilter] = useState('todos') // todos|programados|atrasados|pagos
  // Marcar como Pago inline (loading por linha)
  const [markingPaidId, setMarkingPaidId] = useState(null)
  // PR C: mapa recebimento_id -> ultima emissao NFS-e. 1 fetch agregado em
  // vez de N fetches (1 por linha). Atualiza ao montar e quando refreshKey
  // muda (apos criar/editar recebimento).
  const [emissoesPorRecebimento, setEmissoesPorRecebimento] = useState({})
  const [dataVencimentoInicio, setDataVencimentoInicio] = useState('')
  const [dataVencimentoFim, setDataVencimentoFim] = useState('')
  const [dataRecebimentoInicio, setDataRecebimentoInicio] = useState('')
  const [dataRecebimentoFim, setDataRecebimentoFim] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const [sortConfig, setSortConfig] = useState({ key: 'data_vencimento', direction: 'desc' })

  const fetchClientesECasosParaFiltro = useCallback(async () => {
    const hasToken =
      localStorage.getItem('token') ||
      localStorage.getItem('access_token') ||
      localStorage.getItem('auth_token')
    if (!hasToken) return

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
      console.error('Erro ao buscar clientes/casos para filtro:', err)
      toast.error(`Erro ao carregar dados para filtros: ${err.message}`)
    }
  }, [clienteFilter])

  const fetchRecebimentos = useCallback(async () => {
    const hasToken =
      localStorage.getItem('token') ||
      localStorage.getItem('access_token') ||
      localStorage.getItem('auth_token')
    if (!hasToken) {
      toast.error('Sessão expirada. Faça login.')
      throw new Error('Autenticação necessária.')
    }

    const params = {
      sort_by: sortConfig.key,
      sort_order: sortConfig.direction,
      search: searchTerm,
      cliente_id: clienteFilter,
      caso_id: casoFilter,
      status: statusFilter,
      data_vencimento_inicio: dataVencimentoInicio,
      data_vencimento_fim: dataVencimentoFim,
      data_recebimento_inicio: dataRecebimentoInicio,
      data_recebimento_fim: dataRecebimentoFim,
    }

    return listRecebimentos(params)
  }, [
    searchTerm,
    clienteFilter,
    casoFilter,
    statusFilter,
    dataVencimentoInicio,
    dataVencimentoFim,
    dataRecebimentoInicio,
    dataRecebimentoFim,
    sortConfig,
  ])

  const handleFetchError = useCallback((err) => {
    console.error('Erro ao buscar recebimentos:', err)
    if (!err.message.includes('Autenticação')) {
      toast.error(`Erro ao carregar recebimentos: ${err.message}`)
    }
  }, [])

  const {
    items: recebimentos,
    loading,
    error,
    setError,
    refetch: fetchRecebimentosLista,
  } = useListData({
    fetcher: fetchRecebimentos,
    mapData: (data) => data,
    errorPrefix: 'Erro ao carregar recebimentos',
    onError: handleFetchError,
    refreshKey,
  })

  useEffect(() => {
    fetchClientesECasosParaFiltro()
  }, [fetchClientesECasosParaFiltro])

  // PR C: fetch agregado de emissoes NFS-e. 1 request pra todas em vez
  // de N (1 por linha). Atualiza junto com refreshKey pra captar emissoes
  // criadas via modal de emissao.
  useEffect(() => {
    let cancelado = false
    listEmissoesNFSe()
      .then((emissoes) => {
        if (cancelado) return
        const lista = Array.isArray(emissoes) ? emissoes : []
        // Mapa: recebimento_id -> emissao mais recente (lista ja vem
        // ordenada por created_at desc no backend).
        const map = {}
        for (const e of lista) {
          if (e.recebimento_id && !map[e.recebimento_id]) {
            map[e.recebimento_id] = e
          }
        }
        setEmissoesPorRecebimento(map)
      })
      .catch((err) => {
        // NFS-e pode nem estar configurada; nao bloqueia a lista.
        console.warn('RecebimentoList: erro ao buscar emissoes NFSe', err)
      })
    return () => {
      cancelado = true
    }
  }, [refreshKey])

  /**
   * Marcar como Pago inline (botao direto na linha). Faz PUT mandando
   * status="Pago" — backend (Fase 1) preenche data_pagamento=hoje
   * automaticamente quando nao vier.
   */
  const handleMarcarPago = async (recebimento) => {
    if (markingPaidId) return
    setMarkingPaidId(recebimento.id)
    try {
      await marcarRecebimentoPago(recebimento.id, {
        descricao: recebimento.descricao,
        valor: recebimento.valor,
        status: 'Pago',
      })
      toast.success(`"${recebimento.descricao}" marcado como Pago.`)
      fetchRecebimentosLista()
    } catch (err) {
      toast.error(`Erro ao marcar como pago: ${err.message}`)
    } finally {
      setMarkingPaidId(null)
    }
  }

  /**
   * Filtragem local pelo quickFilter (mais responsivo que round-trip).
   * O fetch ja traz a lista completa filtrada pelo backend (status etc);
   * aqui aplicamos refinamentos rapidos por estado de vencimento.
   */
  const hojeISO = new Date().toISOString().split('T')[0]
  const recebimentosFiltrados = React.useMemo(() => {
    if (quickFilter === 'todos') return recebimentos
    return recebimentos.filter((r) => {
      const status = r.status || (r.recebido ? 'Pago' : 'Pendente')
      const venc = r.data_vencimento
      if (quickFilter === 'programados') {
        if (status === 'Programado') return true
        return status === 'Pendente' && (!venc || venc >= hojeISO)
      }
      if (quickFilter === 'atrasados') {
        if (status === 'Programado') return false
        return status !== 'Pago' && status !== 'Cancelado' && venc && venc < hojeISO
      }
      if (quickFilter === 'pagos') {
        return status === 'Pago'
      }
      return true
    })
  }, [recebimentos, quickFilter, hojeISO])

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
      `Tem certeza que deseja excluir o recebimento ID ${id}?`,
      'Excluir recebimento'
    )
    if (ok) {
      setDeletingId(id)
      setError(null)
      try {
        await deleteRecebimento(id)
        toast.success(`Recebimento ID ${id} excluído com sucesso!`)
        fetchRecebimentosLista()
      } catch (err) {
        console.error(`Erro ao deletar recebimento ${id}:`, err)
        setError(`Erro ao deletar recebimento: ${err.message}`)
        toast.error(`Erro ao deletar recebimento: ${err.message}`)
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
        return 'bg-success-subtle text-success-emphasis'
      case 'Pendente':
        return 'bg-warning-subtle text-warning-emphasis'
      case 'Programado':
        return 'bg-primary-subtle text-primary-emphasis'
      case 'Vencido':
        return 'bg-danger-subtle text-danger-emphasis'
      case 'Cancelado':
        return 'bg-secondary-subtle text-secondary-emphasis'
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
    setDataRecebimentoInicio('')
    setDataRecebimentoFim('')
    setQuickFilter('todos')
    setShowFilters(false)
  }

  const handleExportPDF = () => {
    if (recebimentos.length === 0) {
      toast.warn('Não existem dados para exportar com os filtros atuais.')
      return
    }

    const headers = [
      'Descrição',
      'Cliente',
      'Caso Associado',
      'Valor',
      'Vencimento',
      'Recebimento',
      'Status',
    ]
    const dados = recebimentos.map((r) => {
      const valorStr =
        typeof r.valor === 'number' || (typeof r.valor === 'string' && !isNaN(parseFloat(r.valor)))
          ? parseFloat(r.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
          : 'N/A'
      return [
        r.descricao || '-',
        r.cliente_nome || '-',
        r.caso_titulo || '-',
        valorStr,
        r.data_vencimento ? new Date(r.data_vencimento).toLocaleDateString() : '-',
        r.data_recebimento ? new Date(r.data_recebimento).toLocaleDateString() : '-',
        r.status || '-',
      ]
    })

    exportarParaPDF('Relatório de Títulos a Receber', headers, dados, 'relatorio_recebimentos.pdf')
    toast.success('PDF gerado com sucesso!')
  }

  if (loading && recebimentos.length === 0) {
    return (
      <div className="d-flex justify-content-center align-items-center p-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Carregando recebimentos...</span>
        </div>
        <span className="ms-3 text-muted">Carregando recebimentos...</span>
      </div>
    )
  }

  if (error && recebimentos.length === 0) {
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
          <h6 className="mb-0 text-secondary me-3">Filtros e Busca de Recebimentos</h6>
          <div>
            <button
              className="btn btn-sm btn-outline-danger py-1 px-2 me-2 d-inline-flex align-items-center"
              onClick={handleExportPDF}
              title="Gerar e Baixar Relatório em PDF dos recebimentos listados"
            >
              <DocumentArrowDownIcon style={{ width: '16px', height: '16px' }} className="me-1" />
              Exportar PDF
            </button>
            <button
              className="btn btn-sm btn-outline-secondary py-1 px-2 d-inline-flex align-items-center"
              onClick={() => setShowFilters(!showFilters)}
              aria-expanded={showFilters}
              aria-controls="filtrosAvancadosRecebimentos"
            >
              <FunnelIcon style={{ width: '16px', height: '16px' }} className="me-1" />
              {showFilters ? 'Ocultar Avançados' : 'Mostrar Avançados'}
            </button>
          </div>
        </div>
        <div className="row g-2 align-items-end">
          <div className="col-lg-3 col-md-6">
            <label htmlFor="searchTermRec" className="form-label form-label-sm visually-hidden">
              Buscar
            </label>
            <input
              type="text"
              id="searchTermRec"
              className="form-control form-control-sm"
              placeholder="Buscar por Descrição/Categoria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="col-lg-2 col-md-6">
            <label htmlFor="clienteFilterRec" className="form-label form-label-sm visually-hidden">
              Cliente
            </label>
            <select
              id="clienteFilterRec"
              className="form-select form-select-sm"
              value={clienteFilter}
              onChange={(e) => {
                setClienteFilter(e.target.value)
                setCasoFilter('')
              }}
            >
              <option value="">Todos Clientes</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome_razao_social}
                </option>
              ))}
            </select>
          </div>
          <div className="col-lg-3 col-md-6">
            <label htmlFor="casoFilterRec" className="form-label form-label-sm visually-hidden">
              Caso
            </label>
            <select
              id="casoFilterRec"
              className="form-select form-select-sm"
              value={casoFilter}
              onChange={(e) => setCasoFilter(e.target.value)}
              disabled={
                !clienteFilter &&
                casos.length === 0 &&
                !clientes.find((c) => c.id === parseInt(clienteFilter))
              }
            >
              <option value="">Todos os Casos</option>
              {casos
                .filter((c) => !clienteFilter || c.cliente_id === parseInt(clienteFilter))
                .map((cs) => (
                  <option key={cs.id} value={cs.id}>
                    {cs.titulo}
                  </option>
                ))}
            </select>
          </div>
          <div className="col-lg-2 col-md-6">
            <label htmlFor="statusFilterRec" className="form-label form-label-sm visually-hidden">
              Status
            </label>
            <select
              id="statusFilterRec"
              className="form-select form-select-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Todos Status</option>
              <option value="Pendente">Pendente</option>
              <option value="Pago">Pago</option>
              <option value="Vencido">Vencido</option>
              <option value="Cancelado">Cancelado</option>
            </select>
          </div>
          <div className="col-lg-2 col-md-12 text-lg-end">
            <button
              onClick={resetFilters}
              className="btn btn-sm btn-outline-secondary py-1 px-2 w-100"
            >
              Limpar Filtros
            </button>
          </div>
        </div>
        {showFilters && (
          <div className="mt-3 pt-3 border-top" id="filtrosAvancadosRecebimentos">
            <div className="row g-2 align-items-center mb-2">
              <div className="col-md-3 col-sm-6">
                <label htmlFor="dataVencimentoInicioRec" className="form-label form-label-sm mb-1">
                  Vencimento De:
                </label>
                <input
                  type="date"
                  id="dataVencimentoInicioRec"
                  className="form-control form-control-sm"
                  value={dataVencimentoInicio}
                  onChange={(e) => setDataVencimentoInicio(e.target.value)}
                />
              </div>
              <div className="col-md-3 col-sm-6">
                <label htmlFor="dataVencimentoFimRec" className="form-label form-label-sm mb-1">
                  Vencimento Até:
                </label>
                <input
                  type="date"
                  id="dataVencimentoFimRec"
                  className="form-control form-control-sm"
                  value={dataVencimentoFim}
                  onChange={(e) => setDataVencimentoFim(e.target.value)}
                />
              </div>
              <div className="col-md-3 col-sm-6">
                <label htmlFor="dataRecebimentoInicioRec" className="form-label form-label-sm mb-1">
                  Recebimento De:
                </label>
                <input
                  type="date"
                  id="dataRecebimentoInicioRec"
                  className="form-control form-control-sm"
                  value={dataRecebimentoInicio}
                  onChange={(e) => setDataRecebimentoInicio(e.target.value)}
                />
              </div>
              <div className="col-md-3 col-sm-6">
                <label htmlFor="dataRecebimentoFimRec" className="form-label form-label-sm mb-1">
                  Recebimento Até:
                </label>
                <input
                  type="date"
                  id="dataRecebimentoFimRec"
                  className="form-control form-control-sm"
                  value={dataRecebimentoFim}
                  onChange={(e) => setDataRecebimentoFim(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {error && recebimentos.length > 0 && (
        <div className="alert alert-warning m-3 small" role="alert">
          Erro ao atualizar a lista: {error}. Exibindo dados anteriores.
        </div>
      )}

      {/* Quick filters: filtros rapidos por estado de vencimento/pagamento.
          Aplicados localmente sobre o resultado do backend pra resposta instantanea. */}
      <div className="px-3 py-2 border-bottom bg-white d-flex flex-wrap gap-2 align-items-center">
        <span className="small text-muted me-1">Mostrar:</span>
        {[
          { value: 'todos', label: 'Todos', icon: null },
          { value: 'programados', label: 'Programados', icon: ClockIcon },
          { value: 'atrasados', label: 'Atrasados', icon: ExclamationTriangleIcon },
          { value: 'pagos', label: 'Pagos', icon: CheckCircleIcon },
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
          {recebimentosFiltrados.length} de {recebimentos.length}
        </small>
      </div>

      <div className="table-responsive">
        <table className="table table-hover table-striped table-sm mb-0 align-middle">
          <thead className="table-light">
            <tr>
              <th onClick={() => requestSort('descricao')} style={{ cursor: 'pointer' }}>
                Descrição {getSortIcon('descricao')}
              </th>
              <th onClick={() => requestSort('cliente_nome')} style={{ cursor: 'pointer' }}>
                Cliente {getSortIcon('cliente_nome')}
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
            {loading && recebimentos.length > 0 && (
              <tr>
                <td colSpan="8" className="text-center p-4">
                  <div className="spinner-border spinner-border-sm text-primary" role="status">
                    <span className="visually-hidden">A atualizar...</span>
                  </div>
                </td>
              </tr>
            )}
            {!loading && recebimentosFiltrados.length === 0 && !error && (
              <tr>
                <td colSpan="8">
                  <EmptyState
                    icon={CurrencyDollarIcon}
                    title={
                      quickFilter !== 'todos'
                        ? `Nenhum recebimento ${
                            quickFilter === 'programados'
                              ? 'programado'
                              : quickFilter === 'atrasados'
                                ? 'atrasado'
                                : 'pago'
                          }`
                        : 'Nenhum recebimento registrado'
                    }
                    description={
                      quickFilter !== 'todos'
                        ? 'Ajuste os filtros ou troque o atalho acima.'
                        : 'Registre honorários, parcelas e outros recebimentos do escritório.'
                    }
                    actionLabel="Novo Recebimento"
                    onAction={() => onEditRecebimento(null)}
                    filtered={
                      quickFilter !== 'todos' ||
                      !!(
                        searchTerm ||
                        clienteFilter ||
                        statusFilter ||
                        dataVencimentoInicio ||
                        dataVencimentoFim ||
                        dataRecebimentoInicio ||
                        dataRecebimentoFim
                      )
                    }
                    onClearFilters={resetFilters}
                  />
                </td>
              </tr>
            )}
            {recebimentosFiltrados.map((r) => {
              const statusEfetivo = r.status || (r.recebido ? 'Pago' : 'Pendente')
              const podeMarcarPago = statusEfetivo !== 'Pago' && statusEfetivo !== 'Cancelado'
              return (
                <tr key={r.id}>
                  <td className="px-3 py-2">
                    <div>{r.descricao}</div>
                    <div className="d-flex flex-wrap gap-1 mt-1">
                      {/* Badge de serie: recorrente OU parcela X/Y */}
                      {r.recorrencia_id && r.numero_parcela ? (
                        <span
                          className="badge bg-info-subtle text-info-emphasis"
                          style={{ fontSize: '0.65rem' }}
                          title="Parte de uma serie de recebimentos"
                        >
                          <ArrowPathIcon style={{ width: 10, height: 10 }} className="me-1" />
                          Parcela {r.numero_parcela}
                        </span>
                      ) : null}
                      {r.categoria && (
                        <span
                          className="badge bg-light text-muted border"
                          style={{ fontSize: '0.65rem' }}
                        >
                          {r.categoria}
                        </span>
                      )}
                      {r.tipo_recebimento && (
                        <span
                          className="badge bg-primary-subtle text-primary-emphasis border border-primary-subtle"
                          style={{ fontSize: '0.65rem' }}
                          title="Tipo de recebimento"
                        >
                          {r.tipo_recebimento}
                        </span>
                      )}
                      {r.ano_previsao && (
                        <span
                          className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle"
                          style={{ fontSize: '0.65rem' }}
                          title="Ano de previsão de recebimento"
                        >
                          Previsto: {r.ano_previsao}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">{r.cliente_nome || '-'}</td>
                  <td className="px-3 py-2">{r.caso_titulo || '-'}</td>
                  <td className="px-3 py-2 text-end">
                    {parseFloat(r.valor).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </td>
                  <td className="px-3 py-2">
                    {r.data_vencimento ? (
                      <span
                        className={
                          podeMarcarPago && r.data_vencimento < hojeISO
                            ? 'text-danger fw-semibold'
                            : ''
                        }
                      >
                        {new Date(r.data_vencimento).toLocaleDateString()}
                      </span>
                    ) : (
                      <small className="text-muted">sem vencimento</small>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {r.data_pagamento
                      ? new Date(r.data_pagamento).toLocaleDateString()
                      : r.data_recebimento && statusEfetivo === 'Pago'
                        ? new Date(r.data_recebimento).toLocaleDateString()
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
                        onClick={() => handleMarcarPago(r)}
                        className="btn btn-sm btn-outline-success me-1 p-1 lh-1"
                        title="Marcar como Pago (preenche data_pagamento=hoje)"
                        disabled={markingPaidId === r.id || deletingId === r.id}
                        style={{
                          width: '30px',
                          height: '30px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {markingPaidId === r.id ? (
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
                    {/* PR C: Emitir NFS-e inline pra recebimentos pagos. */}
                    {statusEfetivo === 'Pago' && (
                      <EmitirNFSeButton
                        recebimento={r}
                        emissaoInicial={emissoesPorRecebimento[r.id] || null}
                        variant="compacta"
                      />
                    )}
                    <button
                      onClick={() => onEditRecebimento(r)}
                      className="btn btn-sm btn-outline-primary me-1 p-1 lh-1"
                      title="Editar"
                      style={{
                        width: '30px',
                        height: '30px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      disabled={deletingId === r.id}
                    >
                      <PencilSquareIcon style={{ width: '16px', height: '16px' }} />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(r.id)}
                      className="btn btn-sm btn-outline-danger p-1 lh-1"
                      title="Deletar"
                      style={{
                        width: '30px',
                        height: '30px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      disabled={deletingId === r.id}
                    >
                      {deletingId === r.id ? (
                        <div
                          className="spinner-border spinner-border-sm"
                          role="status"
                          style={{ width: '1rem', height: '1rem' }}
                        />
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
      {!loading && recebimentosFiltrados.length > 0 && (
        <div className="card-footer bg-light text-muted p-2 text-end small">
          {recebimentosFiltrados.length} recebimento(s) listado(s)
          {quickFilter !== 'todos' &&
            ` (${recebimentos.length - recebimentosFiltrados.length} ocultos pelo filtro)`}
        </div>
      )}
    </div>
  )
}

export default RecebimentoList
