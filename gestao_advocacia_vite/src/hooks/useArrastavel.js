// Hook que torna um painel arrastavel via pointer events.
// Sem dependencias externas. Funciona com mouse, touch e caneta (pointer events nativos).
//
// Uso:
//   const { panelRef, headerRef, position, isDragging } = useArrastavel({
//     initialPosition: { x: 100, y: 80 },
//     storageKey: 'meu-painel-pos',  // opcional
//     bounds: { margin: 80 },         // opcional, default 80px
//   })
//
// Ligar:
//   <div ref={panelRef} style={{ left: position.x, top: position.y }}>
//     <div ref={headerRef} className={isDragging ? 'dragging' : ''}>...</div>
//   </div>
//
// Atalho de teclado: Alt+Shift+setas movem o painel quando o headerRef tem foco
// (passos de 20px). Respeita prefers-reduced-motion (sem transicoes nas setas).

import { useCallback, useEffect, useRef, useState } from 'react'

const DEFAULT_MARGIN = 80
const KEYBOARD_STEP = 20
const SAVE_DEBOUNCE_MS = 200

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function readStoredPosition(storageKey) {
  if (!storageKey || typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (
      parsed &&
      typeof parsed.x === 'number' &&
      typeof parsed.y === 'number' &&
      Number.isFinite(parsed.x) &&
      Number.isFinite(parsed.y)
    ) {
      return { x: parsed.x, y: parsed.y }
    }
    sessionStorage.removeItem(storageKey)
  } catch {
    try {
      sessionStorage.removeItem(storageKey)
    } catch {
      // ignore
    }
  }
  return null
}

function getViewportSize() {
  if (typeof window === 'undefined') return { w: 1280, h: 800 }
  return {
    w: window.innerWidth || document.documentElement.clientWidth || 1280,
    h: window.innerHeight || document.documentElement.clientHeight || 800,
  }
}

function clampToViewport(pos, margin, panelSize) {
  const { w, h } = getViewportSize()
  // Garante que pelo menos `margin` px do painel sao visiveis em qualquer borda.
  // Se temos o tamanho do painel, usamos para nao deixar sumir alem da borda direita/inferior.
  const panelW = panelSize?.w ?? 0
  const minX = -Math.max(0, panelW - margin)
  const maxX = Math.max(margin, w - margin)
  const minY = 0
  const maxY = Math.max(margin, h - margin)
  return {
    x: clamp(pos.x, minX, maxX),
    y: clamp(pos.y, minY, maxY),
  }
}

export default function useArrastavel(options = {}) {
  const {
    initialPosition = { x: 0, y: 80 },
    storageKey = null,
    bounds = { margin: DEFAULT_MARGIN },
  } = options

  const margin = bounds?.margin ?? DEFAULT_MARGIN

  // Posicao inicial: storage > initialPosition (ja clampada)
  const computeInitial = useCallback(() => {
    const stored = readStoredPosition(storageKey)
    const base = stored || initialPosition
    return clampToViewport(base, margin, null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [position, setPosition] = useState(computeInitial)
  const [isDragging, setIsDragging] = useState(false)
  // headerEl como state (nao ref) para que o useEffect de listeners reaja a montagem.
  const [headerEl, setHeaderEl] = useState(null)
  const headerRef = useCallback((node) => {
    setHeaderEl(node)
  }, [])

  const panelRef = useRef(null)
  const dragStateRef = useRef({ active: false, offsetX: 0, offsetY: 0, pointerId: null })
  const saveTimerRef = useRef(null)
  const rafIdRef = useRef(null)
  const pendingPosRef = useRef(null)

  // Debounced save em sessionStorage
  const schedulePersist = useCallback(
    (pos) => {
      if (!storageKey || typeof sessionStorage === 'undefined') return
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        try {
          sessionStorage.setItem(storageKey, JSON.stringify({ x: pos.x, y: pos.y }))
        } catch {
          // quota cheia ou storage indisponivel — silencioso
        }
      }, SAVE_DEBOUNCE_MS)
    },
    [storageKey]
  )

  const applyPosition = useCallback(
    (newPos) => {
      const panel = panelRef.current
      const panelSize = panel
        ? { w: panel.offsetWidth, h: panel.offsetHeight }
        : null
      const clamped = clampToViewport(newPos, margin, panelSize)
      setPosition(clamped)
      schedulePersist(clamped)
    },
    [margin, schedulePersist]
  )

  // Pointer move: usar rAF para coalescer atualizacoes durante o drag.
  const handlePointerMove = useCallback(
    (e) => {
      if (!dragStateRef.current.active) return
      if (e.pointerId !== dragStateRef.current.pointerId) return

      const newX = e.clientX - dragStateRef.current.offsetX
      const newY = e.clientY - dragStateRef.current.offsetY
      pendingPosRef.current = { x: newX, y: newY }

      if (rafIdRef.current != null) return
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null
        const pos = pendingPosRef.current
        if (pos) applyPosition(pos)
      })
    },
    [applyPosition]
  )

  const handlePointerUp = useCallback(
    (e) => {
      if (!dragStateRef.current.active) return
      if (e.pointerId !== dragStateRef.current.pointerId) return
      dragStateRef.current.active = false
      dragStateRef.current.pointerId = null
      setIsDragging(false)
      try {
        const target = e.target
        if (target && typeof target.releasePointerCapture === 'function') {
          target.releasePointerCapture(e.pointerId)
        }
      } catch {
        // ignore
      }
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      // Flush qualquer posicao pendente
      if (pendingPosRef.current) {
        applyPosition(pendingPosRef.current)
        pendingPosRef.current = null
      }
    },
    [applyPosition]
  )

  const handlePointerDown = useCallback((e) => {
    // Apenas botao primario / touch / caneta. Ignora botoes auxiliares do mouse.
    if (e.button !== undefined && e.button !== 0) return
    const panel = panelRef.current
    if (!panel) return

    const rect = panel.getBoundingClientRect()
    dragStateRef.current = {
      active: true,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      pointerId: e.pointerId,
    }
    setIsDragging(true)
    try {
      if (typeof e.target?.setPointerCapture === 'function') {
        e.target.setPointerCapture(e.pointerId)
      }
    } catch {
      // ignore
    }
  }, [])

  // Liga onPointerDown no header. Tambem registra move/up no document
  // (pointer capture cuidaria mas isso e fallback).
  useEffect(() => {
    if (!headerEl) return
    headerEl.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)
    document.addEventListener('pointercancel', handlePointerUp)
    return () => {
      headerEl.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
      document.removeEventListener('pointercancel', handlePointerUp)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current)
    }
  }, [headerEl, handlePointerDown, handlePointerMove, handlePointerUp])

  // Atalho de teclado: Alt+Shift+setas no header focado
  useEffect(() => {
    if (!headerEl) return
    const onKey = (e) => {
      if (!e.altKey || !e.shiftKey) return
      let dx = 0
      let dy = 0
      switch (e.key) {
        case 'ArrowUp':
          dy = -KEYBOARD_STEP
          break
        case 'ArrowDown':
          dy = KEYBOARD_STEP
          break
        case 'ArrowLeft':
          dx = -KEYBOARD_STEP
          break
        case 'ArrowRight':
          dx = KEYBOARD_STEP
          break
        default:
          return
      }
      e.preventDefault()
      setPosition((prev) => {
        const panel = panelRef.current
        const panelSize = panel
          ? { w: panel.offsetWidth, h: panel.offsetHeight }
          : null
        const next = clampToViewport({ x: prev.x + dx, y: prev.y + dy }, margin, panelSize)
        schedulePersist(next)
        return next
      })
    }
    headerEl.addEventListener('keydown', onKey)
    return () => headerEl.removeEventListener('keydown', onKey)
  }, [headerEl, margin, schedulePersist])

  // Re-clamp quando a viewport muda (resize)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => {
      setPosition((prev) => {
        const panel = panelRef.current
        const panelSize = panel
          ? { w: panel.offsetWidth, h: panel.offsetHeight }
          : null
        return clampToViewport(prev, margin, panelSize)
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [margin])

  return { panelRef, headerRef, position, isDragging }
}
