// admin-fase0: listagem de tenants no backoffice super-admin.
import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { adminApi } from '../../api/admin.js'

const PAGE_SIZE = 25

const STATUS_BADGES = {
  ativo: { className: 'badge bg-success-subtle text-success', label: 'Ativo' },
  suspenso: { className: 'badge bg-warning-subtle text-warning', label: 'Suspenso' },
  cancelado: { className: 'badge bg-danger-subtle text-danger', label: 'Cancelado' },
}

function StatusBadge({ status }) {
  const cfg = STATUS_BADGES[status] || { className: 'badge bg-secondary-subtle text-muted', label: status || '—' }
  return <span className={cfg.className}>{cfg.label}</span>
}

function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(iso))
  } catch {
    return iso
  }
}

export default function AdminTenantsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(
    async (overrides = {}) => {
      setLoading(true)
      try {
        const data = await adminApi.listTenants({
          q,
          status: statusFilter,
          page,
          size: PAGE_SIZE,
          ...overrides,
        })
        setItems(data.items || [])
        setTotal(data.total || 0)
      } catch (e) {
        toast.error(e.message || 'Falha ao carregar tenants')
      } finally {
        setLoading(false)
      }
    },
    [q, statusFilter, page]
  )

  useEffect(() => {
    load()
  }, [load])

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <div className="d-flex flex-wrap align-items-center justify-content-between mb-3 gap-2">
        <div>
          <h2 className="h4 mb-1">Backoffice — Tenants</h2>
          <small className="text-muted">
            {total} {total === 1 ? 'escritório' : 'escritórios'} cadastrado{total === 1 ? '' : 's'}
          </small>
        </div>
      </div>

      <form className="card p-3 mb-3" onSubmit={handleSearch}>
        <div className="row g-2 align-items-end">
          <div className="col-md-6">
            <label className="form-label form-label-sm">Buscar</label>
            <input
              type="search"
              className="form-control"
              placeholder="Nome, CNPJ/CPF ou email"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              maxLength={120}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label form-label-sm">Status</label>
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="">Todos</option>
              <option value="ativo">Ativo</option>
              <option value="suspenso">Suspenso</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
          <div className="col-md-3 d-flex gap-2">
            <button type="submit" className="btn btn-primary flex-grow-1" disabled={loading}>
              {loading ? 'Carregando…' : 'Buscar'}
            </button>
          </div>
        </div>
      </form>

      <div className="card">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Escritório</th>
                <th>Documento</th>
                <th>Email</th>
                <th>Criado em</th>
                <th className="text-end">Usuários</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4">
                    Nenhum tenant encontrado.
                  </td>
                </tr>
              )}
              {items.map((t) => (
                <tr
                  key={t.id}
                  role="button"
                  onClick={() => navigate(`/admin/tenants/${t.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td className="fw-semibold">{t.nome_escritorio}</td>
                  <td>{t.documento || '—'}</td>
                  <td>{t.email_contato || '—'}</td>
                  <td>{formatDate(t.created_at)}</td>
                  <td className="text-end">{t.total_usuarios ?? 0}</td>
                  <td>
                    <StatusBadge status={t.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="d-flex justify-content-between align-items-center p-3 border-top">
            <small className="text-muted">
              Página {page} de {totalPages}
            </small>
            <div className="d-flex gap-2">
              <button
                className="btn btn-sm btn-outline-secondary"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </button>
              <button
                className="btn btn-sm btn-outline-secondary"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
