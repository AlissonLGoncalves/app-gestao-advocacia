// ==================================================
// Conteúdo do arquivo: src/ClienteList.js
// (Atualizado com botões de ação maiores e com ícones)
// ==================================================
import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config'; 

function ClienteList({ onEditCliente, onClienteChange }) { 
  const [clientes, setClientes] = useState([]); 
  const [loading, setLoading] = useState(true); 
  const [error, setError] = useState(null); 
  const [deletingId, setDeletingId] = useState(null); 
  
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoPessoaFiltro, setTipoPessoaFiltro] = useState(''); 
  const [sortConfig, setSortConfig] = useState({ key: 'nome_razao_social', direction: 'asc' });


  const fetchClientes = useCallback(async () => { 
    setLoading(true); setError(null);   
    const params = new URLSearchParams();
    if (searchTerm) params.append('search', searchTerm);
    if (tipoPessoaFiltro) params.append('tipo_pessoa', tipoPessoaFiltro);
    if (sortConfig.key) {
        params.append('sort_by', sortConfig.key);
        params.append('sort_order', sortConfig.direction);
    }
    
    console.log(`Buscando clientes em: ${API_URL}/clientes?${params.toString()}`); 
    try { 
      const response = await fetch(`${API_URL}/clientes?${params.toString()}`); 
      if (!response.ok) { 
        let errorBody = null; try { errorBody = await response.json(); } catch (e) { /* Ignora */ } 
        throw new Error(`Erro HTTP: ${response.status} ${response.statusText}${errorBody ? ` - ${JSON.stringify(errorBody)}` : ''}`); 
      } 
      const data = await response.json(); 
      setClientes(data); 
    } catch (err) { 
      console.error("Falha ao buscar clientes:", err); 
      setError(`Falha ao carregar clientes. Verifique API. Detalhe: ${err.message}`); 
    } finally { 
      setLoading(false); 
    } 
  }, [searchTerm, tipoPessoaFiltro, sortConfig]); 

  useEffect(() => { 
    fetchClientes(); 
  }, [fetchClientes]); 

  const handleDeleteClick = async (clienteId) => { 
      if (window.confirm(`Tem certeza que deseja excluir o cliente ID ${clienteId}?`)) { 
          setDeletingId(clienteId); setError(null); 
          try { 
              const response = await fetch(`${API_URL}/clientes/${clienteId}`, { method: 'DELETE' }); 
              const responseData = await response.json(); 
              if (!response.ok) { throw new Error(responseData.erro || `Erro HTTP: ${response.status}`); } 
              console.log(`Cliente ${clienteId} deletado.`); 
              if (onClienteChange) { onClienteChange(); } 
              else { fetchClientes(); } 
          } catch (err) { 
              console.error(`Erro ao deletar cliente ${clienteId}:`, err); 
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
    if (sortConfig.key !== key) return <i className="fas fa-sort ml-1 text-gray-400"></i>;
    if (sortConfig.direction === 'asc') return <i className="fas fa-sort-up ml-1 text-indigo-600"></i>;
    return <i className="fas fa-sort-down ml-1 text-indigo-600"></i>;
  };

  if (loading && clientes.length === 0) { return <div className="text-center p-4">Carregando clientes...</div>; }
  if (error) { return ( <div className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50" role="alert"> <span className="font-medium">Erro!</span> {error} </div> ); }
  
  return ( 
    <div className="bg-white p-6 rounded-lg shadow-xl border border-gray-200">
      <h2 className="text-2xl font-semibold text-gray-800 mb-6 border-b pb-3">Lista de Clientes</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 items-end">
        <div className="input-group">
          <label htmlFor="searchTermCliente" className="block text-sm font-medium text-gray-700">Buscar:</label>
          <input 
            type="text" 
            id="searchTermCliente"
            placeholder="Nome, CPF/CNPJ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>
        <div className="input-group">
          <label htmlFor="tipoPessoaFiltro" className="block text-sm font-medium text-gray-700">Tipo Pessoa:</label>
          <select 
            id="tipoPessoaFiltro"
            value={tipoPessoaFiltro}
            onChange={(e) => setTipoPessoaFiltro(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          >
            <option value="">Todos</option>
            <option value="PF">Pessoa Física (PF)</option>
            <option value="PJ">Pessoa Jurídica (PJ)</option>
          </select>
        </div>
      </div>

      {loading && clientes.length > 0 && <p className="p-4 text-gray-500 italic">Atualizando lista...</p>} 
      
      {!loading && clientes.length === 0 ? ( 
        <p className="p-4 text-center text-gray-500 italic">Nenhum cliente encontrado com os filtros atuais ou nenhum cadastrado.</p> 
      ) : (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-200" onClick={() => requestSort('id')}>ID {getSortIcon('id')}</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-200" onClick={() => requestSort('nome_razao_social')}>Nome / Razão Social {getSortIcon('nome_razao_social')}</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-200" onClick={() => requestSort('cpf_cnpj')}>CPF / CNPJ {getSortIcon('cpf_cnpj')}</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Tipo</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Email</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Telefone</th>
                  <th scope="col" className="relative px-6 py-3"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {clientes.map((cliente) => (
                  <tr key={cliente.id} className={`hover:bg-gray-50 transition-colors ${deletingId === cliente.id ? 'opacity-40' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{cliente.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{cliente.nome_razao_social}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cliente.cpf_cnpj}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cliente.tipo_pessoa}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cliente.email || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cliente.telefone || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      {/* Botões de Ação Aumentados e com Ícones */}
                      <button 
                        onClick={() => onEditCliente(cliente)} 
                        className="btn btn-sm bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50" 
                        disabled={deletingId === cliente.id} title="Editar Cliente">
                          <i className="fas fa-pencil-alt mr-1"></i> Editar
                      </button>
                      <button 
                        onClick={() => handleDeleteClick(cliente.id)} 
                        className="btn btn-sm bg-red-500 hover:bg-red-600 text-white disabled:opacity-50" 
                        disabled={deletingId === cliente.id} title="Deletar Cliente">
                          {deletingId === cliente.id ? <i className="fas fa-spinner fa-spin mr-1"></i> : <i className="fas fa-trash-alt mr-1"></i>}
                          {deletingId === cliente.id ? 'Deletando...' : 'Deletar'}
                      </button>
                    </td> 
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
      )}
    </div> 
  );
}
export default ClienteList;

