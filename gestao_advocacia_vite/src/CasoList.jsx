// src/CasoList.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config.js'; // Ajuste o caminho se config.js não estiver em src/
import { PencilSquareIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon, ArrowsUpDownIcon, FunnelIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';

function CasoList({ onEditCaso, refreshKey }) {
  console.log("CasoList: Renderizando. RefreshKey:", refreshKey);

  const [casos, setCasos] = useState([]);
  const [clientes, setClientes] = useState([]); // Para o filtro de cliente
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  // Estados para filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [clienteFilter, setClienteFilter] = useState('');
  const [dataCriacaoInicioFilter, setDataCriacaoInicioFilter] = useState('');
  const [dataCriacaoFimFilter, setDataCriacaoFimFilter] = useState('');
  const [dataAtualizacaoInicioFilter, setDataAtualizacaoInicioFilter] = useState('');
  const [dataAtualizacaoFimFilter, setDataAtualizacaoFimFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Estado para ordenação
  const [sortConfig, setSortConfig] = useState({ key: 'data_atualizacao', direction: 'desc' });

  const fetchClientesParaFiltro = useCallback(async () => {
    console.log("CasoList: fetchClientesParaFiltro chamado.");
    try {
      const response = await fetch(`${API_URL}/clientes?sort_by=nome_razao_social&order=asc`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.erro || 'Falha ao carregar clientes para filtro');
      }
      const data = await response.json();
      setClientes(data.clientes || []);
      console.log("CasoList: Clientes para filtro carregados:", data.clientes);
    } catch (err) {
      console.error("CasoList: Erro ao buscar clientes para filtro:", err);
      toast.error(`Erro ao carregar clientes para filtro: ${err.message}`);
    }
  }, []); // API_URL como dependência se vier de contexto/props

  const fetchCasos = useCallback(async () => {
    console.log("CasoList: fetchCasos chamado. Configuração de ordenação:", sortConfig, "Filtros:", { searchTerm, statusFilter, clienteFilter /*...outros filtros*/ });
    setLoading(true);
    setError('');
    let url = `${API_URL}/casos?sort_by=${sortConfig.key}&sort_order=${sortConfig.direction}`;
    if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
    if (statusFilter) url += `&status=${encodeURIComponent(statusFilter)}`;
    if (clienteFilter) url += `&cliente_id=${clienteFilter}`;
    if (dataCriacaoInicioFilter) url += `&data_criacao_inicio=${dataCriacaoInicioFilter}`;
    if (dataCriacaoFimFilter) url += `&data_criacao_fim=${dataCriacaoFimFilter}`;
    if (dataAtualizacaoInicioFilter) url += `&data_atualizacao_inicio=${dataAtualizacaoInicioFilter}`;
    if (dataAtualizacaoFimFilter) url += `&data_atualizacao_fim=${dataAtualizacaoFimFilter}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        const resData = await response.json().catch(() => ({}));
        console.error("CasoList: Erro da API ao buscar casos:", resData);
        throw new Error(resData.erro || `Erro HTTP: ${response.status} ao buscar casos`);
      }
      const data = await response.json();
      setCasos(data.casos || []);
      console.log("CasoList: Casos carregados:", data.casos);
    } catch (err) {
      console.error("CasoList: Erro detalhado ao buscar casos:", err);
      setError(`Erro ao carregar casos: ${err.message}`);
      toast.error(`Erro ao carregar casos: ${err.message}`);
    } finally {
      setLoading(false);
      console.log("CasoList: fetchCasos finalizado.");
    }
  }, [searchTerm, statusFilter, clienteFilter, dataCriacaoInicioFilter, dataCriacaoFimFilter, dataAtualizacaoInicioFilter, dataAtualizacaoFimFilter, sortConfig]);

  useEffect(() => {
    fetchClientesParaFiltro();
  }, [fetchClientesParaFiltro]);

  useEffect(() => {
    fetchCasos();
  }, [fetchCasos, refreshKey]); // refreshKey força a re-busca quando um item é adicionado/editado

  const handleDeleteClick = async (id) => {
    console.log("CasoList: handleDeleteClick chamado para ID:", id);
    // Substituir window.confirm por um modal customizado se preferir
    if (window.confirm(`Tem certeza que deseja excluir o caso ID ${id}? Esta ação pode ser irreversível e afetar registos associados.`)) {
      setDeletingId(id);
      setError(null);
      try {
        const response = await fetch(`${API_URL}/casos/${id}`, { method: 'DELETE' });
        if (!response.ok) {
          const resData = await response.json().catch(() => ({}));
          console.error("CasoList: Erro da API ao deletar caso:", resData);
          throw new Error(resData.erro || `Erro HTTP: ${response.status}`);
        }
        toast.success(`Caso ID ${id} excluído com sucesso!`);
        fetchCasos(); // Re-busca a lista após a exclusão
      } catch (err) {
        console.error(`CasoList: Erro ao deletar caso ${id}:`, err);
        setError(`Erro ao deletar caso: ${err.message}`);
        toast.error(`Erro ao deletar caso: ${err.message}`);
      } finally {
        setDeletingId(null);
      }
    }
  };

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    console.log("CasoList: requestSort. Nova ordenação:", { key, direction });
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
    const iconStyle = { width: '14px', height: '14px', display: 'inline', verticalAlign: 'text-bottom', marginLeft: '4px' };
    if (sortConfig.key !== key) return <ArrowsUpDownIcon className="text-muted" style={iconStyle} />;
    if (sortConfig.direction === 'asc') return <ArrowUpIcon className="text-primary" style={iconStyle} />;
    return <ArrowDownIcon className="text-primary" style={iconStyle} />;
  };

  const resetFilters = () => {
    console.log("CasoList: resetFilters chamado.");
    setSearchTerm('');
    setStatusFilter('');
    setClienteFilter('');
    setDataCriacaoInicioFilter('');
    setDataCriacaoFimFilter('');
    setDataAtualizacaoInicioFilter('');
    setDataAtualizacaoFimFilter('');
    setShowFilters(false);
    // Considerar resetar sortConfig para o padrão também, se desejado
    // setSortConfig({ key: 'data_atualizacao', direction: 'desc' });
  };

  const getStatusBadge = (status) => {
    switch (status) {
        case 'Ativo': return 'bg-success-subtle text-success-emphasis';
        case 'Encerrado': return 'bg-secondary-subtle text-secondary-emphasis';
        case 'Suspenso': return 'bg-warning-subtle text-warning-emphasis';
        case 'Arquivado': return 'bg-info-subtle text-info-emphasis'; // Usando info para Arquivado
        default: return 'bg-light text-dark';
    }
  };

  if (loading && casos.length === 0) { // Mostra loading apenas se a lista estiver vazia para evitar piscar
    console.log("CasoList: Renderizando estado de carregamento inicial.");
    return (
      <div className="d-flex justify-content-center align-items-center p-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">A carregar casos...</span>
        </div>
        <span className="ms-3 text-muted">A carregar casos...</span>
      </div>
    );
  }

  console.log("CasoList: Renderizando tabela de casos ou mensagem de erro/lista vazia.");
  return (
    <div className="card shadow-sm">
      <div className="card-header bg-light p-3">
        <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap">
          <h6 className="mb-0 text-secondary me-3">Filtros e Busca de Casos</h6>
          <button
            className="btn btn-sm btn-outline-secondary py-1 px-2 d-flex align-items-center"
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
            aria-controls="filtrosAvancadosCasos"
          >
            <FunnelIcon style={{width: '16px', height: '16px'}} className="me-1" />
            {showFilters ? 'Ocultar Avançados' : 'Mostrar Avançados'}
          </button>
        </div>

        <div className="row g-2 align-items-end">
          <div className="col-lg-4 col-md-6">
            <label htmlFor="searchTermCaso" className="form-label form-label-sm visually-hidden">Buscar</label>
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
            <label htmlFor="clienteFilterCaso" className="form-label form-label-sm visually-hidden">Cliente</label>
            <select
              id="clienteFilterCaso"
              className="form-select form-select-sm"
              value={clienteFilter}
              onChange={(e) => setClienteFilter(e.target.value)}
            >
              <option value="">Todos os Clientes</option>
              {clientes.map(cliente => (
                <option key={cliente.id} value={cliente.id}>{cliente.nome_razao_social}</option>
              ))}
            </select>
          </div>
          <div className="col-lg-3 col-md-6">
            <label htmlFor="statusFilterCaso" className="form-label form-label-sm visually-hidden">Status</label>
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
          <div className="col-lg-2 col-md-12 text-lg-end mt-2 mt-lg-0"> {/* Ajuste para responsividade */}
            <button onClick={resetFilters} className="btn btn-sm btn-outline-secondary py-1 px-2 w-100">Limpar Filtros</button>
          </div>
        </div>

        {showFilters && (
          <div className="mt-3 pt-3 border-top" id="filtrosAvancadosCasos">
            <div className="row g-2 align-items-center mb-2">
              <div className="col-md-3 col-sm-6">
                  <label htmlFor="dataCriacaoInicioFilter" className="form-label form-label-sm mb-1">Criação De:</label>
                  <input type="date" id="dataCriacaoInicioFilter" className="form-control form-control-sm" value={dataCriacaoInicioFilter} onChange={e => setDataCriacaoInicioFilter(e.target.value)} />
              </div>
              <div className="col-md-3 col-sm-6">
                  <label htmlFor="dataCriacaoFimFilter" className="form-label form-label-sm mb-1">Criação Até:</label>
                  <input type="date" id="dataCriacaoFimFilter" className="form-control form-control-sm" value={dataCriacaoFimFilter} onChange={e => setDataCriacaoFimFilter(e.target.value)} />
              </div>
              <div className="col-md-3 col-sm-6">
                  <label htmlFor="dataAtualizacaoInicioFilter" className="form-label form-label-sm mb-1">Atualização De:</label>
                  <input type="date" id="dataAtualizacaoInicioFilter" className="form-control form-control-sm" value={dataAtualizacaoInicioFilter} onChange={e => setDataAtualizacaoInicioFilter(e.target.value)} />
              </div>
              <div className="col-md-3 col-sm-6">
                  <label htmlFor="dataAtualizacaoFimFilter" className="form-label form-label-sm mb-1">Atualização Até:</label>
                  <input type="date" id="dataAtualizacaoFimFilter" className="form-control form-control-sm" value={dataAtualizacaoFimFilter} onChange={e => setDataAtualizacaoFimFilter(e.target.value)} />
              </div>
            </div>
          </div>
        )}
      </div>

      {error && <div className="alert alert-danger m-3 small" role="alert">{error}</div>}

      <div className="table-responsive">
        <table className="table table-hover table-striped table-sm mb-0 align-middle">
          <thead className="table-light">
            <tr>
              <th onClick={() => requestSort('titulo')} style={{ cursor: 'pointer' }}>Título {getSortIcon('titulo')}</th>
              <th onClick={() => requestSort('cliente_nome')} style={{ cursor: 'pointer' }}>Cliente {getSortIcon('cliente_nome')}</th>
              <th onClick={() => requestSort('numero_processo')} style={{ cursor: 'pointer' }}>Nº Proc. {getSortIcon('numero_processo')}</th>
              <th onClick={() => requestSort('status')} style={{ cursor: 'pointer' }}>Status {getSortIcon('status')}</th>
              <th onClick={() => requestSort('data_criacao')} style={{ cursor: 'pointer' }}>Criação {getSortIcon('data_criacao')}</th>
              <th onClick={() => requestSort('data_atualizacao')} style={{ cursor: 'pointer' }}>Atualização {getSortIcon('data_atualizacao')}</th>
              <th className="text-center" style={{width: '100px'}}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && casos.length > 0 && ( // Spinner sobre a tabela se já houver dados
              <tr><td colSpan="7" className="text-center p-4"><div className="spinner-border spinner-border-sm text-primary" role="status"><span className="visually-hidden">A atualizar...</span></div></td></tr>
            )}
            {!loading && casos.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center text-muted p-4">Nenhum caso encontrado com os filtros aplicados.</td>
              </tr>
            ) : (
              casos.map((caso) => (
                <tr key={caso.id}>
                  <td className="px-3 py-2">{caso.titulo}</td>
                  <td className="px-3 py-2">{caso.cliente?.nome_razao_social || 'N/A'}</td>
                  <td className="px-3 py-2">{caso.numero_processo || '-'}</td>
                  <td className="px-3 py-2">
                    <span className={`badge fs-xs ${getStatusBadge(caso.status)}`}>{caso.status}</span>
                  </td>
                  <td className="px-3 py-2">{caso.data_criacao ? new Date(caso.data_criacao).toLocaleDateString() : '-'}</td>
                  <td className="px-3 py-2">{caso.data_atualizacao ? new Date(caso.data_atualizacao).toLocaleDateString() : '-'}</td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => onEditCaso(caso)}
                      className="btn btn-sm btn-outline-primary me-1 p-1 lh-1"
                      title="Editar Caso"
                      disabled={deletingId === caso.id}
                      style={{width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}}
                    >
                      <PencilSquareIcon style={{ width: '16px', height: '16px' }} />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(caso.id)}
                      className="btn btn-sm btn-outline-danger p-1 lh-1"
                      title="Deletar Caso"
                      disabled={deletingId === caso.id}
                      style={{width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}}
                    >
                      {deletingId === caso.id ? (
                        <div className="spinner-border spinner-border-sm" role="status" style={{width: '1rem', height: '1rem'}}></div>
                      ) : (
                        <TrashIcon style={{ width: '16px', height: '16px' }} />
                      )}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {!loading && casos.length > 0 && (
        <div className="card-footer bg-light text-muted p-2 text-end small">
          {casos.length} caso(s) encontrado(s)
        </div>
      )}
    </div>
  );
}

export default CasoList;
