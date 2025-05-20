// Arquivo: src/DespesaList.jsx
// v2: Estilização refinada, filtros completos e ordenação.

import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config.js';
import { PencilSquareIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon, ArrowsUpDownIcon, FunnelIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';

function DespesaList({ onEditDespesa, refreshKey }) {
    const [despesas, setDespesas] = useState([]);
    const [clientes, setClientes] = useState([]);
    const [casos, setCasos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [deletingId, setDeletingId] = useState(null);

    // Estados para filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [clienteFilter, setClienteFilter] = useState(''); 
    const [casoFilter, setCasoFilter] = useState(''); 
    const [statusFilter, setStatusFilter] = useState('');
    const [dataVencimentoInicio, setDataVencimentoInicio] = useState('');
    const [dataVencimentoFim, setDataVencimentoFim] = useState('');
    const [dataDespesaInicio, setDataDespesaInicio] = useState('');
    const [dataDespesaFim, setDataDespesaFim] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Estado para ordenação
    const [sortConfig, setSortConfig] = useState({ key: 'data_vencimento', direction: 'desc' });

    const fetchClientesECasosParaFiltro = useCallback(async () => {
        try {
            const clientesRes = await fetch(`${API_URL}/clientes?sort_by=nome_razao_social&order=asc`);
            if (!clientesRes.ok) throw new Error('Falha ao carregar clientes');
            const clientesData = await clientesRes.json();
            setClientes(clientesData.clientes || []);

            let casosUrl = `${API_URL}/casos?sort_by=titulo&order=asc`;
            if (clienteFilter) {
                casosUrl += `&cliente_id=${clienteFilter}`;
            }
            const casosRes = await fetch(casosUrl);
            if (!casosRes.ok) throw new Error('Falha ao carregar casos');
            const casosData = await casosRes.json();
            setCasos(casosData.casos || []);

        } catch (err) {
            console.error("Erro ao buscar clientes/casos para filtro de despesas:", err);
            toast.error(`Erro ao carregar dados para filtros: ${err.message}`);
        }
    }, [clienteFilter]);

    const fetchDespesas = useCallback(async () => {
        setLoading(true);
        setError('');
        let url = `${API_URL}/despesas?sort_by=${sortConfig.key}&sort_order=${sortConfig.direction}`;
        if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
        if (clienteFilter && !casoFilter) { 
            url += `&cliente_id=${clienteFilter}`; 
        }
        if (casoFilter) {
            if (casoFilter === "DESPESA_GERAL") { 
                url += `&caso_id=-1`; 
            } else {
                url += `&caso_id=${casoFilter}`;
            }
        }
        if (statusFilter) url += `&status=${encodeURIComponent(statusFilter)}`;
        if (dataVencimentoInicio) url += `&data_vencimento_inicio=${dataVencimentoInicio}`;
        if (dataVencimentoFim) url += `&data_vencimento_fim=${dataVencimentoFim}`;
        if (dataDespesaInicio) url += `&data_despesa_inicio=${dataDespesaInicio}`;
        if (dataDespesaFim) url += `&data_despesa_fim=${dataDespesaFim}`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                const resData = await response.json().catch(() => null);
                throw new Error(resData?.erro || `Erro HTTP: ${response.status}`);
            }
            const data = await response.json();
            setDespesas(data.despesas || []);
        } catch (err) {
            console.error("Erro ao buscar despesas:", err);
            setError(`Erro ao carregar despesas: ${err.message}`);
            toast.error(`Erro ao carregar despesas: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, [searchTerm, clienteFilter, casoFilter, statusFilter, dataVencimentoInicio, dataVencimentoFim, dataDespesaInicio, dataDespesaFim, sortConfig]);

    useEffect(() => {
        fetchClientesECasosParaFiltro();
    }, [fetchClientesECasosParaFiltro]);

    useEffect(() => {
        fetchDespesas();
    }, [fetchDespesas, refreshKey]);

    const handleDeleteClick = async (id) => {
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
                console.error(`Erro ao deletar despesa ${id}:`, err);
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
        setSearchTerm('');
        setClienteFilter('');
        setCasoFilter('');
        setStatusFilter('');
        setDataVencimentoInicio('');
        setDataVencimentoFim('');
        setDataDespesaInicio('');
        setDataDespesaFim('');
        setShowFilters(false);
    };

    if (loading && despesas.length === 0) {
        return (
            <div className="d-flex justify-content-center align-items-center p-5">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Carregando despesas...</span>
                </div>
                <span className="ms-3 text-muted">Carregando despesas...</span>
            </div>
        );
    }

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
                        <label htmlFor="clienteFilterDesp" className="form-label form-label-sm visually-hidden">Cliente</label>
                        <select id="clienteFilterDesp" className="form-select form-select-sm" value={clienteFilter} onChange={(e) => {setClienteFilter(e.target.value); setCasoFilter('');}}>
                            <option value="">Todos Clientes (para Casos)</option>
                            {clientes.map(c => <option key={c.id} value={c.id}>{c.nome_razao_social}</option>)}
                        </select>
                    </div>
                    <div className="col-lg-3 col-md-6">
                        <label htmlFor="casoFilterDesp" className="form-label form-label-sm visually-hidden">Caso</label>
                        <select id="casoFilterDesp" className="form-select form-select-sm" value={casoFilter} onChange={(e) => setCasoFilter(e.target.value)} >
                            <option value="">Todos os Casos/Despesas Gerais</option>
                            <option value="DESPESA_GERAL">Apenas Despesas Gerais (Sem Caso)</option>
                            {casos.filter(c => !clienteFilter || c.cliente_id === parseInt(clienteFilter)).map(cs => (<option key={cs.id} value={cs.id}>{cs.titulo}</option>))}
                        </select>
                    </div>
                    <div className="col-lg-2 col-md-6">
                        <label htmlFor="statusFilterDesp" className="form-label form-label-sm visually-hidden">Status</label>
                        <select id="statusFilterDesp" className="form-select form-select-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="">Todos os Status</option>
                            <option value="A Pagar">A Pagar</option>
                            <option value="Paga">Paga</option>
                            <option value="Vencida">Vencida</option>
                            <option value="Cancelada">Cancelada</option>
                        </select>
                    </div>
                     <div className="col-lg-2 col-md-12 text-lg-end">
                        <button onClick={resetFilters} className="btn btn-sm btn-outline-secondary py-1 px-2 w-100">Limpar Filtros</button>
                    </div>
                </div>
                {showFilters && (
                     <div className="mt-3 pt-3 border-top" id="filtrosAvancadosDespesas">
                        <div className="row g-2 align-items-center mb-2">
                            <div className="col-md-3 col-sm-6">
                                <label htmlFor="dataVencimentoInicioDesp" className="form-label form-label-sm mb-1">Vencimento De:</label>
                                <input type="date" id="dataVencimentoInicioDesp" className="form-control form-control-sm" value={dataVencimentoInicio} onChange={e => setDataVencimentoInicio(e.target.value)} />
                            </div>
                            <div className="col-md-3 col-sm-6">
                                <label htmlFor="dataVencimentoFimDesp" className="form-label form-label-sm mb-1">Vencimento Até:</label>
                                <input type="date" id="dataVencimentoFimDesp" className="form-control form-control-sm" value={dataVencimentoFim} onChange={e => setDataVencimentoFim(e.target.value)} />
                            </div>
                            <div className="col-md-3 col-sm-6">
                                <label htmlFor="dataDespesaInicio" className="form-label form-label-sm mb-1">Data Despesa De:</label>
                                <input type="date" id="dataDespesaInicio" className="form-control form-control-sm" value={dataDespesaInicio} onChange={e => setDataDespesaInicio(e.target.value)} />
                            </div>
                            <div className="col-md-3 col-sm-6">
                                <label htmlFor="dataDespesaFim" className="form-label form-label-sm mb-1">Data Despesa Até:</label>
                                <input type="date" id="dataDespesaFim" className="form-control form-control-sm" value={dataDespesaFim} onChange={e => setDataDespesaFim(e.target.value)} />
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
                        {despesas.length === 0 && !loading ? (
                            <tr><td colSpan="7" className="text-center text-muted p-4">Nenhuma despesa encontrada.</td></tr>
                        ) : (
                            despesas.map((d) => (
                                <tr key={d.id}>
                                    <td className="px-3 py-2">{d.descricao}</td>
                                    <td className="px-3 py-2">{d.caso_titulo || 'Despesa Geral'}</td>
                                    <td className="px-3 py-2 text-end">{parseFloat(d.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                    <td className="px-3 py-2">{new Date(d.data_vencimento).toLocaleDateString()}</td>
                                    <td className="px-3 py-2">{d.data_despesa ? new Date(d.data_despesa).toLocaleDateString() : '-'}</td>
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
            {despesas.length > 0 && (
                <div className="card-footer bg-light text-muted p-2 text-end small">
                    {despesas.length} despesa(s) encontrada(s)
                </div>
            )}
        </div>
    );
}

export default DespesaList;
