/**
 * NotificacoesBell
 * ================
 * Icone de sino no header com badge de nao-lidas + dropdown listando as
 * ultimas N notificacoes. Polling leve a cada 60s pra pegar novas sem
 * forcar reload da pagina.
 *
 * Comportamento:
 *  - Click no sino abre/fecha dropdown
 *  - Click numa notificacao marca como lida e navega pro link
 *  - "Marcar todas como lidas" no header do dropdown
 *  - Click fora fecha
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { BellIcon } from '@heroicons/react/24/outline'
import { BellAlertIcon } from '@heroicons/react/24/solid'
import {
  getNotificacoesUnreadCount,
  listNotificacoes,
  marcarNotificacaoLida,
  marcarTodasNotificacoesLidas,
} from '../api/notificacoes.js'

const POLL_INTERVAL_MS = 60_000 // 60s

function severidadeBadge(severidade) {
  switch (severidade) {
    case 'danger':
      return 'bg-danger-subtle text-danger-emphasis'
    case 'warning':
      return 'bg-warning-subtle text-warning-emphasis'
    case 'success':
      return 'bg-success-subtle text-success-emphasis'
    case 'info':
    default:
      return 'bg-info-subtle text-info-emphasis'
  }
}

function severidadeDot(severidade) {
  switch (severidade) {
    case 'danger':
      return '#dc3545'
    case 'warning':
      return '#ffc107'
    case 'success':
      return '#198754'
    case 'info':
    default:
      return '#0dcaf0'
  }
}

function formatarData(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const agora = new Date()
  const diff = agora - d
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `${min}min`
  const horas = Math.floor(min / 60)
  if (horas < 24) return `${horas}h`
  const dias = Math.floor(horas / 24)
  if (dias < 7) return `${dias}d`
  return d.toLocaleDateString('pt-BR')
}

export default function NotificacoesBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificacoes, setNotificacoes] = useState([])
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef(null)

  // Polling do unread-count (leve — so devolve { count })
  const refreshCount = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token) return
    try {
      const res = await getNotificacoesUnreadCount()
      setUnreadCount(res?.count ?? 0)
    } catch {
      // Silencioso: nao queremos toast em poll
    }
  }, [])

  useEffect(() => {
    refreshCount()
    const id = setInterval(refreshCount, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [refreshCount])

  // Quando abre o dropdown, busca a lista completa
  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listNotificacoes({ limit: 20 })
      setNotificacoes(data)
    } catch {
      // Silencioso
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) loadList()
  }, [open, loadList])

  // Click fora fecha
  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const handleClickNotif = async (notif) => {
    setOpen(false)
    if (!notif.lida) {
      try {
        await marcarNotificacaoLida(notif.id)
        setUnreadCount((c) => Math.max(0, c - 1))
      } catch {
        // segue mesmo se falhar
      }
    }
    if (notif.link) {
      navigate(notif.link)
    }
  }

  const handleMarcarTodas = async () => {
    try {
      await marcarTodasNotificacoesLidas()
      setUnreadCount(0)
      setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })))
    } catch {
      // silencioso
    }
  }

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="btn btn-link p-2 position-relative"
        aria-label="Notificações"
        title="Notificações"
        onClick={() => setOpen((v) => !v)}
        style={{ lineHeight: 1, color: 'inherit' }}
      >
        {unreadCount > 0 ? (
          <BellAlertIcon style={{ width: 22, height: 22 }} className="text-primary" />
        ) : (
          <BellIcon style={{ width: 22, height: 22 }} />
        )}
        {unreadCount > 0 && (
          <span
            className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
            style={{ fontSize: '0.65rem' }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
            <span className="visually-hidden">não lidas</span>
          </span>
        )}
      </button>

      {open && (
        <div
          className="card shadow-lg"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 380,
            maxHeight: 480,
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1050,
          }}
          role="dialog"
          aria-label="Painel de notificações"
        >
          <div className="card-header d-flex justify-content-between align-items-center py-2 px-3">
            <strong className="small">Notificações</strong>
            {unreadCount > 0 && (
              <button
                type="button"
                className="btn btn-sm btn-link p-0 small text-decoration-none"
                onClick={handleMarcarTodas}
              >
                Marcar todas como lidas
              </button>
            )}
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading && (
              <div className="text-center p-3 small text-muted">
                <span className="spinner-border spinner-border-sm me-2" /> Carregando...
              </div>
            )}
            {!loading && notificacoes.length === 0 && (
              <div className="text-center p-4 small text-muted">
                <BellIcon style={{ width: 32, height: 32 }} className="text-muted mb-2" />
                <div>Sem notificações por aqui.</div>
              </div>
            )}
            {!loading &&
              notificacoes.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleClickNotif(n)}
                  className="d-block w-100 text-start border-0 border-bottom p-3"
                  style={{
                    background: n.lida ? 'transparent' : 'rgba(13, 110, 253, 0.04)',
                    cursor: 'pointer',
                  }}
                >
                  <div className="d-flex gap-2 align-items-start">
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: severidadeDot(n.severidade),
                        marginTop: 6,
                        flexShrink: 0,
                      }}
                      aria-hidden
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <strong
                          className={`small ${n.lida ? 'text-muted fw-normal' : ''}`}
                          style={{ wordBreak: 'break-word' }}
                        >
                          {n.titulo}
                        </strong>
                        <small className="text-muted flex-shrink-0" style={{ fontSize: '0.7rem' }}>
                          {formatarData(n.data_criacao)}
                        </small>
                      </div>
                      {n.mensagem && (
                        <div
                          className="small text-muted mt-1"
                          style={{ fontSize: '0.78rem', lineHeight: 1.3 }}
                        >
                          {n.mensagem}
                        </div>
                      )}
                      <span
                        className={`badge mt-2 ${severidadeBadge(n.severidade)}`}
                        style={{ fontSize: '0.65rem' }}
                      >
                        {n.tipo.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
