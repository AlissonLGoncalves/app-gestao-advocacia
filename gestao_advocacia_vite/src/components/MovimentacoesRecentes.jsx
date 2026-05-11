/**
 * MovimentacoesRecentes - Widget de timeline de publicacoes DJEN dos ultimos dias.
 *
 * Mesmo padrao visual usado na pagina DJEN (DjenPage.jsx):
 * - Card por publicacao com borda azul a esquerda quando nao lida
 * - Linha de badges: Nova / sigla_tribunal / tipo_comunicacao / origem
 * - Numero do processo em destaque
 * - Linha "nome_orgao · data" em texto muted pequeno
 * - Botoes: baixar certidao + abrir publicacao
 */

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { API_URL } from '../config.js'
import { CalendarIcon, ArrowPathIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline'
import { baixarCertidao as baixarCertidaoApi } from '../api/djen.js'
import AvatarSigla from './ui/AvatarSigla.jsx'

const fmtData = (iso) => {
  if (!iso) return ''
  try {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  } catch {
    return iso
  }
}

const MovimentacoesRecentes = ({ className = '' }) => {
  const navigate = useNavigate()
  const [publicacoes, setPublicacoes] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [diasSelecionados, setDiasSelecionados] = useState(7)

  const carregarPublicacoes = async (dias = 7) => {
    setLoading(true)
    setError(null)
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('auth_token')
      const response = await fetch(`${API_URL}/dashboard/publicacoes-recentes?dias=${dias}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Falha ao carregar publicações')
      }

      const data = await response.json()
      setPublicacoes(data)
    } catch (err) {
      console.error('Erro ao carregar publicações recentes:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarPublicacoes(diasSelecionados)
  }, [diasSelecionados])

  const handleMudarPeriodo = (dias) => {
    setDiasSelecionados(dias)
  }

  const abrirPublicacao = (pub) => {
    if (pub?.id) {
      navigate(`/djen?publicacao=${pub.id}`)
    }
  }

  const baixarCertidao = async (pub) => {
    if (!pub?.hash_comunicacao) {
      toast.warn('Esta publicação não possui certidão para download.')
      return
    }
    try {
      const blob = await baixarCertidaoApi(pub.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `certidao_djen_${pub.id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(err.message || 'Erro ao baixar certidão.')
    }
  }

  return (
    <div
      className={`card border-0 shadow-sm ${className}`}
      style={{ borderRadius: 'var(--radius-lg)' }}
    >
      {/* Header */}
      <div className="card-header bg-white border-bottom d-flex justify-content-between align-items-center p-4 flex-wrap gap-2">
        <div className="d-flex align-items-center gap-3">
          <div
            className="p-3 rounded-circle"
            style={{
              background:
                'linear-gradient(135deg, rgba(79, 70, 229, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)',
            }}
          >
            <CalendarIcon style={{ width: '24px', height: '24px', color: 'var(--primary)' }} />
          </div>
          <div>
            <h5 className="mb-0 fw-bold text-dark">Movimentações recentes</h5>
            <p className="mb-0 text-muted small">Publicações DJEN dos últimos dias</p>
          </div>
        </div>

        {/* Periodo selector */}
        <div className="btn-group" role="group">
          {[7, 15, 30].map((dias) => (
            <button
              key={dias}
              type="button"
              className={`btn btn-sm ${
                diasSelecionados === dias ? 'btn-primary' : 'btn-outline-secondary'
              }`}
              onClick={() => handleMudarPeriodo(dias)}
            >
              {dias}d
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="card-body p-4">
        {loading && (
          <div className="text-center py-5">
            <ArrowPathIcon
              style={{
                width: '32px',
                height: '32px',
                animation: 'spin 1s linear infinite',
                marginBottom: '1rem',
                color: 'var(--primary)',
              }}
            />
            <p className="text-muted">Carregando...</p>
          </div>
        )}

        {error && (
          <div className="alert alert-warning d-flex gap-3" role="alert">
            <ExclamationCircleIcon style={{ width: '24px', height: '24px', flexShrink: 0 }} />
            <div>
              <strong>Erro:</strong> {error}
            </div>
          </div>
        )}

        {!loading && !error && publicacoes && (
          <>
            {publicacoes.grupos.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <CalendarIcon
                  style={{ width: '48px', height: '48px', opacity: '0.3', marginBottom: '1rem' }}
                />
                <p>Nenhuma publicação nos últimos {diasSelecionados} dias</p>
              </div>
            ) : (
              publicacoes.grupos.map((grupo) => (
                <div key={grupo.data} className="mb-4">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <span
                      className="badge"
                      style={{
                        backgroundColor: 'rgba(79, 70, 229, 0.1)',
                        color: 'var(--primary)',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      {grupo.rotulo}
                    </span>
                    <span className="text-muted small">{fmtData(grupo.data)}</span>
                  </div>

                  {grupo.publicacoes.map((pub) => (
                    <div
                      key={pub.id}
                      className={`card mb-2 border-0 shadow-sm ${!pub.lida ? 'border-start border-4 border-primary' : ''}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => abrirPublicacao(pub)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          abrirPublicacao(pub)
                        }
                      }}
                    >
                      <div className="card-body py-2 px-3">
                        <div className="d-flex justify-content-between align-items-start">
                          <div className="flex-grow-1 me-2" style={{ minWidth: 0 }}>
                            <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                              {!pub.lida && <span className="badge bg-primary">Nova</span>}
                              <span className="badge bg-secondary">
                                {pub.sigla_tribunal || pub.tribunal || '—'}
                              </span>
                              <span className="badge bg-light text-dark border">
                                {pub.tipo_comunicacao || 'Comunicação'}
                              </span>
                              {pub.origem_busca === 'oab' && (
                                <span className="badge bg-info text-dark">via OAB</span>
                              )}
                              {pub.origem_busca === 'processo' && (
                                <span className="badge bg-warning text-dark">via Processo</span>
                              )}
                              {pub.cliente_nome && pub.cliente_nome !== 'N/A' && (
                                <span className="badge bg-light text-dark border">
                                  {pub.cliente_nome}
                                </span>
                              )}
                              {pub.responsavel_nome && (
                                <AvatarSigla
                                  nome={pub.responsavel_nome}
                                  iniciais={pub.responsavel_iniciais}
                                />
                              )}
                            </div>
                            <div className="fw-semibold text-truncate small">
                              {pub.numero_processo_mascara ||
                                pub.numero_processo ||
                                'Sem nº processo'}
                            </div>
                            <div className="text-muted" style={{ fontSize: '0.78rem' }}>
                              {(pub.nome_orgao || pub.orgao) && (
                                <>
                                  {pub.nome_orgao || pub.orgao}
                                  {pub.data_disponibilizacao &&
                                    ` · ${fmtData(pub.data_disponibilizacao)}`}
                                </>
                              )}
                            </div>
                          </div>
                          <div className="d-flex gap-1">
                            {pub.hash_comunicacao && (
                              <button
                                className="btn btn-sm btn-outline-secondary"
                                title="Baixar certidão PDF"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  baixarCertidao(pub)
                                }}
                              >
                                <i className="bi bi-file-earmark-text" />
                              </button>
                            )}
                            <button
                              className="btn btn-sm btn-outline-primary"
                              title="Ver completo"
                              onClick={(e) => {
                                e.stopPropagation()
                                abrirPublicacao(pub)
                              }}
                            >
                              <i className="bi bi-arrow-up-right-square" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  )
}

export default MovimentacoesRecentes
