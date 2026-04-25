import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import useArrastavel from './useArrastavel.js'

// Helper: simula posicao inicial do painel via getBoundingClientRect e
// dimensoes via offsetWidth/offsetHeight no panelRef.current.
function attachFakePanel(result, { x = 0, y = 0, w = 800, h = 500 } = {}) {
  const panel = document.createElement('div')
  Object.defineProperty(panel, 'offsetWidth', { value: w, configurable: true })
  Object.defineProperty(panel, 'offsetHeight', { value: h, configurable: true })
  panel.getBoundingClientRect = () => ({
    left: x,
    top: y,
    width: w,
    height: h,
    right: x + w,
    bottom: y + h,
    x,
    y,
  })
  result.current.panelRef.current = panel
  return panel
}

function attachFakeHeader(result) {
  // headerRef e callback ref no hook — invocamos como funcao para registrar.
  const header = document.createElement('div')
  document.body.appendChild(header)
  act(() => {
    result.current.headerRef(header)
  })
  return header
}

function pointerEvent(type, { clientX = 0, clientY = 0, pointerId = 1, button = 0 } = {}) {
  // jsdom nao implementa PointerEvent — usamos Event customizado com props.
  const e = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(e, { clientX, clientY, pointerId, button })
  // setPointerCapture/releasePointerCapture sao chamadas no target (header).
  return e
}

beforeEach(() => {
  sessionStorage.clear()
  // Viewport padrao para os clamps
  Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
})

describe('useArrastavel', () => {
  it('estado_inicial_usa_initialPosition', () => {
    const { result } = renderHook(() =>
      useArrastavel({ initialPosition: { x: 120, y: 80 } })
    )
    expect(result.current.position).toEqual({ x: 120, y: 80 })
    expect(result.current.isDragging).toBe(false)
  })

  it('pointerdown_no_header_inicia_drag', () => {
    const { result } = renderHook(() =>
      useArrastavel({ initialPosition: { x: 100, y: 80 } })
    )
    attachFakePanel(result, { x: 100, y: 80 })
    const header = attachFakeHeader(result)

    act(() => {
      header.dispatchEvent(pointerEvent('pointerdown', { clientX: 110, clientY: 90 }))
    })

    expect(result.current.isDragging).toBe(true)
  })

  it('clamp_nao_deixa_painel_sair_da_viewport', () => {
    // Painel grande (700x600) com viewport 1000x800; tenta posicionar muito alem.
    Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
    const { result } = renderHook(() =>
      useArrastavel({
        initialPosition: { x: 99999, y: 99999 },
        bounds: { margin: 80 },
      })
    )
    // Sem panelRef montado, clamp usa apenas viewport => maxX = w - margin
    expect(result.current.position.x).toBeLessThanOrEqual(1000 - 80)
    expect(result.current.position.y).toBeLessThanOrEqual(800 - 80)
  })

  it('clamp_negativo_eh_limitado_a_zero_em_y', () => {
    const { result } = renderHook(() =>
      useArrastavel({ initialPosition: { x: 100, y: -500 } })
    )
    expect(result.current.position.y).toBeGreaterThanOrEqual(0)
  })

  it('persiste_em_sessionStorage_quando_storageKey_passado', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() =>
      useArrastavel({
        initialPosition: { x: 100, y: 80 },
        storageKey: 'teste-pos',
      })
    )
    attachFakePanel(result, { x: 100, y: 80 })
    const header = attachFakeHeader(result)

    // Inicia drag e move
    act(() => {
      header.dispatchEvent(pointerEvent('pointerdown', { clientX: 110, clientY: 90 }))
    })
    act(() => {
      document.dispatchEvent(pointerEvent('pointermove', { clientX: 250, clientY: 200 }))
    })
    // rAF flush
    act(() => {
      vi.advanceTimersByTime(20)
    })
    act(() => {
      document.dispatchEvent(pointerEvent('pointerup', { clientX: 250, clientY: 200 }))
    })
    // Debounce do save (200ms)
    act(() => {
      vi.advanceTimersByTime(250)
    })

    const raw = sessionStorage.getItem('teste-pos')
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw)
    expect(typeof parsed.x).toBe('number')
    expect(typeof parsed.y).toBe('number')

    vi.useRealTimers()
  })

  it('restaura_posicao_de_sessionStorage_ao_montar', () => {
    sessionStorage.setItem('saved-pos', JSON.stringify({ x: 333, y: 222 }))
    const { result } = renderHook(() =>
      useArrastavel({
        initialPosition: { x: 100, y: 80 },
        storageKey: 'saved-pos',
      })
    )
    expect(result.current.position).toEqual({ x: 333, y: 222 })
  })

  it('descarta_e_limpa_sessionStorage_invalido', () => {
    sessionStorage.setItem('bad-pos', '{"x":"nao-numero","y":null}')
    const { result } = renderHook(() =>
      useArrastavel({
        initialPosition: { x: 50, y: 60 },
        storageKey: 'bad-pos',
      })
    )
    expect(result.current.position).toEqual({ x: 50, y: 60 })
    // Chave invalida foi limpa
    expect(sessionStorage.getItem('bad-pos')).toBeNull()
  })

  it('descarta_json_corrompido_no_sessionStorage', () => {
    sessionStorage.setItem('corrupt-pos', 'isso-nao-eh-json')
    const { result } = renderHook(() =>
      useArrastavel({
        initialPosition: { x: 10, y: 20 },
        storageKey: 'corrupt-pos',
      })
    )
    expect(result.current.position).toEqual({ x: 10, y: 20 })
    expect(sessionStorage.getItem('corrupt-pos')).toBeNull()
  })

  it('teclado_alt_shift_setas_move_o_painel_quando_header_focado', () => {
    const { result } = renderHook(() =>
      useArrastavel({ initialPosition: { x: 100, y: 100 } })
    )
    attachFakePanel(result, { x: 100, y: 100 })
    const header = attachFakeHeader(result)

    const ev = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      altKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    })
    act(() => {
      header.dispatchEvent(ev)
    })

    expect(result.current.position.x).toBe(120) // 100 + 20
    expect(result.current.position.y).toBe(100)
  })

  it('teclado_sem_alt_shift_nao_move', () => {
    const { result } = renderHook(() =>
      useArrastavel({ initialPosition: { x: 100, y: 100 } })
    )
    const header = attachFakeHeader(result)

    const ev = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
    })
    act(() => {
      header.dispatchEvent(ev)
    })

    expect(result.current.position.x).toBe(100)
  })
})
