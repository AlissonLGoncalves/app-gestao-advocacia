// Arquivo: src/CasoList.jsx
// Responsável por listar os casos e permitir ações de edição/deleção.
// v2: Filtros e ordenação aprimorados, incluindo filtros por período de data.

import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config.js';
import { PencilSquareIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon, ArrowsUpDownIcon, FunnelIcon } from '@heroicons/react/24/outline';

function CasoList({ onEditCaso, refreshKey }) {
    const [casos, setCasos] = useState([]);
    const [clientes, setClientes] = useState([]);
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
    const [showFilters, setShowFilters] = useState(false); // Para mostrar/esconder filtros avançados

    // Estado para ordenação
    const [sortConfig, setSortConfig] = useState({ key: 'data_atualizacao', direction: 'desc' });

    const fetchClientesParaFiltro = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/clientes?sort_by=nome_razao_social&order=asc`);
            if (!response.ok) throw new Error('Falha ao carregar clientes para filtro');
            const data = await response.json();
            setClientes(data.clientes || []);
        } catch (err) {
            console.error("Erro ao buscar clientes para filtro:", err);
            // Não define erro principal da lista, apenas loga
        }
    }, []);

    const fetchCasos = useCallback(async () => {
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
                const resData = await response.json().catch(() => null);
                throw new Error(resData?.erro || `Erro HTTP: ${response.status}`);
            }
            const data = await response.json();
            setCasos(data.casos || []);
        } catch (err) {
            console.error("Erro ao buscar casos:", err);
            setError(`Erro ao carregar casos: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, [searchTerm, statusFilter, clienteFilter, dataCriacaoInicioFilter, dataCriacaoFimFilter, dataAtualizacaoInicioFilter, dataAtualizacaoFimFilter, sortConfig]);

    useEffect(() => {
        fetchClientesParaFiltro();
    }, [fetchClientesParaFiltro]);

    useEffect(() => {
        fetchCasos();
    }, [fetchCasos, refreshKey]);

    const handleDeleteClick = async (id) => {
        if (window.confirm(`Tem certeza que deseja excluir o caso ID ${id}? Esta ação pode ser irreversível.`)) {
            setDeletingId(id);
            setError(null);
            try {
                const response = await fetch(`${API_URL}/casos/${id}`, { method: 'DELETE' });
                if (!response.ok) {
                    const resData = await response.json().catch(() => ({}));
                    throw new Error(resData.erro || `Erro HTTP: ${response.status}`);
                }
                fetchCasos();
            } catch (err) {
                console.error(`Erro ao deletar caso ${id}:`, err);
                setError(`Erro ao deletar caso: ${err.message}`);
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
    
    const resetFilters = () => {
        setSearchTerm('');
        setStatusFilter('');
        setClienteFilter('');
        setDataCriacaoInicioFilter('');
        setDataCriacaoFimFilter('');
        setDataAtualizacaoInicioFilter('');
        setDataAtualizacaoFimFilter('');
        // Mantém a ordenação atual ou reseta para padrão
        // setSortConfig({ key: 'data_atualizacao', direction: 'desc' }); 
    };

    if (loading && casos.length === 0) {
        return (
            <div className="d-flex justify-content-center align-items-center p-4" style={{minHeight: '200px'}}>
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Carregando casos...</span>
                </div>
                <span className="ms-2 text-muted">Carregando casos...</span>
            </div>
        );
    }

    return (
        <div className="card shadow-sm">
            <div className="card-header bg-light p-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="mb-0 text-secondary">Filtros e Busca</h6>
                    <button 
                        className="btn btn-sm btn-outline-secondary py-1 px-2 d-flex align-items-center"
                        onClick={() => setShowFilters(!showFilters)}
                    >
                        <FunnelIcon style={{width: '16px', height: '16px'}} className="me-1" />
                        {showFilters ? ' Ocultar Avançados' : ' Mostrar Avançados'}
                    </button>
                </div>
                
                <div className="row g-2 align-items-center">
                    <div className="col-lg-4 col-md-6">
                        <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="Buscar por Título, Nº Processo, Parte Contrária..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="col-lg-4 col-md-6">
                        <select
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
                    <div className="col-lg-4 col-md-12"> {/* Ocupa linha inteira em telas menores */}
                        <select
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
                </div>

                {showFilters && (
                    <div className="mt-3 pt-3 border-top">
                        <div className="row g-2 align-items-center">
                            <div className="col-md-3 col-sm-6">
                                <label htmlFor="dataCriacaoInicio" className="form-label form-label-sm mb-1">Criação De:</label>
                                <input type="date" id="dataCriacaoInicio" className="form-control form-control-sm" value={dataCriacaoInicioFilter} onChange={e => setDataCriacaoInicioFilter(e.target.value)} />
                            </div>
                            <div className="col-md-3 col-sm-6">
                                <label htmlFor="dataCriacaoFim" className="form-label form-label-sm mb-1">Criação Até:</label>
                                <input type="date" id="dataCriacaoFim" className="form-control form-control-sm" value={dataCriacaoFimFilter} onChange={e => setDataCriacaoFimFilter(e.target.value)} />
                            </div>
                            <div className="col-md-3 col-sm-6">
                                <label htmlFor="dataAtualizacaoInicio" className="form-label form-label-sm mb-1">Atualização De:</label>
                                <input type="date" id="dataAtualizacaoInicio" className="form-control form-control-sm" value={dataAtualizacaoInicioFilter} onChange={e => setDataAtualizacaoInicioFilter(e.target.value)} />
                            </div>
                            <div className="col-md-3 col-sm-6">
                                <label htmlFor="dataAtualizacaoFim" className="form-label form-label-sm mb-1">Atualização Até:</label>
                                <input type="date" id="dataAtualizacaoFim" className="form-control form-control-sm" value={dataAtualizacaoFimFilter} onChange={e => setDataAtualizacaoFimFilter(e.target.value)} />
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
                            <th scope="col" className="px-3 py-2" onClick={() => requestSort('titulo')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                Título {getSortIcon('titulo')}
                            </th>
                            <th scope="col" className="px-3 py-2" onClick={() => requestSort('cliente_nome')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}> {/* Assumindo que a API suporta ordenar por cliente.nome_razao_social */}
                                Cliente {getSortIcon('cliente_nome')}
                            </th>
                            <th scope="col" className="px-3 py-2" onClick={() => requestSort('numero_processo')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                Nº Proc. {getSortIcon('numero_processo')}
                            </th>
                            <th scope="col" className="px-3 py-2" onClick={() => requestSort('status')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                Status {getSortIcon('status')}
                            </th>
                            <th scope="col" className="px-3 py-2" onClick={() => requestSort('data_criacao')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                Criação {getSortIcon('data_criacao')}
                            </th>
                            <th scope="col" className="px-3 py-2" onClick={() => requestSort('data_atualizacao')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                Atualização {getSortIcon('data_atualizacao')}
                            </th>
                            <th scope="col" className="px-3 py-2 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {casos.length === 0 && !loading ? (
                            <tr>
                                <td colSpan="7" className="text-center text-muted p-4">Nenhum caso encontrado com os filtros aplicados.</td>
                            </tr>
                        ) : (
                            casos.map((caso) => (
                                <tr key={caso.id}>
                                    <td className="px-3 py-2 align-middle">{caso.titulo}</td>
                                    <td className="px-3 py-2 align-middle">{caso.cliente?.nome_razao_social || 'N/A'}</td>
                                    <td className="px-3 py-2 align-middle">{caso.numero_processo || '-'}</td>
                                    <td className="px-3 py-2 align-middle">
                                        <span className={`badge fs-xs ${ // fs-xs para fonte menor no badge
                                            caso.status === 'Ativo' ? 'bg-success-subtle text-success-emphasis' :
                                            caso.status === 'Encerrado' ? 'bg-secondary-subtle text-secondary-emphasis' :
                                            caso.status === 'Suspenso' ? 'bg-warning-subtle text-warning-emphasis' :
                                            caso.status === 'Arquivado' ? 'bg-info-subtle text-info-emphasis' :
                                            'bg-light text-dark'
                                        }`}>{caso.status}</span>
                                    </td>
                                    <td className="px-3 py-2 align-middle">{new Date(caso.data_criacao).toLocaleDateString()}</td>
                                    <td className="px-3 py-2 align-middle">{new Date(caso.data_atualizacao).toLocaleDateString()}</td>
                                    <td className="px-3 py-2 text-center align-middle">
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
            {casos.length > 0 && (
                <div className="card-footer bg-light text-muted p-2 text-end">
                    <small>{casos.length} caso(s) encontrado(s)</small>
                </div>
            )}
        </div>
    );
}

export default CasoList;
