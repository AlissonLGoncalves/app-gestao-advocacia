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
          <div className="card shadow-lg mb-4">
            <div className="card-body p-4">
              <div className="row g-4 mb-4">
                <div className="col-md-6">
                  <div className="border p-3 rounded h-100">
                    <h6 className="text-secondary border-bottom pb-2 mb-3">Informações Gerais</h6>
                    <p className="small mb-1">
                      <strong>Número do Processo:</strong>{' '}
                      <span className="text-dark">{caso.numero_processo || 'Não informado'}</span>
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
                      <span className="text-dark">{formatarDataLegivel(caso.data_criacao)}</span>
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
          {/* HONORÁRIOS na tab Resumo */}
          <HonorariosCasoCard casoId={casoId} clienteId={caso.cliente_id} />
          {/* Epic #8 (#182): apensar processo + alterar instancia */}
          <ApensarMenuCaso
            caso={caso}
            onCasoAtualizado={(novoCaso) => setCaso((prev) => ({ ...prev, ...novoCaso }))}
          />
          {/* DOCUMENTOS VINCULADOS (procurações + contratos com viewer/download) */}
          <DocumentosVinculadosCard casoId={casoId} />
          {/* DRIVE do processo */}
          <div className="card shadow-lg mb-4">
            <div className="card-body p-4 pt-2">
              <DocumentosCasoTab casoId={casoId} />
            </div>
          </div>
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
                      </tr>
                    </thead>
                    <tbody>
                      {prazos.map((t) => (
                        <tr key={t.id}>
                          <td className="fw-medium text-dark">{t.titulo}</td>
                          <td>
                            <span
                              className={`badge bg-${t.prioridade === 'Urgente' ? 'danger' : t.prioridade === 'Alta' ? 'warning' : 'info'}-subtle text-dark`}
                            >
                              {t.prioridade}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`badge ${t.status === 'Concluído' ? 'bg-success' : t.status === 'Fazendo' ? 'bg-warning' : 'bg-danger'}`}
                            >
                              {t.status}
                            </span>
                          </td>
                          <td>
                            {t.data_vencimento
                              ? new Date(t.data_vencimento + 'T12:00:00').toLocaleDateString(
                                  'pt-BR'
                                )
                              : '-'}
                          </td>
                        </tr>
                      ))}
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
    </div>
  )
}

export default CasoDetalhePage
