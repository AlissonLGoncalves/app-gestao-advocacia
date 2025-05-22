// src/pages/RecebimentosPage.jsx
import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import RecebimentoList from '../RecebimentoList.jsx'; // Ajuste o caminho se RecebimentoList.jsx não estiver em src/
import RecebimentoForm from '../RecebimentoForm.jsx'; // Ajuste o caminho se RecebimentoForm.jsx não estiver em src/
import BotaoAdicionar from '../components/BotaoAdicionar.jsx'; // Ajuste o caminho se BotaoAdicionar.jsx não estiver em src/components/
import { API_URL } from '../config.js'; // Ajuste o caminho se config.js não estiver em src/

function RecebimentosPage() {
  const navigate = useNavigate();
  const params = useParams(); // Para pegar :recebimentoId da URL
  const location = useLocation(); // Para verificar a rota atual e determinar o modo

  console.log("RecebimentosPage: Renderizando. Pathname:", location.pathname);
  console.log("RecebimentosPage: Params:", params);

  const [refreshKey, setRefreshKey] = useState(0); // Para forçar a atualização da lista
  const [recebimentoParaEditar, setRecebimentoParaEditar] = useState(null);
  const [loadingItem, setLoadingItem] = useState(false); // Estado para carregamento do item para edição

  // Determina se o formulário deve ser mostrado e em qual modo com base na URL
  const urlPath = location.pathname.toLowerCase();
  const mostrarFormulario = urlPath.includes('/recebimentos/novo') || urlPath.startsWith('/recebimentos/editar/');
  const modoFormulario = urlPath.includes('/recebimentos/novo') ? 'novo' : (urlPath.startsWith('/recebimentos/editar/') ? 'editar' : null);

  console.log("RecebimentosPage: mostrarFormulario:", mostrarFormulario, "modoFormulario:", modoFormulario);

  // Busca dados do recebimento para edição se estiver no modo de edição e recebimentoId estiver presente
  useEffect(() => {
    console.log("RecebimentosPage: useEffect disparado. Modo:", modoFormulario, "ID:", params.recebimentoId);
    if (modoFormulario === 'editar' && params.recebimentoId) {
      setLoadingItem(true);
      console.log(`RecebimentosPage: Buscando recebimento com ID: ${params.recebimentoId}`);
      fetch(`${API_URL}/recebimentos/${params.recebimentoId}`)
        .then(response => {
          if (!response.ok) {
            console.error(`RecebimentosPage: Falha ao buscar recebimento ${params.recebimentoId}. Status: ${response.status}`);
            throw new Error('Falha ao buscar recebimento para edição.');
          }
          return response.json();
        })
        .then(data => {
          console.log("RecebimentosPage: Dados do recebimento recebidos para edição:", data);
          setRecebimentoParaEditar(data);
        })
        .catch(error => {
          console.error("RecebimentosPage: Erro ao buscar recebimento:", error);
          navigate('/recebimentos'); // Volta para a lista em caso de erro
        })
        .finally(() => {
          setLoadingItem(false);
          console.log("RecebimentosPage: Busca de recebimento para edição finalizada.");
        });
    } else if (modoFormulario === 'novo') {
      console.log("RecebimentosPage: Modo novo, limpando recebimentoParaEditar.");
      setRecebimentoParaEditar(null); // Garante que não há dados de edição anteriores
    }
  }, [modoFormulario, params.recebimentoId, navigate]);

  const handleAdicionarClick = () => {
    console.log("RecebimentosPage: handleAdicionarClick chamado.");
    setRecebimentoParaEditar(null); // Limpa qualquer estado de edição anterior
    navigate('/recebimentos/novo');
  };

  const handleEditarRecebimento = (recebimento) => {
    console.log("RecebimentosPage: handleEditarRecebimento chamado com:", recebimento);
    navigate(`/recebimentos/editar/${recebimento.id}`);
  };

  const handleFormularioFechado = useCallback(() => {
    console.log("RecebimentosPage: handleFormularioFechado chamado.");
    setRefreshKey(prevKey => prevKey + 1);
    setRecebimentoParaEditar(null); // Limpa o estado de edição
    navigate('/recebimentos'); // Volta para a lista após fechar/salvar o formulário
  }, [navigate]);

  if (loadingItem && modoFormulario === 'editar') {
    console.log("RecebimentosPage: Renderizando estado de carregamento para edição.");
    return (
      <div className="d-flex justify-content-center align-items-center p-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">A carregar recebimento...</span>
        </div>
        <span className="ms-3 text-muted">A carregar dados do recebimento...</span>
      </div>
    );
  }

  if (mostrarFormulario) {
    console.log("RecebimentosPage: Renderizando RecebimentoForm. Modo:", modoFormulario, "Recebimento para editar:", recebimentoParaEditar);
    return (
      <RecebimentoForm
        recebimentoParaEditar={recebimentoParaEditar} // Se for novo, será null
        onRecebimentoChange={handleFormularioFechado}
        onCancel={() => {
          console.log("RecebimentosPage: Formulário cancelado.");
          setRecebimentoParaEditar(null);
          navigate('/recebimentos');
        }}
      />
    );
  }

  console.log("RecebimentosPage: Renderizando RecebimentoList. RefreshKey:", refreshKey);
  return (
    <>
      <BotaoAdicionar texto="Adicionar Novo Recebimento" onClick={handleAdicionarClick} />
      <RecebimentoList key={refreshKey} onEditRecebimento={handleEditarRecebimento} />
    </>
  );
}

export default RecebimentosPage;
