// Arquivo: src/EventoAgendaList.jsx
// Responsável por listar os eventos da agenda com filtros e ordenação.

import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config.js';
import { PencilSquareIcon, TrashIcon, CheckCircleIcon, XCircleIcon, ArrowUpIcon, ArrowDownIcon, ArrowsUpDownIcon, FunnelIcon, CalendarDaysIcon, ClockIcon } from '@heroicons/react/24/outline';

function EventoAgendaList({ onEditEvento, refreshKey }) {
    const [eventos, setEventos] = useState([]);
    const [clientes, setClientes] = useState([]);
    const [casos, setCasos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [deletingId, setDeletingId] = useState(null);
    const [togglingId, setTogglingId] = useState(null);

    // Estados para filtros
    const [searchTerm, setSearchTerm] = useState(''); // Para buscar por título ou descrição
    const [clienteFilter, setClienteFilter] = useState('');
    const [casoFilter, setCasoFilter] = useState(''); // Pode ser ID do caso ou "EVENTO_GERAL"
    const [tipoEventoFilter, setTipoEventoFilter] = useState('');
    const [statusConclusaoFilter, setStatusConclusaoFilter] = useState(''); // '', 'concluido', 'pendente'
    const [dataInicioFilter, setDataInicioFilter] = useState(''); // Data de início do período
    const [dataFimFilter, setDataFimFilter] = useState(''); // Data de fim do período
    const [showFilters, setShowFilters] = useState(false);

    // Estado para ordenação
    const [sortConfig, setSortConfig] = useState({ key: 'data_inicio', direction: 'asc' });

    const tipoEventoOptions = ["Prazo", "Audiência", "Reunião", "Lembrete", "Outro"];

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
            console.error("Erro ao buscar clientes/casos para filtro de agenda:", err);
        }
    }, [clienteFilter]);

    const fetchEventos = useCallback(async () => {
        setLoading(true);
        setError('');
        let url = `${API_URL}/eventos?sort_by=${sortConfig.key}&sort_order=${sortConfig.direction}`;
        if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
        if (clienteFilter && !casoFilter) { // Se cliente selecionado, mas nenhum caso específico
             url += `&cliente_id=${clienteFilter}`; // API precisa suportar filtro de eventos por cliente_id (via casos)
        }
        if (casoFilter) {
            if (casoFilter === "EVENTO_GERAL") {
                url += `&caso_id=-1`; // Sinaliza para buscar eventos sem caso_id
            } else {
                url += `&caso_id=${casoFilter}`;
            }
        }
        if (tipoEventoFilter) url += `&tipo_evento=${encodeURIComponent(tipoEventoFilter)}`;
        if (statusConclusaoFilter === 'concluido') url += `&concluido=true`;
        if (statusConclusaoFilter === 'pendente') url += `&concluido=false`;
        if (dataInicioFilter) url += `&start=${dataInicioFilter}`; 
        if (dataFimFilter) url += `&end=${dataFimFilter}`;       

        try {
            const response = await fetch(url);
            if (!response.ok) {
                const resData = await response.json().catch(() => null);
                throw new Error(resData?.erro || `Erro HTTP: ${response.status}`);
            }
            const data = await response.json();
            setEventos(data.eventos || []);
        } catch (err) {
            console.error("Erro ao buscar eventos:", err);
            setError(`Erro ao carregar eventos: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, [searchTerm, clienteFilter, casoFilter, tipoEventoFilter, statusConclusaoFilter, dataInicioFilter, dataFimFilter, sortConfig]);

    useEffect(() => {
        fetchClientesECasosParaFiltro();
    }, [fetchClientesECasosParaFiltro]);

    useEffect(() => {
        fetchEventos();
    }, [fetchEventos, refreshKey]);

    const handleDeleteClick = async (id) => {
        if (window.confirm(`Tem certeza que deseja excluir o evento/prazo ID ${id}?`)) {
            setDeletingId(id);
            setError(null);
            try {
                const response = await fetch(`${API_URL}/eventos/${id}`, { method: 'DELETE' });
                if (!response.ok) {
                    const resData = await response.json().catch(() => ({}));
                    throw new Error(resData.erro || `Erro HTTP: ${response.status}`);
                }
                fetchEventos(); 
            } catch (err) {
                console.error(`Erro ao deletar evento ${id}:`, err);
                setError(`Erro ao deletar evento: ${err.message}`);
            } finally {
                setDeletingId(null);
            }
        }
    };
    
    const handleToggleConcluido = async (evento) => {
        setTogglingId(evento.id);
        setError(null);
        // Prepara os dados para enviar, garantindo que as datas estejam no formato correto se forem enviadas
        // A API de update de evento espera um corpo JSON completo.
        const dadosAtualizados = { 
            ...evento, 
            // Converte data_inicio e data_fim para string ISO se existirem, removendo milissegundos e 'Z'
            // A API deve ser capaz de parsear isso.
            data_inicio: evento.data_inicio ? new Date(evento.data_inicio).toISOString().split('.')[0] : null,
            data_fim: evento.data_fim ? new Date(evento.data_fim).toISOString().split('.')[0] : null,
            concluido: !evento.concluido 
        };
         // Remove o campo 'cliente' e 'caso_titulo' que são apenas para exibição e não do modelo EventoAgenda
        delete dadosAtualizados.cliente; 
        delete dadosAtualizados.caso_titulo; 
        delete dadosAtualizados.cliente_nome; // Se existir

        try {
            const response = await fetch(`${API_URL}/eventos/${evento.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dadosAtualizados)
            });
            if (!response.ok) {
                const resData = await response.json().catch(() => ({}));
                throw new Error(resData.erro || `Erro HTTP: ${response.status}`);
            }
            fetchEventos();
        } catch (err) {
            console.error(`Erro ao atualizar status do evento ${evento.id}:`, err);
            setError(`Erro ao atualizar status: ${err.message}`);
        } finally {
            setTogglingId(null);
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
        setClienteFilter('');
        setCasoFilter('');
        setTipoEventoFilter('');
        setStatusConclusaoFilter('');
        setDataInicioFilter('');
        setDataFimFilter('');
    };

    if (loading && eventos.length === 0) {
        return (
            <div className="d-flex justify-content-center align-items-center p-4" style={{minHeight: '200px'}}>
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Carregando agenda...</span>
                </div>
                <span className="ms-2 text-muted">Carregando agenda...</span>
            </div>
        );
    }

    return (
        <div className="card shadow-sm">
            <div className="card-header bg-light p-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="mb-0 text-secondary">Filtros e Busca na Agenda</h6>
                    <button 
                        className="btn btn-sm btn-outline-secondary py-1 px-2 d-flex align-items-center"
                        onClick={() => setShowFilters(!showFilters)}
                    >
                        <FunnelIcon style={{width: '16px', height: '16px'}} className="me-1" />
                        {showFilters ? ' Ocultar Filtros Avançados' : ' Mostrar Filtros Avançados'}
                    </button>
                </div>
                <div className="row g-2 align-items-center">
                    <div className="col-lg-4 col-md-6">
                        <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="Buscar por Título/Descrição..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="col-lg-4 col-md-6">
                        <select className="form-select form-select-sm" value={clienteFilter} onChange={(e) => {setClienteFilter(e.target.value); setCasoFilter('');}}>
                            <option value="">Todos Clientes (para Casos)</option>
                            {clientes.map(c => <option key={c.id} value={c.id}>{c.nome_razao_social}</option>)}
                        </select>
                    </div>
                    <div className="col-lg-4 col-md-12">
                        <select className="form-select form-select-sm" value={casoFilter} onChange={(e) => setCasoFilter(e.target.value)}>
                            <option value="">Todos os Casos/Eventos Gerais</option>
                            <option value="EVENTO_GERAL">Apenas Eventos Gerais (Sem Caso)</option>
                            {casos.filter(c => !clienteFilter || c.cliente_id === parseInt(clienteFilter)).map(cs => (<option key={cs.id} value={cs.id}>{cs.titulo}</option>))}
                        </select>
                    </div>
                </div>
                {showFilters && (
                     <div className="mt-3 pt-3 border-top">
                        <div className="row g-2 align-items-center">
                            <div className="col-md-3 col-sm-6">
                                <select className="form-select form-select-sm" value={tipoEventoFilter} onChange={(e) => setTipoEventoFilter(e.target.value)}>
                                    <option value="">Todos os Tipos</option>
                                    {tipoEventoOptions.map(tipo => (<option key={tipo} value={tipo}>{tipo}</option>))}
                                </select>
                            </div>
                            <div className="col-md-3 col-sm-6">
                                <select className="form-select form-select-sm" value={statusConclusaoFilter} onChange={(e) => setStatusConclusaoFilter(e.target.value)}>
                                    <option value="">Todos (Conclusão)</option>
                                    <option value="pendente">Pendentes</option>
                                    <option value="concluido">Concluídos</option>
                                </select>
                            </div>
                            <div className="col-md-3 col-sm-6">
                                <label htmlFor="dataInicioEvt" className="form-label form-label-sm mb-1 visually-hidden">De:</label>
                                <input type="date" id="dataInicioEvt" className="form-control form-control-sm" value={dataInicioFilter} onChange={e => setDataInicioFilter(e.target.value)} title="Filtrar por data de início a partir de"/>
                            </div>
                            <div className="col-md-3 col-sm-6">
                                 <label htmlFor="dataFimEvt" className="form-label form-label-sm mb-1 visually-hidden">Até:</label>
                                <input type="date" id="dataFimEvt" className="form-control form-control-sm" value={dataFimFilter} onChange={e => setDataFimFilter(e.target.value)} title="Filtrar por data de início até"/>
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
                            <th onClick={() => requestSort('data_inicio')} style={{ cursor: 'pointer' }}>Data/Hora Início {getSortIcon('data_inicio')}</th>
                            <th onClick={() => requestSort('titulo')} style={{ cursor: 'pointer' }}>Título {getSortIcon('titulo')}</th>
                            <th onClick={() => requestSort('tipo_evento')} style={{ cursor: 'pointer' }}>Tipo {getSortIcon('tipo_evento')}</th>
                            <th onClick={() => requestSort('caso_titulo')} style={{ cursor: 'pointer' }}>Caso {getSortIcon('caso_titulo')}</th>
                            <th className="text-center" onClick={() => requestSort('concluido')} style={{ cursor: 'pointer' }}>Concluído {getSortIcon('concluido')}</th>
                            <th className="text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {eventos.length === 0 && !loading ? (
                            <tr><td colSpan="6" className="text-center text-muted p-4">Nenhum evento/prazo encontrado.</td></tr>
                        ) : (
                            eventos.map((evento) => (
                                <tr key={evento.id} className={evento.concluido ? 'opacity-50' : ''}>
                                    <td className="align-middle">
                                        {new Date(evento.data_inicio).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td className="align-middle">{evento.titulo}</td>
                                    <td className="align-middle">
                                        {evento.tipo_evento === 'Prazo' && <ClockIcon className="me-1 text-danger d-inline" style={{width: '16px', height: '16px'}}/>}
                                        {evento.tipo_evento !== 'Prazo' && <CalendarDaysIcon className="me-1 text-primary d-inline" style={{width: '16px', height: '16px'}}/>}
                                        {evento.tipo_evento}
                                    </td>
                                    <td className="align-middle">{evento.caso_titulo || '-'}</td>
                                    <td className="text-center align-middle">
                                        <button
                                            onClick={() => handleToggleConcluido(evento)}
                                            className={`btn btn-sm p-1 lh-1 ${evento.concluido ? 'btn-outline-secondary' : 'btn-outline-success'}`}
                                            title={evento.concluido ? 'Marcar como Pendente' : 'Marcar como Concluído'}
                                            disabled={togglingId === evento.id}
                                            style={{width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}}
                                        >
                                            {togglingId === evento.id ? <div className="spinner-border spinner-border-sm" role="status"></div> : (evento.concluido ? <XCircleIcon style={{ width: '18px', height: '18px' }}/> : <CheckCircleIcon style={{ width: '18px', height: '18px' }} />)}
                                        </button>
                                    </td>
                                    <td className="text-center align-middle">
                                        <button onClick={() => onEditEvento(evento)} className="btn btn-sm btn-outline-primary me-1 p-1 lh-1" title="Editar" style={{width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}} disabled={deletingId === evento.id || togglingId === evento.id}><PencilSquareIcon style={{ width: '16px', height: '16px' }} /></button>
                                        <button onClick={() => handleDeleteClick(evento.id)} className="btn btn-sm btn-outline-danger p-1 lh-1" title="Deletar" style={{width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}} disabled={deletingId === evento.id || togglingId === evento.id}>
                                            {deletingId === evento.id ? <div className="spinner-border spinner-border-sm" role="status" style={{width: '1rem', height: '1rem'}}></div> : <TrashIcon style={{ width: '16px', height: '16px' }} />}
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            {eventos.length > 0 && (
                <div className="card-footer bg-light text-muted p-2 text-end">
                    <small>{eventos.length} evento(s) encontrado(s)</small>
                </div>
            )}
        </div>
    );
}

export default EventoAgendaList;