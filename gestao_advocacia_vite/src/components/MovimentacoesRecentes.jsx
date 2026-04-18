/**
 * MovimentacoesRecentes - Widget de timeline de publicações DJEN dos últimos dias
 * Exibe publicações agrupadas por data com rotulos humanos (Hoje, Ontem, etc)
 */

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_URL } from '../config.js'
import {
  CalendarIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline'

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
      const response = await fetch(
        `${API_URL}/dashboard/publicacoes-recentes?dias=${dias}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      )

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

  const handleNavigateToCaso = (casoId) => {
    if (casoId) {
      navigate(`/casos/${casoId}`)
    }
  }

  const formatarResumo = (resumo) => {
    if (!resumo) return ''
    if (resumo.length > 120) {
      return resumo.substring(0, 120) + '...'
    }
    return resumo
  }

  return (
    <div className={`card border-0 shadow-sm ${className}`} style={{ borderRadius: 'var(--radius-lg)' }}>
      {/* Header */}
      <div className="card-header bg-white border-bottom d-flex justify-content-between align-items-center p-4">
        <div className="d-flex align-items-center gap-3">
          <div
            className="p-3 rounded-circle"
            style={{
              background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)',
            }}
          >
            <CalendarIcon style={{ width: '24px', height: '24px', color: 'var(--primary)' }} />
          </div>
          <div>
            <h5 className="mb-0 fw-bold text-dark">Movimentacoes recentes</h5>
            <p className="mb-0 text-muted small">Publicacoes DJEN dos ultimos dias</p>
          </div>
        </div>

        {/* Periodo selector */}
        <div className="btn-group" role="group">
          {[7, 15, 30].map((dias) => (
            <button
              key={dias}
              type="button"
              className={`btn btn-sm ${
                diasSelecionados === dias
                  ? 'btn-primary'
                  : 'btn-outline-secondary'
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
            <ExclamationCircleIcon
              style={{ width: '24px', height: '24px', flexShrink: 0 }}
            />
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
                <p>Nenhuma publicacao nos ultimos {diasSelecionados} dias</p>
              </div>
            ) : (
              <div className="timeline">
                {publicacoes.grupos.map((grupo, grupoIdx) => (
                  <div
                    key={grupo.data}
                    className={`timeline-group mb-4 ${grupoIdx !== publicacoes.grupos.length - 1 ? 'pb-3' : ''}`}
                    style={{
                      borderLeft: '2px solid #e0e0e0',
                      paddingLeft: '1.5rem',
                      marginLeft: '1rem',
                      position: 'relative',
                    }}
                  >
                    {/* Dot on timeline */}
                    <div
                      style={{
                        position: 'absolute',
                        left: '-10px',
                        top: '0',
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--primary)',
                        border: '3px solid white',
                        boxShadow: '0 0 0 2px var(--primary)',
                      }}
                    />

                    {/* Date label */}
                    <div className="mb-3">
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
                      <span className="text-muted small ms-2">{grupo.data}</span>
                    </div>

                    {/* Publications */}
                    <div className="space-y-2">
                      {grupo.publicacoes.map((pub) => (
                        <div
                          key={pub.id}
                          className="publication-item p-3 rounded-2"
                          onClick={() => handleNavigateToCaso(pub.caso_id)}
                          style={{
                            backgroundColor: pub.lida ? '#f9f9f9' : '#fafbff',
                            border: pub.lida ? '1px solid #e0e0e0' : '1px solid #e3e9f3',
                            cursor: pub.caso_id ? 'pointer' : 'default',
                            transition: 'all 0.2s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (pub.caso_id) {
                              e.currentTarget.style.backgroundColor = '#f0f4ff'
                              e.currentTarget.style.borderColor = 'var(--primary)'
                              e.currentTarget.style.boxShadow = '0 2px 8px rgba(79, 70, 229, 0.1)'
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = pub.lida ? '#f9f9f9' : '#fafbff'
                            e.currentTarget.style.borderColor = pub.lida ? '#e0e0e0' : '#e3e9f3'
                            e.currentTarget.style.boxShadow = 'none'
                          }}
                          role={pub.caso_id ? 'button' : undefined}
                          tabIndex={pub.caso_id ? 0 : undefined}
                          onKeyDown={(e) => {
                            if (pub.caso_id && (e.key === 'Enter' || e.key === ' ')) {
                              handleNavigateToCaso(pub.caso_id)
                            }
                          }}
                        >
                          <div className="d-flex justify-content-between align-items-start mb-2">
                            <div className="flex-grow-1">
                              <p
                                className="mb-1 fw-bold text-dark"
                                style={{
                                  fontSize: '0.95rem',
                                  fontWeight: pub.lida ? '500' : '600',
                                }}
                              >
                                {pub.cliente_nome}
                              </p>
                              {pub.numero_processo && (
                                <p
                                  className="mb-2 text-primary"
                                  style={{
                                    fontSize: '0.9rem',
                                    fontFamily: 'monospace',
                                    cursor: 'pointer',
                                    textDecoration: pub.caso_id ? 'underline' : 'none',
                                  }}
                                >
                                  {pub.numero_processo}
                                </p>
                              )}
                            </div>

                            {/* Not read indicator */}
                            {!pub.lida && (
                              <div
                                style={{
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '50%',
                                  backgroundColor: 'var(--danger)',
                                  marginLeft: '0.5rem',
                                  flexShrink: 0,
                                }}
                              />
                            )}
                          </div>

                          <p className="mb-2 text-muted small" style={{ fontSize: '0.85rem' }}>
                            {pub.tribunal && pub.orgao && (
                              <>
                                <span className="fw-500">{pub.tribunal}</span> • {pub.orgao}
                              </>
                            )}
                          </p>

                          <div className="mb-2 d-flex gap-2 flex-wrap">
                            {pub.tipo_comunicacao && (
                              <span
                                className="badge"
                                style={{
                                  backgroundColor: 'rgba(79, 70, 229, 0.15)',
                                  color: 'var(--primary)',
                                  fontSize: '0.75rem',
                                  fontWeight: '500',
                                  padding: '0.35rem 0.6rem',
                                }}
                              >
                                {pub.tipo_comunicacao}
                              </span>
                            )}
                          </div>

                          {pub.resumo && (
                            <p
                              className="mb-0 text-muted small"
                              style={{
                                fontSize: '0.85rem',
                                lineHeight: '1.4',
                                color: '#666',
                              }}
                            >
                              {formatarResumo(pub.resumo)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
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

        .timeline-group .publication-item {
          transition: all 0.2s ease;
        }
      `}</style>
    </div>
  )
}

export default MovimentacoesRecentes
