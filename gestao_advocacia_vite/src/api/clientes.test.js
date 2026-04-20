import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCliente, deleteCliente, listClientes } from './clientes'

describe('api/clientes', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    localStorage.setItem('token', 'token-teste')
  })

  it('listClientes passa query params corretamente', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({ ok: true, status: 200, json: async () => [] })

    await listClientes({ search: 'maria', sort_by: 'nome', sort_order: 'asc' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/clientes?search=maria&sort_by=nome&sort_order=asc')
  })

  it('createCliente envia body JSON', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 1 }) })

    await createCliente({ nome: 'Cliente Teste', cpf_cnpj: '123' })

    const [, options] = fetchMock.mock.calls[0]
    expect(options.method).toBe('POST')
    expect(options.body).toBe(JSON.stringify({ nome: 'Cliente Teste', cpf_cnpj: '123' }))
    expect(options.headers['Content-Type']).toBe('application/json')
  })

  it('deleteCliente retorna null em 204', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, status: 204 })

    const result = await deleteCliente(99)

    expect(result).toBeNull()
  })
})
