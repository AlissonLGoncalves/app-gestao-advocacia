// src/DespesaList.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config.js'; // Ajuste o caminho se config.js não estiver em src/
import { PencilSquareIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon, ArrowsUpDownIcon, FunnelIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';

function DespesaList({ onEditDespesa, refreshKey }) {
  console.log("DespesaList: Renderizando. RefreshKey:", refreshKey);

  const [despesas, setDespesas] = useState([]);
  const [clientes, setClientes] = useState([]); // Para filtrar casos associados a despesas
  const [casos, setCasos] = useState([]);     // Para filtrar despesas por caso
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  // Estados para filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [clienteFilter, setClienteFilter] = useState(''); // Filtro de cliente para refinar a lista de casos
  const [casoFilter, setCasoFilter] = useState('');     // Filtro de caso para despesas
  const [statusFilter, setStatusFilter] = useState('');
  const [dataVencimentoInicio, setDataVencimentoInicio] = useState('');
  const [dataVencimentoFim, setDataVencimentoFim] = useState('');
  const [dataDespesaInicio, setDataDespesaInicio] = useState(''); // Data da efetivação da despesa
  const [dataDespesaFim, setDataDespesaFim] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Estado para ordenação
  const [sortConfig, setSortConfig] = useState({ key: 'data_vencimento', direction: 'desc' });

  const fetchClientesECasosParaFiltro = useCallback(async () => {
    console.log("DespesaList: fetchClientesECasosParaFiltro chamado. Cliente para filtro de casos:", clienteFilter);
    try {
      // Buscar Clientes
      const clientesRes = await fetch(`${API_URL}/clientes?sort_by=nome_razao_social&order=asc`);
      if (!clientesRes.ok) throw new Error('Falha ao carregar clientes para filtro.');
      const clientesData = await clientesRes.json();
      setClientes(clientesData.clientes || []);
      console.log("DespesaList: Clientes para filtro carregados:", clientesData.clientes);

      // Buscar Casos (pode ser filtrado por clienteFilter se este estiver selecionado)
      let casosUrl = `${API_URL}/casos?sort_by=titulo&order=asc`;
      if (clienteFilter) {
        casosUrl += `&cliente_id=${clienteFilter}`;
      }
      const casosRes = await fetch(casosUrl);
      if (!casosRes.ok) throw new Error('Falha ao carregar casos para filtro.');
      const casosData = await casosRes.json();
      setCasos(casosData.casos || []);
      console.log("DespesaList: Casos para filtro carregados:", casosData.casos);

    } catch (err) {
      console.error("DespesaList: Erro ao buscar clientes/casos para filtro:", err);
      toast.error(`Erro ao carregar dados para filtros: ${err.message}`);
    }
  }, [clienteFilter]); // API_URL como dependência se vier de contexto/props

  const fetchDespesas = useCallback(async () => {
    console.log("DespesaList: fetchDespesas chamado. Configuração de ordenação:", sortConfig, "Filtros:", { searchTerm, clienteFilter, casoFilter, statusFilter /*...outros filtros*/ });
    setLoading(true);
    setError('');
    let url = `${API_URL}/despesas?sort_by=${sortConfig.key}&sort_order=${sortConfig.direction}`;
    if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
    
    // Se casoFilter for "DESPESA_GERAL", queremos despesas sem caso_id
    // Se casoFilter for um ID, filtramos por esse caso_id
    // Se casoFilter estiver vazio mas clienteFilter estiver preenchido, a API deve idealmente
    // retornar despesas de todos os casos daquele cliente OU despesas gerais.
    // A lógica atual da API para despesas parece lidar com `caso_id=-1` para despesas gerais.
    if (casoFilter) {
        if (casoFilter === "DESPESA_GERAL") {
            url += `&caso_id=-1`; // Indica para a API buscar despesas sem caso
        } else {
            url += `&caso_id=${casoFilter}`;
        }
    } else if (clienteFilter) {
        // Se um cliente é selecionado mas nenhum caso específico (ou "Despesa Geral") é selecionado,
        // pode-se optar por não filtrar por caso aqui, ou a API pode ter uma lógica
        // para retornar despesas de todos os casos do cliente + despesas gerais.
        // Por simplicidade, se apenas clienteFilter está ativo, não adicionamos filtro de caso_id específico aqui,
        // mas a API pode precisar ser ajustada se o comportamento desejado for diferente.
        // Para filtrar por despesas de um cliente específico (independente do caso ou incluindo gerais),
        // a API precisaria de um parâmetro como `cliente_id_para_despesas`.
        // No momento, o filtro de cliente aqui serve para popular o dropdown de casos.
        // A filtragem de despesas por cliente é indireta através do caso selecionado.
    }

    if (statusFilter) url += `&status=${encodeURIComponent(statusFilter)}`;
    if (dataVencimentoInicio) url += `&data_vencimento_inicio=${dataVencimentoInicio}`;
    if (dataVencimentoFim) url += `&data_vencimento_fim=${dataVencimentoFim}`;
    if (dataDespesaInicio) url += `&data_despesa_inicio=${dataDespesaInicio}`;
    if (dataDespesaFim) url += `&data_despesa_fim=${dataDespesaFim}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        const resData = await response.json().catch(() => ({}));
        console.error("DespesaList: Erro da API ao buscar despesas:", resData);
        throw new Error(resData.erro || `Erro HTTP: ${response.status} ao buscar despesas`);
      }
      const data = await response.json();
      setDespesas(data.despesas || []);
      console.log("DespesaList: Despesas carregadas:", data.despesas);
    } catch (err) {
      console.error("DespesaList: Erro detalhado ao buscar despesas:", err);
      setError(`Erro ao carregar despesas: ${err.message}`);
      // toast.error(`Erro ao carregar despesas: ${err.message}`);
    } finally {
      setLoading(false);
      console.log("DespesaList: fetchDespesas finalizado.");
    }
  }, [searchTerm, clienteFilter, casoFilter, statusFilter, dataVencimentoInicio, dataVencimentoFim, dataDespesaInicio, dataDespesaFim, sortConfig]);

  useEffect(() => {
    fetchClientesECasosParaFiltro();
  }, [fetchClientesECasosParaFiltro]); // Chamado quando clienteFilter muda

  useEffect(() => {
    fetchDespesas();
  }, [fetchDespesas, refreshKey]);

  const handleDeleteClick = async (id) => {
    console.log("DespesaList: handleDeleteClick chamado para ID:", id);
    if (window.confirm(`Tem certeza que deseja excluir a despesa ID ${id}?`)) {
      setDeletingId(id);
      setError(null);
      try {
        const response = await fetch(`${API_URL}/despesas/${id}`, { method: 'DELETE' });
        if (!response.ok) {
          const resData = await response.json().catch(() => ({}));
          throw new Error(resData.erro || `Erro HTTP: ${response.status}`);
        }
        toast.success(`Despesa ID ${id} excluída com sucesso!`);
        fetchDespesas();
      } catch (err) {
        console.error(`DespesaList: Erro ao deletar despesa ${id}:`, err);
        setError(`Erro ao deletar despesa: ${err.message}`);
        toast.error(`Erro ao deletar despesa: ${err.message}`);
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
    console.log("DespesaList: requestSort. Nova ordenação:", { key, direction });
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
    const iconStyle = { width: '14px', height: '14px', display: 'inline', verticalAlign: 'text-bottom', marginLeft: '4px' };
    if (sortConfig.key !== key) return <ArrowsUpDownIcon className="text-muted" style={iconStyle} />;
    if (sortConfig.direction === 'asc') return <ArrowUpIcon className="text-primary" style={iconStyle} />;
    return <ArrowDownIcon className="text-primary" style={iconStyle} />;
  };

  const getStatusBadge = (status) => {
    switch (status) {
        case 'Paga': return 'bg-success-subtle text-success-emphasis';
        case 'A Pagar': return 'bg-warning-subtle text-warning-emphasis';
        case 'Vencida': return 'bg-danger-subtle text-danger-emphasis';
        case 'Cancelada': return 'bg-secondary-subtle text-secondary-emphasis';
        default: return 'bg-light text-dark';
    }
  };

  const resetFilters = () => {
    console.log("DespesaList: resetFilters chamado.");
    setSearchTerm('');
    setClienteFilter(''); // Reseta filtro de cliente
    setCasoFilter('');     // Reseta filtro de caso
    setStatusFilter('');
    setDataVencimentoInicio('');
    setDataVencimentoFim('');
    setDataDespesaInicio('');
    setDataDespesaFim('');
    setShowFilters(false);
  };

  if (loading && despesas.length === 0) {
    console.log("DespesaList: Renderizando estado de carregamento inicial.");
    return (
      <div className="d-flex justify-content-center align-items-center p-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">A carregar despesas...</span>
        </div>
        <span className="ms-3 text-muted">A carregar despesas...</span>
      </div>
    );
  }

  console.log("DespesaList: Renderizando tabela de despesas ou mensagem de erro/lista vazia.");
  return (
    <div className="card shadow-sm">
      <div className="card-header bg-light p-3">
        <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap">
          <h6 className="mb-0 text-secondary me-3">Filtros e Busca de Despesas</h6>
          <button
            className="btn btn-sm btn-outline-secondary py-1 px-2 d-flex align-items-center"
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
            aria-controls="filtrosAvancadosDespesas"
          >
            <FunnelIcon style={{width: '16px', height: '16px'}} className="me-1" />
            {showFilters ? 'Ocultar Avançados' : 'Mostrar Avançados'}
          </button>
        </div>
        <div className="row g-2 align-items-end">
          <div className="col-lg-3 col-md-6">
            <label htmlFor="searchTermDesp" className="form-label form-label-sm visually-hidden">Buscar</label>
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
            <label htmlFor="clienteFilterDespList" className="form-label form-label-sm visually-hidden">Filtrar Casos por Cliente</label>
            <select 
              id="clienteFilterDespList" 
              className="form-select form-select-sm" 
              value={clienteFilter} 
              onChange={(e) => {
                setClienteFilter(e.target.value);
                setCasoFilter(''); // Limpa o filtro de caso quando o cliente muda
              }}
            >
              <option value="">Todos Clientes (para Casos)</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome_razao_social}</option>)}
            </select>
          </div>
          <div className="col-lg-3 col-md-6">
            <label htmlFor="casoFilterDespList" className="form-label form-label-sm visually-hidden">Filtrar por Caso</label>
            <select 
              id="casoFilterDespList" 
              className="form-select form-select-sm" 
              value={casoFilter} 
              onChange={(e) => setCasoFilter(e.target.value)}
              disabled={!clienteFilter && casos.length === 0} // Desabilita se não houver cliente selecionado e nenhum caso carregado
            >
              <option value="">Todos os Casos/Despesas Gerais</option>
              <option value="DESPESA_GERAL">Apenas Despesas Gerais (Sem Caso)</option>
              {(clienteFilter ? casos.filter(c => String(c.cliente_id) === clienteFilter) : casos).map(cs => (
                <option key={cs.id} value={cs.id}>{cs.titulo}</option>
              ))}
            </select>
          </div>
          <div className="col-lg-2 col-md-6">
            <label htmlFor="statusFilterDespList" className="form-label form-label-sm visually-hidden">Status</label>
            <select id="statusFilterDespList" className="form-select form-select-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Todos os Status</option>
              <option value="A Pagar">A Pagar</option>
              <option value="Paga">Paga</option>
              <option value="Vencida">Vencida</option>
              <option value="Cancelada">Cancelada</option>
            </select>
          </div>
          <div className="col-lg-2 col-md-12 text-lg-end mt-2 mt-lg-0">
            <button onClick={resetFilters} className="btn btn-sm btn-outline-secondary py-1 px-2 w-100">Limpar Filtros</button>
          </div>
        </div>
        {showFilters && (
          <div className="mt-3 pt-3 border-top" id="filtrosAvancadosDespesas">
            <div className="row g-2 align-items-center mb-2">
              <div className="col-md-3 col-sm-6">
                <label htmlFor="dataVencimentoInicioDespList" className="form-label form-label-sm mb-1">Vencimento De:</label>
                <input type="date" id="dataVencimentoInicioDespList" className="form-control form-control-sm" value={dataVencimentoInicio} onChange={e => setDataVencimentoInicio(e.target.value)} />
              </div>
              <div className="col-md-3 col-sm-6">
                <label htmlFor="dataVencimentoFimDespList" className="form-label form-label-sm mb-1">Vencimento Até:</label>
                <input type="date" id="dataVencimentoFimDespList" className="form-control form-control-sm" value={dataVencimentoFim} onChange={e => setDataVencimentoFim(e.target.value)} />
              </div>
              <div className="col-md-3 col-sm-6">
                <label htmlFor="dataDespesaInicioList" className="form-label form-label-sm mb-1">Data Despesa De:</label>
                <input type="date" id="dataDespesaInicioList" className="form-control form-control-sm" value={dataDespesaInicio} onChange={e => setDataDespesaInicio(e.target.value)} />
              </div>
              <div className="col-md-3 col-sm-6">
                <label htmlFor="dataDespesaFimList" className="form-label form-label-sm mb-1">Data Despesa Até:</label>
                <input type="date" id="dataDespesaFimList" className="form-control form-control-sm" value={dataDespesaFim} onChange={e => setDataDespesaFim(e.target.value)} />
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
              <th onClick={() => requestSort('descricao')} style={{ cursor: 'pointer' }}>Descrição {getSortIcon('descricao')}</th>
              <th onClick={() => requestSort('caso_titulo')} style={{ cursor: 'pointer' }}>Caso Associado {getSortIcon('caso_titulo')}</th>
              <th className="text-end" onClick={() => requestSort('valor')} style={{ cursor: 'pointer' }}>Valor {getSortIcon('valor')}</th>
              <th onClick={() => requestSort('data_vencimento')} style={{ cursor: 'pointer' }}>Vencimento {getSortIcon('data_vencimento')}</th>
              <th onClick={() => requestSort('data_despesa')} style={{ cursor: 'pointer' }}>Data Despesa {getSortIcon('data_despesa')}</th>
              <th onClick={() => requestSort('status')} style={{ cursor: 'pointer' }}>Status {getSortIcon('status')}</th>
              <th className="text-center" style={{width: '100px'}}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && despesas.length > 0 && (
              <tr><td colSpan="7" className="text-center p-4"><div className="spinner-border spinner-border-sm text-primary" role="status"><span className="visually-hidden">A atualizar...</span></div></td></tr>
            )}
            {!loading && despesas.length === 0 ? (
              <tr><td colSpan="7" className="text-center text-muted p-4">Nenhuma despesa encontrada com os filtros aplicados.</td></tr>
            ) : (
              despesas.map((d) => (
                <tr key={d.id}>
                  <td className="px-3 py-2">{d.descricao}</td>
                  <td className="px-3 py-2">{d.caso_titulo || 'Despesa Geral'}</td>
                  <td className="px-3 py-2 text-end">
                    {/* Garante que o valor é um número antes de formatar */}
                    {typeof d.valor === 'number' || (typeof d.valor === 'string' && !isNaN(parseFloat(d.valor)))
                      ? parseFloat(d.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                      : 'N/A'}
                  </td>
                  <td className="px-3 py-2">{d.data_vencimento ? new Date(d.data_vencimento).toLocaleDateString('pt-BR') : '-'}</td>
                  <td className="px-3 py-2">{d.data_despesa ? new Date(d.data_despesa).toLocaleDateString('pt-BR') : '-'}</td>
                  <td className="px-3 py-2"><span className={`badge fs-xs ${getStatusBadge(d.status)}`}>{d.status}</span></td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => onEditDespesa(d)} className="btn btn-sm btn-outline-primary me-1 p-1 lh-1" title="Editar" style={{width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}} disabled={deletingId === d.id}><PencilSquareIcon style={{ width: '16px', height: '16px' }} /></button>
                    <button onClick={() => handleDeleteClick(d.id)} className="btn btn-sm btn-outline-danger p-1 lh-1" title="Deletar" style={{width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}} disabled={deletingId === d.id}>
                      {deletingId === d.id ? <div className="spinner-border spinner-border-sm" role="status" style={{width: '1rem', height: '1rem'}}></div> : <TrashIcon style={{ width: '16px', height: '16px' }} />}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {!loading && despesas.length > 0 && (
        <div className="card-footer bg-light text-muted p-2 text-end small">
          {despesas.length} despesa(s) encontrada(s)
        </div>
      )}
    </div>
  );
}

export default DespesaList;
