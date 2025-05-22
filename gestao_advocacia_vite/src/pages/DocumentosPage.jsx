// src/pages/DocumentosPage.jsx
import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import DocumentoList from '../DocumentoList.jsx'; // Ajuste o caminho se DocumentoList.jsx não estiver em src/
import DocumentoForm from '../DocumentoForm.jsx'; // Ajuste o caminho se DocumentoForm.jsx não estiver em src/
import BotaoAdicionar from '../components/BotaoAdicionar.jsx'; // Ajuste o caminho se BotaoAdicionar.jsx não estiver em src/components/
import { API_URL } from '../config.js'; // Ajuste o caminho se config.js não estiver em src/

function DocumentosPage() {
  const navigate = useNavigate();
  const params = useParams(); // Para pegar :documentoId da URL
  const location = useLocation(); // Para verificar a rota atual e determinar o modo

  console.log("DocumentosPage: Renderizando. Pathname:", location.pathname);
  console.log("DocumentosPage: Params:", params);

  const [refreshKey, setRefreshKey] = useState(0); // Para forçar a atualização da lista
  const [documentoParaEditar, setDocumentoParaEditar] = useState(null);
  const [loadingItem, setLoadingItem] = useState(false); // Estado para carregamento do item para edição

  // Determina se o formulário deve ser mostrado e em qual modo com base na URL
  const urlPath = location.pathname.toLowerCase();
  const mostrarFormulario = urlPath.includes('/documentos/novo') || urlPath.startsWith('/documentos/editar/');
  const modoFormulario = urlPath.includes('/documentos/novo') ? 'novo' : (urlPath.startsWith('/documentos/editar/') ? 'editar' : null);

  console.log("DocumentosPage: mostrarFormulario:", mostrarFormulario, "modoFormulario:", modoFormulario);

  // Busca metadados do documento para edição se estiver no modo de edição e documentoId estiver presente
  useEffect(() => {
    console.log("DocumentosPage: useEffect disparado. Modo:", modoFormulario, "ID:", params.documentoId);
    if (modoFormulario === 'editar' && params.documentoId) {
      setLoadingItem(true);
      console.log(`DocumentosPage: Buscando metadados do documento com ID: ${params.documentoId}`);
      // Assumindo que sua API tem um endpoint para buscar metadados de um documento por ID.
      // Se não tiver, o DocumentoForm pode precisar apenas do ID e o DocumentoList já passou os dados.
      // No entanto, buscar aqui garante dados mais recentes.
      fetch(`${API_URL}/documentos/${params.documentoId}`) // Crie este endpoint na sua API se não existir
        .then(response => {
          if (!response.ok) {
            console.error(`DocumentosPage: Falha ao buscar metadados do documento ${params.documentoId}. Status: ${response.status}`);
            throw new Error('Falha ao buscar metadados do documento para edição.');
          }
          return response.json();
        })
        .then(data => {
          console.log("DocumentosPage: Metadados do documento recebidos para edição:", data);
          setDocumentoParaEditar(data);
        })
        .catch(error => {
          console.error("DocumentosPage: Erro ao buscar metadados do documento:", error);
          navigate('/documentos'); // Volta para a lista em caso de erro
        })
        .finally(() => {
          setLoadingItem(false);
          console.log("DocumentosPage: Busca de metadados do documento para edição finalizada.");
        });
    } else if (modoFormulario === 'novo') {
      console.log("DocumentosPage: Modo novo, limpando documentoParaEditar.");
      setDocumentoParaEditar(null); // Garante que não há dados de edição anteriores
    }
  }, [modoFormulario, params.documentoId, navigate]);

  const handleAdicionarClick = () => {
    console.log("DocumentosPage: handleAdicionarClick chamado.");
    setDocumentoParaEditar(null); // Limpa qualquer estado de edição anterior
    navigate('/documentos/novo');
  };

  const handleEditarDocumento = (documento) => {
    console.log("DocumentosPage: handleEditarDocumento chamado com:", documento);
    // Para documentos, o DocumentoForm lidará principalmente com metadados.
    // A navegação acionará o useEffect para buscar os metadados se necessário.
    navigate(`/documentos/editar/${documento.id}`);
  };

  const handleFormularioFechado = useCallback(() => {
    console.log("DocumentosPage: handleFormularioFechado chamado.");
    setRefreshKey(prevKey => prevKey + 1);
    setDocumentoParaEditar(null); // Limpa o estado de edição
    navigate('/documentos'); // Volta para a lista após fechar/salvar o formulário
  }, [navigate]);

  if (loadingItem && modoFormulario === 'editar') {
    console.log("DocumentosPage: Renderizando estado de carregamento para edição de metadados.");
    return (
      <div className="d-flex justify-content-center align-items-center p-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">A carregar metadados...</span>
        </div>
        <span className="ms-3 text-muted">A carregar metadados do documento...</span>
      </div>
    );
  }

  if (mostrarFormulario) {
    console.log("DocumentosPage: Renderizando DocumentoForm. Modo:", modoFormulario, "Documento para editar (metadados):", documentoParaEditar);
    return (
      <DocumentoForm
        documentoParaEditar={documentoParaEditar} // Se for novo, será null
        onDocumentoChange={handleFormularioFechado}
        onCancel={() => {
          console.log("DocumentosPage: Formulário cancelado.");
          setDocumentoParaEditar(null);
          navigate('/documentos');
        }}
      />
    );
  }

  console.log("DocumentosPage: Renderizando DocumentoList. RefreshKey:", refreshKey);
  return (
    <>
      <BotaoAdicionar texto="Adicionar Novo Documento" onClick={handleAdicionarClick} />
      <DocumentoList key={refreshKey} onEditDocumento={handleEditarDocumento} />
    </>
  );
}

export default DocumentosPage;
