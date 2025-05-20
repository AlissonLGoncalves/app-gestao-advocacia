// Arquivo: src/ClienteList.jsx
// v3: Estilização refinada, filtros completos e ordenação.

import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config.js'; 
import { PencilSquareIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon, ArrowsUpDownIcon, FunnelIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';

function ClienteList({ onEditCliente, refreshKey }) {
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [deletingId, setDeletingId] = useState(null);

    // Estados para filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [tipoPessoaFilter, setTipoPessoaFilter] = useState(''); 
    // Adicionar mais filtros se necessário (ex: por cidade, estado - exigiria backend)
    // const [cidadeFilter, setCidadeFilter] = useState('');
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);


    // Estado para ordenação
    const [sortConfig, setSortConfig] = useState({ key: 'nome_razao_social', direction: 'asc' });

    const fetchClientes = useCallback(async () => {
        setLoading(true);
        setError('');
        let url = `${API_URL}/clientes?sort_by=${sortConfig.key}&sort_order=${sortConfig.direction}`;
        if (searchTerm) {
            url += `&search=${encodeURIComponent(searchTerm)}`;
        }
        if (tipoPessoaFilter) {
            url += `&tipo_pessoa=${tipoPessoaFilter}`;
        }
        // if (cidadeFilter) url += `&cidade=${encodeURIComponent(cidadeFilter)}`;


        try {
            const response = await fetch(url);
            if (!response.ok) {
                const resData = await response.json().catch(() => null);
                throw new Error(resData?.erro || `Erro HTTP: ${response.status}`);
            }
            const data = await response.json();
            setClientes(data.clientes || []);
        } catch (err) {
            console.error("Erro ao buscar clientes:", err);
            setError(`Erro ao carregar clientes: ${err.message}`);
            toast.error(`Erro ao carregar clientes: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, [searchTerm, tipoPessoaFilter, sortConfig /*, cidadeFilter */]); 

    useEffect(() => {
        fetchClientes();
    }, [fetchClientes, refreshKey]);

    const handleDeleteClick = async (id) => {
        if (window.confirm(`Tem certeza que deseja excluir o cliente ID ${id}? Esta ação pode ser irreversível e afetar registros associados (casos, recebimentos, etc.).`)) {
            setDeletingId(id);
            setError(null);
            try {
                const response = await fetch(`${API_URL}/clientes/${id}`, {
                    method: 'DELETE',
                });
                if (!response.ok) {
                    const resData = await response.json().catch(() => ({})); 
                    throw new Error(resData.erro || `Erro HTTP: ${response.status}`);
                }
                toast.success(`Cliente ID ${id} excluído com sucesso!`);
                fetchClientes(); 
            } catch (err) {
                console.error(`Erro ao deletar cliente ${id}:`, err);
                setError(`Erro ao deletar cliente: ${err.message}`);
                toast.error(`Erro ao deletar cliente: ${err.message}`);
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

    const resetFilters = () => {
        setSearchTerm('');
        setTipoPessoaFilter('');
        // setCidadeFilter('');
        setShowAdvancedFilters(false);
    };
    
    if (loading && clientes.length === 0) {
        return (
            <div className="d-flex justify-content-center align-items-center p-5">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Carregando clientes...</span>
                </div>
                <span className="ms-3 text-muted">Carregando clientes...</span>
            </div>
        );
    }
    
    return (
        <div className="card shadow-sm">
            <div className="card-header bg-light p-3">
                <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap">
                    <h6 className="mb-0 text-secondary me-3">Filtros e Busca de Clientes</h6>
                    {/* <button 
                        className="btn btn-sm btn-outline-secondary py-1 px-2 d-flex align-items-center"
                        onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                        aria-expanded={showAdvancedFilters}
                        aria-controls="filtrosAvancadosClientes"
                    >
                        <FunnelIcon style={{width: '16px', height: '16px'}} className="me-1" />
                        {showAdvancedFilters ? 'Ocultar Avançados' : 'Mostrar Avançados'}
                    </button> */}
                </div>
                
                <div className="row g-2 align-items-end">
                    <div className="col-lg-5 col-md-6">
                        <label htmlFor="searchTermCliente" className="form-label form-label-sm visually-hidden">Buscar</label>
                        <input
                            type="text"
                            id="searchTermCliente"
                            className="form-control form-control-sm"
                            placeholder="Buscar por Nome/Razão Social ou CPF/CNPJ..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="col-lg-4 col-md-6">
                         <label htmlFor="tipoPessoaFilterCliente" className="form-label form-label-sm visually-hidden">Tipo</label>
                        <select
                            id="tipoPessoaFilterCliente"
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
                        <button onClick={resetFilters} className="btn btn-sm btn-outline-secondary py-1 px-2 w-100">Limpar Filtros</button>
                    </div>
                </div>

                {/* {showAdvancedFilters && (
                    <div className="mt-3 pt-3 border-top" id="filtrosAvancadosClientes">
                        <div className="row g-2">
                            <div className="col-md-6">
                                <label htmlFor="cidadeFilterCliente" className="form-label form-label-sm mb-1">Cidade:</label>
                                <input type="text" id="cidadeFilterCliente" className="form-control form-control-sm" value={cidadeFilter} onChange={e => setCidadeFilter(e.target.value)} placeholder="Filtrar por cidade..."/>
                            </div>
                        </div>
                    </div>
                )} */}
            </div>

            {error && <div className="alert alert-danger m-3 small" role="alert">{error}</div>}
            
            <div className="table-responsive">
                <table className="table table-hover table-striped table-sm mb-0 align-middle">
                    <thead className="table-light">
                        <tr>
                            <th onClick={() => requestSort('nome_razao_social')} style={{ cursor: 'pointer' }}>Nome / Razão Social {getSortIcon('nome_razao_social')}</th>
                            <th onClick={() => requestSort('cpf_cnpj')} style={{ cursor: 'pointer' }}>CPF / CNPJ {getSortIcon('cpf_cnpj')}</th>
                            <th onClick={() => requestSort('tipo_pessoa')} style={{ cursor: 'pointer' }}>Tipo {getSortIcon('tipo_pessoa')}</th>
                            <th>Email</th>
                            <th>Telefone</th>
                            <th className="text-center" style={{width: '100px'}}>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {clientes.length === 0 && !loading ? (
                            <tr>
                                <td colSpan="6" className="text-center text-muted p-4">Nenhum cliente encontrado com os filtros aplicados.</td>
                            </tr>
                        ) : (
                            clientes.map((cliente) => (
                                <tr key={cliente.id}>
                                    <td className="px-3 py-2">{cliente.nome_razao_social}</td>
                                    <td className="px-3 py-2">{cliente.cpf_cnpj}</td>
                                    <td className="px-3 py-2">{cliente.tipo_pessoa}</td>
                                    <td className="px-3 py-2">{cliente.email || '-'}</td>
                                    <td className="px-3 py-2">{cliente.telefone || '-'}</td>
                                    <td className="px-3 py-2 text-center">
                                        <button
                                            onClick={() => onEditCliente(cliente)}
                                            className="btn btn-sm btn-outline-primary me-1 p-1 lh-1"
                                            title="Editar Cliente"
                                            disabled={deletingId === cliente.id}
                                            style={{width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}}
                                        >
                                            <PencilSquareIcon style={{ width: '16px', height: '16px' }} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteClick(cliente.id)}
                                            className="btn btn-sm btn-outline-danger p-1 lh-1"
                                            title="Deletar Cliente"
                                            disabled={deletingId === cliente.id}
                                            style={{width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}}
                                        >
                                            {deletingId === cliente.id ? (
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
            {clientes.length > 0 && (
                <div className="card-footer bg-light text-muted p-2 text-end small">
                    {clientes.length} cliente(s) encontrado(s)
                </div>
            )}
        </div>
    );
}

export default ClienteList;
