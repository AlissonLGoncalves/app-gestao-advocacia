// ==================================================
// Conteúdo do arquivo: src/EventoAgendaList.js
// ==================================================
import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config'; 

function EventoAgendaList({ onEditEvento, onEventoChange }) {
  const [eventos, setEventos] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(null); const [deletingId, setDeletingId] = useState(null);
  const formatarDataHora = (dataIso) => { if (!dataIso) return '-'; try { return new Date(dataIso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }); } catch (e) { console.warn("Erro formatando data/hora:", dataIso, e); return dataIso; } };
  const fetchEventos = useCallback(async () => { setLoading(true); setError(null); console.log(`Buscando eventos em: ${API_URL}/eventos`); try { const response = await fetch(`${API_URL}/eventos`); if (!response.ok) { const errorData = await response.json().catch(() => null); throw new Error(errorData?.erro || `Erro HTTP: ${response.status}`); } const data = await response.json(); setEventos(data); } catch (err) { console.error("Falha ao buscar eventos:", err); setError(`Falha ao carregar eventos: ${err.message}`); } finally { setLoading(false); } }, []);
  useEffect(() => { fetchEventos(); }, [fetchEventos]);
  const handleDeleteClick = async (id) => { if (window.confirm(`Tem certeza que deseja excluir o evento/prazo ID ${id}?`)) { setDeletingId(id); setError(null); try { const response = await fetch(`${API_URL}/eventos/${id}`, { method: 'DELETE' }); if (!response.ok) { const resData = await response.json().catch(() => null); throw new Error(resData?.erro || `Erro HTTP: ${response.status}`); } if (onEventoChange) onEventoChange(); else fetchEventos(); } catch (err) { console.error(`Erro ao deletar evento ${id}:`, err); setError(`Erro ao deletar evento: ${err.message}`); } finally { setDeletingId(null); } } };
  if (loading && eventos.length === 0) return <div className="text-center p-4">Carregando agenda...</div>;
  if (error) return <div className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50" role="alert"><span className="font-medium">Erro!</span> {error}</div>;
  return ( 
    <div className="overflow-x-auto shadow-md rounded-lg">
      <h2 className="text-xl font-semibold text-gray-700 mb-4 p-4 bg-gray-50 rounded-t-lg">Agenda / Prazos</h2>
       {loading && eventos.length > 0 && <p className="p-4 text-gray-500">Atualizando lista...</p>}
      {!loading && eventos.length === 0 ? (<p className="p-4 text-gray-500">Nenhum evento ou prazo cadastrado ainda.</p>) : (
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data/Hora Início</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Título</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Caso (ID)</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Concluído</th><th className="relative px-6 py-3"><span className="sr-only">Ações</span></th></tr></thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {eventos.map((e) => (
              <tr key={e.id} className={`hover:bg-gray-50 ${deletingId === e.id ? 'opacity-50' : ''} ${e.concluido ? 'bg-green-50 opacity-70' : ''}`}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{e.id}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatarDataHora(e.data_inicio)}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{e.tipo_evento}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{e.titulo}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{e.caso_id || '-'}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{e.concluido ? 'Sim' : 'Não'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"><button onClick={() => onEditEvento(e)} className="text-indigo-600 hover:text-indigo-900 mr-3 disabled:opacity-50" disabled={deletingId === e.id}>Editar</button><button onClick={() => handleDeleteClick(e.id)} className="text-red-600 hover:text-red-900 disabled:opacity-50" disabled={deletingId === e.id}>{deletingId === e.id ? 'Deletando...' : 'Deletar'}</button></td> 
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div> 
  );
}
export default EventoAgendaList;

