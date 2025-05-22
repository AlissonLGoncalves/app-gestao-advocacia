// src/pages/DespesasPage.jsx
import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import DespesaList from '../DespesaList.jsx'; // Ajuste o caminho se DespesaList.jsx não estiver em src/
import DespesaForm from '../DespesaForm.jsx'; // Ajuste o caminho se DespesaForm.jsx não estiver em src/
import BotaoAdicionar from '../components/BotaoAdicionar.jsx'; // Ajuste o caminho se BotaoAdicionar.jsx não estiver em src/components/
import { API_URL } from '../config.js'; // Ajuste o caminho se config.js não estiver em src/

function DespesasPage() {
  const navigate = useNavigate();
  const params = useParams(); // Para pegar :despesaId da URL
  const location = useLocation(); // Para verificar a rota atual e determinar o modo

  console.log("DespesasPage: Renderizando. Pathname:", location.pathname);
  console.log("DespesasPage: Params:", params);

  const [refreshKey, setRefreshKey] = useState(0); // Para forçar a atualização da lista
  const [despesaParaEditar, setDespesaParaEditar] = useState(null);
  const [loadingItem, setLoadingItem] = useState(false); // Estado para carregamento do item para edição

  // Determina se o formulário deve ser mostrado e em qual modo com base na URL
  const urlPath = location.pathname.toLowerCase();
  const mostrarFormulario = urlPath.includes('/despesas/novo') || urlPath.startsWith('/despesas/editar/');
  const modoFormulario = urlPath.includes('/despesas/novo') ? 'novo' : (urlPath.startsWith('/despesas/editar/') ? 'editar' : null);

  console.log("DespesasPage: mostrarFormulario:", mostrarFormulario, "modoFormulario:", modoFormulario);

  // Busca dados da despesa para edição se estiver no modo de edição e despesaId estiver presente
  useEffect(() => {
    console.log("DespesasPage: useEffect disparado. Modo:", modoFormulario, "ID:", params.despesaId);
    if (modoFormulario === 'editar' && params.despesaId) {
      setLoadingItem(true);
      console.log(`DespesasPage: Buscando despesa com ID: ${params.despesaId}`);
      fetch(`${API_URL}/despesas/${params.despesaId}`)
        .then(response => {
          if (!response.ok) {
            console.error(`DespesasPage: Falha ao buscar despesa ${params.despesaId}. Status: ${response.status}`);
            throw new Error('Falha ao buscar despesa para edição.');
          }
          return response.json();
        })
        .then(data => {
          console.log("DespesasPage: Dados da despesa recebidos para edição:", data);
          setDespesaParaEditar(data);
        })
        .catch(error => {
          console.error("DespesasPage: Erro ao buscar despesa:", error);
          navigate('/despesas'); // Volta para a lista em caso de erro
        })
        .finally(() => {
          setLoadingItem(false);
          console.log("DespesasPage: Busca de despesa para edição finalizada.");
        });
    } else if (modoFormulario === 'novo') {
      console.log("DespesasPage: Modo novo, limpando despesaParaEditar.");
      setDespesaParaEditar(null); // Garante que não há dados de edição anteriores
    }
  }, [modoFormulario, params.despesaId, navigate]);

  const handleAdicionarClick = () => {
    console.log("DespesasPage: handleAdicionarClick chamado.");
    setDespesaParaEditar(null); // Limpa qualquer estado de edição anterior
    navigate('/despesas/novo');
  };

  const handleEditarDespesa = (despesa) => {
    console.log("DespesasPage: handleEditarDespesa chamado com:", despesa);
    navigate(`/despesas/editar/${despesa.id}`);
  };

  const handleFormularioFechado = useCallback(() => {
    console.log("DespesasPage: handleFormularioFechado chamado.");
    setRefreshKey(prevKey => prevKey + 1);
    setDespesaParaEditar(null); // Limpa o estado de edição
    navigate('/despesas'); // Volta para a lista após fechar/salvar o formulário
  }, [navigate]);

  if (loadingItem && modoFormulario === 'editar') {
    console.log("DespesasPage: Renderizando estado de carregamento para edição.");
    return (
      <div className="d-flex justify-content-center align-items-center p-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">A carregar despesa...</span>
        </div>
        <span className="ms-3 text-muted">A carregar dados da despesa...</span>
      </div>
    );
  }

  if (mostrarFormulario) {
    console.log("DespesasPage: Renderizando DespesaForm. Modo:", modoFormulario, "Despesa para editar:", despesaParaEditar);
    return (
      <DespesaForm
        despesaParaEditar={despesaParaEditar} // Se for novo, será null
        onDespesaChange={handleFormularioFechado}
        onCancel={() => {
          console.log("DespesasPage: Formulário cancelado.");
          setDespesaParaEditar(null);
          navigate('/despesas');
        }}
      />
    );
  }

  console.log("DespesasPage: Renderizando DespesaList. RefreshKey:", refreshKey);
  return (
    <>
      <BotaoAdicionar texto="Adicionar Nova Despesa" onClick={handleAdicionarClick} />
      <DespesaList key={refreshKey} onEditDespesa={handleEditarDespesa} />
    </>
  );
}

export default DespesasPage;
