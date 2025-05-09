// ==================================================
// Conteúdo do arquivo: src/ClienteList.js
// ==================================================
import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config'; 

function ClienteList({ onEditCliente, onClienteChange }) { 
  const [clientes, setClientes] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(null); const [deletingId, setDeletingId] = useState(null); 
  const fetchClientes = useCallback(async () => { setLoading(true); setError(null); console.log(`Buscando clientes em: ${API_URL}/clientes`); try { const response = await fetch(`${API_URL}/clientes`); console.log('Resposta recebida:', response.status, response.statusText); if (!response.ok) { let errorBody = null; try { errorBody = await response.json(); } catch (e) { /* Ignora */ } console.error("Erro HTTP:", response.status, response.statusText, errorBody); throw new Error(`Erro HTTP: ${response.status} ${response.statusText}${errorBody ? ` - ${JSON.stringify(errorBody)}` : ''}`); } const data = await response.json(); console.log('Dados recebidos:', data); setClientes(data); } catch (err) { console.error("Falha ao buscar clientes:", err); setError(`Falha ao carregar clientes. Verifique API em ${API_URL}. Detalhe: ${err.message}`); } finally { setLoading(false); } }, []); 
  useEffect(() => { fetchClientes(); }, [fetchClientes]); 
  const handleDeleteClick = async (clienteId) => { if (window.confirm(`Tem certeza que deseja excluir o cliente ID ${clienteId}?`)) { setDeletingId(clienteId); setError(null); try { const response = await fetch(`${API_URL}/clientes/${clienteId}`, { method: 'DELETE' }); const responseData = await response.json(); if (!response.ok) { throw new Error(responseData.erro || `Erro HTTP: ${response.status}`); } console.log(`Cliente ${clienteId} deletado.`); if (onClienteChange) { onClienteChange(); } else { fetchClientes(); } } catch (err) { console.error(`Erro ao deletar cliente ${clienteId}:`, err); setError(`Erro ao deletar cliente: ${err.message}`); } finally { setDeletingId(null); } } };
  if (loading && clientes.length === 0) { return <div className="text-center p-4">Carregando clientes...</div>; }
  if (error) { return ( <div className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50" role="alert"> <span className="font-medium">Erro!</span> {error} </div> ); }
  return ( 
    <div className="overflow-x-auto shadow-md rounded-lg">
      <h2 className="text-xl font-semibold text-gray-700 mb-4 p-4 bg-gray-50 rounded-t-lg">Lista de Clientes</h2>
      {loading && clientes.length > 0 && <p className="p-4 text-gray-500">Atualizando lista...</p>} 
      {!loading && clientes.length === 0 ? ( <p className="p-4 text-gray-500">Nenhum cliente cadastrado ainda.</p> ) : (
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100"><tr><th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th><th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome / Razão Social</th><th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CPF / CNPJ</th><th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th><th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th><th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telefone</th><th scope="col" className="relative px-6 py-3"><span className="sr-only">Ações</span></th></tr></thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {clientes.map((cliente) => (
              <tr key={cliente.id} className={`hover:bg-gray-50 ${deletingId === cliente.id ? 'opacity-50' : ''}`}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{cliente.id}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{cliente.nome_razao_social}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cliente.cpf_cnpj}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cliente.tipo_pessoa}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cliente.email || '-'}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cliente.telefone || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"><button onClick={() => onEditCliente(cliente)} className="text-indigo-600 hover:text-indigo-900 mr-3 disabled:opacity-50" disabled={deletingId === cliente.id}>Editar</button><button onClick={() => handleDeleteClick(cliente.id)} className="text-red-600 hover:text-red-900 disabled:opacity-50" disabled={deletingId === cliente.id}>{deletingId === cliente.id ? 'Deletando...' : 'Deletar'}</button></td> 
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div> 
  );
}
export default ClienteList;
