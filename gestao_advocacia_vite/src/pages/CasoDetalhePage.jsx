// gestao_advocacia_vite/src/pages/CasoDetalhePage.jsx
import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { API_URL } from '../config.js' // Importa API_URL
import { toast } from 'react-toastify' // Para notificações
import {
  atualizarCasoViaDjen,
  gerarResumoCaso,
  getCaso,
  listPublicacoesDjenCaso,
} from '../api/casos.js'
import HonorariosCasoCard from '../components/HonorariosCasoCard'
import DocumentosCasoTab from '../components/DocumentosCasoTab'
import DocumentosVinculadosCard from '../components/DocumentosVinculadosCard'
import ApensarMenuCaso from '../components/ApensarMenuCaso.jsx'
import CasoTimeline from '../components/CasoTimeline'
import ProximasAtividadesCard from '../components/ProximasAtividadesCard.jsx'
import PrioridadeBadge from '../components/ui/PrioridadeBadge.jsx'
import StatusBadge from '../components/ui/StatusBadge.jsx'
import { useConfirm } from '../hooks/useConfirm.jsx'
import {
  CheckCircleIcon,
  EyeIcon,
  TrashIcon,
  NewspaperIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'

// Componente auxiliar para exibir mensagens de status (loading, error, success)
const StatusDisplay = ({ isLoading, error, successMessage, className = '' }) => {
  if (isLoading)
    return <p className={`text-sm text-blue-600 animate-pulse ${className}`}>Processando...</p>
  if (error)
    return <p className={`text-sm text-red-600 font-semibold ${className}`}>Erro: {error}</p>
  if (successMessage)
    return <p className={`text-sm text-green-600 font-semibold ${className}`}>{successMessage}</p>
  return null
}

// Epic #6 (#180): tabs do detalhe do caso. Persistido em ?tab=resumo|atividades|historico
// pra preservar estado em refresh / share de URL. Default: 'resumo'.
const TABS_VALIDAS = ['resumo', 'atividades', 'historico']
const TAB_DEFAULT = 'resumo'

function CasoDetalhePage() {
  const { casoId } = useParams()
  const navigate = useNavigate()
  const { confirm, ConfirmDialog } = useConfirm()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const tabAtiva = TABS_VALIDAS.includes(tabParam) ? tabParam : TAB_DEFAULT
  const setTabAtiva = (novaTab) => {
    const params = new URLSearchParams(searchParams)
    if (novaTab === TAB_DEFAULT) {
      params.delete('tab')
    } else {
      params.set('tab', novaTab)
    }
    setSearchParams(params, { replace: true })
  }

  const [caso, setCaso] = useState(null)
  const [publicacoesDjen, setPublicacoesDjen] = useState([])
  const [prazos, setPrazos] = useState([])

  const [isLoadingCaso, setIsLoadingCaso] = useState(true)
  const [isLoadingMovimentacoes, setIsLoadingMovimentacoes] = useState(false)
  const [isLoadingAtualizacaoCNJ, setIsLoadingAtualizacaoCNJ] = useState(false)
  const [timelineRefreshNonce, setTimelineRefreshNonce] = useState(0)
  const [isLoadingResumo, setIsLoadingResumo] = useState(false)
  const [resumoError, setResumoError] = useState('')

  const [fetchError, setFetchError] = useState('')
  const [atualizacaoCNJError, setAtualizacaoCNJError] = useState('')
  const [atualizacaoCNJSuccess, setAtualizacaoCNJSuccess] = useState('')

  const formatarDataLegivel = (dataISO) => {
    if (!dataISO) return 'Não disponível'
    try {
      return new Date(dataISO).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch (e) {
      console.warn('Erro ao formatar data:', dataISO, e)
      return dataISO
    }
  }

  const carregarDadosDoCaso = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      toast.error('Autenticação necessária. Redirecionando para login...')
      navigate('/login') // Idealmente, você teria uma rota de login
      return
    }
    const authHeaders = { Authorization: `Bearer ${token}` }

    setIsLoadingCaso(true)
    setIsLoadingMovimentacoes(true)
    setFetchError('')
    setAtualizacaoCNJError('')
    setAtualizacaoCNJSuccess('')

    try {
      const dataCaso = await getCaso(casoId)
      setCaso(dataCaso)
      setIsLoadingCaso(false)

      const dataMovCNJ = await listPublicacoesDjenCaso(casoId)
      setPublicacoesDjen(dataMovCNJ)

      // Buscar Prazos/Tarefas Vinculados
      const resTarefas = await fetch(`${API_URL}/tarefas`, { headers: authHeaders })
      if (resTarefas.ok) {
        const dataTarefas = await resTarefas.json()
        setPrazos(dataTarefas.filter((t) => t.caso_id === parseInt(casoId)))
      }
    } catch (err) {
      console.error('Erro ao buscar dados do caso ou movimentações:', err)
      setFetchError(err.message)
      toast.error(`Erro ao carregar dados: ${err.message}`)
    } finally {
      setIsLoadingCaso(false)
      setIsLoadingMovimentacoes(false)
    }
  }, [casoId, navigate]) // API_URL não precisa ser dependência se importado diretamente

  useEffect(() => {
    carregarDadosDoCaso()
  }, [carregarDadosDoCaso])

  // Acoes inline na aba Atividades — evita ter que abrir o Kanban so pra
  // mexer numa tarefa vinculada ao caso. Reusa endpoints existentes do
  // ciclo Kanban<>DJEN.
  const recarregarPrazos = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/tarefas`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setPrazos(data.filter((t) => t.caso_id === parseInt(casoId)))
      }
    } catch (e) {
      console.error('Erro ao recarregar prazos:', e)
    }
  }

  const handleConcluirTarefa = async (tarefa) => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/tarefas/${tarefa.id}/concluir`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      })
      if (res.ok) {
        toast.success('Tarefa marcada como cumprida.')
        recarregarPrazos()
      } else {
        toast.error('Falha ao concluir tarefa.')
      }
    } catch {
      toast.error('Erro na comunicação com servidor.')
    }
  }

  const handleExcluirTarefa = async (tarefa) => {
    const ok = await confirm(
      `Tem certeza que deseja excluir "${tarefa.titulo}"? Essa ação não pode ser desfeita.`,
      'Excluir prazo'
    )
    if (!ok) return
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/tarefas/${tarefa.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        toast.success('Prazo excluído.')
        recarregarPrazos()
      } else {
        toast.error('Falha ao excluir.')
      }
    } catch {
      toast.error('Erro na comunicação com servidor.')
    }
  }

  const handleAtualizarViaDJEN = async () => {
    if (!caso || !caso.numero_processo) {
      setAtualizacaoCNJError(
        'Não é possível atualizar: dados do caso ou número do processo ausentes.'
      )
      toast.warn('Número de processo ausente.')
      return
    }

    setIsLoadingAtualizacaoCNJ(true)
    setAtualizacaoCNJError('')
    setAtualizacaoCNJSuccess('')

    try {
      const dataResposta = await atualizarCasoViaDjen(caso.id)
      const mensagem = dataResposta.message || 'Publicações DJEN sincronizadas com sucesso!'
      setAtualizacaoCNJSuccess(mensagem)
      toast.success(mensagem)
      await carregarDadosDoCaso()
      setTimelineRefreshNonce((v) => v + 1)
    } catch (err) {
      console.error('Erro durante a atualização via DJEN:', err)
      setAtualizacaoCNJError(err.message)
      toast.error(`Erro na sincronização DJEN: ${err.message}`)
    } finally {
      setIsLoadingAtualizacaoCNJ(false)
    }
  }

  const handleGerarResumo = async () => {
    if (!caso) {
      return
    }

    setIsLoadingResumo(true)
    setResumoError('')
    try {
      const resp = await gerarResumoCaso(caso.id)
      toast.success(resp.message || 'Resumo gerado com sucesso!')
      setCaso((prev) => ({ ...prev, descricao: resp.resumo }))
      await carregarDadosDoCaso()
    } catch (err) {
      setResumoError(err.message)
      toast.error(`Erro ao gerar resumo: ${err.message}`)
    } finally {
      setIsLoadingResumo(false)
    }
  }

  if (isLoadingCaso && !caso) {
    return (
      <div
        className="d-flex justify-content-center align-items-center"
        style={{ minHeight: '70vh' }}
      >
        <div
          className="spinner-border text-primary"
          role="status"
          style={{ width: '3rem', height: '3rem' }}
        >
          <span className="visually-hidden">A carregar...</span>
        </div>
        <p className="ms-3 text-muted fs-5">Carregando detalhes do caso...</p>
      </div>
    )
  }

  if (fetchError && !caso) {
    return (
      <div className="container my-5">
        <div className="alert alert-danger text-center">
          <h4 className="alert-heading">Erro ao Carregar Dados</h4>
          <p>{fetchError}</p>
          <button onClick={() => navigate('/casos')} className="btn btn-primary mt-3">
            Voltar para Lista de Casos
          </button>
        </div>
      </div>
    )
  }

  if (!caso) {
    return (
      <div className="container my-5 text-center">
        <p className="fs-5 text-muted">Caso não encontrado ou não acessível.</p>
        <button onClick={() => navigate('/casos')} className="btn btn-primary mt-3">
          Voltar para Lista de Casos
        </button>
      </div>
    )
  }

  return (
    <div className="container-fluid p-md-4 p-lg-5">
      {/* Epic #6 (#180): cabeçalho fixo com tabs (Resumo / Atividades / Histórico).
          Inspirado no padrão Astrea — tab persiste na URL pra share/refresh. */}
      <div className="card shadow-lg mb-3">
        <div className="card-header bg-light py-3">
          <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center">
            <h5 className="card-title mb-2 mb-sm-0 text-primary">
              Detalhes do Caso: <span className="fw-bold">{caso.nome_caso}</span>
            </h5>
            <Link to={`/casos/editar/${caso.id}`} className="btn btn-sm btn-outline-secondary">
              Editar Caso
            </Link>
          </div>
        </div>
        <ul className="nav nav-tabs px-3" role="tablist" data-testid="caso-tabs">
          <li className="nav-item" role="presentation">
            <button
              className={`nav-link ${tabAtiva === 'resumo' ? 'active fw-semibold' : ''}`}
              onClick={() => setTabAtiva('resumo')}
              role="tab"
              aria-selected={tabAtiva === 'resumo'}
              data-testid="tab-resumo"
            >
              Resumo
            </button>
          </li>
          <li className="nav-item" role="presentation">
            <button
              className={`nav-link ${tabAtiva === 'atividades' ? 'active fw-semibold' : ''}`}
              onClick={() => setTabAtiva('atividades')}
              role="tab"
              aria-selected={tabAtiva === 'atividades'}
              data-testid="tab-atividades"
            >
              Atividades
              {prazos.length > 0 && (
                <span className="badge bg-secondary ms-2" style={{ fontSize: '0.7rem' }}>
                  {prazos.length}
                </span>
              )}
            </button>
          </li>
          <li className="nav-item" role="presentation">
            <button
              className={`nav-link ${tabAtiva === 'historico' ? 'active fw-semibold' : ''}`}
              onClick={() => setTabAtiva('historico')}
              role="tab"
              aria-selected={tabAtiva === 'historico'}
              data-testid="tab-historico"
            >
              Histórico
              {publicacoesDjen.length > 0 && (
                <span className="badge bg-secondary ms-2" style={{ fontSize: '0.7rem' }}>
                  {publicacoesDjen.length}
                </span>
              )}
            </button>
          </li>
        </ul>
      </div>

      {fetchError && (
        <div className="alert alert-warning small mb-3">
          <p className="mb-0">{fetchError}</p>
        </div>
      )}

      {/* ── TAB RESUMO: dados estruturais + honorários + apensos ──────────── */}
      {tabAtiva === 'resumo' && (
        <div role="tabpanel" data-testid="painel-resumo">
          {/* Epic #7 (#181): layout 2 colunas — conteúdo principal à esq.
              (col-lg-8) + sidebar com cards compactos à dir. (col-lg-4).
              Em mobile (<lg) empilha vertical naturalmente. */}
          <div className="row g-3">
            <div className="col-lg-8" data-testid="caso-coluna-principal">
              <div className="card shadow-lg mb-4">
                <div className="card-body p-4">
                  <div className="row g-4 mb-4">
                    <div className="col-md-6">
                      <div className="border p-3 rounded h-100">
                        <h6 className="text-secondary border-bottom pb-2 mb-3">
                          Informações Gerais
                        </h6>
                        <p className="small mb-1">
                          <strong>Número do Processo:</strong>{' '}
                          <span className="text-dark">
                            {caso.numero_processo || 'Não informado'}
                          </span>
                        </p>
                        <p className="small mb-1">
                          <strong>Status (Sistema):</strong>{' '}
                          <span className="text-dark">{caso.status || 'Não definido'}</span>
                        </p>
                        <p className="small mb-1">
                          <strong>Cliente:</strong>{' '}
                          <span className="text-dark">
                            {caso.nome_cliente || `ID ${caso.cliente_id}`}
                          </span>
                        </p>
                        <p className="small mb-1">
                          <strong>Descrição:</strong>
                        </p>
                        <p
                          className="small text-dark bg-light p-2 rounded"
                          style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                        >
                          {caso.descricao || 'Nenhuma descrição fornecida.'}
                        </p>
                        <button
                          onClick={handleGerarResumo}
                          disabled={isLoadingResumo || publicacoesDjen.length === 0}
                          className="btn btn-sm btn-outline-secondary mt-2 w-100"
                          title={
                            publicacoesDjen.length === 0
                              ? 'Sincronize o DJEN primeiro'
                              : 'Usa IA para resumir as publicações DJEN'
                          }
                        >
                          {isLoadingResumo ? (
                            <>
                              <span
                                className="spinner-border spinner-border-sm me-2"
                                role="status"
                                aria-hidden="true"
                              ></span>
                              Gerando resumo...
                            </>
                          ) : (
                            '✨ Gerar Resumo com IA'
                          )}
                        </button>
                        {resumoError && <p className="small text-danger mt-1">{resumoError}</p>}
                      </div>
                    </div>

                    <div className="col-md-6">
                      <div className="border p-3 rounded h-100">
                        <h6 className="text-secondary border-bottom pb-2 mb-3">
                          Datas e Sincronização CNJ
                        </h6>
                        <p className="small mb-1">
                          <strong>Criado em:</strong>{' '}
                          <span className="text-dark">
                            {formatarDataLegivel(caso.data_criacao)}
                          </span>
                        </p>
                        <p className="small mb-1">
                          <strong>Última Atualização (Sistema):</strong>{' '}
                          <span className="text-dark">
                            {formatarDataLegivel(caso.data_atualizacao)}
                          </span>
                        </p>
                        <p className="small mb-2">
                          <strong>Última Verificação CNJ:</strong>{' '}
                          <span className="text-dark">
                            {formatarDataLegivel(caso.data_ultima_verificacao_cnj)}
                          </span>
                        </p>

                        {caso.numero_processo ? (
                          <button
                            onClick={handleAtualizarViaDJEN}
                            disabled={isLoadingAtualizacaoCNJ || isLoadingCaso}
                            className="btn btn-sm btn-primary w-100 mt-2"
                          >
                            {isLoadingAtualizacaoCNJ ? (
                              <>
                                <span
                                  className="spinner-border spinner-border-sm me-2"
                                  role="status"
                                  aria-hidden="true"
                                ></span>
                                Verificando DJEN...
                              </>
                            ) : (
                              'Verificar Publicações no DJEN'
                            )}
                          </button>
                        ) : (
                          <p className="mt-2 text-xs text-muted fst-italic">
                            Número do processo não cadastrado. Consulta ao DJEN indisponível.
                          </p>
                        )}
                        <StatusDisplay
                          isLoading={isLoadingAtualizacaoCNJ}
                          error={atualizacaoCNJError}
                          successMessage={atualizacaoCNJSuccess}
                          className="mt-2 text-center small"
                        />
                      </div>
                    </div>
                  </div>
                  {/* /row.g-4 */}
                </div>
                {/* /card-body */}
              </div>
              {/* /card "Detalhes do Caso" */}
              {/* HONORÁRIOS continua coluna principal (precisa de espaço) */}
              <HonorariosCasoCard casoId={casoId} clienteId={caso.cliente_id} />
              {/* DRIVE do processo (full-width principal) */}
              <div className="card shadow-lg mb-4">
                <div className="card-body p-4 pt-2">
                  <DocumentosCasoTab casoId={casoId} />
                </div>
              </div>
            </div>
            {/* /coluna principal */}

            {/* Sidebar com cards compactos */}
            <div className="col-lg-4" data-testid="caso-sidebar">
              {/* Próximas atividades — usa as `prazos` já carregadas */}
              <ProximasAtividadesCard prazos={prazos} />

              {/* Documentos vinculados (procurações + contratos) */}
              <DocumentosVinculadosCard casoId={casoId} />

              {/* Apensar processo + alterar instância */}
              <ApensarMenuCaso
                caso={caso}
                onCasoAtualizado={(novoCaso) => setCaso((prev) => ({ ...prev, ...novoCaso }))}
              />
            </div>
            {/* /sidebar */}
          </div>
          {/* /row.g-3 (2 colunas) */}
        </div>
      )}

      {/* ── TAB ATIVIDADES: prazos + tarefas pendentes ────────────────────── */}
      {tabAtiva === 'atividades' && (
        <div role="tabpanel" data-testid="painel-atividades">
          <div className="card shadow-lg mb-4">
            <div className="card-header bg-light py-3 d-flex justify-content-between align-items-center">
              <h5 className="card-title mb-0 text-primary">
                Prazos e Tarefas Vinculados ({prazos.length})
              </h5>
              <Link to="/prazos" className="btn btn-sm btn-outline-primary">
                Abrir Kanban
              </Link>
            </div>
            <div className="card-body p-3">
              {prazos.length > 0 ? (
                <div className="table-responsive">
                  <table className="table table-hover align-middle small mb-0">
                    <thead>
                      <tr>
                        <th>Título</th>
                        <th>Prioridade</th>
                        <th>Status</th>
                        <th>Vencimento</th>
                        <th>Origem</th>
                        <th className="text-center" style={{ width: 120 }}>
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {prazos.map((t) => {
                        const concluida = t.status === 'Concluído' || t.status === 'Concluido'
                        const precisaConfirmarIA =
                          t.prazo_calculado_por_ia && t.prazo_validado === false
                        return (
                          <tr
                            key={t.id}
                            style={{ cursor: 'pointer' }}
                            onClick={() => navigate(`/prazos?tarefa=${t.id}`)}
                            title="Abrir no Kanban de Prazos"
                          >
                            <td className="fw-medium text-dark">{t.titulo}</td>
                            <td>
                              <PrioridadeBadge prioridade={t.prioridade} mostrarNormal />
                            </td>
                            <td>
                              <StatusBadge tipo="tarefa" valor={t.status} />
                            </td>
                            <td>
                              {t.data_vencimento
                                ? new Date(
                                    String(t.data_vencimento).slice(0, 10) + 'T12:00:00'
                                  ).toLocaleDateString('pt-BR')
                                : '-'}
                            </td>
                            <td>
                              <div className="d-flex flex-wrap gap-1">
                                {t.publicacao_djen_id && (
                                  <span
                                    role="button"
                                    className="badge bg-info-subtle text-info-emphasis d-inline-flex align-items-center gap-1"
                                    title="Ver publicação DJEN que originou este prazo"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      navigate(`/djen?publicacao=${t.publicacao_djen_id}`)
                                    }}
                                  >
                                    <NewspaperIcon style={{ width: 11, height: 11 }} />
                                    via DJEN
                                  </span>
                                )}
                                {precisaConfirmarIA && (
                                  <span
                                    className="badge bg-warning-subtle text-warning-emphasis d-inline-flex align-items-center gap-1"
                                    title={
                                      t.prazo_dias_origem
                                        ? `Prazo de ${t.prazo_dias_origem} dias calculado pela IA — revise e confirme no Kanban`
                                        : 'Prazo calculado pela IA — revise e confirme no Kanban'
                                    }
                                  >
                                    <SparklesIcon style={{ width: 11, height: 11 }} />
                                    IA — confirmar
                                  </span>
                                )}
                                {!t.publicacao_djen_id && !precisaConfirmarIA && (
                                  <span className="text-muted" style={{ fontSize: '0.72rem' }}>
                                    Manual
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="text-center" onClick={(e) => e.stopPropagation()}>
                              {!concluida && (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-success p-1 lh-1 me-1"
                                  title="Marcar como cumprida"
                                  onClick={() => handleConcluirTarefa(t)}
                                  style={{ width: 28, height: 28 }}
                                >
                                  <CheckCircleIcon style={{ width: 14, height: 14 }} />
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary p-1 lh-1 me-1"
                                title="Abrir no Kanban"
                                onClick={() => navigate(`/prazos?tarefa=${t.id}`)}
                                style={{ width: 28, height: 28 }}
                              >
                                <EyeIcon style={{ width: 14, height: 14 }} />
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger p-1 lh-1"
                                title="Excluir prazo"
                                onClick={() => handleExcluirTarefa(t)}
                                style={{ width: 28, height: 28 }}
                              >
                                <TrashIcon style={{ width: 14, height: 14 }} />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted fst-italic text-center py-3 mb-0">
                  Nenhum prazo vinculado a este caso.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB HISTÓRICO: timeline + lista raw de publicações DJEN ─────── */}
      {tabAtiva === 'historico' && (
        <div role="tabpanel" data-testid="painel-historico">
          <div className="card shadow-lg mb-4">
            <div className="card-header bg-light py-3">
              <h5 className="card-title mb-0 text-primary">Linha do Tempo</h5>
              <small className="text-muted">
                Publicações DJEN, documentos e prazos em ordem cronológica
              </small>
            </div>
            <div className="card-body p-4">
              <CasoTimeline key={`${casoId}-${timelineRefreshNonce}`} casoId={casoId} />
            </div>
          </div>
          <div className="card shadow-lg">
            <div className="card-header bg-light py-3">
              <h5 className="card-title mb-0 text-primary">
                Publicações DJEN ({publicacoesDjen.length})
              </h5>
            </div>
            <div className="card-body p-3" style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {isLoadingMovimentacoes ? (
                <p className="text-muted text-center py-3">Carregando publicações...</p>
              ) : publicacoesDjen.length > 0 ? (
                <ul className="list-group list-group-flush">
                  {publicacoesDjen.map((pub) => (
                    <li key={pub.id} className="list-group-item px-0 py-3">
                      <div className="d-flex justify-content-between align-items-start mb-1">
                        <span className="badge bg-primary me-2">
                          {pub.tipo_comunicacao || 'Publicação'}
                        </span>
                        <span className="text-black-50" style={{ fontSize: '0.75rem' }}>
                          {pub.sigla_tribunal}
                          {pub.nome_orgao ? ` — ${pub.nome_orgao}` : ''}
                        </span>
                      </div>
                      <p className="fw-medium text-dark small mb-1">
                        Data:{' '}
                        {pub.data_disponibilizacao
                          ? new Date(pub.data_disponibilizacao).toLocaleDateString('pt-BR')
                          : 'Não informada'}
                      </p>
                      <p
                        className="text-muted small mb-2"
                        style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                      >
                        {pub.texto || 'Sem conteúdo disponível.'}
                      </p>
                      {pub.link && (
                        <a
                          href={pub.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="small text-primary"
                        >
                          Ver publicação original
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted fst-italic text-center py-3">
                  Nenhuma publicação DJEN registrada. Clique em &ldquo;Verificar Publicações no
                  DJEN&rdquo; para sincronizar.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 text-center">
        <button onClick={() => navigate('/casos')} className="btn btn-secondary">
          Voltar para Lista de Casos
        </button>
      </div>
      {ConfirmDialog}
    </div>
  )
}

export default CasoDetalhePage
