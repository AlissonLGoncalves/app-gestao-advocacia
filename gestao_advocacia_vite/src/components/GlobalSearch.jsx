import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  UsersIcon,
  BriefcaseIcon,
} from '@heroicons/react/24/outline'
import { api } from '../api/client.js'

export default function GlobalSearch() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState({ clientes: [], casos: [] })
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)
  const containerRef = useRef(null)
  const timerRef = useRef(null)

  const buscar = useCallback(async (q) => {
    if (q.trim().length < 2) {
      setResults({ clientes: [], casos: [] })
      return
    }
    setLoading(true)
    try {
      const [clientesRes, casosRes] = await Promise.all([
        api.get(`/clientes/?search=${encodeURIComponent(q)}`),
        api.get(`/casos/?search=${encodeURIComponent(q)}`),
      ])
      setResults({
        clientes: Array.isArray(clientesRes) ? clientesRes.slice(0, 5) : [],
        casos: Array.isArray(casosRes) ? casosRes.slice(0, 5) : [],
      })
    } catch {
      setResults({ clientes: [], casos: [] })
    } finally {
      setLoading(false)
    }
  }, [])

  const handleInputChange = (e) => {
    const q = e.target.value
    setQuery(q)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => buscar(q), 300)
  }

  const handleOpen = () => {
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleClose = useCallback(() => {
    setOpen(false)
    setQuery('')
    setResults({ clientes: [], casos: [] })
    clearTimeout(timerRef.current)
  }, [])

  const handleSelect = (path) => {
    navigate(path)
    handleClose()
  }

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) handleClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, handleClose])

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, handleClose])

  const temResultados = results.clientes.length > 0 || results.casos.length > 0
  const showDropdown = open && query.trim().length >= 2

  if (!open) {
    return (
      <button
        className="btn btn-sm btn-outline-secondary rounded-pill d-flex align-items-center gap-1 px-3"
        onClick={handleOpen}
        title="Buscar casos e clientes (Ctrl+K)"
        style={{ opacity: 0.85, whiteSpace: 'nowrap' }}
      >
        <MagnifyingGlassIcon style={{ width: 15, height: 15 }} />
        <span className="d-none d-md-inline" style={{ fontSize: '0.82rem' }}>
          Buscar...
        </span>
      </button>
    )
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', zIndex: 1050, flex: '0 0 auto' }}>
      <div
        className="input-group input-group-sm shadow-sm"
        style={{ width: 'clamp(200px, 28vw, 360px)' }}
      >
        <span className="input-group-text bg-white border-end-0">
          {loading ? (
            <span
              className="spinner-border spinner-border-sm text-secondary"
              style={{ width: 13, height: 13 }}
            />
          ) : (
            <MagnifyingGlassIcon style={{ width: 14, height: 14, color: '#6b7280' }} />
          )}
        </span>
        <input
          ref={inputRef}
          type="text"
          className="form-control border-start-0 ps-0"
          placeholder="Buscar casos, clientes..."
          value={query}
          onChange={handleInputChange}
          autoComplete="off"
          style={{ fontSize: '0.88rem' }}
        />
        <button
          className="btn btn-outline-secondary border-start-0"
          onClick={handleClose}
          tabIndex={-1}
        >
          <XMarkIcon style={{ width: 14, height: 14 }} />
        </button>
      </div>

      {showDropdown && (
        <div
          className="card shadow border-0 mt-1"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            maxHeight: '400px',
            overflowY: 'auto',
            borderRadius: '10px',
            minWidth: '300px',
          }}
        >
          {!temResultados && !loading && (
            <div className="p-3 text-center text-muted small">
              Nenhum resultado para &ldquo;<strong>{query}</strong>&rdquo;
            </div>
          )}

          {results.clientes.length > 0 && (
            <>
              <div className="px-3 pt-3 pb-1 d-flex align-items-center gap-2">
                <UsersIcon style={{ width: 12, height: 12, color: '#6b7280' }} />
                <span
                  className="text-muted"
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  Clientes
                </span>
              </div>
              {results.clientes.map((c) => (
                <button
                  key={c.id}
                  className="btn btn-light border-0 w-100 text-start px-3 py-2 d-flex align-items-center gap-2"
                  style={{ borderRadius: 0, fontSize: '0.88rem' }}
                  onClick={() => handleSelect(`/clientes/editar/${c.id}`)}
                >
                  <div className="p-1 rounded bg-primary-subtle flex-shrink-0">
                    <UsersIcon style={{ width: 12, height: 12, color: '#2563eb' }} />
                  </div>
                  <div className="overflow-hidden">
                    <div className="fw-semibold text-truncate">{c.nome_razao_social}</div>
                    {c.cpf_cnpj && (
                      <div className="text-muted text-truncate" style={{ fontSize: '0.74rem' }}>
                        {c.cpf_cnpj}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </>
          )}

          {results.casos.length > 0 && (
            <>
              <div
                className={`px-3 ${results.clientes.length > 0 ? 'pt-2' : 'pt-3'} pb-1 d-flex align-items-center gap-2`}
              >
                <BriefcaseIcon style={{ width: 12, height: 12, color: '#6b7280' }} />
                <span
                  className="text-muted"
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  Casos
                </span>
              </div>
              {results.casos.map((c) => (
                <button
                  key={c.id}
                  className="btn btn-light border-0 w-100 text-start px-3 py-2 d-flex align-items-center gap-2"
                  style={{ borderRadius: 0, fontSize: '0.88rem' }}
                  onClick={() => handleSelect(`/casos/detalhe/${c.id}`)}
                >
                  <div className="p-1 rounded bg-success-subtle flex-shrink-0">
                    <BriefcaseIcon style={{ width: 12, height: 12, color: '#16a34a' }} />
                  </div>
                  <div className="overflow-hidden">
                    <div className="fw-semibold text-truncate">{c.titulo}</div>
                    <div className="text-muted text-truncate" style={{ fontSize: '0.74rem' }}>
                      {c.numero_processo ? `${c.numero_processo} · ` : ''}
                      {c.status}
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}

          {temResultados && (
            <div className="px-3 py-2 border-top text-muted" style={{ fontSize: '0.7rem' }}>
              Até 5 resultados por categoria — refine a busca para mais precisão
            </div>
          )}
        </div>
      )}
    </div>
  )
}
