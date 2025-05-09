// ==================================================
// Conteúdo do arquivo: src/RecebimentoList.js 
// (Pequenos ajustes no feedback e formatação)
// ==================================================
import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config'; 

function RecebimentoList({ onEditRecebimento, onRecebimentoChange }) {
  const [recebimentos, setRecebimentos] = useState([]); 
  const [loading, setLoading] = useState(true); 
  const [error, setError] = useState(null); 
  const [deletingId, setDeletingId] = useState(null); // ID do item sendo deletado

  // Funções de formatação (podem ser movidas para um arquivo utilitário depois)
  const formatarMoeda = (valor) => {
      if (valor === null || valor === undefined || isNaN(Number(valor))) return '-';
      return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };
  const formatarData = (data) => {
      if (!data) return '-';
      try {
          return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR'); // Adiciona T00 para evitar fuso
      } catch (e) {
          console.warn("Erro formatando data:", data, e);
          return data; // Retorna original em caso de erro
      }
  };

  // Busca os recebimentos da API
  const fetchRecebimentos = useCallback(async () => { 
    setLoading(true); 
    setError(null);   
    console.log(`Buscando recebimentos em: ${API_URL}/recebimentos`); 
    try { 
      // Poderia adicionar filtros aqui: ?caso_id=X ou ?cliente_id=Y
      const response = await fetch(`${API_URL}/recebimentos`); 
      if (!response.ok) { 
        const errorData = await response.json().catch(() => null); 
        throw new Error(errorData?.erro || `Erro HTTP: ${response.status}`); 
      } 
      const data = await response.json(); 
      setRecebimentos(data); 
    } catch (err) { 
      console.error("Falha ao buscar recebimentos:", err); 
      setError(`Falha ao carregar recebimentos: ${err.message}`); 
    } finally { 
      setLoading(false); 
    } 
  }, []); // useCallback para memoizar a função

  // Executa a busca quando o componente monta ou a função fetch muda
  useEffect(() => { 
    fetchRecebimentos(); 
  }, [fetchRecebimentos]); 

  // Lida com o clique no botão de deletar
  const handleDeleteClick = async (id) => { 
    if (window.confirm(`Tem certeza que deseja excluir o recebimento ID ${id}?`)) { 
      setDeletingId(id); // Indica que está deletando
      setError(null); 
      try { 
        const response = await fetch(`${API_URL}/recebimentos/${id}`, { method: 'DELETE' }); 
        if (!response.ok) { 
          const resData = await response.json().catch(() => null); 
          throw new Error(resData?.erro || `Erro HTTP: ${response.status}`); 
        } 
        console.log(`Recebimento ${id} deletado.`);
        // Chama a função de callback do App para atualizar o estado global (refreshKey)
        if (onRecebimentoChange) { 
            onRecebimentoChange(); 
        } else { 
            fetchRecebimentos(); // Fallback: recarrega apenas esta lista
        } 
      } catch (err) { 
        console.error(`Erro ao deletar recebimento ${id}:`, err); 
        setError(`Erro ao deletar recebimento: ${err.message}`); 
      } finally { 
        setDeletingId(null); // Limpa o estado de deleção
      } 
    } 
  };

  // Renderização condicional (Loading, Erro, Lista Vazia, Tabela)
  if (loading && recebimentos.length === 0) return <div className="text-center p-4">Carregando recebimentos...</div>;
  
  if (error) return (
      <div className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400" role="alert">
          <span className="font-medium">Erro!</span> {error}
      </div>
  );

  return ( 
    <div className="overflow-x-auto shadow-md rounded-lg">
      <h2 className="text-xl font-semibold text-gray-700 mb-4 p-4 bg-gray-50 rounded-t-lg">Lista de Recebimentos</h2>
      {/* Feedback visual enquanto a lista está sendo atualizada após uma ação */}
      {loading && recebimentos.length > 0 && <p className="p-4 text-gray-500">Atualizando lista...</p>} 
      
      {!loading && recebimentos.length === 0 ? (
          <p className="p-4 text-gray-500">Nenhum recebimento cadastrado ainda.</p>
      ) : (
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Rec.</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoria</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Caso (ID)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente (ID)</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="relative px-6 py-3"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {recebimentos.map((r) => (
              // Aplica opacidade se o item estiver sendo deletado
              <tr key={r.id} className={`hover:bg-gray-50 ${deletingId === r.id ? 'opacity-50' : ''}`}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{r.id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatarData(r.data_recebimento)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{r.descricao}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{r.categoria}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{r.caso_id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{r.cliente_id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatarMoeda(r.valor)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{r.status}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {/* Botão Editar chama onEditRecebimento passado pelo App.js */}
                  <button 
                    onClick={() => onEditRecebimento(r)} 
                    className="text-indigo-600 hover:text-indigo-900 mr-3 disabled:opacity-50" 
                    disabled={deletingId === r.id} // Desabilita enquanto deleta
                  >
                    Editar
                  </button>
                  {/* Botão Deletar chama handleDeleteClick */}
                  <button 
                    onClick={() => handleDeleteClick(r.id)} 
                    className="text-red-600 hover:text-red-900 disabled:opacity-50" 
                    disabled={deletingId === r.id} // Desabilita enquanto deleta
                  >
                    {deletingId === r.id ? 'Deletando...' : 'Deletar'}
                  </button>
                </td> 
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div> 
  );
}
export default RecebimentoList;