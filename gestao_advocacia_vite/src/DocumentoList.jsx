// Arquivo: src/DocumentoList.jsx
// Responsável por listar os documentos e permitir ações de download, edição de metadados e deleção.

import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config.js';
import { PencilSquareIcon, TrashIcon, ArrowDownTrayIcon, ArrowUpIcon, ArrowDownIcon, ArrowsUpDownIcon } from '@heroicons/react/24/outline';

function DocumentoList({ onEditDocumento, refreshKey }) {
    const [documentos, setDocumentos] = useState([]);
    const [clientes, setClientes] = useState([]);
    const [casos, setCasos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [deletingId, setDeletingId] = useState(null);

    // Estados para filtros e ordenação
    const [clienteFilter, setClienteFilter] = useState('');
    const [casoFilter, setCasoFilter] = useState('');
    const [searchTerm, setSearchTerm] = useState(''); // Para buscar por nome do arquivo ou descrição
    const [sortConfig, setSortConfig] = useState({ key: 'data_upload', direction: 'desc' });

    const fetchDependentData = useCallback(async () => {
        try {
            const [clientesRes, casosRes] = await Promise.all([
                fetch(`${API_URL}/clientes?sort_by=nome_razao_social&order=asc`),
                fetch(`${API_URL}/casos?sort_by=titulo&order=asc${clienteFilter ? `&cliente_id=${clienteFilter}` : ''}`)
            ]);
            if (!clientesRes.ok) throw new Error('Falha ao carregar clientes para filtro');
            if (!casosRes.ok) throw new Error('Falha ao carregar casos para filtro');
            
            const clientesData = await clientesRes.json();
            const casosData = await casosRes.json();
            
            setClientes(clientesData.clientes || []);
            setCasos(casosData.casos || []);

        } catch (err) {
            console.error("Erro ao buscar dados para filtros de documentos:", err);
            // Não define erro principal da lista, apenas loga
        }
    }, [clienteFilter]);

    const fetchDocumentos = useCallback(async () => {
        setLoading(true);
        setError('');
        let url = `${API_URL}/documentos?sort_by=${sortConfig.key}&sort_order=${sortConfig.direction}`;
        if (clienteFilter) url += `&cliente_id=${clienteFilter}`;
        if (casoFilter) url += `&caso_id=${casoFilter}`;
        if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`; // API precisa suportar 'search'

        try {
            const response = await fetch(url);
            if (!response.ok) {
                const resData = await response.json().catch(() => null);
                throw new Error(resData?.erro || `Erro HTTP: ${response.status}`);
            }
            const data = await response.json();
            setDocumentos(data.documentos || []);
        } catch (err) {
            console.error("Erro ao buscar documentos:", err);
            setError(`Erro ao carregar documentos: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, [clienteFilter, casoFilter, searchTerm, sortConfig]);

    useEffect(() => {
        fetchDependentData();
    }, [fetchDependentData]);

    useEffect(() => {
        fetchDocumentos();
    }, [fetchDocumentos, refreshKey]);

    const handleDeleteClick = async (id) => {
        if (window.confirm(`Tem certeza que deseja excluir o documento ID ${id}? Esta ação também removerá o arquivo do servidor.`)) {
            setDeletingId(id);
            setError(null);
            try {
                const response = await fetch(`${API_URL}/documentos/${id}`, { method: 'DELETE' });
                if (!response.ok) {
                    const resData = await response.json().catch(() => ({}));
                    throw new Error(resData.erro || `Erro HTTP: ${response.status}`);
                }
                fetchDocumentos(); 
            } catch (err) {
                console.error(`Erro ao deletar documento ${id}:`, err);
                setError(`Erro ao deletar documento: ${err.message}`);
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

    const formatBytes = (bytes, decimals = 2) => {
        if (bytes === 0 || !bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };


    if (loading && documentos.length === 0) {
        return (
            <div className="d-flex justify-content-center align-items-center p-4" style={{minHeight: '200px'}}>
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Carregando documentos...</span>
                </div>
                <span className="ms-2 text-muted">Carregando documentos...</span>
            </div>
        );
    }

    return (
        <div className="card shadow-sm">
            <div className="card-header bg-light p-3">
                <div className="row g-2 align-items-center">
                    <div className="col-md-3">
                        <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="Buscar por nome ou descrição..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="col-md-3">
                        <select
                            className="form-select form-select-sm"
                            value={clienteFilter}
                            onChange={(e) => { setClienteFilter(e.target.value); setCasoFilter('');}}
                        >
                            <option value="">Todos os Clientes</option>
                            {clientes.map(cliente => (
                                <option key={cliente.id} value={cliente.id}>{cliente.nome_razao_social}</option>
                            ))}
                        </select>
                    </div>
                    <div className="col-md-3">
                        <select
                            className="form-select form-select-sm"
                            value={casoFilter}
                            onChange={(e) => setCasoFilter(e.target.value)}
                            disabled={!clienteFilter && casos.length === 0}
                        >
                            <option value="">Todos os Casos</option>
                            {casos
                                .filter(caso => !clienteFilter || caso.cliente_id === parseInt(clienteFilter))
                                .map(caso => (
                                <option key={caso.id} value={caso.id}>{caso.titulo}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {error && <div className="alert alert-danger m-3 small" role="alert">{error}</div>}

            <div className="table-responsive">
                <table className="table table-hover table-striped table-sm mb-0">
                    <thead className="table-light">
                        <tr>
                            <th scope="col" className="px-3 py-2" onClick={() => requestSort('nome_original_arquivo')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                Nome do Arquivo {getSortIcon('nome_original_arquivo')}
                            </th>
                            <th scope="col" className="px-3 py-2" onClick={() => requestSort('descricao')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                Descrição {getSortIcon('descricao')}
                            </th>
                            <th scope="col" className="px-3 py-2">Cliente</th>
                            <th scope="col" className="px-3 py-2">Caso</th>
                            <th scope="col" className="px-3 py-2" onClick={() => requestSort('data_upload')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                Data Upload {getSortIcon('data_upload')}
                            </th>
                            <th scope="col" className="px-3 py-2">Tamanho</th>
                            <th scope="col" className="px-3 py-2 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {documentos.length === 0 && !loading ? (
                            <tr>
                                <td colSpan="7" className="text-center text-muted p-4">Nenhum documento encontrado.</td>
                            </tr>
                        ) : (
                            documentos.map((doc) => (
                                <tr key={doc.id}>
                                    <td className="px-3 py-2 align-middle">{doc.nome_original_arquivo}</td>
                                    <td className="px-3 py-2 align-middle">{doc.descricao || '-'}</td>
                                    <td className="px-3 py-2 align-middle">{doc.cliente_nome || '-'}</td>
                                    <td className="px-3 py-2 align-middle">{doc.caso_titulo || '-'}</td>
                                    <td className="px-3 py-2 align-middle">{new Date(doc.data_upload).toLocaleDateString()}</td>
                                    <td className="px-3 py-2 align-middle">{formatBytes(doc.tamanho_bytes)}</td>
                                    <td className="px-3 py-2 text-center align-middle">
                                        <a
                                            href={`${API_URL}/documentos/download/${doc.nome_armazenado}`}
                                            target="_blank" // Abre em nova aba para não interromper a SPA
                                            rel="noopener noreferrer"
                                            className="btn btn-sm btn-outline-success me-1 p-1 lh-1"
                                            title="Download"
                                            style={{width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}}
                                        >
                                            <ArrowDownTrayIcon style={{ width: '16px', height: '16px' }} />
                                        </a>
                                        <button
                                            onClick={() => onEditDocumento(doc)}
                                            className="btn btn-sm btn-outline-primary me-1 p-1 lh-1"
                                            title="Editar Metadados"
                                            disabled={deletingId === doc.id}
                                            style={{width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}}
                                        >
                                            <PencilSquareIcon style={{ width: '16px', height: '16px' }} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteClick(doc.id)}
                                            className="btn btn-sm btn-outline-danger p-1 lh-1"
                                            title="Deletar Documento"
                                            disabled={deletingId === doc.id}
                                            style={{width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}}
                                        >
                                            {deletingId === doc.id ? (
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
            {documentos.length > 0 && (
                <div className="card-footer bg-light text-muted p-2 text-end">
                    <small>{documentos.length} documento(s) encontrado(s)</small>
                </div>
            )}
        </div>
    );
}

export default DocumentoList;