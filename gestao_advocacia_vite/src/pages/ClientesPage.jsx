// src/pages/ClientesPage.jsx
import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import ClienteList from '../ClienteList.jsx';
import ClienteForm from '../ClienteForm.jsx';

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

function ClientesPage({ modoFormulario: modoFormularioProp }) {
  const navigate = useNavigate();
  const params = useParams(); // Para pegar :clienteId da URL
  const location = useLocation(); // Para verificar a rota atual

  const [refreshKey, setRefreshKey] = useState(0);
  const [clienteParaEditar, setClienteParaEditar] = useState(null);

  // Determina se o formulário deve ser mostrado e em qual modo
  const urlPath = location.pathname;
  const mostrarFormulario = urlPath.includes('/novo') || urlPath.includes('/editar');
  const modoFormulario = urlPath.includes('/novo') ? 'novo' : (urlPath.includes('/editar') ? 'editar' : null);
  
  // Busca dados do cliente para edição se estiver no modo de edição e clienteId estiver presente
  useEffect(() => {
    if (modoFormulario === 'editar' && params.clienteId) {
      // Simula a busca de um cliente. Em uma aplicação real, você faria uma chamada à API.
      // Para este exemplo, vamos assumir que o ClienteList pode fornecer o cliente
      // ou você buscaria aqui: fetch(`${API_URL}/clientes/${params.clienteId}`)
      // Por simplicidade, vamos deixar para o ClienteList lidar com o "onEdit"
      // e o formulário receber o cliente através de `clienteParaEditar`
      // Esta lógica de buscar o cliente para edição aqui é mais robusta.
      // Se o ClienteList não for renderizado (porque o formulário está visível),
      // precisamos buscar o cliente aqui.
      console.log(`Modo Editar Cliente ID: ${params.clienteId}. Implementar busca de dados do cliente.`);
      // Exemplo: setClienteParaEditar({ id: params.clienteId, nome_razao_social: "Carregando..."});
      // fetchCliente(params.clienteId).then(data => setClienteParaEditar(data));
    } else {
      setClienteParaEditar(null);
    }
  }, [modoFormulario, params.clienteId]);


  const handleAdicionarClick = () => {
    navigate('/clientes/novo');
  };

  const handleEditarCliente = (cliente) => {
    setClienteParaEditar(cliente); // Define o cliente para edição
    navigate(`/clientes/editar/${cliente.id}`);
  };

  const handleFormularioFechado = useCallback(() => {
    setRefreshKey(prevKey => prevKey + 1);
    navigate('/clientes'); // Volta para a lista após fechar/salvar o formulário
  }, [navigate]);

  if (mostrarFormulario) {
    return (
      <ClienteForm
        clienteParaEditar={modoFormulario === 'editar' ? clienteParaEditar : null}
        onClienteChange={handleFormularioFechado}
        onCancel={() => navigate('/clientes')}
      />
    );
  }

  return (
    <>
      <BotaoAdicionar texto="Adicionar Novo Cliente" onClick={handleAdicionarClick} />
      <ClienteList
        key={refreshKey}
        onEditCliente={handleEditarCliente}
        // Passar o clienteId da URL para o ClienteList pode ser útil se ele precisar destacar o item
        // ou se a lógica de buscar o cliente para edição for centralizada nele ao invés de na página.
        // clienteIdParaEditar={modoFormulario === 'editar' ? params.clienteId : null}
      />
    </>
  );
}

export default ClientesPage;
