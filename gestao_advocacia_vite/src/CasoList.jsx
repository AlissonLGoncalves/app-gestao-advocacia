// src/CasoList.jsx
import React, { useState, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { API_URL } from './config.js'
import { deleteCaso, listCasos } from './api/casos.js'
import {
  PencilSquareIcon,
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowsUpDownIcon,
  FunnelIcon,
  DocumentArrowDownIcon,
  BriefcaseIcon,
  XMarkIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'react-toastify'
import { exportarParaPDF } from './utils/pdfGenerator.js'
import { useConfirm } from './hooks/useConfirm.jsx'
import useListData from './hooks/useListData.js'
import EmptyState from './components/EmptyState.jsx'
import CardMeta from './components/ui/CardMeta.jsx'

function CasoList({ onEditCaso, refreshKey }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [clientes, setClientes] = useState([])
  const [deletingId, setDeletingId] = useState(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [clienteFilter, setClienteFilter] = useState('')
  const [dataCriacaoInicioFilter, setDataCriacaoInicioFilter] = useState('')
  const [dataCriacaoFimFilter, setDataCriacaoFimFilter] = useState('')
  const [dataAtualizacaoInicioFilter, setDataAtualizacaoInicioFilter] = useState('')
  const [dataAtualizacaoFimFilter, setDataAtualizacaoFimFilter] = useState('')
  const [areaDireitoFilter, setAreaDireitoFilter] = useState('')
  const [prioridadeFilter, setPrioridadeFilter] = useState('')
  const [faseProcessualFilter, setFaseProcessualFilter] = useState('')
  const [varaJuizoFilter, setVaraJuizoFilter] = useState('')
  const [instanciaFilter, setInstanciaFilter] = useState('')
  const [valorCausaMinFilter, setValorCausaMinFilter] = useState('')
  const [valorCausaMaxFilter, setValorCausaMaxFilter] = useState('')
  const [dataDistribuicaoInicioFilter, setDataDistribuicaoInicioFilter] = useState('')
  const [dataDistribuicaoFimFilter, setDataDistribuicaoFimFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const [sortConfig, setSortConfig] = useState({ key: 'data_atualizacao', direction: 'desc' })

  useEffect(() => {
    const clienteIdDaUrl = new URLSearchParams(location.search).get('cliente_id') || ''
    setClienteFilter((prev) => (prev === clienteIdDaUrl ? prev : clienteIdDaUrl))
  }, [location.search])

  const fetchClientesParaFiltro = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      // Não precisa setar erro aqui, pois o fetchCasos também fará a checagem
      return
    }
    const authHeaders = { Authorization: `Bearer ${token}` }

    try {
      const response = await fetch(`${API_URL}/clientes/?sort_by=nome_razao_social&order=asc`, {
        headers: authHeaders,
      }) // Adicionada barra final
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.erro || 'Falha ao carregar clientes para filtro')
      }
      const data = await response.json()
      setClientes(Array.isArray(data) ? data : data.clientes || [])
    } catch (err) {
      console.error('CasoList: Erro ao buscar clientes para filtro:', err)
      toast.error(`Erro ao carregar clientes para filtro: ${err.message}`)
    }
  }, [])

  const fetchCasos = useCallback(async () => {
    return listCasos({
      sort_by: sortConfig.key,
      sort_order: sortConfig.direction,
      search: searchTerm,
      status: statusFilter,
      cliente_id: clienteFilter,
      data_criacao_inicio: dataCriacaoInicioFilter,
      data_criacao_fim: dataCriacaoFimFilter,
      data_atualizacao_inicio: dataAtualizacaoInicioFilter,
      data_atualizacao_fim: dataAtualizacaoFimFilter,
      area_direito: areaDireitoFilter,
      prioridade: prioridadeFilter,
      fase_processual: faseProcessualFilter,
      vara_juizo: varaJuizoFilter,
      instancia: instanciaFilter,
      valor_causa_min: valorCausaMinFilter,
      valor_causa_max: valorCausaMaxFilter,
      data_distribuicao_inicio: dataDistribuicaoInicioFilter,
      data_distribuicao_fim: dataDistribuicaoFimFilter,
    })
  }, [
    searchTerm,
    statusFilter,
    clienteFilter,
    dataCriacaoInicioFilter,
    dataCriacaoFimFilter,
    dataAtualizacaoInicioFilter,
    dataAtualizacaoFimFilter,
    areaDireitoFilter,
    prioridadeFilter,
    faseProcessualFilter,
    varaJuizoFilter,
    instanciaFilter,
    valorCausaMinFilter,
    valorCausaMaxFilter,
    dataDistribuicaoInicioFilter,
    dataDistribuicaoFimFilter,
    sortConfig,
  ])

  const handleFetchError = useCallback((err) => {
    console.error('CasoList: Erro detalhado ao buscar casos:', err)
    if (!err.message.includes('Autenticação')) {
      toast.error(`Erro ao carregar casos: ${err.message}`)
    }
  }, [])

  const {
    items: casos,
    loading,
    error,
    setError,
    refetch: fetchCasosLista,
  } = useListData({
    fetcher: fetchCasos,
    mapData: (data) => (Array.isArray(data) ? data : data.casos || []),
    errorPrefix: 'Erro ao carregar casos',
    onError: handleFetchError,
    refreshKey,
  })

  useEffect(() => {
    fetchClientesParaFiltro()
  }, [fetchClientesParaFiltro])

  const { confirm, ConfirmDialog } = useConfirm()

  const handleDeleteClick = async (id) => {
    const ok = await confirm(
      `Tem certeza que deseja excluir o caso ID ${id}? Esta ação pode ser irreversível e afetar registos associados.`,
      'Excluir caso'
    )
    if (ok) {
      setDeletingId(id)
      setError(null)
      try {
        await deleteCaso(id)
        toast.success(`Caso ID ${id} excluído com sucesso!`)
        fetchCasosLista()
      } catch (err) {
        console.error(`CasoList: Erro ao deletar caso ${id}:`, err)
        setError(`Erro ao deletar caso: ${err.message}`)
        toast.error(`Erro ao deletar caso: ${err.message}`)
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

  const resetFilters = () => {
    setSearchTerm('')
    setStatusFilter('')
    setClienteFilter('')
    setDataCriacaoInicioFilter('')
    setDataCriacaoFimFilter('')
    setDataAtualizacaoInicioFilter('')
    setDataAtualizacaoFimFilter('')
    setAreaDireitoFilter('')
    setPrioridadeFilter('')
    setFaseProcessualFilter('')
    setVaraJuizoFilter('')
    setInstanciaFilter('')
    setValorCausaMinFilter('')
    setValorCausaMaxFilter('')
    setDataDistribuicaoInicioFilter('')
    setDataDistribuicaoFimFilter('')
    setShowFilters(false)
  }

  const filtrosAtivos = [
    searchTerm && { label: `Busca: ${searchTerm}`, clear: () => setSearchTerm('') },
    statusFilter && { label: `Status: ${statusFilter}`, clear: () => setStatusFilter('') },
    clienteFilter && {
      label: `Cliente: ${clientes.find((c) => String(c.id) === String(clienteFilter))?.nome_razao_social || clienteFilter}`,
      clear: () => setClienteFilter(''),
    },
    areaDireitoFilter && {
      label: `Área: ${areaDireitoFilter}`,
      clear: () => setAreaDireitoFilter(''),
    },
    prioridadeFilter && {
      label: `Prioridade: ${prioridadeFilter}`,
      clear: () => setPrioridadeFilter(''),
    },
    faseProcessualFilter && {
      label: `Fase: ${faseProcessualFilter}`,
      clear: () => setFaseProcessualFilter(''),
    },
    varaJuizoFilter && { label: `Vara: ${varaJuizoFilter}`, clear: () => setVaraJuizoFilter('') },
    instanciaFilter && {
      label: `Instância: ${instanciaFilter}`,
      clear: () => setInstanciaFilter(''),
    },
    (valorCausaMinFilter || valorCausaMaxFilter) && {
      label: `Valor: ${valorCausaMinFilter || '0'} – ${valorCausaMaxFilter || '∞'}`,
      clear: () => {
        setValorCausaMinFilter('')
        setValorCausaMaxFilter('')
      },
    },
    (dataDistribuicaoInicioFilter || dataDistribuicaoFimFilter) && {
      label: `Distribuição: ${dataDistribuicaoInicioFilter || '…'} a ${dataDistribuicaoFimFilter || '…'}`,
      clear: () => {
        setDataDistribuicaoInicioFilter('')
        setDataDistribuicaoFimFilter('')
      },
    },
    (dataCriacaoInicioFilter || dataCriacaoFimFilter) && {
      label: `Criação: ${dataCriacaoInicioFilter || '…'} a ${dataCriacaoFimFilter || '…'}`,
      clear: () => {
        setDataCriacaoInicioFilter('')
        setDataCriacaoFimFilter('')
      },
    },
    (dataAtualizacaoInicioFilter || dataAtualizacaoFimFilter) && {
      label: `Atualização: ${dataAtualizacaoInicioFilter || '…'} a ${dataAtualizacaoFimFilter || '…'}`,
      clear: () => {
        setDataAtualizacaoInicioFilter('')
        setDataAtualizacaoFimFilter('')
      },
    },
  ].filter(Boolean)

  const handleExportPDF = () => {
    if (casos.length === 0) {
      toast.warn('Não existem dados para exportar com os filtros atuais.')
      return
    }

    const headers = ['Título do Caso', 'Cliente', 'Nº Processo', 'Status', 'Criação', 'Atualização']
    const dados = casos.map((caso) => [
      caso.titulo || '-',
      caso.cliente_nome || caso.cliente?.nome_razao_social || 'N/A',
      caso.numero_processo || '-',
      caso.status || '-',
      caso.data_criacao ? new Date(caso.data_criacao).toLocaleDateString() : '-',
      caso.data_atualizacao ? new Date(caso.data_atualizacao).toLocaleDateString() : '-',
    ])

    exportarParaPDF('Relatório de Casos Processuais', headers, dados, 'relatorio_casos.pdf')
    toast.success('PDF gerado com sucesso!')
  }

  if (loading && casos.length === 0) {
    return (
      <div className="d-flex justify-content-center align-items-center p-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">A carregar casos...</span>
        </div>
        <span className="ms-3 text-muted">A carregar casos...</span>
      </div>
    )
  }

  if (error && casos.length === 0) {
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
          <h6 className="mb-0 text-secondary me-3">Filtros e Busca de Casos</h6>
          <div>
            <button
              className="btn btn-sm btn-outline-danger py-1 px-2 me-2 d-inline-flex align-items-center"
              onClick={handleExportPDF}
              title="Gerar e Baixar Relatório em PDF dos casos listados"
            >
              <DocumentArrowDownIcon style={{ width: '16px', height: '16px' }} className="me-1" />
              Exportar PDF
            </button>
            <button
              className="btn btn-sm btn-outline-secondary py-1 px-2 d-inline-flex align-items-center"
              onClick={() => setShowFilters(!showFilters)}
              aria-expanded={showFilters}
              aria-controls="filtrosAvancadosCasos"
            >
              <FunnelIcon style={{ width: '16px', height: '16px' }} className="me-1" />
              {showFilters ? 'Ocultar Avançados' : 'Mostrar Avançados'}
            </button>
          </div>
        </div>

        <div className="row g-2 align-items-end">
          <div className="col-lg-4 col-md-6">
            <label htmlFor="searchTermCaso" className="form-label form-label-sm visually-hidden">
              Buscar
            </label>
            <input
              type="text"
              id="searchTermCaso"
              className="form-control form-control-sm"
              placeholder="Buscar por Título, Nº Processo, Parte Contrária..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="col-lg-3 col-md-6">
            <label htmlFor="clienteFilterCaso" className="form-label form-label-sm visually-hidden">
              Cliente
            </label>
            <select
              id="clienteFilterCaso"
              className="form-select form-select-sm"
              value={clienteFilter}
              onChange={(e) => setClienteFilter(e.target.value)}
            >
              <option value="">Todos os Clientes</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome_razao_social}
                </option>
              ))}
            </select>
          </div>
          <div className="col-lg-3 col-md-6">
            <label htmlFor="statusFilterCaso" className="form-label form-label-sm visually-hidden">
              Status
            </label>
            <select
              id="statusFilterCaso"
              className="form-select form-select-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Todos os Status</option>
              <option value="Ativo">Ativo</option>
              <option value="Suspenso">Suspenso</option>
              <option value="Encerrado">Encerrado</option>
              <option value="Arquivado">Arquivado</option>
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
          <div className="mt-3 pt-3 border-top" id="filtrosAvancadosCasos">
            <div className="row g-2 align-items-center mb-2">
              <div className="col-md-3 col-sm-6">
                <label className="form-label form-label-sm mb-1">Área do Direito</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Ex: Trabalhista"
                  value={areaDireitoFilter}
                  onChange={(e) => setAreaDireitoFilter(e.target.value)}
                />
              </div>
              <div className="col-md-3 col-sm-6">
                <label className="form-label form-label-sm mb-1">Prioridade</label>
                <select
                  className="form-select form-select-sm"
                  value={prioridadeFilter}
                  onChange={(e) => setPrioridadeFilter(e.target.value)}
                >
                  <option value="">Todas</option>
                  <option value="Urgente">Urgente</option>
                  <option value="Alta">Alta</option>
                  <option value="Normal">Normal</option>
                  <option value="Baixa">Baixa</option>
                </select>
              </div>
              <div className="col-md-3 col-sm-6">
                <label className="form-label form-label-sm mb-1">Fase Processual</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Ex: Conhecimento"
                  value={faseProcessualFilter}
                  onChange={(e) => setFaseProcessualFilter(e.target.value)}
                />
              </div>
              <div className="col-md-3 col-sm-6">
                <label className="form-label form-label-sm mb-1">Vara/Juízo</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="contém..."
                  value={varaJuizoFilter}
                  onChange={(e) => setVaraJuizoFilter(e.target.value)}
                />
              </div>
              <div className="col-md-3 col-sm-6">
                <label className="form-label form-label-sm mb-1">Instância</label>
                <select
                  className="form-select form-select-sm"
                  value={instanciaFilter}
                  onChange={(e) => setInstanciaFilter(e.target.value)}
                >
                  <option value="">Todas</option>
                  <option value="1ª Instância">1ª Instância</option>
                  <option value="2ª Instância">2ª Instância</option>
                  <option value="Superior">Superior</option>
                </select>
              </div>
            </div>
            <div className="row g-2 align-items-center mb-2">
              <div className="col-md-3 col-sm-6">
                <label className="form-label form-label-sm mb-1">Valor da causa (mín)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-control form-control-sm"
                  value={valorCausaMinFilter}
                  onChange={(e) => setValorCausaMinFilter(e.target.value)}
                />
              </div>
              <div className="col-md-3 col-sm-6">
                <label className="form-label form-label-sm mb-1">Valor da causa (máx)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-control form-control-sm"
                  value={valorCausaMaxFilter}
                  onChange={(e) => setValorCausaMaxFilter(e.target.value)}
                />
              </div>
              <div className="col-md-3 col-sm-6">
                <label className="form-label form-label-sm mb-1">Distribuição De:</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={dataDistribuicaoInicioFilter}
                  onChange={(e) => setDataDistribuicaoInicioFilter(e.target.value)}
                />
              </div>
              <div className="col-md-3 col-sm-6">
                <label className="form-label form-label-sm mb-1">Distribuição Até:</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={dataDistribuicaoFimFilter}
                  onChange={(e) => setDataDistribuicaoFimFilter(e.target.value)}
                />
              </div>
            </div>
            <div className="row g-2 align-items-center mb-2">
              <div className="col-md-3 col-sm-6">
                <label htmlFor="dataCriacaoInicioFilter" className="form-label form-label-sm mb-1">
                  Criação De:
                </label>
                <input
                  type="date"
                  id="dataCriacaoInicioFilter"
                  className="form-control form-control-sm"
                  value={dataCriacaoInicioFilter}
                  onChange={(e) => setDataCriacaoInicioFilter(e.target.value)}
                />
              </div>
              <div className="col-md-3 col-sm-6">
                <label htmlFor="dataCriacaoFimFilter" className="form-label form-label-sm mb-1">
                  Criação Até:
                </label>
                <input
                  type="date"
                  id="dataCriacaoFimFilter"
                  className="form-control form-control-sm"
                  value={dataCriacaoFimFilter}
                  onChange={(e) => setDataCriacaoFimFilter(e.target.value)}
                />
              </div>
              <div className="col-md-3 col-sm-6">
                <label
                  htmlFor="dataAtualizacaoInicioFilter"
                  className="form-label form-label-sm mb-1"
                >
                  Atualização De:
                </label>
                <input
                  type="date"
                  id="dataAtualizacaoInicioFilter"
                  className="form-control form-control-sm"
                  value={dataAtualizacaoInicioFilter}
                  onChange={(e) => setDataAtualizacaoInicioFilter(e.target.value)}
                />
              </div>
              <div className="col-md-3 col-sm-6">
                <label htmlFor="dataAtualizacaoFimFilter" className="form-label form-label-sm mb-1">
                  Atualização Até:
                </label>
                <input
                  type="date"
                  id="dataAtualizacaoFimFilter"
                  className="form-control form-control-sm"
                  value={dataAtualizacaoFimFilter}
                  onChange={(e) => setDataAtualizacaoFimFilter(e.target.value)}
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

      {error && casos.length > 0 && (
        <div className="alert alert-warning m-3 small" role="alert">
          Erro ao atualizar a lista: {error}. Exibindo dados anteriores.
        </div>
      )}

      <div className="table-responsive">
        <table className="table table-hover table-striped table-sm mb-0 align-middle">
          <thead className="table-light">
            <tr>
              <th onClick={() => requestSort('titulo')} style={{ cursor: 'pointer' }}>
                Título {getSortIcon('titulo')}
              </th>
              <th onClick={() => requestSort('cliente_nome')} style={{ cursor: 'pointer' }}>
                Cliente {getSortIcon('cliente_nome')}
              </th>
              <th onClick={() => requestSort('numero_processo')} style={{ cursor: 'pointer' }}>
                Nº Proc. {getSortIcon('numero_processo')}
              </th>
              <th onClick={() => requestSort('status')} style={{ cursor: 'pointer' }}>
                Status {getSortIcon('status')}
              </th>
              <th onClick={() => requestSort('data_criacao')} style={{ cursor: 'pointer' }}>
                Criação {getSortIcon('data_criacao')}
              </th>
              <th onClick={() => requestSort('data_atualizacao')} style={{ cursor: 'pointer' }}>
                Atualização {getSortIcon('data_atualizacao')}
              </th>
              <th className="text-center" style={{ width: '100px' }}>
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && casos.length > 0 && (
              <tr>
                <td colSpan="7" className="text-center p-4">
                  <div className="spinner-border spinner-border-sm text-primary" role="status">
                    <span className="visually-hidden">A atualizar...</span>
                  </div>
                </td>
              </tr>
            )}
            {!loading && casos.length === 0 && !error && (
              <tr>
                <td colSpan="7">
                  <EmptyState
                    icon={BriefcaseIcon}
                    title="Nenhum caso cadastrado"
                    description="Comece adicionando o primeiro caso do escritório."
                    actionLabel="Novo Caso"
                    onAction={() => onEditCaso(null)}
                    filtered={
                      !!(
                        searchTerm ||
                        statusFilter ||
                        clienteFilter ||
                        dataCriacaoInicioFilter ||
                        dataCriacaoFimFilter ||
                        dataAtualizacaoInicioFilter ||
                        dataAtualizacaoFimFilter
                      )
                    }
                    onClearFilters={resetFilters}
                  />
                </td>
              </tr>
            )}
            {casos.map((caso) => {
              // Estilo Astrea: "Autor × Réu" na coluna Título.
              // Sem campo de polo do cliente, assumimos cliente = autor e
              // parte_contraria = réu (pode estar invertido em casos onde o
              // cliente é réu, mas é a heuristica mais útil até termos polo
              // explícito no modelo Caso).
              const clienteNome = caso.cliente_nome || caso.cliente?.nome_razao_social || ''
              const parteContraria = (caso.parte_contraria || '').trim()
              const partesLabel =
                clienteNome && parteContraria
                  ? `${clienteNome} × ${parteContraria}`
                  : clienteNome || parteContraria || caso.titulo
              return (
                <tr key={caso.id}>
                  <td className="px-3 py-2">
                    <span
                      role="button"
                      className="text-primary text-decoration-underline d-block"
                      style={{ cursor: 'pointer', fontWeight: 500 }}
                      title={`Abrir detalhes do caso · Título interno: ${caso.titulo || '(sem título)'}`}
                      onClick={() => navigate(`/casos/detalhe/${caso.id}`)}
                    >
                      {partesLabel}
                    </span>
                    {caso.titulo && partesLabel !== caso.titulo && (
                      <small
                        className="text-muted d-block text-truncate"
                        style={{ maxWidth: '320px', fontSize: '0.72rem' }}
                        title={caso.titulo}
                      >
                        {caso.titulo}
                      </small>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {caso.cliente_nome || caso.cliente?.nome_razao_social || 'N/A'}
                  </td>
                  <td className="px-3 py-2">
                    {caso.numero_processo ? (
                      <span
                        role="button"
                        className="text-primary text-decoration-underline"
                        style={{ cursor: 'pointer' }}
                        title="Ver publicações DJEN deste processo"
                        onClick={() =>
                          navigate(`/djen?processo=${encodeURIComponent(caso.numero_processo)}`)
                        }
                      >
                        {caso.numero_processo}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <CardMeta
                      status={caso.status}
                      prioridade={caso.prioridade}
                      responsavelNome={caso.responsavel_nome}
                      responsavelIniciais={caso.responsavel_iniciais}
                    />
                  </td>
                  <td className="px-3 py-2">
                    {caso.data_criacao ? new Date(caso.data_criacao).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-3 py-2">
                    {caso.data_atualizacao
                      ? new Date(caso.data_atualizacao).toLocaleDateString()
                      : '-'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => navigate(`/casos/detalhe/${caso.id}`)}
                      className="btn btn-sm btn-outline-info me-1 p-1 lh-1"
                      title="Ver detalhes do caso (linha do tempo, publicações)"
                      disabled={deletingId === caso.id}
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
                      onClick={() => onEditCaso(caso)}
                      className="btn btn-sm btn-outline-primary me-1 p-1 lh-1"
                      title="Editar Caso"
                      disabled={deletingId === caso.id}
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
                      onClick={() => handleDeleteClick(caso.id)}
                      className="btn btn-sm btn-outline-danger p-1 lh-1"
                      title="Deletar Caso"
                      disabled={deletingId === caso.id}
                      style={{
                        width: '30px',
                        height: '30px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {deletingId === caso.id ? (
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
      {!loading && casos.length > 0 && (
        <div className="card-footer bg-light text-muted p-2 text-end small">
          {casos.length} caso(s) encontrado(s)
        </div>
      )}
    </div>
  )
}

export default CasoList
