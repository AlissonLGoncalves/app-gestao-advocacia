import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import EscolherModeloModal from './EscolherModeloModal.jsx'

const listModelosMock = vi.fn()

vi.mock('../api/modelos.js', () => ({
  listModelos: (...args) => listModelosMock(...args),
}))

// Mock PreviewModeloModal pra evitar carregar a árvore inteira
vi.mock('./PreviewModeloModal.jsx', () => ({
  default: ({ modelo, clientePreSelecionadoId, onClose }) => (
    <div
      data-testid="preview-modal-stub"
      data-modelo-id={modelo?.id}
      data-cliente-id={clientePreSelecionadoId}
    >
      preview {modelo?.titulo}
      <button onClick={onClose}>fechar-preview</button>
    </div>
  ),
}))

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}))

const CLIENTE_PF = { id: 1, nome_razao_social: 'João Silva', tipo_pessoa: 'PF' }
const CLIENTE_PJ = { id: 2, nome_razao_social: 'Empresa X LTDA', tipo_pessoa: 'PJ' }

const MODELOS = [
  { id: 10, titulo: 'Procuração PF', tipo: 'procuracao_pf', padrao: true },
  { id: 11, titulo: 'Procuração PJ', tipo: 'procuracao_pj', padrao: true },
  { id: 12, titulo: 'Contrato PF', tipo: 'contrato_pf', padrao: true },
  { id: 13, titulo: 'Contrato PJ', tipo: 'contrato_pj', padrao: true },
  { id: 14, titulo: 'Petição genérica', tipo: 'peticao', padrao: false },
]

beforeEach(() => {
  vi.clearAllMocks()
  listModelosMock.mockResolvedValue(MODELOS)
})

describe('EscolherModeloModal', () => {
  it('lista apenas modelos PF para cliente PF + tipos genéricos', async () => {
    render(<EscolherModeloModal cliente={CLIENTE_PF} onClose={vi.fn()} />)
    await waitFor(() => expect(listModelosMock).toHaveBeenCalled())
    expect(screen.getByTestId('escolher-modelo-10')).toBeInTheDocument() // PF
    expect(screen.getByTestId('escolher-modelo-12')).toBeInTheDocument() // PF
    expect(screen.getByTestId('escolher-modelo-14')).toBeInTheDocument() // peticao (genérico)
    expect(screen.queryByTestId('escolher-modelo-11')).not.toBeInTheDocument() // PJ excluído
    expect(screen.queryByTestId('escolher-modelo-13')).not.toBeInTheDocument() // PJ excluído
  })

  it('lista apenas modelos PJ para cliente PJ + tipos genéricos', async () => {
    render(<EscolherModeloModal cliente={CLIENTE_PJ} onClose={vi.fn()} />)
    await waitFor(() => expect(listModelosMock).toHaveBeenCalled())
    expect(screen.getByTestId('escolher-modelo-11')).toBeInTheDocument() // PJ
    expect(screen.getByTestId('escolher-modelo-13')).toBeInTheDocument() // PJ
    expect(screen.queryByTestId('escolher-modelo-10')).not.toBeInTheDocument() // PF excluído
  })

  it('clicar num modelo abre o preview com cliente pré-selecionado', async () => {
    render(<EscolherModeloModal cliente={CLIENTE_PF} onClose={vi.fn()} />)
    await waitFor(() => expect(listModelosMock).toHaveBeenCalled())
    fireEvent.click(screen.getByTestId('escolher-modelo-10'))

    const preview = screen.getByTestId('preview-modal-stub')
    expect(preview).toBeInTheDocument()
    expect(preview.getAttribute('data-modelo-id')).toBe('10')
    expect(preview.getAttribute('data-cliente-id')).toBe('1')
  })

  it('mostra alert quando não há modelo compatível', async () => {
    listModelosMock.mockResolvedValue([
      { id: 99, titulo: 'Só PJ', tipo: 'procuracao_pj', padrao: false },
    ])
    render(<EscolherModeloModal cliente={CLIENTE_PF} onClose={vi.fn()} />)
    await waitFor(() => expect(listModelosMock).toHaveBeenCalled())
    expect(screen.getByText(/Nenhum modelo compatível/i)).toBeInTheDocument()
  })

  it('clicar no backdrop fecha', async () => {
    const onClose = vi.fn()
    render(<EscolherModeloModal cliente={CLIENTE_PF} onClose={onClose} />)
    await waitFor(() => expect(listModelosMock).toHaveBeenCalled())
    fireEvent.click(screen.getByTestId('escolher-modelo-backdrop'))
    expect(onClose).toHaveBeenCalled()
  })
})
