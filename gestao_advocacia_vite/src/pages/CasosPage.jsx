// src/pages/CasosPage.jsx
import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import CasoList from '../CasoList.jsx';
import CasoForm from '../CasoForm.jsx';

// Botão Adicionar genérico
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

function CasosPage() {
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();

  const [refreshKey, setRefreshKey] = useState(0);
  const [casoParaEditar, setCasoParaEditar] = useState(null);

  const urlPath = location.pathname;
  const mostrarFormulario = urlPath.includes('/novo') || urlPath.includes('/editar');
  const modoFormulario = urlPath.includes('/novo') ? 'novo' : (urlPath.includes('/editar') ? 'editar' : null);

  useEffect(() => {
    if (modoFormulario === 'editar' && params.casoId) {
      // Lógica para buscar dados do caso para edição
      console.log(`Modo Editar Caso ID: ${params.casoId}. Implementar busca de dados do caso.`);
      // Exemplo: setCasoParaEditar({ id: params.casoId, titulo: "Carregando..." });
      // fetchCaso(params.casoId).then(data => setCasoParaEditar(data));
    } else {
      setCasoParaEditar(null);
    }
  }, [modoFormulario, params.casoId]);

  const handleAdicionarClick = () => {
    navigate('/casos/novo');
  };

  const handleEditarCaso = (caso) => {
    setCasoParaEditar(caso);
    navigate(`/casos/editar/${caso.id}`);
  };

  const handleFormularioFechado = useCallback(() => {
    setRefreshKey(prevKey => prevKey + 1);
    navigate('/casos');
  }, [navigate]);

  if (mostrarFormulario) {
    return (
      <CasoForm
        casoParaEditar={modoFormulario === 'editar' ? casoParaEditar : null}
        onCasoChange={handleFormularioFechado}
        onCancel={() => navigate('/casos')}
      />
    );
  }

  return (
    <>
      <BotaoAdicionar texto="Adicionar Novo Caso" onClick={handleAdicionarClick} />
      <CasoList key={refreshKey} onEditCaso={handleEditarCaso} />
    </>
  );
}

export default CasosPage;
