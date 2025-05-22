// src/pages/CasosPage.jsx
import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import CasoList from '../CasoList.jsx'; // Ajuste o caminho se CasoList.jsx não estiver em src/
import CasoForm from '../CasoForm.jsx'; // Ajuste o caminho se CasoForm.jsx não estiver em src/
import BotaoAdicionar from '../components/BotaoAdicionar.jsx'; // Ajuste o caminho se BotaoAdicionar.jsx não estiver em src/components/
import { API_URL } from '../config.js'; // Ajuste o caminho se config.js não estiver em src/

function CasosPage() {
  const navigate = useNavigate();
  const params = useParams(); // Para pegar :casoId da URL
  const location = useLocation(); // Para verificar a rota atual e determinar o modo

  console.log("CasosPage: Renderizando. Pathname:", location.pathname);
  console.log("CasosPage: Params:", params);

  const [refreshKey, setRefreshKey] = useState(0); // Para forçar a atualização da lista
  const [casoParaEditar, setCasoParaEditar] = useState(null);
  const [loadingItem, setLoadingItem] = useState(false); // Estado para carregamento do item para edição

  // Determina se o formulário deve ser mostrado e em qual modo com base na URL
  const urlPath = location.pathname.toLowerCase(); // Normaliza para minúsculas para segurança
  const mostrarFormulario = urlPath.includes('/casos/novo') || urlPath.startsWith('/casos/editar/');
  const modoFormulario = urlPath.includes('/casos/novo') ? 'novo' : (urlPath.startsWith('/casos/editar/') ? 'editar' : null);

  console.log("CasosPage: mostrarFormulario:", mostrarFormulario, "modoFormulario:", modoFormulario);

  // Busca dados do caso para edição se estiver no modo de edição e casoId estiver presente
  useEffect(() => {
    console.log("CasosPage: useEffect disparado. Modo:", modoFormulario, "ID:", params.casoId);
    if (modoFormulario === 'editar' && params.casoId) {
      setLoadingItem(true);
      console.log(`CasosPage: Buscando caso com ID: ${params.casoId}`);
      fetch(`${API_URL}/casos/${params.casoId}`)
        .then(response => {
          if (!response.ok) {
            console.error(`CasosPage: Falha ao buscar caso ${params.casoId}. Status: ${response.status}`);
            throw new Error('Falha ao buscar caso para edição.');
          }
          return response.json();
        })
        .then(data => {
          console.log("CasosPage: Dados do caso recebidos para edição:", data);
          setCasoParaEditar(data);
        })
        .catch(error => {
          console.error("CasosPage: Erro ao buscar caso:", error);
          // Adicionar feedback para o utilizador, ex: toast
          navigate('/casos'); // Volta para a lista em caso de erro
        })
        .finally(() => {
          setLoadingItem(false);
          console.log("CasosPage: Busca de caso para edição finalizada.");
        });
    } else if (modoFormulario === 'novo') {
      console.log("CasosPage: Modo novo, limpando casoParaEditar.");
      setCasoParaEditar(null); // Garante que não há dados de edição anteriores
    }
  }, [modoFormulario, params.casoId, navigate]);

  const handleAdicionarClick = () => {
    console.log("CasosPage: handleAdicionarClick chamado.");
    setCasoParaEditar(null); // Limpa qualquer estado de edição anterior
    navigate('/casos/novo');
  };

  const handleEditarCaso = (caso) => {
    console.log("CasosPage: handleEditarCaso chamado com:", caso);
    navigate(`/casos/editar/${caso.id}`);
  };

  const handleFormularioFechado = useCallback(() => {
    console.log("CasosPage: handleFormularioFechado chamado.");
    setRefreshKey(prevKey => prevKey + 1);
    setCasoParaEditar(null); // Limpa o estado de edição
    navigate('/casos'); // Volta para a lista após fechar/salvar o formulário
  }, [navigate]);

  if (loadingItem && modoFormulario === 'editar') {
    console.log("CasosPage: Renderizando estado de carregamento para edição.");
    return (
      <div className="d-flex justify-content-center align-items-center p-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">A carregar caso...</span>
        </div>
        <span className="ms-3 text-muted">A carregar dados do caso...</span>
      </div>
    );
  }

  if (mostrarFormulario) {
    console.log("CasosPage: Renderizando CasoForm. Modo:", modoFormulario, "Caso para editar:", casoParaEditar);
    return (
      <CasoForm
        casoParaEditar={casoParaEditar} // Se for novo, será null
        onCasoChange={handleFormularioFechado}
        onCancel={() => {
          console.log("CasosPage: Formulário cancelado.");
          setCasoParaEditar(null);
          navigate('/casos');
        }}
      />
    );
  }

  console.log("CasosPage: Renderizando CasoList. RefreshKey:", refreshKey);
  return (
    <>
      <BotaoAdicionar texto="Adicionar Novo Caso" onClick={handleAdicionarClick} />
      <CasoList key={refreshKey} onEditCaso={handleEditarCaso} />
    </>
  );
}

export default CasosPage;
