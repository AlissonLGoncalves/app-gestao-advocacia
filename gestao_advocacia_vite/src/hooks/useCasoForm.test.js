import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import useCasoForm from './useCasoForm.js'
import { createCaso } from '../api/casos.js'

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }))
vi.mock('../api/casos.js', () => ({
  createCaso: vi.fn(),
  updateCaso: vi.fn(),
}))

globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => ({}) }))

const makeFormData = (overrides = {}) => ({
  titulo: 'Caso Teste',
  cliente_id: '1',
  status: 'Ativo',
  tipo_acao: '',
  area_direito: '',
  valor_causa: '',
  notas_caso: '',
  numero_processo: '',
  ...overrides,
})

const defaultEvento = { titulo: '', data_hora: '', tipo: 'Prazo', notas: '' }

function makeProps(overrides = {}) {
  return {
    formData: makeFormData(),
    isEditing: false,
    casoParaEditar: null,
    onCasoChange: vi.fn(),
    criarEvento: false,
    eventoData: defaultEvento,
    setLoading: vi.fn(),
    ...overrides,
  }
}

const mockEvent = () => ({ preventDefault: vi.fn() })

describe('useCasoForm', () => {
  it('retorna validationErrors vazio no estado inicial', () => {
    const { result } = renderHook(() => useCasoForm(makeProps()))

    expect(result.current.validationErrors).toEqual({})
  })

  it('clearValidationErrors limpa erros existentes', async () => {
    const setLoading = vi.fn()
    const { result } = renderHook(() =>
      useCasoForm(makeProps({ formData: makeFormData({ titulo: '' }), setLoading }))
    )

    await act(async () => {
      await result.current.handleSubmit(mockEvent())
    })
    expect(Object.keys(result.current.validationErrors).length).toBeGreaterThan(0)

    act(() => {
      result.current.clearValidationErrors()
    })
    expect(result.current.validationErrors).toEqual({})
  })

  it('nao chama setLoading quando titulo vazio', async () => {
    const setLoading = vi.fn()
    const { result } = renderHook(() =>
      useCasoForm(makeProps({ formData: makeFormData({ titulo: '' }), setLoading }))
    )

    await act(async () => {
      await result.current.handleSubmit(mockEvent())
    })

    expect(setLoading).not.toHaveBeenCalled()
    expect(result.current.validationErrors.titulo).toBeTruthy()
  })

  it('nao chama setLoading quando cliente_id ausente', async () => {
    const setLoading = vi.fn()
    const { result } = renderHook(() =>
      useCasoForm(makeProps({ formData: makeFormData({ cliente_id: '' }), setLoading }))
    )

    await act(async () => {
      await result.current.handleSubmit(mockEvent())
    })

    expect(setLoading).not.toHaveBeenCalled()
    expect(result.current.validationErrors.cliente_id).toBeTruthy()
  })

  it('nao chama setLoading quando valor_causa negativo', async () => {
    const setLoading = vi.fn()
    const { result } = renderHook(() =>
      useCasoForm(makeProps({ formData: makeFormData({ valor_causa: '-100' }), setLoading }))
    )

    await act(async () => {
      await result.current.handleSubmit(mockEvent())
    })

    expect(setLoading).not.toHaveBeenCalled()
    expect(result.current.validationErrors.valor_causa).toBeTruthy()
  })

  it('chama setLoading quando dados validos', async () => {
    const setLoading = vi.fn()
    createCaso.mockResolvedValueOnce({ id: 1 })

    const { result } = renderHook(() => useCasoForm(makeProps({ setLoading })))

    await act(async () => {
      await result.current.handleSubmit(mockEvent())
    })

    expect(setLoading).toHaveBeenCalledWith(true)
    expect(result.current.validationErrors).toEqual({})
  })
})
