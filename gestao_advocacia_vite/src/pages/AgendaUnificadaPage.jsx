// src/pages/AgendaUnificadaPage.jsx
// Agenda unificada — consome /v1/itens-agenda como fonte unica (tarefas +
// eventos) e oferece 4 visoes na MESMA rota (?view=):
//
//   hoje        → fila do dia por hora (VisaoHoje)
//   calendario  → mes (CalendarView) + painel do dia (PainelDoDia)
//   kanban      → board drag-drop (PrazosPage embutido, estado proprio)
//   lista       → tabela unificada
//
// Redesign Stitch (set/2026): a casca mudou (toggle segmentado, cabecalho
// do mes com chips, painel lateral, pilulas no calendario); a logica,
// endpoints, drag-and-drop do Kanban e o TratarPrazoModal continuam os
// mesmos. Estilos em AgendaUnificadaPage.css (tokens de index.css).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'react-toastify'
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline'
import ItemAgendaForm from '../components/ItemAgendaForm.jsx'
import AgendaViewToggle from '../components/AgendaViewToggle.jsx'
import TratarPrazoModal from '../components/TratarPrazoModal.jsx'
import CalendarView from '../components/CalendarView.jsx'
import CabecalhoMes from '../components/agenda/CabecalhoMes.jsx'
import PainelDoDia from '../components/agenda/PainelDoDia.jsx'
import VisaoHoje from '../components/agenda/VisaoHoje.jsx'
import {
  CHIPS,
  VIEW_KEYS,
  hojeYmd,
  ymdDoItem,
  urgenciaDoItem,
  ehAudiencia,
  filtrarPorChip,
  itensDoDia,
  contarMes,
  tituloMes,
} from '../components/agenda/agendaHelpers.js'
import PrazosPage from './PrazosPage.jsx'
import {
  listItensAgenda,
  deleteItemAgenda,
  concluirItemAgenda,
  updateItemAgenda,
} from '../api/itensAgenda.js'
import { listCasos } from '../api/casos.js'
import { getProvidencia } from '../utils/providencia.js'
import { useConfirm } from '../hooks/useConfirm.jsx'
import './AgendaUnificadaPage.css'

function formatDataBR(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: iso.includes('T') ? '2-digit' : undefined,
      minute: iso.includes('T') ? '2-digit' : undefined,
    })
  } catch {
    return iso
  }
}

const BADGE_STATUS = {
  Pendente: 'bg-secondary',
  'Em Andamento': 'bg-info text-dark',
  Concluido: 'bg-success',
  Cancelado: 'bg-dark',
}

// Classe do evento no FullCalendar por urgencia (+ marcador de audiencia).
function classesDoEvento(item, hoje) {
  const urg = urgenciaDoItem(item, hoje)
  const classes = [
    `ag-ev--${urg === 'cancelado' ? 'concluido' : urg === 'semana' ? 'normal' : urg}`,
  ]
  if (ehAudiencia(item)) classes.push('ag-ev--audiencia')
  return classes
}

function AgendaUnificadaPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [itens, setItens] = useState([])
  const [casos, setCasos] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  // Visao vem da URL (?view=hoje|calendario|kanban|lista). Fallback pra
  // preferencia salva, depois 'calendario'.
  const viewParam = searchParams.get('view')
  const salva = localStorage.getItem('agenda_unificada_view')
  const viewMode = VIEW_KEYS.includes(viewParam)
    ? viewParam
    : VIEW_KEYS.includes(salva)
      ? salva
      : 'calendario'
  const isKanban = viewMode === 'kanban'
  // Fase 3 (caso como hub): /agenda?caso=ID mostra só a agenda do caso.
  const casoFiltro = searchParams.get('caso')
  const [chip, setChip] = useState('todos') // todos | prazos | audiencias | tarefas
  const [filtroStatus, setFiltroStatus] = useState('ativos') // ativos | todos | pendentes | concluidos
  const [modalAberto, setModalAberto] = useState(false)
  const [itemEditar, setItemEditar] = useState(null)
  // Issue #304 — clique em TAREFA/PRAZO abre o tratamento (não o editor):
  // ver vencimento, providência, responder com peça, marcar cumprido.
  const [itemTratar, setItemTratar] = useState(null)
  const { confirm, ConfirmDialog } = useConfirm()
  const hoje = hojeYmd()
  const [diaSelecionado, setDiaSelecionado] = useState(hoje)
  const [mesVisivel, setMesVisivel] = useState(() => new Date())
  const calendarRef = useRef(null)

  // Issue #301 — ?novo=evento|tarefa abre o modal de criação direto.
  // Usado pelo QuickAdd do header (substitui a rota legada /agenda/novo).
  const [novoTipoUrl, setNovoTipoUrl] = useState(null)
  useEffect(() => {
    const novo = searchParams.get('novo')
    if (novo === 'evento' || novo === 'tarefa') {
      setNovoTipoUrl(novo)
      setItemEditar(null)
      setModalAberto(true)
      const params = new URLSearchParams(searchParams)
      params.delete('novo') // remove da URL pra não reabrir em refresh
      setSearchParams(params, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // Fetch unificado (itens + casos pra resolver cliente × parte / nº CNJ)
  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (casoFiltro) params.caso_id = casoFiltro
      if (filtroStatus === 'pendentes') params.status = 'Pendente'
      if (filtroStatus === 'concluidos') params.status = 'Concluido'
      const [data, listaCasos] = await Promise.all([
        listItensAgenda(params),
        listCasos().catch((err) => {
          console.warn('AgendaUnificadaPage: erro ao carregar casos', err)
          return []
        }),
      ])
      let lista = Array.isArray(data) ? data : []
      // 'ativos' = nao Concluido nem Cancelado (default, esconde ruido)
      if (filtroStatus === 'ativos') {
        lista = lista.filter((i) => i.status !== 'Concluido' && i.status !== 'Cancelado')
      }
      setItens(lista)
      setCasos(Array.isArray(listaCasos) ? listaCasos : [])
    } catch (err) {
      console.error('AgendaUnificadaPage: erro ao carregar itens', err)
      toast.error(err?.message || 'Não foi possível carregar a agenda. Recarregue a página.')
    } finally {
      setLoading(false)
    }
  }, [filtroStatus, casoFiltro])

  useEffect(() => {
    // No Kanban o board carrega seus próprios dados; evita fetch redundante.
    if (isKanban) {
      setLoading(false)
      return
    }
    carregar()
  }, [carregar, refreshKey, isKanban])

  const handleViewChange = (mode) => {
    localStorage.setItem('agenda_unificada_view', mode)
    const params = new URLSearchParams(searchParams)
    params.set('view', mode)
    setSearchParams(params, { replace: true })
  }

  const handleAdicionarClick = () => {
    setItemEditar(null)
    setModalAberto(true)
  }

  // Painel do dia vazio → "Novo item neste dia": o form nasce com a data
  // preenchida (sem id = criação; ItemAgendaForm hidrata pelos campos).
  const handleNovoNoDia = (ymd) => {
    setItemEditar({ tipo: 'tarefa', data_vencimento: ymd, data_inicio: `${ymd}T09:00` })
    setModalAberto(true)
  }

  const handleEditarClick = (item) => {
    setItemEditar(item)
    setModalAberto(true)
  }

  // Issue #304 — roteia o clique: tarefa (prazo) → modal de tratamento;
  // evento (compromisso) → editor direto, como antes.
  const handleItemClick = (item) => {
    if (item.tipo === 'tarefa') {
      setItemTratar(item)
    } else {
      handleEditarClick(item)
    }
  }

  const handleExcluir = async (item) => {
    const ok = await confirm(
      `Excluir "${item.titulo}"? Esta ação não pode ser desfeita.`,
      'Excluir item'
    )
    if (!ok) return
    try {
      await deleteItemAgenda(item.id)
      toast.success('Item excluído.')
      setRefreshKey((k) => k + 1)
    } catch (err) {
      console.error('AgendaUnificadaPage: erro ao excluir', err)
      toast.error(err?.message || 'Não foi possível excluir o item. Tente de novo.')
    }
  }

  // "Concluir" do painel/fila — mesmo endpoint do Kanban pra tarefa;
  // evento não tem /concluir, vai por PUT de status.
  const handleConcluir = async (item) => {
    try {
      if (item.tipo === 'tarefa') {
        await concluirItemAgenda(item.id)
      } else {
        await updateItemAgenda(item.id, { status: 'Concluido' })
      }
      toast.success('Concluído.')
      setRefreshKey((k) => k + 1)
    } catch (err) {
      console.error('AgendaUnificadaPage: erro ao concluir', err)
      toast.error(err?.message || 'Não foi possível concluir o item. Tente de novo.')
    }
  }

  const handleFormSalvo = () => {
    setModalAberto(false)
    setItemEditar(null)
    setNovoTipoUrl(null)
    setRefreshKey((k) => k + 1)
  }

  // ── Derivados ────────────────────────────────────────────────────────
  const itensFiltrados = useMemo(() => filtrarPorChip(itens, chip), [itens, chip])

  const eventosFullCalendar = useMemo(
    () =>
      itensFiltrados
        .filter((i) => ymdDoItem(i))
        .map((item) => {
          const start = item.data_inicio || item.data_vencimento
          return {
            id: String(item.id),
            title: item.titulo,
            start,
            end: item.data_fim || undefined,
            allDay: !String(start).includes('T'),
            extendedProps: { item },
            classNames: classesDoEvento(item, hoje),
          }
        }),
    [itensFiltrados, hoje]
  )

  const itensDoDiaSelecionado = useMemo(
    () => itensDoDia(itensFiltrados, diaSelecionado),
    [itensFiltrados, diaSelecionado]
  )

  const contagemMes = useMemo(
    () => contarMes(itens, mesVisivel.getFullYear(), mesVisivel.getMonth() + 1),
    [itens, mesVisivel]
  )

  const calApi = () => calendarRef.current?.getApi?.()
  const irMesAnterior = () => calApi()?.prev()
  const irMesProximo = () => calApi()?.next()
  const irHoje = () => {
    calApi()?.today()
    setDiaSelecionado(hoje)
  }

  const agendaVazia = !isKanban && !loading && itens.length === 0 && filtroStatus === 'ativos'

  const acoesCard = {
    onAbrir: handleItemClick,
    onResponder: (item) => setItemTratar(item),
    onConcluir: handleConcluir,
  }

  return (
    <div className="ag-page">
      <div className="ag-header">
        <div>
          <h1>Agenda</h1>
          <p className="ag-header-sub">Prazos, audiências e tarefas</p>
        </div>
        <div className="ag-header-acoes">
          <AgendaViewToggle current={viewMode} onLocalChange={handleViewChange} />
          {/* No Kanban, a criação fica no botão "Novo Prazo" próprio (que refresca
              o estado do board). No estado vazio o primário desce pro card. */}
          {!isKanban && !agendaVazia && (
            <button type="button" className="ag-primary" onClick={handleAdicionarClick}>
              <PlusIcon aria-hidden="true" />
              Novo item
            </button>
          )}
        </div>
      </div>

      {casoFiltro && (
        <div className="mb-3">
          <span className="ag-chip-caso" data-testid="chip-filtro-caso">
            Agenda do caso #{casoFiltro}
            <button
              type="button"
              className="btn-close"
              style={{ fontSize: '0.6rem' }}
              aria-label="Limpar filtro de caso"
              onClick={() => {
                const params = new URLSearchParams(searchParams)
                params.delete('caso')
                setSearchParams(params, { replace: true })
              }}
            />
          </span>
        </div>
      )}

      {isKanban ? (
        // Kanban embutido — board drag-drop com estado próprio (não usa o
        // fetch/loading desta página). Colunas A Fazer/Em Andamento/Concluído
        // são persistidas pelo backend (/itens-agenda/reorder) — mantidas.
        <div className="ag-kanban">
          <PrazosPage embedded />
        </div>
      ) : loading ? (
        <div className="ag-loading">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Carregando agenda...</span>
          </div>
          <span>Carregando itens da agenda...</span>
        </div>
      ) : agendaVazia ? (
        <div className="ag-vazio" data-testid="agenda-vazia">
          <div className="ag-vazio-icone">
            <CalendarDaysIcon aria-hidden="true" />
          </div>
          <h2 className="ag-vazio-titulo">Sua agenda está vazia.</h2>
          <p className="ag-vazio-texto">
            Prazos criados a partir das intimações aparecem aqui automaticamente.
          </p>
          <button type="button" className="ag-primary" onClick={handleAdicionarClick}>
            <PlusIcon aria-hidden="true" />
            Novo item
          </button>
        </div>
      ) : viewMode === 'hoje' ? (
        <VisaoHoje
          itens={itens}
          casos={casos}
          hoje={hoje}
          onVerCalendario={() => handleViewChange('calendario')}
          {...acoesCard}
        />
      ) : viewMode === 'calendario' ? (
        <>
          <CabecalhoMes
            titulo={tituloMes(mesVisivel)}
            contagem={contagemMes}
            chip={chip}
            onChip={setChip}
            onAnterior={irMesAnterior}
            onProximo={irMesProximo}
            onHoje={irHoje}
          />
          <div className="ag-cal-layout">
            <CalendarView
              calendarRef={calendarRef}
              eventos={eventosFullCalendar}
              diaSelecionado={diaSelecionado}
              onDiaClick={setDiaSelecionado}
              onEventoClick={handleItemClick}
              onMesChange={setMesVisivel}
            />
            <PainelDoDia
              dataYmd={diaSelecionado}
              itens={itensDoDiaSelecionado}
              casos={casos}
              hoje={hoje}
              onNovoNoDia={handleNovoNoDia}
              {...acoesCard}
            />
          </div>
        </>
      ) : (
        <>
          <div className="ag-lista-toolbar">
            <div className="ag-chips" role="group" aria-label="Filtrar por tipo">
              {CHIPS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className={`ag-chip${chip === c.key ? ' is-active' : ''}`}
                  aria-pressed={chip === c.key}
                  onClick={() => setChip(c.key)}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <select
              className="form-select form-select-sm ms-2"
              style={{ width: 'auto' }}
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              aria-label="Filtrar por status"
            >
              <option value="ativos">Ativos</option>
              <option value="pendentes">Só pendentes</option>
              <option value="concluidos">Só concluídos</option>
              <option value="todos">Todos</option>
            </select>
          </div>
          <ListaItens
            itens={itensFiltrados}
            onAbrir={handleItemClick}
            onEditar={handleEditarClick}
            onExcluir={handleExcluir}
            onLimparFiltros={() => {
              setChip('todos')
              setFiltroStatus('ativos')
            }}
          />
        </>
      )}

      {modalAberto && (
        <ItemAgendaForm
          itemParaEditar={itemEditar}
          onSalvo={handleFormSalvo}
          onCancel={() => {
            setModalAberto(false)
            setItemEditar(null)
            setNovoTipoUrl(null)
          }}
          defaultTipo={novoTipoUrl || (chip === 'audiencias' ? 'evento' : 'tarefa')}
        />
      )}

      {ConfirmDialog}

      {/* Issue #304 — tratamento do prazo (cumprir, cancelar, responder com peça) */}
      {itemTratar && (
        <TratarPrazoModal
          item={itemTratar}
          onTratado={() => {
            setItemTratar(null)
            setRefreshKey((k) => k + 1)
          }}
          onClose={() => setItemTratar(null)}
          onEditarDados={(it) => {
            setItemTratar(null)
            handleEditarClick(it)
          }}
        />
      )}
    </div>
  )
}

// Tabela inline — separada pra reduzir tamanho do componente principal
// e facilitar leitura. Nao virou arquivo separado porque so faz sentido
// no contexto da AgendaUnificadaPage.
function ListaItens({ itens, onAbrir, onEditar, onExcluir, onLimparFiltros }) {
  if (itens.length === 0) {
    return (
      <div className="ag-vazio" data-testid="lista-vazia">
        <p className="ag-vazio-titulo">Nenhum item com esses filtros.</p>
        <p className="ag-vazio-texto">Troque o tipo ou o status para ver mais itens.</p>
        <button
          type="button"
          className="btn btn-outline-primary btn-sm rounded-pill px-3"
          onClick={onLimparFiltros}
        >
          Limpar filtros
        </button>
      </div>
    )
  }
  return (
    <div className="ag-lista">
      <div className="table-responsive">
        <table className="table table-hover mb-0 align-middle">
          <thead>
            <tr>
              <th>Título</th>
              <th>Tipo</th>
              <th>Categoria</th>
              <th>Quando</th>
              <th>Status</th>
              <th>Prioridade</th>
              <th style={{ width: '80px' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => {
              const prov = item.tipo === 'tarefa' ? getProvidencia(item.tipo_providencia) : null
              return (
                <tr key={item.id}>
                  <td className="fw-medium">
                    {/* Issue #304 — título clicável: tarefa abre tratamento */}
                    <button
                      type="button"
                      className="btn btn-link p-0 text-start fw-medium text-decoration-none"
                      onClick={() => onAbrir(item)}
                      title={item.tipo === 'tarefa' ? 'Tratar prazo' : 'Editar evento'}
                    >
                      {item.titulo}
                    </button>
                    {prov && (
                      <span
                        className={`ag-badge ms-2 ${prov.cor === 'danger' ? 'ag-badge-danger' : prov.cor === 'warning' ? 'ag-badge-warning' : 'ag-badge-muted'}`}
                        title={prov.descricao}
                      >
                        {prov.label}
                      </span>
                    )}
                  </td>
                  <td>
                    <span
                      className={`ag-badge ${item.tipo === 'evento' ? 'ag-badge-audiencia' : 'ag-badge-warning'}`}
                    >
                      {item.tipo === 'evento' ? 'Evento' : 'Prazo'}
                    </span>
                  </td>
                  <td>
                    <small className="text-muted">{item.categoria || '—'}</small>
                  </td>
                  <td>
                    <small className="tabular">
                      {formatDataBR(item.data_inicio || item.data_vencimento)}
                    </small>
                  </td>
                  <td>
                    <span className={`badge ${BADGE_STATUS[item.status] || 'bg-secondary'}`}>
                      {item.status}
                    </span>
                  </td>
                  <td>
                    <small>{item.prioridade}</small>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary me-1 p-1 lh-1"
                      onClick={() => onEditar(item)}
                      title="Editar"
                      aria-label={`Editar ${item.titulo}`}
                      style={{ width: 28, height: 28 }}
                    >
                      <PencilSquareIcon style={{ width: 14, height: 14 }} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger p-1 lh-1"
                      onClick={() => onExcluir(item)}
                      title="Excluir"
                      aria-label={`Excluir ${item.titulo}`}
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
    </div>
  )
}

export default AgendaUnificadaPage
