// src/pages/ClientesPage.jsx
import React, { useState, useCallback, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import ClienteList from '../components/ClienteList.jsx' // Ajuste o caminho se ClienteList.jsx não estiver em src/
import ClienteForm from '../components/ClienteForm.jsx' // Ajuste o caminho se ClienteForm.jsx não estiver em src/
import BotaoAdicionar from '../components/BotaoAdicionar.jsx' // Ajuste o caminho se BotaoAdicionar.jsx não estiver em src/components/
import { getCliente } from '../api/clientes.js'

function ClientesPage() {
  const navigate = useNavigate()
  const params = useParams() // Para pegar :clienteId da URL
  const location = useLocation() // Para verificar a rota atual e determinar o modo
  const [refreshKey, setRefreshKey] = useState(0) // Para forçar a atualização da lista
  const [clienteParaEditar, setClienteParaEditar] = useState(null)
  const [loadingItem, setLoadingItem] = useState(false) // Estado para carregamento do item para edição

  // Determina se o formulário deve ser mostrado e em qual modo com base na URL.
  // PR #249: rota /clientes/:id agora vai direto pra ClienteDetalhePage (em
  // App.jsx); aqui so cuidamos de /novo e /editar.
  const urlPath = location.pathname.toLowerCase()
  const mostrarFormulario =
    (urlPath.includes('/clientes/novo') && !urlPath.includes('/clientes/novo/procuracao')) ||
    urlPath.startsWith('/clientes/editar/')
  const modoFormulario = urlPath.includes('/clientes/novo')
    ? 'novo'
    : urlPath.startsWith('/clientes/editar/')
      ? 'editar'
      : null
  // Busca dados do cliente para edição se estiver no modo de edição e clienteId estiver presente
  useEffect(() => {
    if (modoFormulario === 'editar' && params.clienteId) {
      setLoadingItem(true)
      getCliente(params.clienteId)
        .then((data) => setClienteParaEditar(data))
        .catch((error) => {
          console.error('ClientesPage: Erro ao buscar cliente:', error)
          // Adicionar feedback para o usuário, ex: toast
          navigate('/clientes')
        })
        .finally(() => {
          setLoadingItem(false)
        })
    } else if (modoFormulario === 'novo') {
      setClienteParaEditar(null) // Garante que não há dados de edição anteriores
    }
  }, [modoFormulario, params.clienteId, navigate])

  const handleAdicionarClick = () => {
    setClienteParaEditar(null) // Limpa qualquer estado de edição anterior
    navigate('/clientes/novo')
  }

  const handleEditarCliente = (cliente) => {
    // Os dados do cliente já vêm da lista.
    // A navegação acionará o useEffect para buscar a versão mais recente, se necessário,
    // ou podemos passar o cliente diretamente para o formulário se a busca no useEffect for removida para este caso.
    // Por consistência, vamos manter a busca no useEffect.
    navigate(`/clientes/editar/${cliente.id}`)
  }

  // PR A do diagnostico (redirect pos-criacao):
  // - Cliente novo => navega pro detalhe (/clientes/:id) pra usuario continuar
  //   trabalhando nele (criar casos, contratos, etc).
  // - Edicao => volta pro detalhe tambem (refresh da view) em vez de jogar
  //   na lista; consistente com expectativa "salvei, vou ver o resultado".
  // - Anonimizacao (LGPD) ou cancelamento => sem entidade, volta pra lista.
  const handleFormularioFechado = useCallback(
    (cliente, isNovo) => {
      setRefreshKey((prevKey) => prevKey + 1)
      setClienteParaEditar(null)
      if (cliente?.id) {
        navigate(`/clientes/${cliente.id}`)
      } else {
        navigate('/clientes')
      }
    },
    [navigate]
  )

  if (loadingItem && (modoFormulario === 'editar' || modoFormulario === 'detalhe')) {
    return (
      <div className="d-flex justify-content-center align-items-center p-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">A carregar cliente...</span>
        </div>
        <span className="ms-3 text-muted">A carregar dados do cliente...</span>
      </div>
    )
  }

  if (mostrarFormulario) {
    return (
      <ClienteForm
        clienteParaEditar={clienteParaEditar} // Se for novo, será null
        onClienteChange={handleFormularioFechado}
        onCancel={() => {
          setClienteParaEditar(null)
          navigate('/clientes')
        }}
      />
    )
  }
  return (
    <>
      <div className="d-flex flex-wrap gap-2 mb-3">
        <BotaoAdicionar texto="Adicionar Novo Cliente" onClick={handleAdicionarClick} />
        <button
          type="button"
          className="btn btn-outline-primary d-flex align-items-center mb-3"
          onClick={() => navigate('/clientes/novo/procuracao')}
        >
          <i className="bi bi-file-earmark-arrow-up me-2"></i>
          Cadastrar por Procuração
        </button>
      </div>
      <ClienteList key={refreshKey} onEditCliente={handleEditarCliente} />
    </>
  )
}

export default ClientesPage
