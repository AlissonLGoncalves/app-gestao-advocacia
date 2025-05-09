// ==================================================
// Conteúdo do arquivo: src/CasoList.js
// ==================================================
import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config'; 

function CasoList({ onEditCaso, onCasoChange }) {
  const [casos, setCasos] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(null); const [deletingId, setDeletingId] = useState(null);
  const fetchCasos = useCallback(async () => { setLoading(true); setError(null); console.log(`Buscando casos em: ${API_URL}/casos`); try { const response = await fetch(`${API_URL}/casos`); if (!response.ok) { const errorData = await response.json().catch(() => null); throw new Error(errorData?.erro || `Erro HTTP: ${response.status}`); } const data = await response.json(); setCasos(data); } catch (err) { console.error("Falha ao buscar casos:", err); setError(`Falha ao carregar casos: ${err.message}`); } finally { setLoading(false); } }, []); 
  useEffect(() => { fetchCasos(); }, [fetchCasos]); 
  const handleDeleteClick = async (casoId) => { if (window.confirm(`Tem certeza que deseja excluir o caso ID ${casoId}?`)) { setDeletingId(casoId); setError(null); try { const response = await fetch(`${API_URL}/casos/${casoId}`, { method: 'DELETE' }); if (!response.ok) { const resData = await response.json().catch(() => null); throw new Error(resData?.erro || `Erro HTTP: ${response.status}`); } console.log(`Caso ${casoId} deletado.`); if (onCasoChange) onCasoChange(); else fetchCasos(); } catch (err) { console.error(`Erro ao deletar caso ${casoId}:`, err); setError(`Erro ao deletar caso: ${err.message}`); } finally { setDeletingId(null); } } };
  if (loading && casos.length === 0) return <div className="text-center p-4">Carregando casos...</div>;
  if (error) return <div className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50" role="alert"><span className="font-medium">Erro!</span> {error}</div>;
  return ( 
    <div className="overflow-x-auto shadow-md rounded-lg">
      <h2 className="text-xl font-semibold text-gray-700 mb-4 p-4 bg-gray-50 rounded-t-lg">Lista de Casos</h2>
      {loading && casos.length > 0 && <p className="p-4 text-gray-500">Atualizando lista...</p>}
      {!loading && casos.length === 0 ? (<p className="p-4 text-gray-500">Nenhum caso cadastrado ainda.</p>) : (
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Título</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nº Processo</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th><th className="relative px-6 py-3"><span className="sr-only">Ações</span></th></tr></thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {casos.map((caso) => (
              <tr key={caso.id} className={`hover:bg-gray-50 ${deletingId === caso.id ? 'opacity-50' : ''}`}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{caso.id}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{caso.titulo}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{caso.cliente?.nome_razao_social || 'N/A'}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{caso.numero_processo || '-'}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{caso.status}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"><button onClick={() => onEditCaso(caso)} className="text-indigo-600 hover:text-indigo-900 mr-3 disabled:opacity-50" disabled={deletingId === caso.id}>Editar</button><button onClick={() => handleDeleteClick(caso.id)} className="text-red-600 hover:text-red-900 disabled:opacity-50" disabled={deletingId === caso.id}>{deletingId === caso.id ? 'Deletando...' : 'Deletar'}</button></td> 
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div> 
  );
}
export default CasoList;
