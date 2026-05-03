/**
 * IntegracoesPage — gerencia integracoes externas do tenant.
 * Atualmente: projudi-agent (token API + status sync).
 */

import React, { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { useConfirm } from '../hooks/useConfirm.jsx'
import {
  gerarTokenProjudi,
  getProjudiSyncStatus,
  listTokensProjudi,
  revogarTokenProjudi,
} from '../api/projudi.js'

function badgeStatus(minutos) {
  if (minutos === null || minutos === undefined) {
    return { texto: 'Nunca sincronizou', cor: 'secondary' }
  }
  if (minutos < 60) return { texto: `há ${minutos} min`, cor: 'success' }
  if (minutos < 360) return { texto: `há ${Math.floor(minutos / 60)}h`, cor: 'warning' }
  return { texto: `há ${Math.floor(minutos / 1440)}d`, cor: 'danger' }
}

function formatDate(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function IntegracoesPage() {
  const { confirm, ConfirmDialog } = useConfirm()
  const [tokens, setTokens] = useState([])
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [gerando, setGerando] = useState(false)
  const [novoTokenInfo, setNovoTokenInfo] = useState(null)
  const [nomeNovo, setNomeNovo] = useState('Projudi Agent')

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [tks, st] = await Promise.all([listTokensProjudi(), getProjudiSyncStatus()])
      setTokens(Array.isArray(tks) ? tks : [])
      setStatus(st)
    } catch (err) {
      toast.error(err?.message || 'Falha ao carregar.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const handleGerar = async () => {
    setGerando(true)
    try {
      const data = await gerarTokenProjudi(nomeNovo.trim())
      setNovoTokenInfo(data)
      toast.success('Token gerado! Copie agora — não será mostrado de novo.')
      await carregar()
    } catch (err) {
      toast.error(err?.message || 'Falha ao gerar token.')
    } finally {
      setGerando(false)
    }
  }

  const handleRevogar = async (token) => {
    const ok = await confirm(
      `Revogar token "${token.nome || `#${token.id}`}"? O agent vai parar de sincronizar imediatamente.`,
      'Revogar token'
    )
    if (!ok) return
    try {
      await revogarTokenProjudi(token.id)
      toast.success('Token revogado.')
      await carregar()
    } catch (err) {
      toast.error(err?.message || 'Falha ao revogar.')
    }
  }

  const copiar = (texto) => {
    navigator.clipboard.writeText(texto).then(() => toast.success('Copiado!'))
  }

  const statusBadge = badgeStatus(status?.minutos_desde_ultimo_sync)

  return (
    <div className="container-fluid py-4" style={{ maxWidth: 1100 }}>
      <ConfirmDialog />

      <h3 className="fw-bold mb-1">
        <i className="bi bi-puzzle me-2 text-primary" />
        Integrações
      </h3>
      <p className="text-muted small mb-4">
        Conecte ferramentas externas ao Patronus. Cada integração funciona com tokens API próprios,
        isolados por escritório.
      </p>

      {/* PROJUDI Agent */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white d-flex justify-content-between align-items-center">
          <div>
            <strong className="d-block">
              <i className="bi bi-robot me-2 text-primary" />
              PROJUDI Agent
            </strong>
            <small className="text-muted">
              Scraper local que sincroniza processos, movimentações e peças do TJ-PR
            </small>
          </div>
          <span className={`badge bg-${statusBadge.cor} fs-6`}>
            <i className="bi bi-clock me-1" />
            {statusBadge.texto}
          </span>
        </div>

        <div className="card-body">
          {loading ? (
            <div className="text-center py-3">
              <div className="spinner-border text-primary spinner-border-sm" />
            </div>
          ) : (
            <>
              {/* Status detalhado */}
              <div className="row g-3 mb-4">
                {['processos', 'movimentacoes', 'pecas'].map((tipo) => {
                  const u = status?.ultimo_por_tipo?.[tipo]
                  return (
                    <div key={tipo} className="col-md-4">
                      <div className="border rounded p-3 h-100">
                        <div className="text-muted small text-uppercase mb-1">{tipo}</div>
                        <div className="fw-bold">{formatDate(u?.created_at)}</div>
                        {u?.counts && (
                          <div className="small text-muted mt-1">
                            {Object.entries(u.counts)
                              .filter(([, v]) => v && v !== 0 && !Array.isArray(v))
                              .slice(0, 3)
                              .map(([k, v]) => (
                                <span key={k} className="me-2">
                                  {k}={String(v)}
                                </span>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Token recém-criado (mostra UMA vez) */}
              {novoTokenInfo && (
                <div className="alert alert-warning border-warning">
                  <strong>
                    <i className="bi bi-key me-2" />
                    Novo token gerado — copie AGORA
                  </strong>
                  <p className="small mb-2 mt-1">
                    Este valor não será mostrado novamente. Cole no <code>.env</code> do
                    projudi-agent como <code>APP_GESTAO_API_TOKEN</code>.
                  </p>
                  <div className="input-group">
                    <input
                      type="text"
                      readOnly
                      className="form-control font-monospace"
                      value={novoTokenInfo.token}
                    />
                    <button className="btn btn-warning" onClick={() => copiar(novoTokenInfo.token)}>
                      <i className="bi bi-clipboard me-1" />
                      Copiar
                    </button>
                    <button
                      className="btn btn-outline-secondary"
                      onClick={() => setNovoTokenInfo(null)}
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              )}

              {/* Gerar novo token */}
              <div className="border rounded p-3 mb-3 bg-light">
                <strong className="d-block mb-2">Gerar novo token API</strong>
                <div className="input-group">
                  <input
                    type="text"
                    className="form-control"
                    placeholder='Nome do dispositivo (ex: "Notebook Escritório")'
                    value={nomeNovo}
                    onChange={(e) => setNomeNovo(e.target.value)}
                    maxLength={100}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={handleGerar}
                    disabled={gerando || !nomeNovo.trim()}
                  >
                    {gerando ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" />
                        Gerando...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-plus-lg me-1" />
                        Gerar
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Lista de tokens */}
              <strong className="d-block mb-2">
                Tokens ativos ({tokens.filter((t) => t.ativo).length})
              </strong>
              {tokens.length === 0 ? (
                <p className="text-muted small">Nenhum token criado ainda.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Criado em</th>
                        <th>Último uso</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {tokens.map((t) => (
                        <tr key={t.id}>
                          <td>
                            <strong>{t.nome || `Token #${t.id}`}</strong>
                          </td>
                          <td className="small text-muted">{formatDate(t.created_at)}</td>
                          <td className="small text-muted">
                            {t.last_used_at ? formatDate(t.last_used_at) : '—'}
                          </td>
                          <td>
                            {t.ativo ? (
                              <span className="badge bg-success">Ativo</span>
                            ) : (
                              <span className="badge bg-secondary">Revogado</span>
                            )}
                          </td>
                          <td>
                            {t.ativo && (
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleRevogar(t)}
                              >
                                <i className="bi bi-x-circle me-1" />
                                Revogar
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="alert alert-info small mt-3 mb-0">
                <strong>Como usar:</strong>
                <ol className="mb-0 mt-1">
                  <li>Gere um token aqui e copie o valor</li>
                  <li>
                    No PC com o projudi-agent, edite <code>.env</code> e cole em{' '}
                    <code>APP_GESTAO_API_TOKEN</code>
                  </li>
                  <li>
                    Rode <code>projudi-agent sync push</code> pra enviar dados pro Patronus
                  </li>
                </ol>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default IntegracoesPage
