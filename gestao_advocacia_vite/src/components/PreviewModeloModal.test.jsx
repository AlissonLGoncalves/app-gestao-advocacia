import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PreviewModeloModal from './PreviewModeloModal.jsx'

const listClientesMock = vi.fn()
const listCasosMock = vi.fn()
const gerarMock = vi.fn()

vi.mock('../api/clientes.js', () => ({
  listClientes: (...args) => listClientesMock(...args),
}))
vi.mock('../api/casos.js', () => ({
  listCasos: (...args) => listCasosMock(...args),
}))
vi.mock('../api/modelos.js', () => ({
  gerarDocumentoDoModelo: (...args) => gerarMock(...args),
}))

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}))

const MODELO = {
  id: 7,
  titulo: 'Procuração PF',
  tipo: 'procuracao_pf',
}

const CLIENTES = [
  { id: 1, nome_razao_social: 'João Silva' },
  { id: 2, nome_razao_social: 'Maria Souza' },
]

const CASOS = [
  { id: 10, cliente_id: 1, numero_processo: '0001-23.2026.8.16.0075' },
  { id: 11, cliente_id: 2, numero_processo: '0002-23.2026.8.16.0075' },
]

beforeEach(() => {
  vi.clearAllMocks()
  listClientesMock.mockResolvedValue(CLIENTES)
  listCasosMock.mockResolvedValue(CASOS)
  gerarMock.mockResolvedValue({ html: '<p>Documento gerado</p>' })
})

describe('PreviewModeloModal', () => {
  it('carrega clientes ao abrir', async () => {
    render(<PreviewModeloModal modelo={MODELO} onClose={vi.fn()} />)
    await waitFor(() => expect(listClientesMock).toHaveBeenCalled())
    expect(screen.getByTestId('preview-modelo-modal')).toBeInTheDocument()
  })

  it('Gerar prévia desabilitado sem cliente', async () => {
    render(<PreviewModeloModal modelo={MODELO} onClose={vi.fn()} />)
    await waitFor(() => expect(listClientesMock).toHaveBeenCalled())
    expect(screen.getByTestId('btn-renderizar')).toBeDisabled()
    expect(screen.getByTestId('btn-imprimir')).toBeDisabled()
  })

  it('com cliente selecionado, Gerar prévia chama backend com cliente_id', async () => {
    render(<PreviewModeloModal modelo={MODELO} onClose={vi.fn()} />)
    await waitFor(() => expect(listClientesMock).toHaveBeenCalled())

    fireEvent.change(screen.getByTestId('preview-cliente-select'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('btn-renderizar'))

    await waitFor(() => expect(gerarMock).toHaveBeenCalled())
    expect(gerarMock).toHaveBeenCalledWith(7, expect.objectContaining({ cliente_id: 1 }))
  })

  it('lista casos só do cliente selecionado', async () => {
    render(<PreviewModeloModal modelo={MODELO} onClose={vi.fn()} />)
    await waitFor(() => expect(listClientesMock).toHaveBeenCalled())

    fireEvent.change(screen.getByTestId('preview-cliente-select'), { target: { value: '1' } })

    // O select de casos so habilita quando (a) clienteId esta setado E (b) os
    // casos terminaram de carregar (fetch async no mount). O waitFor(listClientes)
    // acima nao garante que listCasos ja resolveu — por isso o assert sincrono
    // anterior era flaky (casosDoCliente ainda []  => disabled=true). waitFor
    // espera o re-render apos os casos carregarem.
    const casoSelect = screen.getByTestId('preview-caso-select')
    await waitFor(() => expect(casoSelect).not.toBeDisabled())
    // Cliente 1 só tem caso 10, não 11
    const opcoes = Array.from(casoSelect.querySelectorAll('option')).map((o) => o.value)
    expect(opcoes).toContain('10')
    expect(opcoes).not.toContain('11')
  })

  it('clicar no backdrop fecha o modal', async () => {
    const onClose = vi.fn()
    render(<PreviewModeloModal modelo={MODELO} onClose={onClose} />)
    await waitFor(() => expect(listClientesMock).toHaveBeenCalled())
    fireEvent.click(screen.getByTestId('preview-modelo-backdrop'))
    expect(onClose).toHaveBeenCalled()
  })

  it('botão Imprimir habilitado após renderizar', async () => {
    render(<PreviewModeloModal modelo={MODELO} onClose={vi.fn()} />)
    await waitFor(() => expect(listClientesMock).toHaveBeenCalled())
    fireEvent.change(screen.getByTestId('preview-cliente-select'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('btn-renderizar'))
    await waitFor(() => expect(screen.getByTestId('btn-imprimir')).not.toBeDisabled())
  })
})
