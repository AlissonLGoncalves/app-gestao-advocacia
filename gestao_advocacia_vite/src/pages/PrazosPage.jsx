import React, { useState, useEffect, useCallback } from 'react'
import { API_URL } from '../config.js'
import { toast } from 'react-toastify'
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
} from '@heroicons/react/24/outline'

// ── Helpers de data ──────────────────────────────────────────────────────────

const dateStr = (offsetDays = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const hojeLocal = () => dateStr(0)

const isOverdue = (t) =>
  !!(t.data_vencimento && t.status !== 'Concluído' && t.data_vencimento < hojeLocal())

const diasVencido = (t) => {
  if (!t.data_vencimento) return 0
  const [ay, am, ad] = hojeLocal().split('-').map(Number)
  const [by, bm, bd] = t.data_vencimento.split('-').map(Number)
  return Math.floor((new Date(ay, am - 1, ad) - new Date(by, bm - 1, bd)) / 86400000)
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

  const carregarTarefas = useCallback(async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/tarefas`, {
        headers: { Authorization: `Bearer ${token}` },
      })
<<<<<<< HEAD
      if (res.ok) setTarefas(await res.json())
      else toast.error('Erro ao carregar prazos.')
=======
      if (res.ok) {
        const data = await res.json()
        setTarefas(data)
      } else {
        toast.error('Erro ao carregar prazos.')
      }
>>>>>>> 94b5776 (refactor: lint and validation cleanup for C3)
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
<<<<<<< HEAD
      if (res.ok) setCasos(await res.json())
    } catch {
      /* ignore */
=======
      if (res.ok) {
        const data = await res.json()
        setCasos(data)
      }
    } catch {
      // ignore
>>>>>>> 94b5776 (refactor: lint and validation cleanup for C3)
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

  const handleMoverTarefa = async (id, novoStatus) => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/tarefas/${id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: novoStatus }),
      })
<<<<<<< HEAD
      if (res.ok) carregarTarefas()
=======
      if (res.ok) {
        carregarTarefas()
      }
>>>>>>> 94b5776 (refactor: lint and validation cleanup for C3)
    } catch {
      toast.error('Falha ao atualizar tarefa.')
    }
  }

  const getCorPrioridade = (p) =>
    ({ Urgente: 'danger', Alta: 'warning', Baixa: 'info' })[p] || 'primary'

  // ── Vista Kanban ─────────────────────────────────────────────────────────

  const [arrastandoId, setArrastandoId] = useState(null)

  const renderCard = (t) => {
    const overdue = isOverdue(t)
    const dias = overdue ? diasVencido(t) : 0
    const casoVinculado = casos.find((c) => c.id === t.caso_id)

    return (
      <div
        key={t.id}
        draggable
        onDragStart={(e) => {
          setArrastandoId(t.id)
          e.dataTransfer.setData('tarefaId', t.id)
        }}
        className={`card mb-3 border-0 shadow-sm ${arrastandoId === t.id ? 'opacity-50' : ''}`}
        style={{
          cursor: 'grab',
          borderRadius: 'var(--radius-md)',
          borderLeft: overdue ? '4px solid #dc3545' : '4px solid transparent',
          transform: arrastandoId === t.id ? 'scale(0.98)' : 'scale(1)',
          transition: 'transform 0.1s, box-shadow 0.15s',
        }}
      >
        <div className="card-body p-3">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <span
              className={`badge bg-${getCorPrioridade(t.prioridade)}-subtle text-${getCorPrioridade(t.prioridade)}`}
            >
              {t.prioridade}
            </span>
            <button
              className="btn btn-link btn-sm p-0 text-muted"
              title="Editar"
              onClick={(e) => {
                e.stopPropagation()
                handleEditarTarefa(t)
              }}
              style={{ lineHeight: 1 }}
            >
              <PencilSquareIcon style={{ width: 14, height: 14 }} />
            </button>
          </div>

          <h6
            className="card-title fw-bold text-dark mb-1"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            {t.titulo}
          </h6>

          {overdue && (
            <p
              className="mb-1 d-flex align-items-center gap-1 text-danger"
              style={{ fontSize: '0.72rem', fontWeight: 600 }}
            >
              <ExclamationTriangleIcon style={{ width: 12, height: 12, flexShrink: 0 }} />
              Vencido há {dias} dia{dias !== 1 ? 's' : ''}
            </p>
          )}

          <div className="d-flex align-items-center mt-1">
            <span className="small text-muted" style={{ fontSize: '0.72rem' }}>
              {t.tipo_tarefa === 'Prazo' && (
                <ExclamationCircleIcon
                  className="text-danger"
                  style={{ width: 12, display: 'inline', marginRight: 2 }}
                />
              )}
              {t.tipo_tarefa}
            </span>
          </div>

          {casoVinculado && (
            <p
              className="small text-muted mb-0 text-truncate mt-1"
              style={{ fontSize: '0.72rem' }}
              title={`${casoVinculado.titulo} (${casoVinculado.numero_processo})`}
            >
              <BriefcaseIcon
                style={{ width: 11, marginRight: 3, display: 'inline', marginTop: '-2px' }}
              />
              {casoVinculado.titulo}
            </p>
          )}

          {t.data_vencimento && (
            <div className="d-flex align-items-center mt-2 pt-2 border-top">
              <ClockIcon
                className={overdue ? 'text-danger me-1' : 'text-muted me-1'}
                style={{ width: 13 }}
              />
              <span
                className={`small ${overdue ? 'text-danger fw-semibold' : 'text-muted'}`}
                style={{ fontSize: '0.75rem' }}
              >
                {new Date(t.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderColuna = (titulo, statusNome, cor) => {
    const col = tarefas.filter((t) => t.status === statusNome)
    return (
      <div
        className="col-md-4 d-flex flex-column"
        style={{ minHeight: '600px' }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const idStr = e.dataTransfer.getData('tarefaId')
          if (idStr) handleMoverTarefa(parseInt(idStr), statusNome)
          setArrastandoId(null)
        }}
      >
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
              {titulo}
            </h6>
            <span className={`badge bg-${cor}-subtle text-${cor} rounded-pill px-3 py-2`}>
              {col.length}
            </span>
          </div>
          <div
            className="card-body overflow-auto p-3"
            style={{
              maxHeight: 'calc(100vh - 250px)',
              background: 'var(--bg-main)',
              borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
            }}
          >
            {col.map(renderCard)}
            {col.length === 0 && (
              <div className="text-center py-4 text-muted small border border-dashed rounded bg-white">
                Arraste tarefas para cá
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

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
              getCorPrioridade={getCorPrioridade}
            />
          )
        })}
      </div>
    )
  }

  // ── Render principal ─────────────────────────────────────────────────────

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
              ? 'Gerencie o trabalho do escritório visualmente.'
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
        <div className="row g-4">
          {renderColuna('A Fazer', 'A Fazer', 'danger')}
          {renderColuna('Em Andamento', 'Fazendo', 'warning')}
          {renderColuna('Concluído', 'Concluído', 'success')}
        </div>
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
          <div className="modal-dialog modal-dialog-centered">
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
                      rows="2"
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

// ── Sub-componente GrupoLista ────────────────────────────────────────────────

function GrupoLista({ grupo, casos, onEditar, onConcluir, getCorPrioridade }) {
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
                        <span
                          className={`badge bg-${getCorPrioridade(t.prioridade)}-subtle text-${getCorPrioridade(t.prioridade)}`}
                          style={{ fontSize: '0.72rem' }}
                        >
                          {t.prioridade}
                        </span>
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
                            {new Date(t.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}
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
