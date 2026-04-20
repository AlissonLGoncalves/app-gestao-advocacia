import { describe, expect, it, vi } from 'vitest'
import { api } from './client.js'
import {
  createDespesa,
  createRecebimento,
  deleteDespesa,
  deleteRecebimento,
  downloadRelatorioContasAPagar,
  getResumoFinanceiro,
  listDespesas,
  listRecebimentos,
  updateDespesa,
  updateRecebimento,
} from './financeiro.js'

vi.mock('./client.js', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
    getBlob: vi.fn(),
  },
}))

describe('api/financeiro', () => {
  it('lista recebimentos com query params', async () => {
    api.get.mockResolvedValueOnce({ recebimentos: [{ id: 1 }] })

    const data = await listRecebimentos({ status: 'Pendente', cliente_id: 10 })

    expect(api.get).toHaveBeenCalledWith('/recebimentos/?status=Pendente&cliente_id=10')
    expect(data).toEqual([{ id: 1 }])
  })

  it('executa CRUD de recebimentos', async () => {
    const payload = { descricao: 'Honorarios', valor: 100 }

    await createRecebimento(payload)
    await updateRecebimento(7, payload)
    await deleteRecebimento(7)

    expect(api.post).toHaveBeenCalledWith('/recebimentos/', payload)
    expect(api.put).toHaveBeenCalledWith('/recebimentos/7', payload)
    expect(api.del).toHaveBeenCalledWith('/recebimentos/7')
  })

  it('lista despesas e executa CRUD', async () => {
    api.get.mockResolvedValueOnce({ despesas: [{ id: 2 }] })
    const payload = { descricao: 'Custas', valor: 50 }

    const data = await listDespesas({ caso_id: 9 })
    await createDespesa(payload)
    await updateDespesa(2, payload)
    await deleteDespesa(2)

    expect(api.get).toHaveBeenCalledWith('/despesas/?caso_id=9')
    expect(data).toEqual([{ id: 2 }])
    expect(api.post).toHaveBeenCalledWith('/despesas/', payload)
    expect(api.put).toHaveBeenCalledWith('/despesas/2', payload)
    expect(api.del).toHaveBeenCalledWith('/despesas/2')
  })

  it('busca resumo financeiro agregado', async () => {
    await getResumoFinanceiro({ periodo: 'mes' })
    expect(api.get).toHaveBeenCalledWith('/dashboard/stats?periodo=mes')
  })

  it('usa getBlob para download de relatorio', async () => {
    const blob = new Blob(['pdf'])
    api.getBlob.mockResolvedValueOnce(blob)

    const result = await downloadRelatorioContasAPagar({ formato: 'pdf' })

    expect(api.getBlob).toHaveBeenCalledWith('/relatorios/contas-a-pagar?formato=pdf')
    expect(result).toBe(blob)
  })
})
