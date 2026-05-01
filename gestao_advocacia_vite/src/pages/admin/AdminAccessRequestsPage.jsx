// Backoffice super-admin: solicitacoes de acesso a beta privada (issue #112 v2).
// Lista, aprova e rejeita pedidos vindos de POST /api/v1/auth/access-request.

import React, { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { adminApi } from '../../api/admin.js'

const PER_PAGE = 25

const STATUS_BADGES = {
  pending: { className: 'badge bg-warning-subtle text-warning', label: 'Pendente' },
  approved: { className: 'badge bg-success-subtle text-success', label: 'Aprovado' },
  rejected: { className: 'badge bg-danger-subtle text-danger', label: 'Rejeitado' },
}

function StatusBadge({ status }) {
  const cfg = STATUS_BADGES[status] || {
    className: 'badge bg-secondary-subtle text-muted',
    label: status || '—',
  }
  return <span className={cfg.className}>{cfg.label}</span>
}

function formatDateTime(iso) {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function RejectModal({ request, onClose, onConfirm, submitting }) {
  const [motivo, setMotivo] = useState('')

  if (!request) return null

  return (
    <div
      className="modal d-block"
      tabIndex="-1"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Rejeitar solicitação</h5>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body">
            <p className="small text-muted mb-3">
              <strong>{request.nome}</strong> · {request.email}
            </p>
            <div className="mb-3">
              <label className="form-label small fw-bold">
                Motivo (opcional, registrado no audit log)
              </label>
              <textarea
                className="form-control"
                rows={3}
                maxLength={500}
                placeholder="Ex.: fora do escopo da beta atual"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => onConfirm(motivo)}
              disabled={submitting}
            >
              {submitting ? 'Rejeitando...' : 'Rejeitar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminAccessRequestsPage() {
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('pending')
  const [loading, setLoading] = useState(false)
  const [acting, setActing] = useState(null) // id em processamento (approve ou reject)
  const [rejectingItem, setRejectingItem] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminApi.listAccessRequests({
        status: statusFilter,
        page,
        perPage: PER_PAGE,
      })
      setItems(data.items || [])
      setTotal(data.total || 0)
    } catch (e) {
      toast.error(e.message || 'Falha ao carregar solicitações')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, page])

  useEffect(() => {
    load()
  }, [load])

  const handleApprove = async (item) => {
    if (!confirm(`Aprovar solicitação de ${item.email}?`)) return
    setActing(item.id)
    try {
      await adminApi.approveAccessRequest(item.id)
      toast.success(`Solicitação de ${item.email} aprovada.`)
      load()
    } catch (e) {
      toast.error(e.message || 'Falha ao aprovar')
    } finally {
      setActing(null)
    }
  }

  const handleReject = async (motivo) => {
    if (!rejectingItem) return
    setActing(rejectingItem.id)
    try {
      await adminApi.rejectAccessRequest(rejectingItem.id, motivo)
      toast.success(`Solicitação de ${rejectingItem.email} rejeitada.`)
      setRejectingItem(null)
      load()
    } catch (e) {
      toast.error(e.message || 'Falha ao rejeitar')
    } finally {
      setActing(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  return (
    <div className="container-fluid py-4">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4">
        <div>
          <h1 className="h4 mb-1">Solicitações de acesso</h1>
          <p className="text-muted small mb-0">
            Leads vindos do formulário público <code>/solicitar-acesso</code>.
          </p>
        </div>
        <div className="d-flex gap-2 align-items-center">
          <select
            className="form-select form-select-sm"
            value={statusFilter}
            onChange={(e) => {
              setPage(1)
              setStatusFilter(e.target.value)
            }}
            style={{ minWidth: 180 }}
          >
            <option value="pending">Pendentes</option>
            <option value="approved">Aprovados</option>
            <option value="rejected">Rejeitados</option>
            <option value="">Todos</option>
          </select>
          <button className="btn btn-outline-secondary btn-sm" onClick={load} disabled={loading}>
            {loading ? '...' : 'Atualizar'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Status</th>
                <th>Recebido em</th>
                <th>Nome</th>
                <th>Email</th>
                <th>OAB</th>
                <th>Telefone / Escritório</th>
                <th>Mensagem</th>
                <th className="text-end">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan="8" className="text-center text-muted py-4">
                    Carregando...
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan="8" className="text-center text-muted py-4">
                    Nenhuma solicitação{statusFilter ? ` com status "${statusFilter}"` : ''}.
                  </td>
                </tr>
              )}
              {!loading &&
                items.map((it) => (
                  <tr key={it.id}>
                    <td>
                      <StatusBadge status={it.status} />
                      {it.status === 'rejected' && it.motivo_rejeicao && (
                        <div className="small text-muted mt-1" style={{ maxWidth: 200 }}>
                          {it.motivo_rejeicao}
                        </div>
                      )}
                    </td>
                    <td className="small">{formatDateTime(it.criado_em)}</td>
                    <td>{it.nome}</td>
                    <td>
                      <a href={`mailto:${it.email}`} className="text-decoration-none">
                        {it.email}
                      </a>
                    </td>
                    <td className="small">
                      {it.oab ? (
                        <span>
                          {it.oab}
                          {it.sigla_oab && <span className="text-muted">/{it.sigla_oab}</span>}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="small">
                      {it.telefone && <div>{it.telefone}</div>}
                      {it.escritorio && <div className="text-muted">{it.escritorio}</div>}
                      {!it.telefone && !it.escritorio && <span className="text-muted">—</span>}
                    </td>
                    <td className="small" style={{ maxWidth: 280 }}>
                      {it.mensagem ? (
                        <div title={it.mensagem} style={{ whiteSpace: 'normal' }}>
                          {it.mensagem.length > 100 ? it.mensagem.slice(0, 100) + '…' : it.mensagem}
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="text-end" style={{ whiteSpace: 'nowrap' }}>
                      {it.status === 'pending' ? (
                        <>
                          <button
                            className="btn btn-success btn-sm me-1"
                            onClick={() => handleApprove(it)}
                            disabled={acting === it.id}
                          >
                            Aprovar
                          </button>
                          <button
                            className="btn btn-outline-danger btn-sm"
                            onClick={() => setRejectingItem(it)}
                            disabled={acting === it.id}
                          >
                            Rejeitar
                          </button>
                        </>
                      ) : (
                        <span className="small text-muted">
                          {it.processado_em ? formatDateTime(it.processado_em) : '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <nav className="mt-3">
          <ul className="pagination pagination-sm justify-content-center mb-0">
            <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
              <button className="page-link" onClick={() => setPage(page - 1)} disabled={page === 1}>
                Anterior
              </button>
            </li>
            <li className="page-item disabled">
              <span className="page-link">
                Página {page} de {totalPages} ({total} total)
              </span>
            </li>
            <li className={`page-item ${page >= totalPages ? 'disabled' : ''}`}>
              <button
                className="page-link"
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
              >
                Próxima
              </button>
            </li>
          </ul>
        </nav>
      )}

      <RejectModal
        request={rejectingItem}
        onClose={() => setRejectingItem(null)}
        onConfirm={handleReject}
        submitting={acting === rejectingItem?.id}
      />
    </div>
  )
}
