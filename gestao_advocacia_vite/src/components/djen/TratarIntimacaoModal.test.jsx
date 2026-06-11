/**
 * Fase 2 (inbox-zero) — TratarIntimacaoModal: sugestão pré-seleciona a
 * opção, confirmar cria o item certo (e isso trata a intimação), e
 * intimação sem processo bloqueia com CTA de cadastro.
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}))
vi.mock('../../api/djen.js', () => ({
  getSugestaoTratamento: vi.fn(),
  tratarPublicacao: vi.fn(),
  ignorarPublicacao: vi.fn(),
}))
vi.mock('../../api/itensAgenda.js', () => ({
  createItemAgenda: vi.fn(),
}))

import { getSugestaoTratamento, tratarPublicacao, ignorarPublicacao } from '../../api/djen.js'
import { createItemAgenda } from '../../api/itensAgenda.js'
import TratarIntimacaoModal from './TratarIntimacaoModal.jsx'

const PUB = {
  id: 9,
  caso_id: 4,
  numero_processo: '00077347620258160075',
  numero_processo_mascara: '0007734-76.2025.8.16.0075',
}

const SUGESTAO = {
  tipo_sugerido: 'prazo',
  categoria: 'Prazo',
  titulo: 'Intimação: 0007734-76.2025.8.16.0075',
  data_vencimento: '2026-06-26',
  dias: 15,
  regra: 'contestacao_15d',
  prioridade: 'Alta',
  caso_id: 4,
}

describe('TratarIntimacaoModal (Fase 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSugestaoTratamento.mockResolvedValue(SUGESTAO)
    createItemAgenda.mockResolvedValue({ id: 1 })
    tratarPublicacao.mockResolvedValue({})
    ignorarPublicacao.mockResolvedValue({})
  })

  it('sugestão pré-seleciona Prazo com data calculada; confirmar cria o prazo', async () => {
    const onTratado = vi.fn()
    render(<TratarIntimacaoModal pub={PUB} onTratado={onTratado} onClose={vi.fn()} />)
    await waitFor(() => expect(screen.getByTestId('tratar-data').value).toBe('2026-06-26'))
    fireEvent.click(screen.getByTestId('btn-confirmar-tratamento'))
    await waitFor(() =>
      expect(createItemAgenda).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'tarefa',
          categoria: 'Prazo',
          data_vencimento: '2026-06-26',
          publicacao_djen_id: 9,
          caso_id: 4,
          prioridade: 'Alta',
        })
      )
    )
    expect(onTratado).toHaveBeenCalled()
  })

  it('opção Audiência cria evento com data e hora', async () => {
    render(<TratarIntimacaoModal pub={PUB} onTratado={vi.fn()} onClose={vi.fn()} />)
    await screen.findByTestId('opcao-audiencia')
    fireEvent.click(screen.getByTestId('opcao-audiencia'))
    fireEvent.change(screen.getByTestId('tratar-data'), { target: { value: '2026-07-02' } })
    fireEvent.click(screen.getByTestId('btn-confirmar-tratamento'))
    await waitFor(() =>
      expect(createItemAgenda).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'evento',
          categoria: 'Audiência',
          data_inicio: '2026-07-02T09:00',
        })
      )
    )
  })

  it('"Só registrar" chama tratar; "Descartar" chama ignorar', async () => {
    const onTratado = vi.fn()
    const { unmount } = render(
      <TratarIntimacaoModal pub={PUB} onTratado={onTratado} onClose={vi.fn()} />
    )
    await screen.findByTestId('opcao-registro')
    fireEvent.click(screen.getByTestId('opcao-registro'))
    fireEvent.click(screen.getByTestId('btn-confirmar-tratamento'))
    await waitFor(() => expect(tratarPublicacao).toHaveBeenCalledWith(9, 'registro'))
    unmount()

    render(<TratarIntimacaoModal pub={PUB} onTratado={vi.fn()} onClose={vi.fn()} />)
    await screen.findByTestId('opcao-descartar')
    fireEvent.click(screen.getByTestId('opcao-descartar'))
    fireEvent.click(screen.getByTestId('btn-confirmar-tratamento'))
    await waitFor(() => expect(ignorarPublicacao).toHaveBeenCalledWith(9))
  })

  it('sem processo cadastrado: bloqueia confirmação e oferece cadastro', async () => {
    const onCadastrar = vi.fn()
    render(
      <TratarIntimacaoModal
        pub={{ ...PUB, caso_id: null }}
        onTratado={vi.fn()}
        onClose={vi.fn()}
        onCadastrarProcesso={onCadastrar}
      />
    )
    await waitFor(() => expect(screen.getByTestId('btn-confirmar-tratamento')).toBeDisabled())
    fireEvent.click(screen.getByTestId('btn-cadastrar-processo'))
    expect(onCadastrar).toHaveBeenCalled()
    // mas "Só registrar" continua possível sem caso
    fireEvent.click(screen.getByTestId('opcao-registro'))
    expect(screen.getByTestId('btn-confirmar-tratamento')).not.toBeDisabled()
  })
})
