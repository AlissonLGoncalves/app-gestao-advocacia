// gestao_advocacia_vite/src/pages/CasoDetalhePage.jsx
//
// Redesign Stitch (TELA 3 — Caso como hub com próximo passo).
// Cabeçalho "{cliente} × {parte contrária}" + botão primário "Abrir no
// tribunal ↗"; Resumo em duas colunas com o card "Próximo passo" como
// estrela. Lógica, endpoints e tabs (?tab=) preservados do desenho anterior.
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router'
import { toast } from 'react-toastify'
// PR D4.2 — Atividades do caso lê de /v1/itens-agenda em vez de /tarefas
import { listItensAgenda, concluirItemAgenda, deleteItemAgenda } from '../api/itensAgenda.js'
import {
  atualizarCasoViaDjen,
  gerarResumoCaso,
  getCaso,
  listPublicacoesDjenCaso,
} from '../api/casos.js'
import { getCliente } from '../api/clientes.js'
import { listDocumentos } from '../api/documentos.js'
import { api } from '../api/client.js'
import HonorariosCasoCard from '../components/HonorariosCasoCard'
import DocumentosCasoTab from '../components/DocumentosCasoTab'
import DocumentosVinculadosCard from '../components/DocumentosVinculadosCard'
import ApensarMenuCaso from '../components/ApensarMenuCaso.jsx'
import CasoTimeline from '../components/CasoTimeline'
import PrioridadeBadge from '../components/ui/PrioridadeBadge.jsx'
import StatusBadge from '../components/ui/StatusBadge.jsx'
import ItemAgendaForm from '../components/ItemAgendaForm.jsx'
import ContratoFormModal from '../components/ContratoFormModal.jsx'
import RecebimentosCasoCard from '../components/RecebimentosCasoCard.jsx'
import TratarPrazoModal from '../components/TratarPrazoModal.jsx'
import CabecalhoCaso from '../components/caso/CabecalhoCaso.jsx'
import ProximoPassoCard from '../components/caso/ProximoPassoCard.jsx'
import DadosProcessoCard from '../components/caso/DadosProcessoCard.jsx'
import { selecionarProximoPasso } from '../components/caso/proximoPasso.js'
import { derivarChecklist } from '../components/caso/checklistCaso.js'
import { siglaTribunalDoCaso } from '../components/caso/tribunalDoCaso.js'
import { useConfirm } from '../hooks/useConfirm.jsx'
import {
  CheckCircleIcon,
  TrashIcon,
  NewspaperIcon,
  SparklesIcon,
  PencilSquareIcon,
  PlusIcon,
} from '@heroicons/react/24/outline'
import './CasoDetalhePage.css'

// Epic #6 (#180): tabs do detalhe do caso. Persistido em ?tab=resumo|atividades|historico
// pra preservar estado em refresh / share de URL. Default: 'resumo'.
const TABS_VALIDAS = ['resumo', 'atividades', 'historico', 'financeiro']
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
  // Form de prazo no contexto do caso (sem ir pro Kanban global).
  // null = fechado; { item } = editando; {} = criando novo.
  const [prazoForm, setPrazoForm] = useState(null)
  // Fase 3 — caso como hub: '+' cria contrato sem sair do caso
  const [contratoNovo, setContratoNovo] = useState(false)
  const [finNonce, setFinNonce] = useState(0)
  // Stitch — "Gerar peça" / "Vincular peça" abrem o fluxo existente de tratar prazo
  const [itemParaTratar, setItemParaTratar] = useState(null)
  // Stitch — contexto do checklist "O que falta" (cada fonte é independente;
  // undefined = não carregou, o item correspondente fica fora da lista).
  const [contexto, setContexto] = useState({
    cliente: undefined,
    procuracoes: undefined,
    contratos: undefined,
    documentos: undefined,
  })

  const [isLoadingCaso, setIsLoadingCaso] = useState(true)
  const [isLoadingMovimentacoes, setIsLoadingMovimentacoes] = useState(false)
  const [isLoadingAtualizacaoCNJ, setIsLoadingAtualizacaoCNJ] = useState(false)
  const [timelineRefreshNonce, setTimelineRefreshNonce] = useState(0)
  const [isLoadingResumo, setIsLoadingResumo] = useState(false)

  const [fetchError, setFetchError] = useState('')

  const carregarDadosDoCaso = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      toast.error('Autenticação necessária. Redirecionando para login...')
      navigate('/login') // Idealmente, você teria uma rota de login
      return
    }

    setIsLoadingCaso(true)
    setIsLoadingMovimentacoes(true)
    setFetchError('')

    try {
      const dataCaso = await getCaso(casoId)
      setCaso(dataCaso)
      setIsLoadingCaso(false)

      const dataMovCNJ = await listPublicacoesDjenCaso(casoId)
      setPublicacoesDjen(Array.isArray(dataMovCNJ) ? dataMovCNJ : [])

      // PR D4.2 — busca itens da agenda vinculados ao caso. Backend
      // aceita filtro caso_id direto (mais eficiente que filtrar no
      // cliente como antes). Filtramos tipo=tarefa pra manter a
      // semantica original da aba "Atividades" (so prazos, nao eventos
      // — eventos do caso aparecem na agenda unificada).
      try {
        const itens = await listItensAgenda({
          tipo: 'tarefa',
          caso_id: parseInt(casoId),
        })
        setPrazos(Array.isArray(itens) ? itens : [])
      } catch (errTarefas) {
        console.warn('CasoDetalhePage: erro ao buscar prazos do caso', errTarefas)
        setPrazos([])
      }
    } catch (err) {
      console.error('Erro ao buscar dados do caso ou movimentações:', err)
      setFetchError(err.message)
      toast.error(err.message || 'Não foi possível carregar o caso. Recarregue a página.')
    } finally {
      setIsLoadingCaso(false)
      setIsLoadingMovimentacoes(false)
    }
  }, [casoId, navigate]) // API_URL não precisa ser dependência se importado diretamente

  useEffect(() => {
    carregarDadosDoCaso()
  }, [carregarDadosDoCaso])

  // Stitch — contexto do checklist. Três chamadas independentes a endpoints
  // que já existem; falha em uma não derruba as outras.
  const carregarContexto = useCallback(async (id, clienteId) => {
    const [cliente, docsVinculados, documentos] = await Promise.all([
      clienteId ? getCliente(clienteId).catch(() => undefined) : Promise.resolve(undefined),
      api.get(`/casos/${id}/documentos`).catch(() => undefined),
      listDocumentos(id).catch(() => undefined),
    ])
    setContexto({
      cliente:
        cliente && typeof cliente === 'object' && !Array.isArray(cliente) ? cliente : undefined,
      procuracoes: Array.isArray(docsVinculados?.procuracoes)
        ? docsVinculados.procuracoes
        : undefined,
      contratos: Array.isArray(docsVinculados?.contratos) ? docsVinculados.contratos : undefined,
      documentos: Array.isArray(documentos)
        ? documentos
        : Array.isArray(documentos?.documentos)
          ? documentos.documentos
          : undefined,
    })
  }, [])

  useEffect(() => {
    if (caso?.id) carregarContexto(caso.id, caso.cliente_id)
  }, [caso?.id, caso?.cliente_id, carregarContexto, finNonce])

  // Acoes inline na aba Atividades — evita ter que abrir o Kanban so pra
  // mexer numa tarefa vinculada ao caso. Reusa endpoints existentes do
  // ciclo Kanban<>DJEN.
  const recarregarPrazos = async () => {
    try {
      const itens = await listItensAgenda({
        tipo: 'tarefa',
        caso_id: parseInt(casoId),
      })
      setPrazos(Array.isArray(itens) ? itens : [])
    } catch (e) {
      console.error('Erro ao recarregar prazos:', e)
    }
  }

  const handleConcluirTarefa = async (tarefa) => {
    try {
      await concluirItemAgenda(tarefa.id)
      toast.success('Tarefa marcada como cumprida.')
      recarregarPrazos()
    } catch (err) {
      console.error('CasoDetalhePage: erro ao concluir', err)
      toast.error(err?.message || 'Não foi possível concluir a tarefa. Tente de novo.')
    }
  }

  const handleExcluirTarefa = async (tarefa) => {
    const ok = await confirm(
      `Tem certeza que deseja excluir "${tarefa.titulo}"? Essa ação não pode ser desfeita.`,
      'Excluir prazo'
    )
    if (!ok) return
    try {
      await deleteItemAgenda(tarefa.id)
      toast.success('Prazo excluído.')
      recarregarPrazos()
    } catch (err) {
      console.error('CasoDetalhePage: erro ao excluir', err)
      toast.error(err?.message || 'Não foi possível excluir o prazo. Tente de novo.')
    }
  }

  const handleAtualizarViaDJEN = async () => {
    if (!caso || !caso.numero_processo) {
      toast.warn('Cadastre o nº do processo (CNJ) para consultar o DJEN.')
      return
    }

    setIsLoadingAtualizacaoCNJ(true)
    try {
      const dataResposta = await atualizarCasoViaDjen(caso.id)
      const mensagem = dataResposta.message || 'Publicações DJEN sincronizadas com sucesso!'
      toast.success(mensagem)
      await carregarDadosDoCaso()
      setTimelineRefreshNonce((v) => v + 1)
    } catch (err) {
      console.error('Erro durante a atualização via DJEN:', err)
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
    try {
      const resp = await gerarResumoCaso(caso.id)
      toast.success(resp.message || 'Resumo gerado com sucesso!')
      setCaso((prev) => ({ ...prev, descricao: resp.resumo }))
      await carregarDadosDoCaso()
    } catch (err) {
      toast.error(`Erro ao gerar resumo: ${err.message}`)
    } finally {
      setIsLoadingResumo(false)
    }
  }

  // Stitch — derivações do Resumo
  const proximoPasso = useMemo(() => selecionarProximoPasso(prazos), [prazos])
  const publicacaoDoPasso = useMemo(
    () =>
      proximoPasso?.publicacao_djen_id
        ? publicacoesDjen.find((p) => p.id === proximoPasso.publicacao_djen_id) || null
        : null,
    [proximoPasso, publicacoesDjen]
  )
  const checklist = useMemo(
    () =>
      derivarChecklist({
        cliente: contexto.cliente,
        procuracoes: contexto.procuracoes,
        contratos: contexto.contratos,
        documentos: contexto.documentos,
        proximoPasso,
        casoId,
      }),
    [contexto, proximoPasso, casoId]
  )
  const totalDocumentos = useMemo(() => {
    const partes = [contexto.documentos, contexto.procuracoes, contexto.contratos]
    if (partes.every((p) => p === undefined)) return undefined
    return partes.reduce((acc, p) => acc + (Array.isArray(p) ? p.length : 0), 0)
  }, [contexto])
  const sigla = useMemo(() => siglaTribunalDoCaso(caso, publicacoesDjen), [caso, publicacoesDjen])

  const handleChecklistAcao = (acaoId) => {
    if (acaoId === 'responder' && proximoPasso) setItemParaTratar(proximoPasso)
    if (acaoId === 'contrato') setContratoNovo(true)
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

  const casoFixo = {
    id: parseInt(casoId, 10),
    label: caso?.titulo || caso?.numero_processo || `Caso #${casoId}`,
  }

  return (
    <div className="caso-detalhe">
      <CabecalhoCaso
        caso={caso}
        publicacoes={publicacoesDjen}
        onNovoPrazo={() => setPrazoForm({ tipo: 'tarefa' })}
        onNovoEvento={() => setPrazoForm({ tipo: 'evento' })}
        onNovoContrato={() => setContratoNovo(true)}
        onSincronizarDjen={handleAtualizarViaDJEN}
        onGerarResumo={handleGerarResumo}
        sincronizando={isLoadingAtualizacaoCNJ}
        gerandoResumo={isLoadingResumo}
      />

      {/* Epic #6 (#180): tab persiste na URL pra share/refresh. */}
      <ul className="cd-tabs nav" role="tablist" data-testid="caso-tabs">
        <li className="nav-item" role="presentation">
          <button
            className={`nav-link ${tabAtiva === 'resumo' ? 'active' : ''}`}
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
            className={`nav-link ${tabAtiva === 'atividades' ? 'active' : ''}`}
            onClick={() => setTabAtiva('atividades')}
            role="tab"
            aria-selected={tabAtiva === 'atividades'}
            data-testid="tab-atividades"
          >
            Atividades
            {prazos.length > 0 && <span className="cd-tab-count">{prazos.length}</span>}
          </button>
        </li>
        <li className="nav-item" role="presentation">
          <button
            className={`nav-link ${tabAtiva === 'historico' ? 'active' : ''}`}
            onClick={() => setTabAtiva('historico')}
            role="tab"
            aria-selected={tabAtiva === 'historico'}
            data-testid="tab-historico"
          >
            Histórico
            {publicacoesDjen.length > 0 && (
              <span className="cd-tab-count">{publicacoesDjen.length}</span>
            )}
          </button>
        </li>
        <li className="nav-item" role="presentation">
          <button
            className={`nav-link ${tabAtiva === 'financeiro' ? 'active' : ''}`}
            onClick={() => setTabAtiva('financeiro')}
            role="tab"
            aria-selected={tabAtiva === 'financeiro'}
            data-testid="tab-financeiro"
          >
            Financeiro
          </button>
        </li>
      </ul>

      {fetchError && (
        <div className="alert alert-warning small mb-3">
          <p className="mb-0">{fetchError}</p>
        </div>
      )}

      {/* ── TAB RESUMO: próximo passo (60%) + dados/linha do tempo (40%) ── */}
      {tabAtiva === 'resumo' && (
        <div role="tabpanel" data-testid="painel-resumo">
          <div className="cd-grid">
            <div className="cd-col" data-testid="caso-coluna-principal">
              <ProximoPassoCard
                item={proximoPasso}
                publicacao={publicacaoDoPasso}
                checklist={checklist}
                onRegistrar={() => setPrazoForm({ tipo: 'tarefa' })}
                onGerarPeca={(it) => setItemParaTratar(it)}
                onChecklistAcao={handleChecklistAcao}
              />
            </div>

            <div className="cd-col" data-testid="caso-sidebar">
              <DadosProcessoCard
                caso={caso}
                sigla={sigla}
                totalDocumentos={totalDocumentos}
                onVerDocumentos={() => setTabAtiva('historico')}
              />

              <section
                className="cd-card"
                aria-labelledby="cd-timeline-titulo"
                data-testid="timeline-resumo"
              >
                <div className="cd-card-head">
                  <h3 className="cd-card-title" id="cd-timeline-titulo">
                    Linha do tempo
                  </h3>
                  {caso.numero_processo && (
                    <button
                      type="button"
                      className="btn btn-link"
                      onClick={handleAtualizarViaDJEN}
                      disabled={isLoadingAtualizacaoCNJ}
                      title="Busca publicações novas no DJEN para este processo"
                    >
                      {isLoadingAtualizacaoCNJ ? 'Verificando...' : 'Sincronizar DJEN'}
                    </button>
                  )}
                </div>
                <CasoTimeline
                  key={`${casoId}-${timelineRefreshNonce}-compacta`}
                  casoId={casoId}
                  compacto
                  limite={5}
                  onVerTudo={() => setTabAtiva('historico')}
                />
              </section>

              {/* Apensar processo + alterar instância (Epic #8) */}
              <ApensarMenuCaso
                caso={caso}
                onCasoAtualizado={(novoCaso) => setCaso((prev) => ({ ...prev, ...novoCaso }))}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── TAB ATIVIDADES: prazos + tarefas pendentes ────────────────────── */}
      {tabAtiva === 'atividades' && (
        <div role="tabpanel" data-testid="painel-atividades" className="cd-tab-panel">
          <div className="card mb-4">
            <div className="card-header bg-light py-3 d-flex justify-content-between align-items-center">
              <h5 className="card-title mb-0">Prazos e tarefas vinculados ({prazos.length})</h5>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary d-inline-flex align-items-center"
                  onClick={() => setPrazoForm({})}
                  data-testid="btn-novo-prazo-caso"
                >
                  <PlusIcon style={{ width: 16, height: 16 }} className="me-1" />
                  Novo prazo
                </button>
                <Link to="/prazos" className="btn btn-sm btn-outline-secondary">
                  Abrir Kanban
                </Link>
              </div>
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
                            onClick={() => setPrazoForm({ item: t })}
                            title="Editar este prazo"
                          >
                            <td className="fw-medium text-dark">{t.titulo}</td>
                            <td>
                              <PrioridadeBadge prioridade={t.prioridade} mostrarNormal />
                            </td>
                            <td>
                              <StatusBadge tipo="tarefa" valor={t.status} />
                            </td>
                            <td className="cd-num">
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
                                  aria-label="Marcar como cumprida"
                                  onClick={() => handleConcluirTarefa(t)}
                                  style={{ width: 28, height: 28 }}
                                >
                                  <CheckCircleIcon style={{ width: 14, height: 14 }} />
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary p-1 lh-1 me-1"
                                title="Editar prazo"
                                aria-label="Editar prazo"
                                onClick={() => setPrazoForm({ item: t })}
                                style={{ width: 28, height: 28 }}
                              >
                                <PencilSquareIcon style={{ width: 14, height: 14 }} />
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger p-1 lh-1"
                                title="Excluir prazo"
                                aria-label="Excluir prazo"
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
                <div className="cd-vazio">
                  <p className="mb-0">Nenhum prazo vinculado a este caso.</p>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => setPrazoForm({})}
                  >
                    Registrar prazo ou tarefa
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB HISTÓRICO: timeline + publicações DJEN + documentos ─────── */}
      {tabAtiva === 'historico' && (
        <div role="tabpanel" data-testid="painel-historico" className="cd-tab-panel">
          <div className="card mb-4">
            <div className="card-header bg-light py-3">
              <h5 className="card-title mb-0">Linha do tempo</h5>
              <small className="text-muted">
                Publicações DJEN, documentos e prazos em ordem cronológica
              </small>
            </div>
            <div className="card-body p-4">
              <CasoTimeline key={`${casoId}-${timelineRefreshNonce}`} casoId={casoId} />
            </div>
          </div>
          <div className="card mb-4">
            <div className="card-header bg-light py-3 d-flex justify-content-between align-items-center">
              <h5 className="card-title mb-0">Publicações DJEN ({publicacoesDjen.length})</h5>
              {caso.numero_processo && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={handleAtualizarViaDJEN}
                  disabled={isLoadingAtualizacaoCNJ || isLoadingCaso}
                >
                  {isLoadingAtualizacaoCNJ ? 'Verificando DJEN...' : 'Verificar publicações'}
                </button>
              )}
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
                      <p className="fw-medium text-dark small mb-1 cd-num">
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
                <div className="cd-vazio">
                  <p className="mb-0">Nenhuma publicação do DJEN registrada para este processo.</p>
                  {caso.numero_processo ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={handleAtualizarViaDJEN}
                      disabled={isLoadingAtualizacaoCNJ}
                    >
                      Verificar publicações no DJEN
                    </button>
                  ) : (
                    <Link
                      to={`/casos/editar/${caso.id}`}
                      className="btn btn-sm btn-outline-primary"
                    >
                      Cadastrar nº do processo
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
          {/* Documentos completos moram aqui (no Resumo só o contador) */}
          <div className="card mb-4" id="documentos">
            <div className="card-body p-4 pt-2">
              <DocumentosCasoTab casoId={casoId} />
            </div>
          </div>
          <DocumentosVinculadosCard casoId={casoId} />
        </div>
      )}

      {/* ── Aba Financeiro (Fase 3 — caso como hub) ─────────────────────── */}
      {tabAtiva === 'financeiro' && (
        <div data-testid="conteudo-financeiro" className="cd-tab-panel">
          <HonorariosCasoCard key={`hon-${finNonce}`} casoId={casoId} clienteId={caso.cliente_id} />
          <RecebimentosCasoCard key={`rec-${finNonce}`} casoId={casoId} />
        </div>
      )}

      {ConfirmDialog}

      {/* Fase 3 — contrato nasce dentro do caso (caso travado) */}
      {contratoNovo && (
        <ContratoFormModal
          casoFixo={{
            ...casoFixo,
            cliente_id: caso?.cliente_id,
            cliente_nome: caso?.cliente_nome,
          }}
          onCancel={() => setContratoNovo(false)}
          onSalvo={() => {
            setContratoNovo(false)
            setFinNonce((n) => n + 1)
            setTabAtiva('financeiro')
          }}
        />
      )}

      {/* Form de prazo no contexto do caso — caso travado, sem ir ao Kanban */}
      {prazoForm && (
        <ItemAgendaForm
          itemParaEditar={prazoForm.item || null}
          defaultTipo={prazoForm.tipo || 'tarefa'}
          casoFixo={casoFixo}
          onCancel={() => setPrazoForm(null)}
          onSalvo={() => {
            setPrazoForm(null)
            recarregarPrazos()
            setTimelineRefreshNonce((n) => n + 1)
          }}
        />
      )}

      {/* Stitch — "Gerar peça" / "Vincular peça": fluxo existente de tratar prazo
          (Responder com peça + minuta IA + petição cumpridora) */}
      {itemParaTratar && (
        <TratarPrazoModal
          item={itemParaTratar}
          onClose={() => setItemParaTratar(null)}
          onTratado={() => {
            setItemParaTratar(null)
            recarregarPrazos()
            setTimelineRefreshNonce((n) => n + 1)
          }}
          onEditarDados={(it) => {
            setItemParaTratar(null)
            setPrazoForm({ item: it || itemParaTratar })
          }}
        />
      )}
    </div>
  )
}

export default CasoDetalhePage
