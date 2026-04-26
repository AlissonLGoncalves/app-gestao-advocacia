// admin-fase0: detalhe de tenant no backoffice. Tabs: Cadastro / Usuarios / Atividade / Anotacoes.
// Confirmacao de suspender/reativar via modal proprio que pede digitar o nome do tenant.
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { adminApi } from '../../api/admin.js'

const TABS = [
  { key: 'cadastro', label: 'Cadastro' },
  { key: 'usuarios', label: 'Usuários' },
  { key: 'atividade', label: 'Atividade' },
  { key: 'anotacoes', label: 'Anotações' },
]

const ANOTACAO_MAX = 5000

function formatDateTime(iso) {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
      new Date(iso)
    )
  } catch {
    return iso
  }
}

function ConfirmTypeNameModal({ tenantName, action, onConfirm, onCancel, busy }) {
  const [typed, setTyped] = useState('')
  const [motivo, setMotivo] = useState('')
  const ok = typed.trim() === tenantName.trim()

  return (
    <div
      className="modal fade show d-block"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      tabIndex="-1"
      role="dialog"
    >
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 480 }}>
        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 14 }}>
          <div className="modal-header border-0 pb-0 pt-4 px-4">
            <h6 className="modal-title fw-bold mb-0">
              {action === 'suspender' ? 'Suspender tenant' : 'Reativar tenant'}
            </h6>
          </div>
          <div className="modal-body py-3 px-4">
            <p className="text-muted mb-3" style={{ fontSize: '0.92rem' }}>
              Para confirmar, digite o nome exato do tenant: <strong>{tenantName}</strong>
            </p>
            <input
              type="text"
              className="form-control mb-3"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Nome do tenant"
              autoFocus
              maxLength={250}
            />
            <label className="form-label form-label-sm">Motivo (opcional)</label>
            <textarea
              className="form-control"
              rows={2}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={500}
              placeholder="Será registrado no audit log"
            />
          </div>
          <div className="modal-footer border-0 pt-0 pb-4 px-4 gap-2">
            <button
              type="button"
              className="btn btn-light btn-sm px-4"
              onClick={onCancel}
              disabled={busy}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={`btn btn-sm px-4 fw-semibold ${
                action === 'suspender' ? 'btn-danger' : 'btn-primary'
              }`}
              onClick={() => onConfirm(motivo)}
              disabled={!ok || busy}
            >
              {busy ? 'Processando…' : 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminTenantDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [tenant, setTenant] = useState(null)
  const [usuarios, setUsuarios] = useState([])
  const [atividade, setAtividade] = useState([])
  const [anotacoes, setAnotacoes] = useState([])
  const [tab, setTab] = useState('cadastro')
  const [loading, setLoading] = useState(true)
  const [confirmAction, setConfirmAction] = useState(null) // 'suspender' | 'reativar' | null
  const [busy, setBusy] = useState(false)
  const [novaAnotacao, setNovaAnotacao] = useState('')

  const loadTenant = useCallback(async () => {
    try {
      const data = await adminApi.getTenant(id)
      setTenant(data)
    } catch (e) {
      if (e.status === 404) {
        toast.error('Tenant não encontrado')
        navigate('/admin/tenants')
        return
      }
      toast.error(e.message || 'Falha ao carregar tenant')
    }
  }, [id, navigate])

  const loadTab = useCallback(
    async (which) => {
      try {
        if (which === 'usuarios') {
          const d = await adminApi.getTenantUsuarios(id)
          setUsuarios(d.items || [])
        } else if (which === 'atividade') {
          const d = await adminApi.getTenantAtividade(id)
          setAtividade(d.items || [])
        } else if (which === 'anotacoes') {
          const d = await adminApi.listAnotacoes(id)
          setAnotacoes(d.items || [])
        }
      } catch (e) {
        toast.error(e.message || 'Falha ao carregar dados da aba')
      }
    },
    [id]
  )

  useEffect(() => {
    setLoading(true)
    loadTenant().finally(() => setLoading(false))
  }, [loadTenant])

  useEffect(() => {
    if (tab !== 'cadastro') loadTab(tab)
  }, [tab, loadTab])

  const handleConfirm = async (motivo) => {
    setBusy(true)
    try {
      if (confirmAction === 'suspender') {
        await adminApi.suspender(id, motivo)
        toast.success('Tenant suspenso')
      } else if (confirmAction === 'reativar') {
        await adminApi.reativar(id, motivo)
        toast.success('Tenant reativado')
      }
      setConfirmAction(null)
      await loadTenant()
      if (tab === 'atividade') await loadTab('atividade')
    } catch (e) {
      toast.error(e.message || 'Falha na operação')
    } finally {
      setBusy(false)
    }
  }

  const handleCriarAnotacao = async () => {
    const texto = novaAnotacao.trim()
    if (!texto) {
      toast.warn('Texto da anotação é obrigatório')
      return
    }
    setBusy(true)
    try {
      await adminApi.criarAnotacao(id, texto)
      setNovaAnotacao('')
      toast.success('Anotação salva')
      await loadTab('anotacoes')
    } catch (e) {
      toast.error(e.message || 'Falha ao salvar anotação')
    } finally {
      setBusy(false)
    }
  }

  const isSuspended = tenant?.status === 'suspenso' || tenant?.status === 'cancelado'

  const remainingChars = useMemo(() => ANOTACAO_MAX - novaAnotacao.length, [novaAnotacao])

  if (loading || !tenant) {
    return (
      <div className="text-center py-5 text-muted">
        <div className="spinner-border" role="status" aria-label="Carregando" />
        <div className="mt-2">Carregando tenant…</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3">
        <Link to="/admin/tenants" className="text-decoration-none small text-muted">
          ← Voltar à listagem
        </Link>
      </div>

      <div className="d-flex flex-wrap align-items-start justify-content-between mb-3 gap-3">
        <div>
          <h2 className="h4 mb-1">{tenant.nome_escritorio}</h2>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <span
              className={`badge ${
                tenant.status === 'ativo'
                  ? 'bg-success-subtle text-success'
                  : tenant.status === 'suspenso'
                    ? 'bg-warning-subtle text-warning'
                    : 'bg-danger-subtle text-danger'
              }`}
            >
              {tenant.status}
            </span>
            <small className="text-muted">ID #{tenant.id}</small>
            {tenant.documento && <small className="text-muted">• {tenant.documento}</small>}
          </div>
        </div>
        <div className="d-flex gap-2">
          {!isSuspended ? (
            <button
              className="btn btn-outline-danger"
              onClick={() => setConfirmAction('suspender')}
              disabled={busy}
            >
              Suspender
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => setConfirmAction('reativar')}
              disabled={busy}
            >
              Reativar
            </button>
          )}
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-body py-2">
          <ul className="nav nav-tabs card-header-tabs border-0 mb-0">
            {TABS.map((t) => (
              <li key={t.key} className="nav-item">
                <button
                  type="button"
                  className={`nav-link ${tab === t.key ? 'active fw-semibold' : ''}`}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {tab === 'cadastro' && (
        <div className="card">
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label form-label-sm">Email de contato</label>
                <div>{tenant.email_contato || '—'}</div>
              </div>
              <div className="col-md-6">
                <label className="form-label form-label-sm">Telefone</label>
                <div>{tenant.telefone || '—'}</div>
              </div>
              <div className="col-md-6">
                <label className="form-label form-label-sm">OAB</label>
                <div>
                  {tenant.numero_oab_escritorio || '—'}
                  {tenant.sigla_oab_escritorio ? ` / ${tenant.sigla_oab_escritorio}` : ''}
                </div>
              </div>
              <div className="col-md-6">
                <label className="form-label form-label-sm">Endereço</label>
                <div>{tenant.endereco || '—'}</div>
              </div>
              <div className="col-md-4">
                <label className="form-label form-label-sm">Owner</label>
                <div>
                  {tenant.owner ? (
                    <>
                      <div className="fw-semibold">
                        {tenant.owner.nome_completo || tenant.owner.username}
                      </div>
                      <small className="text-muted">{tenant.owner.email}</small>
                    </>
                  ) : (
                    '—'
                  )}
                </div>
              </div>
              <div className="col-md-4">
                <label className="form-label form-label-sm">Último login do owner</label>
                <div>{formatDateTime(tenant.ultimo_login_owner)}</div>
              </div>
              <div className="col-md-4">
                <label className="form-label form-label-sm">Criado em</label>
                <div>{formatDateTime(tenant.created_at)}</div>
              </div>
            </div>

            <hr />

            <div className="row g-3">
              <div className="col-sm-4">
                <div className="text-muted small">Usuários</div>
                <div className="h5 mb-0">{tenant.total_usuarios ?? 0}</div>
              </div>
              <div className="col-sm-4">
                <div className="text-muted small">Clientes</div>
                <div className="h5 mb-0">{tenant.total_clientes ?? 0}</div>
              </div>
              <div className="col-sm-4">
                <div className="text-muted small">Casos</div>
                <div className="h5 mb-0">{tenant.total_casos ?? 0}</div>
              </div>
            </div>

            <hr />

            {/* TODO Fase 1: plano, billing, contratos, score de churn, metricas avancadas */}
            <div className="text-muted small">
              <strong>Em breve:</strong> plano e billing, contratos, métricas de uso e score de
              churn.
            </div>
          </div>
        </div>
      )}

      {tab === 'usuarios' && (
        <div className="card">
          <div className="table-responsive">
            <table className="table mb-0 align-middle">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Nome</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-muted py-3">
                      Nenhum usuário.
                    </td>
                  </tr>
                )}
                {usuarios.map((u) => (
                  <tr key={u.id}>
                    <td className="fw-semibold">{u.username}</td>
                    <td>{u.email}</td>
                    <td>{u.nome_completo || '—'}</td>
                    <td>
                      <span className="badge bg-light text-dark">{u.role}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'atividade' && (
        <div className="card">
          <div className="card-body">
            {atividade.length === 0 ? (
              <div className="text-muted text-center py-3">Sem eventos registrados.</div>
            ) : (
              <ul className="list-group list-group-flush">
                {atividade.map((ev) => (
                  <li key={ev.id} className="list-group-item">
                    <div className="d-flex justify-content-between gap-2">
                      <div>
                        <span className="fw-semibold">{ev.action}</span>
                        <small className="text-muted ms-2">
                          por {ev.admin_username || `#${ev.admin_user_id}`}
                        </small>
                      </div>
                      <small className="text-muted">{formatDateTime(ev.created_at)}</small>
                    </div>
                    {ev.after_json && (
                      <pre
                        className="small text-muted mt-2 mb-0"
                        style={{ whiteSpace: 'pre-wrap' }}
                      >
                        {ev.after_json}
                      </pre>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === 'anotacoes' && (
        <div className="card">
          <div className="card-body">
            <label className="form-label form-label-sm">Nova anotação</label>
            <textarea
              className="form-control mb-2"
              rows={3}
              value={novaAnotacao}
              onChange={(e) => setNovaAnotacao(e.target.value.slice(0, ANOTACAO_MAX))}
              maxLength={ANOTACAO_MAX}
              placeholder="Texto puro. HTML será removido."
            />
            <div className="d-flex justify-content-between align-items-center mb-3">
              <small className={`text-${remainingChars < 100 ? 'danger' : 'muted'}`}>
                {remainingChars} caracteres restantes
              </small>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleCriarAnotacao}
                disabled={busy || !novaAnotacao.trim()}
              >
                Salvar anotação
              </button>
            </div>

            <hr />

            {anotacoes.length === 0 ? (
              <div className="text-muted text-center py-3">Sem anotações.</div>
            ) : (
              <ul className="list-group list-group-flush">
                {anotacoes.map((a) => (
                  <li key={a.id} className="list-group-item">
                    <div className="d-flex justify-content-between mb-1">
                      <small className="text-muted">
                        {a.admin_username || `#${a.admin_user_id}`}
                      </small>
                      <small className="text-muted">{formatDateTime(a.created_at)}</small>
                    </div>
                    {/* Renderizado como texto puro: nunca dangerouslySetInnerHTML */}
                    <div style={{ whiteSpace: 'pre-wrap' }}>{a.texto}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {confirmAction && (
        <ConfirmTypeNameModal
          tenantName={tenant.nome_escritorio}
          action={confirmAction}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmAction(null)}
          busy={busy}
        />
      )}
    </div>
  )
}
