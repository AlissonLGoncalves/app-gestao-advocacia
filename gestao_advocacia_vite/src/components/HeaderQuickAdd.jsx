/**
 * HeaderQuickAdd — botão "+" global no header.
 *
 * Inspirado no atalho do Astrea: dropdown sempre visível com criação rápida
 * dos itens mais usados (cliente, caso, recebimento, despesa, evento). Reduz
 * navegação repetitiva pelo menu lateral.
 *
 * Atalho: Alt+N abre o dropdown de qualquer tela. Setas navegam, Enter
 * seleciona, Esc fecha. Sem conflito com atalhos nativos do browser.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PlusIcon,
  UserPlusIcon,
  BriefcaseIcon,
  BanknotesIcon,
  CreditCardIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline'

// Lista de itens — mantém ordem por frequência de uso esperada.
// Cada item: label, path (rota de criação), icon (componente Heroicon),
// shortcut (tecla que dispara quando o dropdown está aberto, opcional).
const ITENS = [
  { label: 'Cliente', path: '/clientes/novo', icon: UserPlusIcon, shortcut: 'C' },
  { label: 'Caso', path: '/casos/novo', icon: BriefcaseIcon, shortcut: 'P' }, // P de Processo
  { label: 'Recebimento', path: '/recebimentos/novo', icon: BanknotesIcon, shortcut: 'R' },
  { label: 'Despesa', path: '/despesas/novo', icon: CreditCardIcon, shortcut: 'D' },
  { label: 'Evento (Agenda)', path: '/agenda?novo=evento', icon: CalendarDaysIcon, shortcut: 'E' },
]

export default function HeaderQuickAdd() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const containerRef = useRef(null)
  const buttonRef = useRef(null)

  const handleOpen = useCallback(() => {
    setOpen(true)
    setActiveIdx(0)
  }, [])

  const handleClose = useCallback(() => {
    setOpen(false)
    setActiveIdx(0)
  }, [])

  const handleSelect = useCallback(
    (path) => {
      navigate(path)
      handleClose()
    },
    [navigate, handleClose]
  )

  // Atalho global: Alt+N abre o dropdown de qualquer tela. Não conflita com
  // atalhos do browser (Ctrl+N abre janela nova; usar Alt+ é seguro).
  useEffect(() => {
    const handler = (e) => {
      if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault()
        if (open) {
          handleClose()
          buttonRef.current?.focus()
        } else {
          handleOpen()
        }
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, handleOpen, handleClose])

  // Escape, setas e Enter quando o dropdown está aberto. Tecla de atalho de
  // cada item (C/P/R/D/E) também navega direto.
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleClose()
        buttonRef.current?.focus()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx((i) => (i + 1) % ITENS.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx((i) => (i - 1 + ITENS.length) % ITENS.length)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSelect(ITENS[activeIdx].path)
        return
      }
      // Atalho direto pela letra
      const letra = e.key.toUpperCase()
      const match = ITENS.find((it) => it.shortcut === letra)
      if (match && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        handleSelect(match.path)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, activeIdx, handleClose, handleSelect])

  // Fechar ao clicar fora.
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) handleClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, handleClose])

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', flex: '0 0 auto' }}
      className="d-none d-md-block"
    >
      <button
        ref={buttonRef}
        type="button"
        className="btn btn-sm btn-primary rounded-pill d-flex align-items-center gap-1 px-3"
        onClick={open ? handleClose : handleOpen}
        title="Criar novo... (Alt+N)"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="header-quick-add-toggle"
      >
        <PlusIcon style={{ width: 15, height: 15 }} />
        <span className="d-none d-lg-inline" style={{ fontSize: '0.82rem' }}>
          Novo
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="card shadow border-0 mt-1"
          data-testid="header-quick-add-menu"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            minWidth: 240,
            zIndex: 1050,
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          <div className="list-group list-group-flush">
            {ITENS.map((item, idx) => {
              const Icon = item.icon
              const ativo = idx === activeIdx
              return (
                <button
                  key={item.path}
                  type="button"
                  role="menuitem"
                  className={`list-group-item list-group-item-action d-flex align-items-center gap-2 ${
                    ativo ? 'active' : ''
                  }`}
                  onClick={() => handleSelect(item.path)}
                  onMouseEnter={() => setActiveIdx(idx)}
                  style={{ fontSize: '0.88rem', cursor: 'pointer', border: 'none' }}
                >
                  <Icon style={{ width: 16, height: 16, flex: '0 0 auto' }} />
                  <span className="flex-grow-1 text-start">{item.label}</span>
                  {item.shortcut && (
                    <kbd
                      className={ativo ? 'text-white' : 'text-muted'}
                      style={{
                        fontSize: '0.7rem',
                        padding: '1px 5px',
                        borderRadius: 3,
                        background: ativo ? 'rgba(255,255,255,0.2)' : '#f3f4f6',
                      }}
                    >
                      {item.shortcut}
                    </kbd>
                  )}
                </button>
              )
            })}
          </div>
          <div
            className="px-3 py-2 text-muted small border-top"
            style={{ fontSize: '0.72rem', background: '#f9fafb' }}
          >
            <kbd style={{ fontSize: '0.65rem' }}>↑ ↓</kbd> navegar &nbsp;
            <kbd style={{ fontSize: '0.65rem' }}>Enter</kbd> selecionar &nbsp;
            <kbd style={{ fontSize: '0.65rem' }}>Esc</kbd> fechar
          </div>
        </div>
      )}
    </div>
  )
}
