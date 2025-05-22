// src/DocumentoList.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config.js'; // Ajuste o caminho se config.js não estiver em src/
import { PencilSquareIcon, TrashIcon, ArrowDownTrayIcon, ArrowUpIcon, ArrowDownIcon, ArrowsUpDownIcon } from '@heroicons/react/24/outline'; // Removido FunnelIcon se não usado aqui
import { toast } from 'react-toastify';

function DocumentoList({ onEditDocumento, refreshKey }) {
  console.log("DocumentoList: Renderizando. RefreshKey:", refreshKey);

  const [documentos, setDocumentos] = useState([]);
  const [clientes, setClientes] = useState([]); // Para o filtro de cliente
  const [casos, setCasos] = useState([]);     // Para o filtro de caso
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  // Estados para filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [clienteFilter, setClienteFilter] = useState(''); // Filtro de cliente para refinar a lista de casos
  const [casoFilter, setCasoFilter] = useState('');     // Filtro de caso para documentos

  // Estado para ordenação
  const [sortConfig, setSortConfig] = useState({ key: 'data_upload', direction: 'desc' });

  const fetchClientesECasosParaFiltro = useCallback(async () => {
    console.log("DocumentoList: fetchClientesECasosParaFiltro chamado. Cliente para filtro de casos:", clienteFilter);
    try {
      // Buscar Clientes
      const clientesRes = await fetch(`${API_URL}/clientes?sort_by=nome_razao_social&order=asc`);
      if (!clientesRes.ok) throw new Error('Falha ao carregar clientes para filtro.');
      const clientesData = await clientesRes.json();
      setClientes(clientesData.clientes || []);
      console.log("DocumentoList: Clientes para filtro carregados:", clientesData.clientes);

      // Buscar Casos (filtrado por clienteFilter se este estiver selecionado)
      let casosUrl = `${API_URL}/casos?sort_by=titulo&order=asc`;
      if (clienteFilter) {
        casosUrl += `&cliente_id=${clienteFilter}`;
      }
      const casosRes = await fetch(casosUrl);
      if (!casosRes.ok) throw new Error('Falha ao carregar casos para filtro.');
      const casosData = await casosRes.json();
      setCasos(casosData.casos || []);
      console.log("DocumentoList: Casos para filtro carregados:", casosData.casos);

    } catch (err) {
      console.error("DocumentoList: Erro ao buscar clientes/casos para filtro:", err);
      toast.error(`Erro ao carregar dados para filtros de documentos: ${err.message}`);
    }
  }, [clienteFilter]); // API_URL como dependência se vier de contexto/props

  const fetchDocumentos = useCallback(async () => {
    console.log("DocumentoList: fetchDocumentos chamado. Configuração de ordenação:", sortConfig, "Filtros:", { searchTerm, clienteFilter, casoFilter });
    setLoading(true);
    setError('');
    let url = `${API_URL}/documentos?sort_by=${sortConfig.key}&sort_order=${sortConfig.direction}`;
    if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
    
    // Se casoFilter for "DOCUMENTO_GERAL_CLIENTE" e clienteFilter estiver preenchido,
    // queremos documentos associados diretamente ao cliente, mas sem caso.
    // Se casoFilter for um ID de caso, filtramos por esse caso_id.
    // Se apenas clienteFilter estiver preenchido e casoFilter vazio,
    // a API pode precisar de uma lógica para retornar todos os docs daquele cliente (com ou sem caso).
    if (casoFilter) {
        if (casoFilter === "DOCUMENTO_GERAL_CLIENTE" && clienteFilter) {
            url += `&cliente_id=${clienteFilter}&sem_caso=true`; // Exemplo de como a API poderia tratar isso
        } else if (casoFilter !== "DOCUMENTO_GERAL_CLIENTE") {
            url += `&caso_id=${casoFilter}`;
        }
    } else if (clienteFilter) {
        url += `&cliente_id=${clienteFilter}`; // Documentos do cliente (com ou sem caso, depende da API)
    }
    // Se ambos vazios, busca todos os documentos (ou conforme lógica padrão da API)

    try {
      const response = await fetch(url);
      if (!response.ok) {
        const resData = await response.json().catch(() => ({}));
        console.error("DocumentoList: Erro da API ao buscar documentos:", resData);
        throw new Error(resData.erro || `Erro HTTP: ${response.status} ao buscar documentos`);
      }
      const data = await response.json();
      setDocumentos(data.documentos || []);
      console.log("DocumentoList: Documentos carregados:", data.documentos);
    } catch (err) {
      console.error("DocumentoList: Erro detalhado ao buscar documentos:", err);
      setError(`Erro ao carregar documentos: ${err.message}`);
      // toast.error(`Erro ao carregar documentos: ${err.message}`);
    } finally {
      setLoading(false);
      console.log("DocumentoList: fetchDocumentos finalizado.");
    }
  }, [searchTerm, clienteFilter, casoFilter, sortConfig]);

  useEffect(() => {
    fetchClientesECasosParaFiltro();
  }, [fetchClientesECasosParaFiltro]);

  useEffect(() => {
    fetchDocumentos();
  }, [fetchDocumentos, refreshKey]);

  const handleDeleteClick = async (id) => {
    console.log("DocumentoList: handleDeleteClick chamado para ID:", id);
    if (window.confirm(`Tem certeza que deseja excluir o documento ID ${id}? Esta ação também removerá o arquivo físico do servidor.`)) {
      setDeletingId(id);
      setError(null);
      try {
        const response = await fetch(`${API_URL}/documentos/${id}`, { method: 'DELETE' });
        if (!response.ok) {
          const resData = await response.json().catch(() => ({}));
          throw new Error(resData.erro || `Erro HTTP: ${response.status}`);
        }
        toast.success(`Documento ID ${id} excluído com sucesso!`);
        fetchDocumentos();
      } catch (err) {
        console.error(`DocumentoList: Erro ao deletar documento ${id}:`, err);
        setError(`Erro ao deletar documento: ${err.message}`);
        toast.error(`Erro ao deletar documento: ${err.message}`);
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
    console.log("DocumentoList: requestSort. Nova ordenação:", { key, direction });
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
    const iconStyle = { width: '14px', height: '14px', display: 'inline', verticalAlign: 'text-bottom', marginLeft: '4px' };
    if (sortConfig.key !== key) return <ArrowsUpDownIcon className="text-muted" style={iconStyle} />;
    if (sortConfig.direction === 'asc') return <ArrowUpIcon className="text-primary" style={iconStyle} />;
    return <ArrowDownIcon className="text-primary" style={iconStyle} />;
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };
  
  const resetFilters = () => {
    console.log("DocumentoList: resetFilters chamado.");
    setSearchTerm('');
    setClienteFilter('');
    setCasoFilter('');
  };

  if (loading && documentos.length === 0) {
    console.log("DocumentoList: Renderizando estado de carregamento inicial.");
    return (
      <div className="d-flex justify-content-center align-items-center p-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">A carregar documentos...</span>
        </div>
        <span className="ms-3 text-muted">A carregar documentos...</span>
      </div>
    );
  }

  console.log("DocumentoList: Renderizando tabela de documentos ou mensagem de erro/lista vazia.");
  return (
    <div className="card shadow-sm">
      <div className="card-header bg-light p-3">
        <h6 className="mb-2 text-secondary">Filtros e Busca de Documentos</h6>
        <div className="row g-2 align-items-end">
          <div className="col-lg-4 col-md-6">
            <label htmlFor="searchTermDocList" className="form-label form-label-sm visually-hidden">Buscar</label>
            <input
              type="text"
              id="searchTermDocList"
              className="form-control form-control-sm"
              placeholder="Buscar por Nome do Arquivo/Descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="col-lg-3 col-md-6">
            <label htmlFor="clienteFilterDocList" className="form-label form-label-sm visually-hidden">Filtrar por Cliente</label>
            <select 
              id="clienteFilterDocList" 
              className="form-select form-select-sm" 
              value={clienteFilter} 
              onChange={(e) => {
                setClienteFilter(e.target.value);
                setCasoFilter(''); // Limpa o filtro de caso quando o cliente muda
              }}
            >
              <option value="">Todos os Clientes</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome_razao_social}</option>)}
            </select>
          </div>
          <div className="col-lg-3 col-md-6">
            <label htmlFor="casoFilterDocList" className="form-label form-label-sm visually-hidden">Filtrar por Caso</label>
            <select 
              id="casoFilterDocList" 
              className="form-select form-select-sm" 
              value={casoFilter} 
              onChange={(e) => setCasoFilter(e.target.value)}
              disabled={!clienteFilter && casos.length === 0} // Desabilita se não houver cliente selecionado e nenhum caso carregado
            >
              <option value="">Todos os Casos/Documentos do Cliente</option>
              {/* Opção para documentos apenas do cliente, sem caso específico */}
              {clienteFilter && <option value="DOCUMENTO_GERAL_CLIENTE">Apenas Documentos do Cliente (Sem Caso)</option>}
              {(clienteFilter ? casos.filter(c => String(c.cliente_id) === clienteFilter) : casos).map(cs => (
                <option key={cs.id} value={cs.id}>{cs.titulo}</option>
              ))}
            </select>
          </div>
          <div className="col-lg-2 col-md-12 text-lg-end mt-2 mt-lg-0">
            <button onClick={resetFilters} className="btn btn-sm btn-outline-secondary py-1 px-2 w-100">Limpar Filtros</button>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger m-3 small" role="alert">{error}</div>}

      <div className="table-responsive">
        <table className="table table-hover table-striped table-sm mb-0 align-middle">
          <thead className="table-light">
            <tr>
              <th onClick={() => requestSort('nome_original_arquivo')} style={{ cursor: 'pointer' }}>Nome Arquivo {getSortIcon('nome_original_arquivo')}</th>
              <th onClick={() => requestSort('descricao')} style={{ cursor: 'pointer' }}>Descrição {getSortIcon('descricao')}</th>
              <th onClick={() => requestSort('cliente_nome')} style={{ cursor: 'pointer' }}>Cliente {getSortIcon('cliente_nome')}</th>
              <th onClick={() => requestSort('caso_titulo')} style={{ cursor: 'pointer' }}>Caso {getSortIcon('caso_titulo')}</th>
              <th onClick={() => requestSort('data_upload')} style={{ cursor: 'pointer' }}>Upload {getSortIcon('data_upload')}</th>
              <th onClick={() => requestSort('tamanho_bytes')} style={{ cursor: 'pointer' }}>Tamanho {getSortIcon('tamanho_bytes')}</th>
              <th className="text-center" style={{width: '120px'}}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && documentos.length > 0 && (
              <tr><td colSpan="7" className="text-center p-4"><div className="spinner-border spinner-border-sm text-primary" role="status"><span className="visually-hidden">A atualizar...</span></div></td></tr>
            )}
            {!loading && documentos.length === 0 ? (
              <tr><td colSpan="7" className="text-center text-muted p-4">Nenhum documento encontrado com os filtros aplicados.</td></tr>
            ) : (
              documentos.map((doc) => (
                <tr key={doc.id}>
                  <td className="px-3 py-2 text-truncate" style={{maxWidth: '200px'}} title={doc.nome_original_arquivo}>{doc.nome_original_arquivo}</td>
                  <td className="px-3 py-2 text-truncate" style={{maxWidth: '250px'}} title={doc.descricao}>{doc.descricao || '-'}</td>
                  <td className="px-3 py-2">{doc.cliente_nome || '-'}</td>
                  <td className="px-3 py-2">{doc.caso_titulo || (doc.cliente_id ? 'Documento do Cliente (Geral)' : '-')}</td>
                  <td className="px-3 py-2">{doc.data_upload ? new Date(doc.data_upload).toLocaleDateString('pt-BR') : '-'}</td>
                  <td className="px-3 py-2">{formatBytes(doc.tamanho_bytes)}</td>
                  <td className="px-3 py-2 text-center">
                    <a
                      href={`${API_URL}/documentos/download/${doc.nome_armazenado}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-outline-success me-1 p-1 lh-1"
                      title="Download"
                      style={{width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}}
                    >
                      <ArrowDownTrayIcon style={{ width: '16px', height: '16px' }} />
                    </a>
                    <button onClick={() => onEditDocumento(doc)} className="btn btn-sm btn-outline-primary me-1 p-1 lh-1" title="Editar Metadados" style={{width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}} disabled={deletingId === doc.id}><PencilSquareIcon style={{ width: '16px', height: '16px' }} /></button>
                    <button onClick={() => handleDeleteClick(doc.id)} className="btn btn-sm btn-outline-danger p-1 lh-1" title="Deletar" style={{width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}} disabled={deletingId === doc.id}>
                      {deletingId === doc.id ? <div className="spinner-border spinner-border-sm" role="status" style={{width: '1rem', height: '1rem'}}></div> : <TrashIcon style={{ width: '16px', height: '16px' }} />}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {!loading && documentos.length > 0 && (
        <div className="card-footer bg-light text-muted p-2 text-end small">
          {documentos.length} documento(s) encontrado(s)
        </div>
      )}
    </div>
  );
}

export default DocumentoList;
