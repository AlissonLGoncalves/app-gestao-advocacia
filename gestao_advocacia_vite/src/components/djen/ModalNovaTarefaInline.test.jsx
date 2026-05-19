import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ModalNovaTarefaInline from './ModalNovaTarefaInline.jsx'

// Mock api.post → vamos checar payload
const postMock = vi.fn()
vi.mock('../../api/client.js', () => ({
  api: {
    post: (...args) => postMock(...args),
  },
}))

// Mock toast pra silenciar
vi.mock('react-toastify', () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}))

const PUB_BASE = {
  id: 42,
  tipo_comunicacao: 'Intimação',
  numero_processo_mascara: '0000123-45.2026.8.16.0075',
  numero_processo: '00001234520268160075',
  sigla_tribunal: 'TJPR',
  texto: 'Intimada a parte para apresentar contestação no prazo de 15 dias úteis.',
  caso_id: 7,
  importante: true,
}

describe('ModalNovaTarefaInline', () => {
  beforeEach(() => {
    postMock.mockReset()
  })

  it('nao renderiza nada quando pub eh null', () => {
    const { container } = render(<ModalNovaTarefaInline pub={null} onClose={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renderiza modal com titulo pre-preenchido baseado no tipo', () => {
    render(<ModalNovaTarefaInline pub={PUB_BASE} casos={[]} onClose={vi.fn()} />)
    expect(screen.getByTestId('tarefa-inline-modal')).toBeInTheDocument()
    const titulo = screen.getByTestId('tarefa-inline-titulo')
    expect(titulo.value).toContain('Cumprir intimação')
    expect(titulo.value).toContain('0000123-45.2026.8.16.0075')
  })

  it('pre-preenche prioridade Alta quando pub.importante === true', () => {
    const { container } = render(
      <ModalNovaTarefaInline pub={PUB_BASE} casos={[]} onClose={vi.fn()} />
    )
    // Prioridade eh o segundo select da row (Vencimento, Prioridade, Tipo)
    const selects = container.querySelectorAll('select')
    const prioridade = Array.from(selects).find((s) =>
      Array.from(s.options).some((o) => o.textContent === 'Urgente')
    )
    expect(prioridade.value).toBe('Alta')
  })

  it('pre-preenche caso_id com o caso vinculado a pub', () => {
    const casos = [
      { id: 7, numero_processo_mascara: '0000123-45.2026.8.16.0075', titulo: 'Caso teste' },
      { id: 8, numero_processo: 'outro' },
    ]
    render(<ModalNovaTarefaInline pub={PUB_BASE} casos={casos} onClose={vi.fn()} />)
    const select = screen.getByTestId('tarefa-inline-caso')
    expect(select.value).toBe('7')
  })

  it('chama POST /itens-agenda/ com publicacao_djen_id e fecha ao salvar', async () => {
    postMock.mockResolvedValue({ id: 99, titulo: 'Cumprir intimação' })
    const onClose = vi.fn()
    const onCriada = vi.fn()
    render(
      <ModalNovaTarefaInline pub={PUB_BASE} casos={[]} onClose={onClose} onCriada={onCriada} />
    )
    fireEvent.click(screen.getByTestId('tarefa-inline-salvar'))

    await waitFor(() => expect(postMock).toHaveBeenCalled())
    expect(postMock).toHaveBeenCalledWith(
      '/itens-agenda/',
      expect.objectContaining({
        tipo: 'tarefa',
        publicacao_djen_id: 42,
        prioridade: 'Alta',
        categoria: 'Prazo',
      })
    )
    await waitFor(() => expect(onCriada).toHaveBeenCalled())
    expect(onClose).toHaveBeenCalled()
  })

  it('NAO submete quando titulo esta vazio', () => {
    render(
      <ModalNovaTarefaInline
        pub={{ ...PUB_BASE, tipo_comunicacao: '' }}
        casos={[]}
        onClose={vi.fn()}
      />
    )
    const titulo = screen.getByTestId('tarefa-inline-titulo')
    fireEvent.change(titulo, { target: { value: '' } })
    const btn = screen.getByTestId('tarefa-inline-salvar')
    expect(btn).toBeDisabled()
  })

  it('chama onClose ao clicar no backdrop', () => {
    const onClose = vi.fn()
    render(<ModalNovaTarefaInline pub={PUB_BASE} casos={[]} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('tarefa-inline-backdrop'))
    expect(onClose).toHaveBeenCalled()
  })
})
