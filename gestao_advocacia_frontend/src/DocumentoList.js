// ==================================================
// Conteúdo do arquivo: src/DocumentoList.js
// (Novo arquivo)
// ==================================================
import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config';

function DocumentoList({ onDocumentoChange }) { // onEdit não é usado por enquanto
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const formatarDataHora = (dataIso) => {
    if (!dataIso) return '-';
    try {
      return new Date(dataIso).toLocaleString('pt-BR', { 
        day: '2-digit', month: '2-digit', year: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
      });
    } catch { return dataIso; }
  };

  const formatarTamanho = (bytes) => {
    if (bytes === null || bytes === undefined || isNaN(Number(bytes))) return '-';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const fetchDocumentos = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      // TODO: Adicionar filtros por cliente_id ou caso_id se necessário
      const response = await fetch(`${API_URL}/documentos`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.erro || `Erro HTTP: ${response.status}`);
      }
      const data = await response.json();
      setDocumentos(data);
    } catch (err) {
      console.error("Falha ao buscar documentos:", err);
      setError(`Falha ao carregar documentos: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocumentos();
  }, [fetchDocumentos]); // Dependência fetchDocumentos para rebuscar se ela mudar (embora não mude aqui)

  const handleDeleteClick = async (id) => {
    if (window.confirm(`Tem certeza que deseja excluir o documento ID ${id}? O arquivo físico também será removido.`)) {
      setDeletingId(id); setError(null);
      try {
        const response = await fetch(`${API_URL}/documentos/${id}`, { method: 'DELETE' });
        if (!response.ok) {
          const resData = await response.json().catch(() => null);
          throw new Error(resData?.erro || `Erro HTTP: ${response.status}`);
        }
        if (onDocumentoChange) onDocumentoChange(); // Atualiza a lista no App
        else fetchDocumentos(); // Fallback
      } catch (err) {
        console.error(`Erro ao deletar documento ${id}:`, err);
        setError(`Erro ao deletar documento: ${err.message}`);
      } finally {
        setDeletingId(null);
      }
    }
  };

  if (loading && documentos.length === 0) return <div className="text-center p-4">Carregando documentos...</div>;
  if (error) return <div className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50" role="alert"><span className="font-medium">Erro!</span> {error}</div>;

  return (
    <div className="overflow-x-auto shadow-md rounded-lg">
      <h2 className="text-xl font-semibold text-gray-700 mb-4 p-4 bg-gray-50 rounded-t-lg">Lista de Documentos</h2>
      {loading && documentos.length > 0 && <p className="p-4 text-gray-500">Atualizando lista...</p>}
      {!loading && documentos.length === 0 ? (
        <p className="p-4 text-gray-500">Nenhum documento cadastrado ainda.</p>
      ) : (
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome Original</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Caso</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tamanho</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Upload</th>
              <th className="relative px-6 py-3"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {documentos.map((doc) => (
              <tr key={doc.id} className={`hover:bg-gray-50 ${deletingId === doc.id ? 'opacity-50' : ''}`}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{doc.id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{doc.nome_original_arquivo}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate" title={doc.descricao}>{doc.descricao || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{doc.cliente_nome || (doc.cliente_id ? `ID: ${doc.cliente_id}` : '-')}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{doc.caso_titulo || (doc.caso_id ? `ID: ${doc.caso_id}` : '-')}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{doc.tipo_mime || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatarTamanho(doc.tamanho_bytes)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatarDataHora(doc.data_upload)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <a 
                    href={`${API_URL}/documentos/download/${doc.nome_armazenado}`} 
                    target="_blank" // Abre em nova aba, mas o backend força download
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-900 mr-3"
                    title="Baixar documento"
                  >
                    Download
                  </a>
                  <button 
                    onClick={() => handleDeleteClick(doc.id)} 
                    className="text-red-600 hover:text-red-900 disabled:opacity-50" 
                    disabled={deletingId === doc.id}
                    title="Deletar documento"
                  >
                    {deletingId === doc.id ? 'Deletando...' : 'Deletar'}
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
export default DocumentoList;
