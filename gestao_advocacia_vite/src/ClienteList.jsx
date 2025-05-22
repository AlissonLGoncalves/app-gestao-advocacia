// src/ClienteList.jsx
import React, { useState, useEffect, useCallback } from 'react';
// src/DocumentoList.jsx (ou qualquer outro componente)
import { API_URL } from './config.js'; // CORRETO: sem a barra no final do nome do arquivo
import { PencilSquareIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon, ArrowsUpDownIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';

function ClienteList({ onEditCliente, refreshKey }) {
  console.log("ClienteList: Renderizando. RefreshKey:", refreshKey);

  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [tipoPessoaFilter, setTipoPessoaFilter] = useState('');

  const [sortConfig, setSortConfig] = useState({ key: 'nome_razao_social', direction: 'asc' });

  const fetchClientes = useCallback(async () => {
    console.log("ClienteList: fetchClientes chamado. Ordenação:", sortConfig, "Filtros:", { searchTerm, tipoPessoaFilter });
    setLoading(true);
    setError('');
    let url = `${API_URL}/clientes?sort_by=${sortConfig.key}&sort_order=${sortConfig.direction}`;
    if (searchTerm) {
      url += `&search=${encodeURIComponent(searchTerm)}`;
    }
    if (tipoPessoaFilter) {
      url += `&tipo_pessoa=${encodeURIComponent(tipoPessoaFilter)}`;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        const resData = await response.json().catch(() => ({}));
        console.error("ClienteList: Erro da API ao buscar clientes:", resData);
        throw new Error(resData.erro || `Erro HTTP: ${response.status} ao buscar clientes`);
      }
      const data = await response.json();
      setClientes(data.clientes || []);
      console.log("ClienteList: Clientes carregados:", data.clientes);
    } catch (err) {
      console.error("ClienteList: Erro detalhado ao buscar clientes:", err);
      setError(`Erro ao carregar clientes: ${err.message}`);
    } finally {
      setLoading(false);
      console.log("ClienteList: fetchClientes finalizado.");
    }
  }, [searchTerm, tipoPessoaFilter, sortConfig]);

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes, refreshKey]);

  const handleDeleteClick = async (id) => {
    console.log("ClienteList: handleDeleteClick chamado para ID:", id);
    if (window.confirm(`Tem certeza que deseja excluir o cliente ID ${id}? Esta ação pode ser irreversível e afetar registos associados (casos, recebimentos, etc.).`)) {
      setDeletingId(id);
      setError(null);
      try {
        const response = await fetch(`${API_URL}/clientes/${id}`, { method: 'DELETE' });
        if (!response.ok) {
          const resData = await response.json().catch(() => ({}));
          console.error("ClienteList: Erro da API ao deletar cliente:", resData);
          // Verifica se o erro é devido a CASCATA/FK
          if (response.status === 409 || (resData.erro && resData.erro.toLowerCase().includes("associados"))) {
             toast.error(resData.erro || "Não é possível deletar o cliente pois existem registos associados a ele.");
          } else {
            throw new Error(resData.erro || `Erro HTTP: ${response.status}`);
          }
        } else {
            toast.success(`Cliente ID ${id} excluído com sucesso!`);
            fetchClientes();
        }
      } catch (err) {
        console.error(`ClienteList: Erro ao deletar cliente ${id}:`, err);
        setError(`Erro ao deletar cliente: ${err.message}`);
        if (!err.message.toLowerCase().includes("associados")) { // Evita toast duplicado
            toast.error(`Erro ao deletar cliente: ${err.message}`);
        }
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
    console.log("ClienteList: requestSort. Nova ordenação:", { key, direction });
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
    const iconStyle = { width: '14px', height: '14px', display: 'inline', verticalAlign: 'text-bottom', marginLeft: '4px' };
    if (sortConfig.key !== key) return <ArrowsUpDownIcon className="text-muted" style={iconStyle} />;
    if (sortConfig.direction === 'asc') return <ArrowUpIcon className="text-primary" style={iconStyle} />;
    return <ArrowDownIcon className="text-primary" style={iconStyle} />;
  };
  
  const resetFilters = () => {
    console.log("ClienteList: resetFilters chamado.");
    setSearchTerm('');
    setTipoPessoaFilter('');
  };

  if (loading && clientes.length === 0) {
    console.log("ClienteList: Renderizando estado de carregamento inicial.");
    return (
      <div className="d-flex justify-content-center align-items-center p-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">A carregar clientes...</span>
        </div>
        <span className="ms-3 text-muted">A carregar clientes...</span>
      </div>
    );
  }

  console.log("ClienteList: Renderizando tabela de clientes ou mensagem de erro/lista vazia.");
  return (
    <div className="card shadow-sm">
      <div className="card-header bg-light p-3">
        <div className="row g-2 align-items-end">
          <div className="col-lg-5 col-md-6">
            <label htmlFor="searchTermClienteList" className="form-label form-label-sm visually-hidden">Buscar</label>
            <input
              type="text"
              id="searchTermClienteList"
              className="form-control form-control-sm"
              placeholder="Buscar por Nome, CPF/CNPJ, Email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="col-lg-4 col-md-6">
            <label htmlFor="tipoPessoaFilterClienteList" className="form-label form-label-sm visually-hidden">Tipo</label>
            <select
              id="tipoPessoaFilterClienteList"
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
      </div>

      {error && <div className="alert alert-danger m-3 small" role="alert">{error}</div>}

      <div className="table-responsive">
        <table className="table table-hover table-striped table-sm mb-0 align-middle">
          <thead className="table-light">
            <tr>
              <th onClick={() => requestSort('nome_razao_social')} style={{ cursor: 'pointer' }}>Nome / Razão Social {getSortIcon('nome_razao_social')}</th>
              <th onClick={() => requestSort('cpf_cnpj')} style={{ cursor: 'pointer' }}>CPF / CNPJ Principal {getSortIcon('cpf_cnpj')}</th>
              <th onClick={() => requestSort('tipo_pessoa')} style={{ cursor: 'pointer' }}>Tipo {getSortIcon('tipo_pessoa')}</th>
              <th>Email</th>
              <th>Telefone</th>
              <th className="text-center" style={{width: '100px'}}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && clientes.length > 0 && (
              <tr><td colSpan="6" className="text-center p-4"><div className="spinner-border spinner-border-sm text-primary" role="status"><span className="visually-hidden">A atualizar...</span></div></td></tr>
            )}
            {!loading && clientes.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center text-muted p-4">Nenhum cliente encontrado com os filtros aplicados.</td>
              </tr>
            ) : (
              clientes.map((cliente) => (
                <tr key={cliente.id}>
                  <td className="px-3 py-2">
                    {cliente.nome_razao_social}
                    {cliente.tipo_pessoa === 'PJ' && (cliente.cnpj_secundario || cliente.cnpj_terciario) && (
                      <InformationCircleIcon 
                        className="ms-1 text-info d-inline" 
                        style={{ width: '16px', height: '16px', cursor: 'help' }} 
                        title={`CNPJs Adicionais: ${[cliente.cnpj_secundario, cliente.cnpj_terciario].filter(Boolean).join(', ')}`}
                      />
                    )}
                  </td>
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
      {!loading && clientes.length > 0 && (
        <div className="card-footer bg-light text-muted p-2 text-end small">
          {clientes.length} cliente(s) encontrado(s)
        </div>
      )}
    </div>
  );
}

export default ClienteList;
