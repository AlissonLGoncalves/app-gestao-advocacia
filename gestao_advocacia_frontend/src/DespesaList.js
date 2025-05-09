// ==================================================
// Conteúdo do arquivo: src/DespesaList.js
// ==================================================
import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config'; 

function DespesaList({ onEditDespesa, onDespesaChange }) {
  const [despesas, setDespesas] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(null); const [deletingId, setDeletingId] = useState(null);
  const formatarMoeda = (valor) => valor ? parseFloat(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-';
  const formatarData = (data) => data ? new Date(data).toLocaleDateString('pt-BR') : '-';
  const fetchDespesas = useCallback(async () => { setLoading(true); setError(null); console.log(`Buscando despesas em: ${API_URL}/despesas`); try { const response = await fetch(`${API_URL}/despesas`); if (!response.ok) { const errorData = await response.json().catch(() => null); throw new Error(errorData?.erro || `Erro HTTP: ${response.status}`); } const data = await response.json(); setDespesas(data); } catch (err) { console.error("Falha ao buscar despesas:", err); setError(`Falha ao carregar despesas: ${err.message}`); } finally { setLoading(false); } }, []);
  useEffect(() => { fetchDespesas(); }, [fetchDespesas]);
  const handleDeleteClick = async (id) => { if (window.confirm(`Tem certeza que deseja excluir a despesa ID ${id}?`)) { setDeletingId(id); setError(null); try { const response = await fetch(`${API_URL}/despesas/${id}`, { method: 'DELETE' }); if (!response.ok) { const resData = await response.json().catch(() => null); throw new Error(resData?.erro || `Erro HTTP: ${response.status}`); } if (onDespesaChange) onDespesaChange(); else fetchDespesas(); } catch (err) { console.error(`Erro ao deletar despesa ${id}:`, err); setError(`Erro ao deletar despesa: ${err.message}`); } finally { setDeletingId(null); } } };
  if (loading && despesas.length === 0) return <div className="text-center p-4">Carregando despesas...</div>;
  if (error) return <div className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50" role="alert"><span className="font-medium">Erro!</span> {error}</div>;
  return ( 
    <div className="overflow-x-auto shadow-md rounded-lg">
      <h2 className="text-xl font-semibold text-gray-700 mb-4 p-4 bg-gray-50 rounded-t-lg">Lista de Despesas</h2>
      {loading && despesas.length > 0 && <p className="p-4 text-gray-500">Atualizando lista...</p>}
      {!loading && despesas.length === 0 ? (<p className="p-4 text-gray-500">Nenhuma despesa cadastrada ainda.</p>) : (
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoria</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Caso (ID)</th><th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th><th className="relative px-6 py-3"><span className="sr-only">Ações</span></th></tr></thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {despesas.map((d) => (
              <tr key={d.id} className={`hover:bg-gray-50 ${deletingId === d.id ? 'opacity-50' : ''}`}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{d.id}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatarData(d.data_despesa)}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{d.descricao}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{d.categoria}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{d.caso_id || '-'}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatarMoeda(d.valor)}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{d.status}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"><button onClick={() => onEditDespesa(d)} className="text-indigo-600 hover:text-indigo-900 mr-3 disabled:opacity-50" disabled={deletingId === d.id}>Editar</button><button onClick={() => handleDeleteClick(d.id)} className="text-red-600 hover:text-red-900 disabled:opacity-50" disabled={deletingId === d.id}>{deletingId === d.id ? 'Deletando...' : 'Deletar'}</button></td> 
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div> 
  );
}
export default DespesaList;
