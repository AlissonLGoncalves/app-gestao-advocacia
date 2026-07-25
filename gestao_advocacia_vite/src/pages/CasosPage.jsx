// src/pages/CasosPage.jsx
import React, { useState, useCallback, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router'
import CasoList from '../components/CasoList.jsx' // Ajuste o caminho se CasoList.jsx não estiver em src/
import CasoForm from '../components/CasoForm.jsx' // Ajuste o caminho se CasoForm.jsx não estiver em src/
import BotaoAdicionar from '../components/BotaoAdicionar.jsx' // Ajuste o caminho se BotaoAdicionar.jsx não estiver em src/components/
import { getCaso } from '../api/casos.js'

function CasosPage() {
  const navigate = useNavigate()
  const params = useParams() // Para pegar :casoId da URL
  const location = useLocation() // Para verificar a rota atual e determinar o modo
  const [refreshKey, setRefreshKey] = useState(0) // Para forçar a atualização da lista
  const [casoParaEditar, setCasoParaEditar] = useState(null)
  const [loadingItem, setLoadingItem] = useState(false) // Estado para carregamento do item para edição

  // Determina se o formulário deve ser mostrado e em qual modo com base na URL
  const urlPath = location.pathname.toLowerCase() // Normaliza para minúsculas para segurança
  const mostrarFormulario = urlPath.includes('/casos/novo') || urlPath.startsWith('/casos/editar/')
  const modoFormulario = urlPath.includes('/casos/novo')
    ? 'novo'
    : urlPath.startsWith('/casos/editar/')
      ? 'editar'
      : null
  // Busca dados do caso para edição se estiver no modo de edição e casoId estiver presente
  useEffect(() => {
    if (modoFormulario === 'editar' && params.casoId) {
      setLoadingItem(true)
      getCaso(params.casoId)
        .then((data) => setCasoParaEditar(data))
        .catch((error) => {
          console.error('CasosPage: Erro ao buscar caso:', error)
          // Adicionar feedback para o utilizador, ex: toast
          navigate('/casos') // Volta para a lista em caso de erro
        })
        .finally(() => {
          setLoadingItem(false)
        })
    } else if (modoFormulario === 'novo') {
      setCasoParaEditar(null) // Garante que não há dados de edição anteriores
    }
  }, [modoFormulario, params.casoId, navigate])

  const handleAdicionarClick = () => {
    setCasoParaEditar(null) // Limpa qualquer estado de edição anterior
    navigate('/casos/novo')
  }

  const handleEditarCaso = (caso) => {
    navigate(`/casos/editar/${caso.id}`)
  }

  // PR A do diagnostico: pos-criacao/edicao, navega pra detalhe do caso
  // (em vez de jogar de volta na lista). Usuario tipicamente cria caso
  // pra trabalhar nele em seguida (anexar documentos, criar prazos etc).
  const handleFormularioFechado = useCallback(
    (caso, isNovo) => {
      setRefreshKey((prevKey) => prevKey + 1)
      setCasoParaEditar(null)
      if (caso?.id) {
        navigate(`/casos/detalhe/${caso.id}`)
      } else {
        navigate('/casos')
      }
    },
    [navigate]
  )

  if (loadingItem && modoFormulario === 'editar') {
    return (
      <div className="d-flex justify-content-center align-items-center p-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">A carregar caso...</span>
        </div>
        <span className="ms-3 text-muted">A carregar dados do caso...</span>
      </div>
    )
  }

  // Lê cliente_id da query string (ex: /casos/novo?cliente_id=3)
  const searchParams = new URLSearchParams(location.search)
  const clienteIdInicial = searchParams.get('cliente_id')

  if (mostrarFormulario) {
    return (
      <>
        {/* Fase 4 — entrada unificada: o form manual mostra os caminhos
            assistidos ANTES do usuário digitar tudo à mão. */}
        {modoFormulario === 'novo' && (
          <div
            className="alert alert-light border d-flex flex-wrap align-items-center gap-2 mx-3 mt-3 mb-0 py-2"
            data-testid="modos-criacao-caso"
          >
            <span className="small text-muted me-1">
              Tem o nº do processo ou a procuração? Deixe o app preencher:
            </span>
            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              onClick={() => navigate('/casos/buscar')}
            >
              Buscar pelo nº CNJ
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              onClick={() => navigate('/clientes/novo/procuracao')}
            >
              A partir da procuração
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => navigate('/casos/importar')}
            >
              Vários CNJs em lote
            </button>
          </div>
        )}
        <CasoForm
          casoParaEditar={casoParaEditar}
          clienteIdInicial={clienteIdInicial}
          onCasoChange={handleFormularioFechado}
          onCancel={() => {
            setCasoParaEditar(null)
            navigate('/casos')
          }}
        />
      </>
    )
  }
  return (
    <>
      <div className="d-flex gap-2 flex-wrap mb-3">
        <BotaoAdicionar texto="Adicionar Novo Caso" onClick={handleAdicionarClick} />
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => navigate('/casos/importar')}
          title="Triagem em lote: cole até 40 CNJs e veja o status de cada um"
        >
          Importar CNJs em lote
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-primary"
          onClick={() => navigate('/casos/buscar')}
          title="Buscar processo no tribunal pelo número CNJ"
        >
          Buscar no tribunal
        </button>
      </div>
      <CasoList key={refreshKey} onEditCaso={handleEditarCaso} />
    </>
  )
}

export default CasosPage
