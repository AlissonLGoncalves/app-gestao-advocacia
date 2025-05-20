// Arquivo: src/ClienteList.jsx
// Responsável por listar os clientes e permitir ações de edição/deleção.
// Utiliza classes Bootstrap para estilização.

import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config.js'; 

// Ícones do Heroicons para os botões de ação
import { PencilSquareIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon, ArrowsUpDownIcon } from '@heroicons/react/24/outline';

function ClienteList({ onEditCliente, refreshKey }) {
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [deletingId, setDeletingId] = useState(null);

    // Estados para filtros e ordenação
    const [searchTerm, setSearchTerm] = useState('');
    const [tipoPessoaFilter, setTipoPessoaFilter] = useState(''); // '', 'PF', 'PJ'
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

        try {
            const response = await fetch(url);
            if (!response.ok) {
                const resData = await response.json().catch(() => null);
                throw new Error(resData?.erro || `Erro HTTP: ${response.status}`);
            }
            const data = await response.json();
            setClientes(data.clientes || []); // Espera que a API retorne um objeto com a chave "clientes"
        } catch (err) {
            console.error("Erro ao buscar clientes:", err);
            setError(`Erro ao carregar clientes: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, [searchTerm, tipoPessoaFilter, sortConfig]); 

    useEffect(() => {
        fetchClientes();
    }, [fetchClientes, refreshKey]);

    const handleDeleteClick = async (id) => {
        if (window.confirm(`Tem certeza que deseja excluir o cliente ID ${id}? Esta ação pode ser irreversível e afetar registros associados.`)) {
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
                fetchClientes(); 
            } catch (err) {
                console.error(`Erro ao deletar cliente ${id}:`, err);
                setError(`Erro ao deletar cliente: ${err.message}`);
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
        if (sortConfig.key !== key) {
            return <ArrowsUpDownIcon className="ms-1 text-muted" style={iconStyle} />;
        }
        if (sortConfig.direction === 'asc') {
            return <ArrowUpIcon className="ms-1 text-primary" style={iconStyle} />;
        }
        return <ArrowDownIcon className="ms-1 text-primary" style={iconStyle} />;
    };
    
    if (loading && clientes.length === 0) {
        return (
            <div className="d-flex justify-content-center align-items-center p-4" style={{minHeight: '200px'}}>
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Carregando clientes...</span>
                </div>
                <span className="ms-2 text-muted">Carregando clientes...</span>
            </div>
        );
    }
    
    // Não mostrar erro se já houver clientes (erro pode ser de uma tentativa de deleção, por exemplo)
    // if (error && clientes.length === 0) return <div className="alert alert-danger" role="alert">Erro ao carregar clientes: {error}</div>;

    return (
        <div className="card shadow-sm">
            <div className="card-header bg-light p-3">
                <div className="row g-2 align-items-center">
                    <div className="col-md-6">
                        <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="Buscar por Nome/Razão Social ou CPF/CNPJ..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="col-md-3">
                        <select
                            className="form-select form-select-sm"
                            value={tipoPessoaFilter}
                            onChange={(e) => setTipoPessoaFilter(e.target.value)}
                        >
                            <option value="">Todos os Tipos</option>
                            <option value="PF">Pessoa Física (PF)</option>
                            <option value="PJ">Pessoa Jurídica (PJ)</option>
                        </select>
                    </div>
                    {/* Espaço para botão de refresh manual, se necessário */}
                </div>
            </div>

            {error && <div className="alert alert-danger m-3 small" role="alert">{error}</div>}
            
            <div className="table-responsive">
                <table className="table table-hover table-striped table-sm mb-0">
                    <thead className="table-light">
                        <tr>
                            <th scope="col" className="px-3 py-2" onClick={() => requestSort('nome_razao_social')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                Nome / Razão Social {getSortIcon('nome_razao_social')}
                            </th>
                            <th scope="col" className="px-3 py-2" onClick={() => requestSort('cpf_cnpj')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                CPF / CNPJ {getSortIcon('cpf_cnpj')}
                            </th>
                            <th scope="col" className="px-3 py-2" onClick={() => requestSort('tipo_pessoa')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                Tipo {getSortIcon('tipo_pessoa')}
                            </th>
                            <th scope="col" className="px-3 py-2">Email</th>
                            <th scope="col" className="px-3 py-2">Telefone</th>
                            <th scope="col" className="px-3 py-2 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {clientes.length === 0 && !loading ? (
                            <tr>
                                <td colSpan="6" className="text-center text-muted p-4">Nenhum cliente encontrado.</td>
                            </tr>
                        ) : (
                            clientes.map((cliente) => (
                                <tr key={cliente.id}>
                                    <td className="px-3 py-2 align-middle">{cliente.nome_razao_social}</td>
                                    <td className="px-3 py-2 align-middle">{cliente.cpf_cnpj}</td>
                                    <td className="px-3 py-2 align-middle">{cliente.tipo_pessoa}</td>
                                    <td className="px-3 py-2 align-middle">{cliente.email || '-'}</td>
                                    <td className="px-3 py-2 align-middle">{cliente.telefone || '-'}</td>
                                    <td className="px-3 py-2 text-center align-middle">
                                        <button
                                            onClick={() => onEditCliente(cliente)}
                                            className="btn btn-sm btn-outline-primary me-1 p-1 lh-1" // lh-1 para line-height
                                            title="Editar Cliente"
                                            disabled={deletingId === cliente.id}
                                            style={{width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}}
                                        >
                                            <PencilSquareIcon style={{ width: '16px', height: '16px' }} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteClick(cliente.id)}
                                            className="btn btn-sm btn-outline-danger p-1 lh-1" // lh-1 para line-height
                                            title="Deletar Cliente"
                                            disabled={deletingId === cliente.id}
                                            style={{width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}}
                                        >
                                            {deletingId === cliente.id ? (
                                                <div className="spinner-border spinner-border-sm" role="status" style={{width: '1rem', height: '1rem'}}>
                                                    <span className="visually-hidden">Deletando...</span>
                                                </div>
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
                <div className="card-footer bg-light text-muted p-2 text-end">
                    <small>{clientes.length} cliente(s) encontrado(s)</small>
                </div>
            )}
        </div>
    );
}

export default ClienteList;