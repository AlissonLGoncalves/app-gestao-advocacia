// src/pages/ClientesPage.jsx
import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import ClienteList from '../ClienteList.jsx'; // Ajuste o caminho se ClienteList.jsx não estiver em src/
import ClienteForm from '../ClienteForm.jsx'; // Ajuste o caminho se ClienteForm.jsx não estiver em src/
import BotaoAdicionar from '../components/BotaoAdicionar.jsx'; // Ajuste o caminho se BotaoAdicionar.jsx não estiver em src/components/
import { API_URL } from '../config.js'; // Ajuste o caminho se config.js não estiver em src/

function ClientesPage() {
  const navigate = useNavigate();
  const params = useParams(); // Para pegar :clienteId da URL
  const location = useLocation(); // Para verificar a rota atual e determinar o modo

  console.log("ClientesPage: Renderizando. Pathname:", location.pathname);
  console.log("ClientesPage: Params:", params);

  const [refreshKey, setRefreshKey] = useState(0); // Para forçar a atualização da lista
  const [clienteParaEditar, setClienteParaEditar] = useState(null);
  const [loadingItem, setLoadingItem] = useState(false); // Estado para carregamento do item para edição

  // Determina se o formulário deve ser mostrado e em qual modo com base na URL
  const urlPath = location.pathname.toLowerCase(); // Normaliza para minúsculas para segurança
  const mostrarFormulario = urlPath.includes('/clientes/novo') || urlPath.startsWith('/clientes/editar/');
  const modoFormulario = urlPath.includes('/clientes/novo') ? 'novo' : (urlPath.startsWith('/clientes/editar/') ? 'editar' : null);

  console.log("ClientesPage: mostrarFormulario:", mostrarFormulario, "modoFormulario:", modoFormulario);

  // Busca dados do cliente para edição se estiver no modo de edição e clienteId estiver presente
  useEffect(() => {
    console.log("ClientesPage: useEffect disparado. Modo:", modoFormulario, "ID:", params.clienteId);
    if (modoFormulario === 'editar' && params.clienteId) {
      setLoadingItem(true);
      console.log(`ClientesPage: Buscando cliente com ID: ${params.clienteId}`);
      fetch(`${API_URL}/clientes/${params.clienteId}`)
        .then(response => {
          if (!response.ok) {
            console.error(`ClientesPage: Falha ao buscar cliente ${params.clienteId}. Status: ${response.status}`);
            throw new Error('Falha ao buscar cliente para edição.');
          }
          return response.json();
        })
        .then(data => {
          console.log("ClientesPage: Dados do cliente recebidos para edição:", data);
          setClienteParaEditar(data);
        })
        .catch(error => {
          console.error("ClientesPage: Erro ao buscar cliente:", error);
          // Adicionar feedback para o usuário, ex: toast
          navigate('/clientes'); // Volta para a lista em caso de erro
        })
        .finally(() => {
          setLoadingItem(false);
          console.log("ClientesPage: Busca de cliente para edição finalizada.");
        });
    } else if (modoFormulario === 'novo') {
      console.log("ClientesPage: Modo novo, limpando clienteParaEditar.");
      setClienteParaEditar(null); // Garante que não há dados de edição anteriores
    }
  }, [modoFormulario, params.clienteId, navigate]);

  const handleAdicionarClick = () => {
    console.log("ClientesPage: handleAdicionarClick chamado.");
    setClienteParaEditar(null); // Limpa qualquer estado de edição anterior
    navigate('/clientes/novo');
  };

  const handleEditarCliente = (cliente) => {
    console.log("ClientesPage: handleEditarCliente chamado com:", cliente);
    // Os dados do cliente já vêm da lista.
    // A navegação acionará o useEffect para buscar a versão mais recente, se necessário,
    // ou podemos passar o cliente diretamente para o formulário se a busca no useEffect for removida para este caso.
    // Por consistência, vamos manter a busca no useEffect.
    navigate(`/clientes/editar/${cliente.id}`);
  };

  const handleFormularioFechado = useCallback(() => {
    console.log("ClientesPage: handleFormularioFechado chamado.");
    setRefreshKey(prevKey => prevKey + 1);
    setClienteParaEditar(null); // Limpa o estado de edição
    navigate('/clientes'); // Volta para a lista após fechar/salvar o formulário
  }, [navigate]);

  if (loadingItem && modoFormulario === 'editar') {
    console.log("ClientesPage: Renderizando estado de carregamento para edição.");
    return (
      <div className="d-flex justify-content-center align-items-center p-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">A carregar cliente...</span>
        </div>
        <span className="ms-3 text-muted">A carregar dados do cliente...</span>
      </div>
    );
  }

  if (mostrarFormulario) {
    console.log("ClientesPage: Renderizando ClienteForm. Modo:", modoFormulario, "Cliente para editar:", clienteParaEditar);
    return (
      <ClienteForm
        clienteParaEditar={clienteParaEditar} // Se for novo, será null
        onClienteChange={handleFormularioFechado}
        onCancel={() => {
          console.log("ClientesPage: Formulário cancelado.");
          setClienteParaEditar(null);
          navigate('/clientes');
        }}
      />
    );
  }

  console.log("ClientesPage: Renderizando ClienteList. RefreshKey:", refreshKey);
  return (
    <>
      <BotaoAdicionar texto="Adicionar Novo Cliente" onClick={handleAdicionarClick} />
      <ClienteList key={refreshKey} onEditCliente={handleEditarCliente} />
    </>
  );
}

export default ClientesPage;
