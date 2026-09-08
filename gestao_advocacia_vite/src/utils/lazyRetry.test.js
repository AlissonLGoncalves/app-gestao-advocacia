import { describe, it, expect, beforeEach, vi } from 'vitest'
import { isChunkLoadError, loadWithRetry } from './lazyRetry.js'

const chunkErr = () => new TypeError('Failed to fetch dynamically imported module: /assets/x.js')

describe('lazyRetry', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('reconhece erros de carga de chunk e ignora outros', () => {
    expect(isChunkLoadError(chunkErr())).toBe(true)
    expect(isChunkLoadError(new Error('Loading chunk 12 failed'))).toBe(true)
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false)
  })

  it('recarrega a pagina uma vez no primeiro erro de chunk', async () => {
    const reload = vi.fn()
    const importer = vi.fn().mockRejectedValue(chunkErr())

    let resolved = false
    loadWithRetry(importer, { reload }).then(() => {
      resolved = true
    })
    await new Promise((r) => setTimeout(r, 0))

    expect(reload).toHaveBeenCalledTimes(1)
    expect(resolved).toBe(false)
    expect(window.sessionStorage.getItem('patronus_chunk_reload')).toBe('1')
  })

  it('nao entra em loop: com a flag ja setada, propaga o erro', async () => {
    window.sessionStorage.setItem('patronus_chunk_reload', '1')
    const reload = vi.fn()
    const importer = vi.fn().mockRejectedValue(chunkErr())

    await expect(loadWithRetry(importer, { reload })).rejects.toThrow(/dynamically imported/)
    expect(reload).not.toHaveBeenCalled()
  })

  it('limpa a flag quando o chunk carrega', async () => {
    window.sessionStorage.setItem('patronus_chunk_reload', '1')
    const mod = { default: () => null }
    await expect(loadWithRetry(() => Promise.resolve(mod))).resolves.toBe(mod)
    expect(window.sessionStorage.getItem('patronus_chunk_reload')).toBeNull()
  })

  it('erros que nao sao de chunk passam direto sem recarregar', async () => {
    const reload = vi.fn()
    await expect(
      loadWithRetry(() => Promise.reject(new Error('boom')), { reload })
    ).rejects.toThrow('boom')
    expect(reload).not.toHaveBeenCalled()
  })
})
