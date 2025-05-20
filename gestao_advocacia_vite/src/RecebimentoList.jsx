// Arquivo: src/RecebimentoList.jsx
// Responsável por listar os recebimentos com filtros e ordenação.

import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config.js';
import { PencilSquareIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon, ArrowsUpDownIcon, FunnelIcon } from '@heroicons/react/24/outline';

function RecebimentoList({ onEditRecebimento, refreshKey }) {
    const [recebimentos, setRecebimentos] = useState([]);
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
    const [dataRecebimentoInicio, setDataRecebimentoInicio] = useState('');
    const [dataRecebimentoFim, setDataRecebimentoFim] = useState('');
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
            if (clienteFilter) { // Se um cliente está selecionado, filtra os casos por esse cliente
                casosUrl += `&cliente_id=${clienteFilter}`;
            }
            const casosRes = await fetch(casosUrl);
            if (!casosRes.ok) throw new Error('Falha ao carregar casos');
            const casosData = await casosRes.json();
            setCasos(casosData.casos || []);

        } catch (err) {
            console.error("Erro ao buscar clientes/casos para filtro:", err);
            // Não define erro principal da lista, apenas loga
        }
    }, [clienteFilter]); // Depende do clienteFilter para recarregar casos

    const fetchRecebimentos = useCallback(async () => {
        setLoading(true);
        setError('');
        let url = `${API_URL}/recebimentos?sort_by=${sortConfig.key}&sort_order=${sortConfig.direction}`;
        if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
        if (clienteFilter) url += `&cliente_id=${clienteFilter}`;
        if (casoFilter) url += `&caso_id=${casoFilter}`;
        if (statusFilter) url += `&status=${encodeURIComponent(statusFilter)}`;
        if (dataVencimentoInicio) url += `&data_vencimento_inicio=${dataVencimentoInicio}`;
        if (dataVencimentoFim) url += `&data_vencimento_fim=${dataVencimentoFim}`;
        if (dataRecebimentoInicio) url += `&data_recebimento_inicio=${dataRecebimentoInicio}`;
        if (dataRecebimentoFim) url += `&data_recebimento_fim=${dataRecebimentoFim}`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                const resData = await response.json().catch(() => null);
                throw new Error(resData?.erro || `Erro HTTP: ${response.status}`);
            }
            const data = await response.json();
            setRecebimentos(data.recebimentos || []);
        } catch (err) {
            console.error("Erro ao buscar recebimentos:", err);
            setError(`Erro ao carregar recebimentos: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, [searchTerm, clienteFilter, casoFilter, statusFilter, dataVencimentoInicio, dataVencimentoFim, dataRecebimentoInicio, dataRecebimentoFim, sortConfig]);

    useEffect(() => {
        fetchClientesECasosParaFiltro();
    }, [fetchClientesECasosParaFiltro]);

    useEffect(() => {
        fetchRecebimentos();
    }, [fetchRecebimentos, refreshKey]);

    const handleDeleteClick = async (id) => {
        if (window.confirm(`Tem certeza que deseja excluir o recebimento ID ${id}?`)) {
            setDeletingId(id);
            setError(null);
            try {
                const response = await fetch(`${API_URL}/recebimentos/${id}`, { method: 'DELETE' });
                if (!response.ok) {
                    const resData = await response.json().catch(() => ({}));
                    throw new Error(resData.erro || `Erro HTTP: ${response.status}`);
                }
                fetchRecebimentos(); 
            } catch (err) {
                console.error(`Erro ao deletar recebimento ${id}:`, err);
                setError(`Erro ao deletar recebimento: ${err.message}`);
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
        const iconStyle = { width: '14px', height: '14px', display: 'inline', verticalAlign: 'middle' };
        if (sortConfig.key !== key) return <ArrowsUpDownIcon className="ms-1 text-muted" style={iconStyle} />;
        if (sortConfig.direction === 'asc') return <ArrowUpIcon className="ms-1 text-primary" style={iconStyle} />;
        return <ArrowDownIcon className="ms-1 text-primary" style={iconStyle} />;
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'Pago': return 'bg-success-subtle text-success-emphasis';
            case 'Pendente': return 'bg-warning-subtle text-warning-emphasis';
            case 'Vencido': return 'bg-danger-subtle text-danger-emphasis';
            case 'Cancelado': return 'bg-secondary-subtle text-secondary-emphasis';
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
        setDataRecebimentoInicio('');
        setDataRecebimentoFim('');
    };

    if (loading && recebimentos.length === 0) {
        return (
            <div className="d-flex justify-content-center align-items-center p-4" style={{minHeight: '200px'}}>
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Carregando recebimentos...</span>
                </div>
                <span className="ms-2 text-muted">Carregando recebimentos...</span>
            </div>
        );
    }

    return (
        <div className="card shadow-sm">
            <div className="card-header bg-light p-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="mb-0 text-secondary">Filtros e Busca de Recebimentos</h6>
                    <button 
                        className="btn btn-sm btn-outline-secondary py-1 px-2 d-flex align-items-center"
                        onClick={() => setShowFilters(!showFilters)}
                    >
                        <FunnelIcon style={{width: '16px', height: '16px'}} className="me-1" />
                        {showFilters ? ' Ocultar Filtros Avançados' : ' Mostrar Filtros Avançados'}
                    </button>
                </div>
                <div className="row g-2 align-items-center">
                    <div className="col-lg-3 col-md-6">
                        <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="Buscar por Descrição/Categoria..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="col-lg-3 col-md-6">
                        <select className="form-select form-select-sm" value={clienteFilter} onChange={(e) => {setClienteFilter(e.target.value); setCasoFilter('');}}>
                            <option value="">Todos os Clientes</option>
                            {clientes.map(c => <option key={c.id} value={c.id}>{c.nome_razao_social}</option>)}
                        </select>
                    </div>
                    <div className="col-lg-3 col-md-6">
                        <select className="form-select form-select-sm" value={casoFilter} onChange={(e) => setCasoFilter(e.target.value)} disabled={!clienteFilter && casos.length === 0 && !clientes.find(c => c.id === parseInt(clienteFilter))}>
                            <option value="">Todos os Casos</option>
                            {casos.filter(c => !clienteFilter || c.cliente_id === parseInt(clienteFilter)).map(cs => (<option key={cs.id} value={cs.id}>{cs.titulo}</option>))}
                        </select>
                    </div>
                    <div className="col-lg-3 col-md-6">
                        <select className="form-select form-select-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="">Todos os Status</option>
                            <option value="Pendente">Pendente</option>
                            <option value="Pago">Pago</option>
                            <option value="Vencido">Vencido</option>
                            <option value="Cancelado">Cancelado</option>
                        </select>
                    </div>
                </div>
                {showFilters && (
                     <div className="mt-3 pt-3 border-top">
                        <div className="row g-2 align-items-center">
                            <div className="col-md-3 col-sm-6">
                                <label htmlFor="dataVencimentoInicio" className="form-label form-label-sm mb-1">Vencimento De:</label>
                                <input type="date" id="dataVencimentoInicio" className="form-control form-control-sm" value={dataVencimentoInicio} onChange={e => setDataVencimentoInicio(e.target.value)} />
                            </div>
                            <div className="col-md-3 col-sm-6">
                                <label htmlFor="dataVencimentoFim" className="form-label form-label-sm mb-1">Vencimento Até:</label>
                                <input type="date" id="dataVencimentoFim" className="form-control form-control-sm" value={dataVencimentoFim} onChange={e => setDataVencimentoFim(e.target.value)} />
                            </div>
                            <div className="col-md-3 col-sm-6">
                                <label htmlFor="dataRecebimentoInicio" className="form-label form-label-sm mb-1">Recebimento De:</label>
                                <input type="date" id="dataRecebimentoInicio" className="form-control form-control-sm" value={dataRecebimentoInicio} onChange={e => setDataRecebimentoInicio(e.target.value)} />
                            </div>
                            <div className="col-md-3 col-sm-6">
                                <label htmlFor="dataRecebimentoFim" className="form-label form-label-sm mb-1">Recebimento Até:</label>
                                <input type="date" id="dataRecebimentoFim" className="form-control form-control-sm" value={dataRecebimentoFim} onChange={e => setDataRecebimentoFim(e.target.value)} />
                            </div>
                        </div>
                        <div className="row mt-2">
                            <div className="col-12 text-end">
                                <button onClick={resetFilters} className="btn btn-sm btn-outline-secondary py-1 px-2">Limpar Filtros</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {error && <div className="alert alert-danger m-3 small" role="alert">{error}</div>}

            <div className="table-responsive">
                <table className="table table-hover table-striped table-sm mb-0">
                    <thead className="table-light">
                        <tr>
                            <th onClick={() => requestSort('descricao')} style={{ cursor: 'pointer' }}>Descrição {getSortIcon('descricao')}</th>
                            <th onClick={() => requestSort('cliente_nome')} style={{ cursor: 'pointer' }}>Cliente {getSortIcon('cliente_nome')}</th>
                            <th onClick={() => requestSort('caso_titulo')} style={{ cursor: 'pointer' }}>Caso {getSortIcon('caso_titulo')}</th>
                            <th className="text-end" onClick={() => requestSort('valor')} style={{ cursor: 'pointer' }}>Valor {getSortIcon('valor')}</th>
                            <th onClick={() => requestSort('data_vencimento')} style={{ cursor: 'pointer' }}>Vencimento {getSortIcon('data_vencimento')}</th>
                            <th onClick={() => requestSort('status')} style={{ cursor: 'pointer' }}>Status {getSortIcon('status')}</th>
                            <th className="text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {recebimentos.length === 0 && !loading ? (
                            <tr><td colSpan="7" className="text-center text-muted p-4">Nenhum recebimento encontrado.</td></tr>
                        ) : (
                            recebimentos.map((r) => (
                                <tr key={r.id}>
                                    <td className="align-middle">{r.descricao}</td>
                                    <td className="align-middle">{r.cliente_nome || '-'}</td>
                                    <td className="align-middle">{r.caso_titulo || '-'}</td>
                                    <td className="align-middle text-end">{parseFloat(r.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                    <td className="align-middle">{new Date(r.data_vencimento).toLocaleDateString()}</td>
                                    <td className="align-middle"><span className={`badge ${getStatusBadge(r.status)}`}>{r.status}</span></td>
                                    <td className="text-center align-middle">
                                        <button onClick={() => onEditRecebimento(r)} className="btn btn-sm btn-outline-primary me-1 p-1 lh-1" title="Editar" style={{width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}} disabled={deletingId === r.id}><PencilSquareIcon style={{ width: '16px', height: '16px' }} /></button>
                                        <button onClick={() => handleDeleteClick(r.id)} className="btn btn-sm btn-outline-danger p-1 lh-1" title="Deletar" style={{width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}} disabled={deletingId === r.id}>
                                            {deletingId === r.id ? <div className="spinner-border spinner-border-sm" role="status" style={{width: '1rem', height: '1rem'}}></div> : <TrashIcon style={{ width: '16px', height: '16px' }} />}
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            {recebimentos.length > 0 && (
                <div className="card-footer bg-light text-muted p-2 text-end">
                    <small>{recebimentos.length} recebimento(s) encontrado(s)</small>
                </div>
            )}
        </div>
    );
}

export default RecebimentoList;
