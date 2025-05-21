// src/pages/RecebimentosPage.jsx
import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import RecebimentoList from '../RecebimentoList.jsx'; // Ajuste o caminho se necessário
import RecebimentoForm from '../RecebimentoForm.jsx'; // Ajuste o caminho se necessário
import { API_URL } from '../config.js'; // Para buscar dados para edição

// Botão Adicionar genérico (pode ser movido para um componente compartilhado)
const BotaoAdicionar = ({ onClick, texto }) => (
  <button
    onClick={onClick}
    className="btn btn-primary mb-3 d-flex align-items-center"
  >
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="me-2" width="18" height="18">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
    {texto}
  </button>
);

function RecebimentosPage() {
  const navigate = useNavigate();
  const params = useParams(); // Para pegar :recebimentoId da URL
  const location = useLocation();

  const [refreshKey, setRefreshKey] = useState(0);
  const [recebimentoParaEditar, setRecebimentoParaEditar] = useState(null);
  const [loadingItem, setLoadingItem] = useState(false); // Estado para carregamento do item para edição

  const urlPath = location.pathname;
  const mostrarFormulario = urlPath.includes('/novo') || urlPath.includes('/editar');
  const modoFormulario = urlPath.includes('/novo') ? 'novo' : (urlPath.includes('/editar') ? 'editar' : null);

  // Busca dados do recebimento para edição
  useEffect(() => {
    if (modoFormulario === 'editar' && params.recebimentoId) {
      setLoadingItem(true);
      // Implementar a busca do recebimento específico pela API
      fetch(`${API_URL}/recebimentos/${params.recebimentoId}`) // Adapte a URL da sua API conforme necessário
        .then(response => {
          if (!response.ok) {
            throw new Error('Falha ao buscar dados do recebimento para edição.');
          }
          return response.json();
        })
        .then(data => {
          setRecebimentoParaEditar(data);
        })
        .catch(error => {
          console.error("Erro ao buscar recebimento:", error);
          // Tratar erro (ex: redirecionar para lista, mostrar toast)
          navigate('/recebimentos');
        })
        .finally(() => {
          setLoadingItem(false);
        });
    } else {
      setRecebimentoParaEditar(null);
    }
  }, [modoFormulario, params.recebimentoId, navigate]);

  const handleAdicionarClick = () => {
    navigate('/recebimentos/novo');
  };

  const handleEditarRecebimento = (recebimento) => {
    // Os dados do recebimento já devem ser passados aqui pela lista,
    // mas a navegação para a URL de edição acionará o useEffect acima para buscar os dados mais recentes se necessário.
    setRecebimentoParaEditar(recebimento);
    navigate(`/recebimentos/editar/${recebimento.id}`);
  };

  const handleFormularioFechado = useCallback(() => {
    setRefreshKey(prevKey => prevKey + 1);
    navigate('/recebimentos'); // Volta para a lista após fechar/salvar o formulário
  }, [navigate]);

  if (loadingItem && modoFormulario === 'editar') {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Carregando dados do recebimento...</span>
        </div>
        <p className="ms-3 text-muted">Carregando dados do recebimento...</p>
      </div>
    );
  }

  if (mostrarFormulario) {
    return (
      <RecebimentoForm
        recebimentoParaEditar={recebimentoParaEditar} // Passa o item carregado ou null para novo
        onRecebimentoChange={handleFormularioFechado}
        onCancel={() => navigate('/recebimentos')}
      />
    );
  }

  return (
    <>
      <BotaoAdicionar texto="Adicionar Novo Recebimento" onClick={handleAdicionarClick} />
      <RecebimentoList
        key={refreshKey}
        onEditRecebimento={handleEditarRecebimento}
      />
    </>
  );
}

export default RecebimentosPage;
