import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'react-toastify'
import { api } from '../../api/client.js'

function StatusBadge({ status }) {
  const map = {
    Ativo: 'success',
    Encerrado: 'secondary',
    Suspenso: 'warning',
    Arquivado: 'dark',
  }
  const color = map[status] || 'primary'
  return <span className={`badge bg-${color}`}>{status}</span>
}

function CardSection({ title, icon, children, empty }) {
  return (
    <div className="card border-0 shadow-sm mb-4">
      <div className="card-header bg-white border-bottom d-flex align-items-center gap-2 py-3">
        <i className={`bi ${icon} text-primary`} />
        <span className="fw-semibold">{title}</span>
      </div>
      <div className="card-body p-0">
        {empty ? <p className="text-muted small text-center py-4 mb-0">{empty}</p> : children}
      </div>
    </div>
  )
}

function PortalPage() {
  const navigate = useNavigate()
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)

  const userStr = localStorage.getItem('user')
  const user = userStr ? JSON.parse(userStr) : {}

  useEffect(() => {
    api
      .get('/portal/situacao')
      .then(setDados)
      .catch(() => {
        toast.error('Erro ao carregar dados do portal.')
      })
      .finally(() => setLoading(false))
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('access_token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center">
        <div className="spinner-border text-primary" />
      </div>
    )
  }

  const cliente = dados?.cliente || {}
  const casos = dados?.casos || []
  const eventos = dados?.proximos_eventos || []
  const documentos = dados?.documentos_recentes || []
  const pendencias = dados?.pendencias_financeiras || []

  return (
    <div className="min-vh-100" style={{ background: '#f1f5f9' }}>
      {/* Header */}
      <header
        className="text-white py-3 px-4 d-flex align-items-center justify-content-between shadow-sm"
        style={{ background: 'linear-gradient(135deg, #1e40af 0%, #1e3a5f 100%)' }}
      >
        <div className="d-flex align-items-center gap-3">
          <div
            className="bg-white rounded-circle d-flex align-items-center justify-content-center"
            style={{ width: 40, height: 40, flexShrink: 0 }}
          >
            <i className="bi bi-person-badge-fill text-primary" />
          </div>
          <div>
            <div className="fw-bold fs-5 lh-1">Portal do Cliente</div>
            <div className="text-white-50 small">{cliente.nome || user.username}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="btn btn-sm btn-outline-light d-flex align-items-center gap-2"
        >
          <i className="bi bi-box-arrow-right" />
          <span className="d-none d-sm-inline">Sair</span>
        </button>
      </header>

      <div className="container py-4" style={{ maxWidth: 860 }}>
        {/* Resumo financeiro */}
        {pendencias.length > 0 && (
          <div className="alert alert-warning d-flex align-items-start gap-3 mb-4 shadow-sm border-0">
            <i className="bi bi-exclamation-triangle-fill fs-5 mt-1" />
            <div>
              <strong>Pendência financeira</strong>
              <div className="small mt-1">
                Você possui {pendencias.length} parcela(s) em aberto. Entre em contato com o
                escritório para regularizar.
              </div>
            </div>
          </div>
        )}

        {/* Casos */}
        <CardSection
          title="Meus Processos"
          icon="bi-briefcase-fill"
          empty={casos.length === 0 ? 'Nenhum processo registrado.' : null}
        >
          <div className="list-group list-group-flush">
            {casos.map((c) => (
              <div key={c.id} className="list-group-item px-4 py-3">
                <div className="d-flex justify-content-between align-items-start gap-2">
                  <div className="flex-grow-1 min-width-0">
                    <div className="fw-semibold text-truncate">{c.titulo}</div>
                    {c.numero_processo && (
                      <div className="text-muted small font-monospace">{c.numero_processo}</div>
                    )}
                    <div className="small text-muted mt-1">
                      {[c.area_direito, c.fase_processual, c.vara_juizo]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <StatusBadge status={c.status} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardSection>

        <div className="row g-4">
          {/* Próximos eventos */}
          <div className="col-lg-6">
            <CardSection
              title="Próximas Audiências / Eventos"
              icon="bi-calendar-event-fill"
              empty={eventos.length === 0 ? 'Sem eventos próximos.' : null}
            >
              <div className="list-group list-group-flush">
                {eventos.map((e) => {
                  const dt = e.data_inicio ? new Date(e.data_inicio) : null
                  return (
                    <div key={e.id} className="list-group-item px-4 py-3">
                      <div className="fw-semibold small">{e.titulo}</div>
                      {dt && (
                        <div className="text-muted small">
                          {dt.toLocaleDateString('pt-BR', {
                            weekday: 'short',
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}{' '}
                          às{' '}
                          {dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                      {e.tipo_evento && (
                        <span className="badge bg-light text-dark border small mt-1">
                          {e.tipo_evento}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardSection>
          </div>

          {/* Documentos recentes */}
          <div className="col-lg-6">
            <CardSection
              title="Documentos Recentes"
              icon="bi-file-earmark-text-fill"
              empty={documentos.length === 0 ? 'Nenhum documento disponível.' : null}
            >
              <div className="list-group list-group-flush">
                {documentos.map((d) => {
                  const dt = d.data_upload ? new Date(d.data_upload) : null
                  return (
                    <div
                      key={d.id}
                      className="list-group-item px-4 py-3 d-flex align-items-center gap-3"
                    >
                      <i className="bi bi-file-earmark-text text-primary fs-5" />
                      <div className="flex-grow-1 min-width-0">
                        <div className="small fw-semibold text-truncate">{d.nome_arquivo}</div>
                        {dt && (
                          <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                            {dt.toLocaleDateString('pt-BR')}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardSection>
          </div>
        </div>

        {/* Pendências financeiras */}
        {pendencias.length > 0 && (
          <CardSection title="Pendências Financeiras" icon="bi-currency-dollar">
            <div className="list-group list-group-flush">
              {pendencias.map((p) => {
                const venc = p.data_vencimento ? new Date(p.data_vencimento) : null
                const vencido = venc && venc < new Date()
                return (
                  <div
                    key={p.id}
                    className="list-group-item px-4 py-3 d-flex justify-content-between align-items-center"
                  >
                    <div>
                      <div className="small fw-semibold">{p.descricao || 'Honorário'}</div>
                      {venc && (
                        <div
                          className={`small ${vencido ? 'text-danger fw-semibold' : 'text-muted'}`}
                        >
                          Vencimento: {venc.toLocaleDateString('pt-BR')}
                          {vencido && ' (vencido)'}
                        </div>
                      )}
                    </div>
                    <span
                      className={`badge ${vencido ? 'bg-danger' : 'bg-warning text-dark'} fs-6`}
                    >
                      R$ {Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardSection>
        )}

        {/* Contato */}
        <div className="text-center text-muted small mt-2 pb-4">
          <i className="bi bi-shield-check me-1" />
          Seus dados estão protegidos. Dúvidas? Entre em contato com seu advogado.
        </div>
      </div>
    </div>
  )
}

export default PortalPage
