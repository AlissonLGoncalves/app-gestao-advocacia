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
  providencia: 'Contestação',
  caso_id: 4,
}

// Formato real de GET /casos: cliente vem aninhado, parte contrária é campo
// do caso. É daí que sai o "Quem × quem" da zona extraída.
const CASOS = [
  {
    id: 4,
    titulo: 'Maria × Banco',
    numero_processo: '0007734-76.2025.8.16.0075',
    cliente: { id: 1, nome_razao_social: 'Maria Silva' },
    parte_contraria: 'Banco X',
  },
  { id: 7, titulo: 'Outro caso', numero_processo: '' },
]

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

  // ── Redesign Stitch (set/2026): painel lateral, sugestão, "Confirmar e próxima" ──
  it('modo painel: renderiza aside com campos extraídos, sugestão do Patronus e progresso', async () => {
    render(
      <TratarIntimacaoModal
        pub={{
          ...PUB,
          sigla_tribunal: 'TJPR',
          nome_classe: 'Ação de cobrança',
          data_disponibilizacao: '2026-06-11',
        }}
        casos={CASOS}
        modo="painel"
        confirmadas={2}
        totalFila={12}
        temProxima
        onTratado={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByTestId('tratar-intimacao-painel')).toBeInTheDocument()
    expect(screen.queryByTestId('tratar-intimacao-modal')).not.toBeInTheDocument()
    // partes vêm do caso vinculado (cliente × parte contrária); assunto = nome_classe
    expect(screen.getByText('Maria Silva × Banco X')).toBeInTheDocument()
    expect(screen.getByText('Ação de cobrança')).toBeInTheDocument()
    const sug = await screen.findByTestId('sugestao-patronus')
    expect(sug).toHaveTextContent('Sugestão do Patronus')
    expect(sug).toHaveTextContent('registrar prazo de Contestação — 15 dias → vence 26/06/2026')
    expect(sug).toHaveTextContent('contado a partir de 11/06/2026')
    expect(screen.getByTestId('btn-confirmar-tratamento')).toHaveTextContent('Confirmar e próxima')
    expect(screen.getByTestId('tratar-progresso')).toHaveTextContent('Você confirmou 2 de 12.')
    expect(screen.getByTestId('tratar-caso').value).toBe('4')
  })

  it('sem próxima na fila o botão vira só "Confirmar"; campo inexistente mostra "—"', async () => {
    render(
      <TratarIntimacaoModal
        pub={{ ...PUB, polo_ativo: '', polo_passivo: '' }}
        temProxima={false}
        onTratado={vi.fn()}
        onClose={vi.fn()}
      />
    )
    await screen.findByTestId('opcao-prazo')
    expect(screen.getByTestId('btn-confirmar-tratamento')).toHaveTextContent(/^Confirmar$/)
    const vazios = screen.getAllByTitle('não extraído nesta publicação')
    expect(vazios.length).toBeGreaterThanOrEqual(2) // Partes e Assunto
  })

  it('seletor de caso persiste o vínculo e libera confirmação', async () => {
    const onVincular = vi.fn()
    render(
      <TratarIntimacaoModal
        pub={{ ...PUB, caso_id: null }}
        casos={CASOS}
        onVincularCaso={onVincular}
        onTratado={vi.fn()}
        onClose={vi.fn()}
      />
    )
    await waitFor(() => expect(screen.getByTestId('btn-confirmar-tratamento')).toBeDisabled())
    fireEvent.change(screen.getByTestId('tratar-caso'), { target: { value: '7' } })
    expect(onVincular).toHaveBeenCalledWith(expect.objectContaining({ id: 9 }), 7)
    expect(screen.getByTestId('btn-confirmar-tratamento')).not.toBeDisabled()
    fireEvent.click(screen.getByTestId('btn-confirmar-tratamento'))
    await waitFor(() =>
      expect(createItemAgenda).toHaveBeenCalledWith(expect.objectContaining({ caso_id: 7 }))
    )
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
