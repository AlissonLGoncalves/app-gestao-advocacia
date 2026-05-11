import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { API_URL } from '../config.js'
import { toast } from 'react-toastify'
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragOverlay,
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  agruparPorColuna,
  calcularReorder,
  aplicarReorderEmTarefas,
} from '../utils/kanbanReorder.js'
import PrioridadeBadge from '../components/ui/PrioridadeBadge.jsx'
import SlaBar from '../components/ui/SlaBar.jsx'
import {
  PlusIcon,
  ClockIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  BriefcaseIcon,
  PencilSquareIcon,
  ExclamationTriangleIcon,
  ListBulletIcon,
  ViewColumnsIcon,
  UserIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'

// ── Constantes do Kanban ─────────────────────────────────────────────────────

const COLUNAS = [
  { id: 'A Fazer', titulo: 'A Fazer', cor: 'danger' },
  { id: 'Fazendo', titulo: 'Em Andamento', cor: 'warning' },
  { id: 'Concluído', titulo: 'Concluído', cor: 'success' },
]
const COLUNAS_IDS = COLUNAS.map((c) => c.id)

// ── Helpers de data ──────────────────────────────────────────────────────────

const dateStr = (offsetDays = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const hojeLocal = () => dateStr(0)

// Backend pode retornar data_vencimento como "YYYY-MM-DD" (modelo to_dict)
// ou ISO completo "YYYY-MM-DDTHH:MM:SS" (DTO flask-restx). Normaliza para
// "YYYY-MM-DD" para todas as comparacoes/parsing seguros.
const dataYmd = (raw) => {
  if (!raw) return null
  const s = String(raw).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

const isOverdue = (t) => {
  const d = dataYmd(t.data_vencimento)
  return !!(d && t.status !== 'Concluído' && d < hojeLocal())
}

const diasVencido = (t) => {
  const d = dataYmd(t.data_vencimento)
  if (!d) return 0
  const [ay, am, ad] = hojeLocal().split('-').map(Number)
  const [by, bm, bd] = d.split('-').map(Number)
  return Math.floor((new Date(ay, am - 1, ad) - new Date(by, bm - 1, bd)) / 86400000)
}

const diasAteVencimento = (t) => {
  const d = dataYmd(t.data_vencimento)
  if (!d) return null
  const [ay, am, ad] = hojeLocal().split('-').map(Number)
  const [by, bm, bd] = d.split('-').map(Number)
  return Math.floor((new Date(by, bm - 1, bd) - new Date(ay, am - 1, ad)) / 86400000)
}

const formatarDataBR = (raw) => {
  const d = dataYmd(raw)
  if (!d) return null
  const [y, m, day] = d.split('-').map(Number)
  const dt = new Date(y, m - 1, day)
  return Number.isNaN(dt.getTime()) ? null : dt.toLocaleDateString('pt-BR')
}

const TAREFA_VAZIA = {
  titulo: '',
  descricao: '',
  status: 'A Fazer',
  prioridade: 'Normal',
  tipo_tarefa: 'Prazo',
  data_vencimento: '',
  caso_id: '',
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function PrazosPage() {
  const [tarefas, setTarefas] = useState([])
  const [loading, setLoading] = useState(true)
  const [casos, setCasos] = useState([])
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('prazos_view') || 'kanban')

  const [showModal, setShowModal] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [novaTarefa, setNovaTarefa] = useState(TAREFA_VAZIA)

  const [draggingId, setDraggingId] = useState(null)

  const carregarTarefas = useCallback(async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/tarefas`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setTarefas(await res.json())
      else toast.error('Erro ao carregar prazos.')
    } catch {
      toast.error('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }, [])

  const carregarCasos = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/casos`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setCasos(await res.json())
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    carregarTarefas()
    carregarCasos()
  }, [carregarTarefas, carregarCasos])

  const handleViewChange = (mode) => {
    setViewMode(mode)
    localStorage.setItem('prazos_view', mode)
  }

  const handleFecharModal = () => {
    setShowModal(false)
    setEditandoId(null)
    setNovaTarefa(TAREFA_VAZIA)
  }

  const handleEditarTarefa = (t) => {
    setNovaTarefa({
      titulo: t.titulo || '',
      descricao: t.descricao || '',
      status: t.status || 'A Fazer',
      prioridade: t.prioridade || 'Normal',
      tipo_tarefa: t.tipo_tarefa || 'Prazo',
      data_vencimento: t.data_vencimento || '',
      caso_id: t.caso_id || '',
    })
    setEditandoId(t.id)
    setShowModal(true)
  }

  const handleSalvarTarefa = async (e) => {
    e.preventDefault()
    try {
      const token = localStorage.getItem('token')
      const payload = { ...novaTarefa }
      if (!payload.caso_id) delete payload.caso_id

      const isEditing = editandoId !== null
      const url = isEditing ? `${API_URL}/tarefas/${editandoId}` : `${API_URL}/tarefas`
      const res = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        toast.success(isEditing ? 'Prazo atualizado!' : 'Prazo criado com sucesso!')
        handleFecharModal()
        carregarTarefas()
      } else {
        const err = await res.json()
        toast.error(err.message || 'Erro ao salvar.')
      }
    } catch {
      toast.error('Erro na comunicação com servidor.')
    }
  }

  // Feature Kanban<>DJEN: confirma prazo gerado pela IA. Remove o badge
  // "IA - confirmar" do card e marca prazo_validado=true no backend.
  const handleConfirmarPrazo = async (tarefa) => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/tarefas/${tarefa.id}/validar-prazo`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (res.ok) {
        toast.success('Prazo confirmado.')
        carregarTarefas()
      } else {
        toast.error('Falha ao confirmar prazo.')
      }
    } catch {
      toast.error('Erro na comunicação com servidor.')
    }
  }

  // Atalho "ja cumpri / nao era prazo": move pra Concluido com 1 clique.
  const handleConcluirTarefa = async (tarefa) => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/tarefas/${tarefa.id}/concluir`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      })
      if (res.ok) {
        toast.success('Tarefa marcada como cumprida.')
        carregarTarefas()
      } else {
        toast.error('Falha ao concluir tarefa.')
      }
    } catch {
      toast.error('Erro na comunicação com servidor.')
    }
  }

  // Toggle "Concluir" da vista lista — usa PUT simples; posicao é preservada.
  const handleMoverTarefa = async (id, novoStatus) => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/tarefas/${id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: novoStatus }),
      })
      if (res.ok) carregarTarefas()
    } catch {
      toast.error('Falha ao atualizar tarefa.')
    }
  }

  // ── Drag & Drop (kanban) ─────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const grupos = useMemo(() => agruparPorColuna(tarefas, COLUNAS_IDS), [tarefas])

  const enviarReorder = useCallback(async (columnsPayload, snapshotAnterior) => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/tarefas/reorder`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ columns: columnsPayload }),
      })
      if (!res.ok) throw new Error(`reorder ${res.status}`)
    } catch {
      toast.error('Não foi possível salvar a nova ordem.')
      setTarefas(snapshotAnterior)
    }
  }, [])

  const handleDragEnd = useCallback(
    ({ active, over }) => {
      setDraggingId(null)
      if (!over) return

      const resultado = calcularReorder({
        grupos,
        colunasIds: COLUNAS_IDS,
        activeId: active.id,
        overId: over.id,
        tarefas,
      })
      if (!resultado) return

      const snapshotAnterior = tarefas
      setTarefas(aplicarReorderEmTarefas(tarefas, resultado.novosGrupos, COLUNAS_IDS))
      enviarReorder(resultado.payload, snapshotAnterior)
    },
    [grupos, tarefas, enviarReorder]
  )

  // ── Vista Lista ───────────────────────────────────────────────────────────

  const renderLista = () => {
    const hoje = hojeLocal()
    const amanha = dateStr(1)
    const semana = dateStr(7)

    const grupos = [
      {
        label: 'Vencidos',
        cor: '#dc3545',
        bg: '#fff5f5',
        items: tarefas
          .filter((t) => t.status !== 'Concluído' && t.data_vencimento && t.data_vencimento < hoje)
          .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento)),
      },
      {
        label: 'Hoje',
        cor: '#f59e0b',
        bg: '#fffbeb',
        items: tarefas.filter((t) => t.status !== 'Concluído' && t.data_vencimento === hoje),
      },
      {
        label: 'Amanhã',
        cor: '#d97706',
        bg: '#fffbeb',
        items: tarefas.filter((t) => t.status !== 'Concluído' && t.data_vencimento === amanha),
      },
      {
        label: 'Esta semana',
        cor: '#2563eb',
        bg: '#eff6ff',
        items: tarefas
          .filter(
            (t) =>
              t.status !== 'Concluído' &&
              t.data_vencimento &&
              t.data_vencimento > amanha &&
              t.data_vencimento <= semana
          )
          .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento)),
      },
      {
        label: 'Próximos',
        cor: '#16a34a',
        bg: '#f0fdf4',
        items: tarefas
          .filter(
            (t) => t.status !== 'Concluído' && t.data_vencimento && t.data_vencimento > semana
          )
          .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento)),
      },
      {
        label: 'Sem prazo',
        cor: '#6b7280',
        bg: '#f9fafb',
        items: tarefas.filter((t) => t.status !== 'Concluído' && !t.data_vencimento),
      },
      {
        label: 'Concluídos',
        cor: '#9ca3af',
        bg: '#f9fafb',
        items: tarefas.filter((t) => t.status === 'Concluído'),
        collapsed: true,
      },
    ]

    return (
      <div className="d-flex flex-column gap-3">
        {grupos.map((grupo) => {
          if (grupo.items.length === 0) return null
          return (
            <GrupoLista
              key={grupo.label}
              grupo={grupo}
              casos={casos}
              onEditar={handleEditarTarefa}
              onConcluir={(t) =>
                handleMoverTarefa(t.id, t.status === 'Concluído' ? 'A Fazer' : 'Concluído')
              }
            />
          )
        })}
      </div>
    )
  }

  // ── Render principal ─────────────────────────────────────────────────────

  const tarefaArrastada = draggingId != null ? tarefas.find((t) => t.id === draggingId) : null

  return (
    <div
      className="container-fluid py-4"
      style={{ backgroundColor: 'var(--bg-main)', minHeight: '100%' }}
    >
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="mb-0 fw-bold mx-2" style={{ fontFamily: 'var(--font-heading)' }}>
            {viewMode === 'kanban' ? 'Kanban de Prazos' : 'Prazos por Data'}
          </h4>
          <p className="text-muted small mb-0 mx-2">
            {viewMode === 'kanban'
              ? 'Arraste cards entre colunas ou reordene dentro da mesma coluna.'
              : 'Visualize prazos agrupados por urgência.'}
          </p>
        </div>
        <div className="d-flex gap-2">
          <div className="btn-group shadow-sm" role="group">
            <button
              type="button"
              className={`btn btn-sm ${viewMode === 'kanban' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => handleViewChange('kanban')}
            >
              <ViewColumnsIcon
                style={{
                  width: 15,
                  height: 15,
                  display: 'inline',
                  marginRight: 4,
                  marginBottom: 2,
                }}
              />
              Kanban
            </button>
            <button
              type="button"
              className={`btn btn-sm ${viewMode === 'lista' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => handleViewChange('lista')}
            >
              <ListBulletIcon
                style={{
                  width: 15,
                  height: 15,
                  display: 'inline',
                  marginRight: 4,
                  marginBottom: 2,
                }}
              />
              Lista
            </button>
          </div>
          <button
            className="btn btn-primary shadow-sm rounded-pill px-4"
            onClick={() => setShowModal(true)}
          >
            <PlusIcon style={{ width: 18, marginRight: 5 }} className="mb-1" />
            Novo Prazo
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <span className="spinner-border text-primary" />
        </div>
      ) : viewMode === 'kanban' ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={({ active }) => setDraggingId(active.id)}
          onDragCancel={() => setDraggingId(null)}
          onDragEnd={handleDragEnd}
        >
          <div className="row g-4">
            {COLUNAS.map((coluna) => (
              <KanbanColuna
                key={coluna.id}
                coluna={coluna}
                ids={grupos[coluna.id]}
                tarefas={tarefas}
                casos={casos}
                onEditar={handleEditarTarefa}
                onConfirmarPrazo={handleConfirmarPrazo}
                onConcluir={handleConcluirTarefa}
              />
            ))}
          </div>
          <DragOverlay>
            {tarefaArrastada ? (
              <KanbanCardVisual tarefa={tarefaArrastada} casos={casos} arrastando />
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        renderLista()
      )}

      {/* ── Modal Criar / Editar ─────────────────────────────────────────── */}
      {showModal && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          tabIndex="-1"
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow-lg border-0">
              <form onSubmit={handleSalvarTarefa}>
                <div className="modal-header border-bottom-0 pb-0">
                  <h5 className="modal-title fw-bold">
                    {editandoId ? 'Editar Prazo / Tarefa' : 'Nova Tarefa / Prazo'}
                  </h5>
                  <button type="button" className="btn-close" onClick={handleFecharModal} />
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Título</label>
                    <input
                      required
                      type="text"
                      className="form-control"
                      value={novaTarefa.titulo}
                      onChange={(e) => setNovaTarefa({ ...novaTarefa, titulo: e.target.value })}
                      placeholder="Peticionar resposta..."
                    />
                  </div>
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label small fw-semibold">Data de Vencimento</label>
                      <input
                        type="date"
                        className="form-control"
                        value={novaTarefa.data_vencimento}
                        onChange={(e) =>
                          setNovaTarefa({ ...novaTarefa, data_vencimento: e.target.value })
                        }
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label small fw-semibold">Prioridade</label>
                      <select
                        className="form-select"
                        value={novaTarefa.prioridade}
                        onChange={(e) =>
                          setNovaTarefa({ ...novaTarefa, prioridade: e.target.value })
                        }
                      >
                        <option>Baixa</option>
                        <option>Normal</option>
                        <option>Alta</option>
                        <option>Urgente</option>
                      </select>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">
                      Vincular a um Caso processual
                    </label>
                    <select
                      className="form-select"
                      value={novaTarefa.caso_id}
                      onChange={(e) => setNovaTarefa({ ...novaTarefa, caso_id: e.target.value })}
                    >
                      <option value="">Nenhum</option>
                      {casos.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.titulo} ({c.numero_processo})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label small fw-semibold">Tipo</label>
                      <select
                        className="form-select"
                        value={novaTarefa.tipo_tarefa}
                        onChange={(e) =>
                          setNovaTarefa({ ...novaTarefa, tipo_tarefa: e.target.value })
                        }
                      >
                        <option>Prazo</option>
                        <option>Peticionamento</option>
                        <option>Reunião</option>
                        <option>Intimação (Leitura)</option>
                        <option>Outros</option>
                      </select>
                    </div>
                    {editandoId && (
                      <div className="col-md-6 mb-3">
                        <label className="form-label small fw-semibold">Status</label>
                        <select
                          className="form-select"
                          value={novaTarefa.status}
                          onChange={(e) => setNovaTarefa({ ...novaTarefa, status: e.target.value })}
                        >
                          <option value="A Fazer">A Fazer</option>
                          <option value="Fazendo">Em Andamento</option>
                          <option value="Concluído">Concluído</option>
                        </select>
                      </div>
                    )}
                  </div>
                  <div className="mb-1">
                    <label className="form-label small fw-semibold">Descrição (Opcional)</label>
                    <textarea
                      className="form-control"
                      rows="6"
                      style={{ resize: 'vertical' }}
                      value={novaTarefa.descricao}
                      onChange={(e) => setNovaTarefa({ ...novaTarefa, descricao: e.target.value })}
                    />
                  </div>
                </div>
                <div className="modal-footer border-top-0 pt-0">
                  <button type="button" className="btn btn-light" onClick={handleFecharModal}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary px-4 fw-semibold">
                    {editandoId ? 'Salvar Alterações' : 'Criar Prazo'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-componentes do Kanban (dnd-kit) ──────────────────────────────────────

function KanbanColuna({ coluna, ids, tarefas, casos, onEditar, onConfirmarPrazo, onConcluir }) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.id })
  const cards = ids.map((id) => tarefas.find((t) => t.id === id)).filter(Boolean)

  return (
    <div className="col-md-4 d-flex flex-column" style={{ minHeight: '600px' }}>
      <div
        className="card shadow-sm h-100 border-0 bg-white"
        style={{ borderRadius: 'var(--radius-lg)' }}
      >
        <div
          className="card-header bg-white py-4 d-flex justify-content-between align-items-center border-bottom-0"
          style={{
            borderTopLeftRadius: 'var(--radius-lg)',
            borderTopRightRadius: 'var(--radius-lg)',
          }}
        >
          <h6 className="mb-0 fw-bold" style={{ fontFamily: 'var(--font-heading)' }}>
            {coluna.titulo}
          </h6>
          <span
            className={`badge bg-${coluna.cor}-subtle text-${coluna.cor} rounded-pill px-3 py-2`}
          >
            {cards.length}
          </span>
        </div>
        <div
          ref={setNodeRef}
          className="card-body overflow-auto p-3"
          style={{
            maxHeight: 'calc(100vh - 250px)',
            background: isOver ? 'rgba(13,110,253,0.04)' : 'var(--bg-main)',
            borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
            transition: 'background 0.15s',
          }}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            {cards.map((t) => (
              <KanbanCard
                key={t.id}
                tarefa={t}
                casos={casos}
                onEditar={onEditar}
                onConfirmarPrazo={onConfirmarPrazo}
                onConcluir={onConcluir}
              />
            ))}
          </SortableContext>
          {cards.length === 0 && (
            <div className="text-center py-4 text-muted small border border-dashed rounded bg-white">
              Arraste tarefas para cá
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function KanbanCard({ tarefa, casos, onEditar, onConfirmarPrazo, onConcluir }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tarefa.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <KanbanCardVisual
        tarefa={tarefa}
        casos={casos}
        onEditar={onEditar}
        onConfirmarPrazo={onConfirmarPrazo}
        onConcluir={onConcluir}
      />
    </div>
  )
}

function KanbanCardVisual({ tarefa, casos, onEditar, onConfirmarPrazo, onConcluir, arrastando }) {
  const overdue = isOverdue(tarefa)
  const diasV = overdue ? diasVencido(tarefa) : 0
  const diasRestantes = !overdue ? diasAteVencimento(tarefa) : null
  // Backend ja' serializa cliente_nome e numero_processo no DTO. Fallback
  // pra busca no array local mantem compat com tarefas legadas.
  const casoLocal = casos.find((c) => c.id === tarefa.caso_id)
  const clienteNome =
    tarefa.cliente_nome ||
    (casoLocal && casoLocal.cliente && casoLocal.cliente.nome_razao_social) ||
    (casoLocal && casoLocal.cliente_nome) ||
    null
  const numeroProcesso = tarefa.numero_processo || (casoLocal && casoLocal.numero_processo) || null
  const tituloCaso = casoLocal && casoLocal.titulo
  const dataFmt = formatarDataBR(tarefa.data_vencimento)
  const precisaConfirmarPrazo = !!tarefa.prazo_calculado_por_ia && tarefa.prazo_validado === false

  return (
    <div
      className={`card mb-3 border-0 shadow-sm overflow-hidden ${arrastando ? 'shadow' : ''}`}
      style={{
        cursor: arrastando ? 'grabbing' : 'grab',
        borderRadius: 'var(--radius-md)',
        borderLeft: overdue
          ? '4px solid #dc3545'
          : precisaConfirmarPrazo
            ? '4px solid #f59e0b'
            : '4px solid transparent',
        transform: arrastando ? 'rotate(2deg)' : 'none',
      }}
    >
      <SlaBar
        dataVencimento={tarefa.data_vencimento}
        concluido={tarefa.status === 'Concluído' || tarefa.status === 'Concluido'}
      />
      <div className="card-body p-3">
        <div className="d-flex justify-content-between align-items-start mb-2">
          <div className="d-flex flex-wrap gap-1">
            <PrioridadeBadge prioridade={tarefa.prioridade} mostrarNormal />

            {precisaConfirmarPrazo && (
              <span
                className="badge bg-warning-subtle text-warning d-inline-flex align-items-center gap-1"
                title={
                  tarefa.prazo_dias_origem
                    ? `Prazo de ${tarefa.prazo_dias_origem} dias calculado pela IA — revise e confirme`
                    : 'Prazo calculado pela IA — revise e confirme'
                }
              >
                <SparklesIcon style={{ width: 11, height: 11 }} />
                IA — confirmar
              </span>
            )}
          </div>
          {onEditar && (
            <button
              className="btn btn-link btn-sm p-0 text-muted"
              title="Editar"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                onEditar(tarefa)
              }}
              style={{ lineHeight: 1 }}
            >
              <PencilSquareIcon style={{ width: 14, height: 14 }} />
            </button>
          )}
        </div>

        <h6
          className="card-title fw-bold text-dark mb-2"
          style={{ fontFamily: 'var(--font-heading)', fontSize: '0.9rem' }}
        >
          {tarefa.titulo}
        </h6>

        {clienteNome && (
          <div
            className="d-flex align-items-center mb-1 text-truncate"
            style={{ fontSize: '0.75rem' }}
            title={`Cliente: ${clienteNome}`}
          >
            <UserIcon
              style={{ width: 12, height: 12, flexShrink: 0, marginRight: 4 }}
              className="text-muted"
            />
            <span className="text-dark fw-semibold text-truncate">{clienteNome}</span>
          </div>
        )}

        {(casoLocal || numeroProcesso) && (
          <Link
            to={`/casos/detalhe/${casoLocal ? casoLocal.id : tarefa.caso_id}`}
            className="d-flex align-items-center text-decoration-none mb-1 text-truncate"
            style={{ fontSize: '0.72rem', color: 'var(--bs-primary)' }}
            title={
              tituloCaso
                ? `${tituloCaso}${numeroProcesso ? ` (${numeroProcesso})` : ''}`
                : numeroProcesso || ''
            }
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <BriefcaseIcon style={{ width: 12, height: 12, flexShrink: 0, marginRight: 4 }} />
            <span className="text-truncate">{numeroProcesso || tituloCaso}</span>
          </Link>
        )}

        {overdue ? (
          <p
            className="mb-0 d-flex align-items-center gap-1 text-danger"
            style={{ fontSize: '0.72rem', fontWeight: 600 }}
          >
            <ExclamationTriangleIcon style={{ width: 12, height: 12, flexShrink: 0 }} />
            Vencido há {diasV} dia{diasV !== 1 ? 's' : ''}
          </p>
        ) : (
          dataFmt && (
            <div className="d-flex align-items-center pt-2 mt-2 border-top">
              <ClockIcon className="text-muted me-1" style={{ width: 13 }} />
              <span className="small text-muted" style={{ fontSize: '0.75rem' }}>
                {dataFmt}
                {diasRestantes !== null && diasRestantes >= 0 && (
                  <span className="ms-1">
                    (
                    {diasRestantes === 0
                      ? 'hoje'
                      : `em ${diasRestantes} dia${diasRestantes !== 1 ? 's' : ''}`}
                    )
                  </span>
                )}
              </span>
            </div>
          )
        )}

        {(precisaConfirmarPrazo || onConcluir) && tarefa.status !== 'Concluído' && (
          <div className="d-flex gap-1 mt-2">
            {precisaConfirmarPrazo && onConfirmarPrazo && (
              <button
                type="button"
                className="btn btn-sm btn-outline-warning flex-grow-1 d-flex align-items-center justify-content-center gap-1"
                style={{ fontSize: '0.72rem' }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  onConfirmarPrazo(tarefa)
                }}
                title="Confirma que o prazo gerado pela IA esta correto"
              >
                <CheckCircleIcon style={{ width: 13, height: 13 }} />
                Confirmar
              </button>
            )}
            {onConcluir && (
              <button
                type="button"
                className="btn btn-sm btn-outline-success flex-grow-1 d-flex align-items-center justify-content-center gap-1"
                style={{ fontSize: '0.72rem' }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  onConcluir(tarefa)
                }}
                title="Marcar como cumprido (move para Concluído)"
              >
                <CheckCircleIcon style={{ width: 13, height: 13 }} />
                Cumprido
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-componente GrupoLista (vista lista) ──────────────────────────────────

function GrupoLista({ grupo, casos, onEditar, onConcluir }) {
  const [collapsed, setCollapsed] = useState(grupo.collapsed ?? false)

  return (
    <div className="card border-0 shadow-sm" style={{ borderRadius: 'var(--radius-lg)' }}>
      <button
        type="button"
        className="card-header bg-white border-0 d-flex justify-content-between align-items-center py-3 px-4 w-100 text-start"
        style={{ borderRadius: 'var(--radius-lg)', cursor: 'pointer' }}
        onClick={() => setCollapsed((v) => !v)}
      >
        <div className="d-flex align-items-center gap-2">
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: grupo.cor,
              flexShrink: 0,
            }}
          />
          <span className="fw-bold" style={{ fontFamily: 'var(--font-heading)', color: grupo.cor }}>
            {grupo.label}
          </span>
          <span
            className="badge rounded-pill px-2"
            style={{ backgroundColor: grupo.cor, color: '#fff', fontSize: '0.7rem' }}
          >
            {grupo.items.length}
          </span>
        </div>
        <span className="text-muted" style={{ fontSize: '0.8rem' }}>
          {collapsed ? '▸ expandir' : '▾ recolher'}
        </span>
      </button>

      {!collapsed && (
        <div className="card-body p-0">
          <div className="table-responsive" style={{ borderTop: `2px solid ${grupo.cor}20` }}>
            <table className="table table-hover align-middle mb-0">
              <tbody>
                {grupo.items.map((t) => {
                  const casoVinculado = casos.find((c) => c.id === t.caso_id)
                  const overdue = isOverdue(t)
                  return (
                    <tr key={t.id} style={overdue ? { backgroundColor: '#fff5f5' } : {}}>
                      <td style={{ width: 36, paddingLeft: 16 }}>
                        <button
                          className="btn btn-sm p-0"
                          title={t.status === 'Concluído' ? 'Reabrir' : 'Marcar como concluído'}
                          onClick={() => onConcluir(t)}
                          style={{ color: t.status === 'Concluído' ? '#16a34a' : '#d1d5db' }}
                        >
                          <CheckCircleIcon style={{ width: 20, height: 20 }} />
                        </button>
                      </td>
                      <td style={{ maxWidth: 260 }}>
                        <div
                          className="fw-semibold text-dark text-truncate"
                          style={{ fontSize: '0.9rem' }}
                        >
                          {t.titulo}
                        </div>
                        {casoVinculado && (
                          <div className="text-muted text-truncate" style={{ fontSize: '0.75rem' }}>
                            <BriefcaseIcon
                              style={{
                                width: 11,
                                display: 'inline',
                                marginRight: 3,
                                marginTop: '-2px',
                              }}
                            />
                            {casoVinculado.titulo}
                          </div>
                        )}
                      </td>
                      <td className="d-none d-md-table-cell">
                        <PrioridadeBadge prioridade={t.prioridade} mostrarNormal />
                      </td>
                      <td
                        className="d-none d-md-table-cell text-muted"
                        style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                      >
                        {t.tipo_tarefa}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {t.data_vencimento ? (
                          <span
                            className="d-flex align-items-center gap-1"
                            style={{
                              fontSize: '0.8rem',
                              color: overdue ? '#dc3545' : '#374151',
                              fontWeight: overdue ? 700 : 400,
                            }}
                          >
                            {overdue && (
                              <ExclamationTriangleIcon style={{ width: 13, height: 13 }} />
                            )}
                            {new Date(
                              String(t.data_vencimento).slice(0, 10) + 'T12:00:00'
                            ).toLocaleDateString('pt-BR')}
                          </span>
                        ) : (
                          <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                            —
                          </span>
                        )}
                      </td>
                      <td style={{ width: 40, paddingRight: 16, textAlign: 'right' }}>
                        <button
                          className="btn btn-link btn-sm p-0 text-muted"
                          title="Editar"
                          onClick={() => onEditar(t)}
                        >
                          <PencilSquareIcon style={{ width: 15, height: 15 }} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
