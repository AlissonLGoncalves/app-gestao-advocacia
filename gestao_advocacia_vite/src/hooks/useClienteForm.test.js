import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import useClienteForm from './useClienteForm.js'
import { createCliente } from '../api/clientes.js'

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }))
vi.mock('../api/clientes.js', () => ({
  createCliente: vi.fn(),
  updateCliente: vi.fn(),
}))

const makeFormData = (overrides = {}) => ({
  nome_razao_social: 'Empresa Teste Ltda',
  cpf_cnpj: '12.345.678/0001-90',
  tipo_pessoa: 'PJ',
  email: '',
  telefone: '',
  cnpj_secundario: '',
  cnpj_terciario: '',
  ...overrides,
})

function makeProps(overrides = {}) {
  return {
    formData: makeFormData(),
    isEditing: false,
    clienteParaEditar: null,
    onClienteChange: vi.fn(),
    setLoading: vi.fn(),
    ...overrides,
  }
}

const mockEvent = () => ({ preventDefault: vi.fn() })

describe('useClienteForm', () => {
  it('retorna validationErrors vazio no estado inicial', () => {
    const { result } = renderHook(() => useClienteForm(makeProps()))

    expect(result.current.validationErrors).toEqual({})
  })

  it('chama setLoading quando dados PJ validos', async () => {
    const setLoading = vi.fn()
    createCliente.mockResolvedValueOnce({ id: 1 })

    const { result } = renderHook(() => useClienteForm(makeProps({ setLoading })))

    await act(async () => {
      await result.current.handleSubmit(mockEvent())
    })

    expect(setLoading).toHaveBeenCalledWith(true)
    expect(result.current.validationErrors).toEqual({})
  })

  it('nao chama setLoading quando nome_razao_social vazio', async () => {
    const setLoading = vi.fn()
    const { result } = renderHook(() =>
      useClienteForm(makeProps({ formData: makeFormData({ nome_razao_social: '' }), setLoading }))
    )

    await act(async () => {
      await result.current.handleSubmit(mockEvent())
    })

    expect(setLoading).not.toHaveBeenCalled()
    expect(result.current.validationErrors.nome_razao_social).toBeTruthy()
  })

  it('nao chama setLoading quando email invalido', async () => {
    const setLoading = vi.fn()
    const { result } = renderHook(() =>
      useClienteForm(makeProps({ formData: makeFormData({ email: 'nao-e-email' }), setLoading }))
    )

    await act(async () => {
      await result.current.handleSubmit(mockEvent())
    })

    expect(setLoading).not.toHaveBeenCalled()
    expect(result.current.validationErrors.email).toBeTruthy()
  })

  it('nao gera erro de email quando email valido', async () => {
    const setLoading = vi.fn()
    createCliente.mockResolvedValueOnce({ id: 2 })

    const { result } = renderHook(() =>
      useClienteForm(
        makeProps({ formData: makeFormData({ email: 'ok@empresa.com.br' }), setLoading })
      )
    )

    await act(async () => {
      await result.current.handleSubmit(mockEvent())
    })

    expect(result.current.validationErrors.email).toBeFalsy()
  })

  it('nao chama setLoading quando CNPJ secundario igual ao principal', async () => {
    const cnpj = '12.345.678/0001-90'
    const setLoading = vi.fn()
    const { result } = renderHook(() =>
      useClienteForm(makeProps({ formData: makeFormData({ cnpj_secundario: cnpj }), setLoading }))
    )

    await act(async () => {
      await result.current.handleSubmit(mockEvent())
    })

    expect(setLoading).not.toHaveBeenCalled()
    expect(result.current.validationErrors.cnpj_secundario).toBeTruthy()
  })

  it('clearValidationErrors limpa os erros', async () => {
    const setLoading = vi.fn()
    const { result } = renderHook(() =>
      useClienteForm(makeProps({ formData: makeFormData({ nome_razao_social: '' }), setLoading }))
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

  it('nao chama setLoading quando CPF PF com digitos incorretos', async () => {
    const setLoading = vi.fn()
    const { result } = renderHook(() =>
      useClienteForm(
        makeProps({
          formData: makeFormData({ tipo_pessoa: 'PF', cpf_cnpj: '123.456.789' }),
          setLoading,
        })
      )
    )

    await act(async () => {
      await result.current.handleSubmit(mockEvent())
    })

    expect(setLoading).not.toHaveBeenCalled()
    expect(result.current.validationErrors.cpf_cnpj).toBeTruthy()
  })
})
