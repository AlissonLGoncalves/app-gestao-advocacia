/**
 * Issue #304 — intimação → resposta acionável.
 * Cobre: badge de providência no TratarPrazoModal, seção "Responder com
 * peça" (sugestão de modelo pela providência) e abertura do preview.
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

vi.mock('../api/itensAgenda.js', () => ({
  tratarItemAgenda: vi.fn(),
  getHistoricoItemAgenda: vi.fn().mockResolvedValue([]),
  gerarMinutaItemAgenda: vi.fn(),
}))
vi.mock('../api/modelos.js', () => ({
  listModelos: vi.fn(),
}))
// PreviewModeloModal pesado (iframe, clientes/casos) — stub
vi.mock('./PreviewModeloModal.jsx', () => ({
  default: ({ modelo }) => <div data-testid="preview-stub">{modelo.titulo}</div>,
}))

import { listModelos } from '../api/modelos.js'
import { gerarMinutaItemAgenda } from '../api/itensAgenda.js'
import TratarPrazoModal from './TratarPrazoModal.jsx'

const ITEM = {
  id: 1,
  titulo: 'Intimação: 0001234-56.2026.8.16.0001',
  tipo: 'tarefa',
  categoria: 'Prazo',
  status: 'Pendente',
  data_vencimento: '2026-06-20',
  caso_id: 7,
  publicacao_djen_id: 33,
  tipo_providencia: 'contestacao_15d',
  prazo_calculado_por_ia: true,
  prazo_validado: false,
}

const MODELOS = [
  { id: 10, titulo: 'Procuração PF', tipo: 'procuracao_pf' },
  { id: 11, titulo: 'Contestação Cível', tipo: 'peticao' },
]

describe('TratarPrazoModal — providência e gerar peça (#304)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'tok')
    listModelos.mockResolvedValue(MODELOS)
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
  })

  it('mostra o badge da providência detectada', async () => {
    render(<TratarPrazoModal item={ITEM} onTratado={vi.fn()} onClose={vi.fn()} />)
    expect(await screen.findByTestId('badge-providencia')).toHaveTextContent('Contestação')
  })

  it('sugere primeiro o modelo que casa com a providência', async () => {
    render(<TratarPrazoModal item={ITEM} onTratado={vi.fn()} onClose={vi.fn()} />)
    const select = await screen.findByRole('combobox', { name: /Modelo de peça/i })
    // contestacao_15d → keyword 'contesta' → "Contestação Cível" vem primeiro
    await waitFor(() => expect(select.value).toBe('11'))
  })

  it('"Gerar peça" abre o preview com o modelo escolhido', async () => {
    render(<TratarPrazoModal item={ITEM} onTratado={vi.fn()} onClose={vi.fn()} />)
    const btn = await screen.findByTestId('btn-gerar-peca')
    fireEvent.click(btn)
    expect(await screen.findByTestId('preview-stub')).toHaveTextContent('Contestação Cível')
  })

  it('sem caso vinculado, seção de peça não aparece', async () => {
    render(
      <TratarPrazoModal item={{ ...ITEM, caso_id: null }} onTratado={vi.fn()} onClose={vi.fn()} />
    )
    await screen.findByTestId('badge-providencia')
    expect(screen.queryByTestId('btn-gerar-peca')).not.toBeInTheDocument()
    expect(listModelos).not.toHaveBeenCalled()
  })
})

describe('TratarPrazoModal — redigir minuta com IA (#316)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'tok')
    listModelos.mockResolvedValue(MODELOS)
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
  })

  it('botão redigir chama a API e abre o editor com a minuta', async () => {
    gerarMinutaItemAgenda.mockResolvedValue({
      minuta: '## CONTESTAÇÃO\n\nExcelentíssimo...',
      tipo_peca: 'CONTESTAÇÃO',
      numero_processo: '0001234-56.2026.8.16.0001',
    })
    render(<TratarPrazoModal item={ITEM} onTratado={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(await screen.findByTestId('btn-redigir-minuta'))
    await waitFor(() => expect(gerarMinutaItemAgenda).toHaveBeenCalledWith(1))
    const editor = await screen.findByTestId('minuta-editor-modal')
    expect(editor).toHaveTextContent('Minuta: CONTESTAÇÃO')
    expect(screen.getByTestId('minuta-textarea').value).toContain('Excelentíssimo')
  })

  it('minuta é editável e salvar envia .md pro caso', async () => {
    gerarMinutaItemAgenda.mockResolvedValue({
      minuta: 'Texto original',
      tipo_peca: 'MANIFESTAÇÃO',
      numero_processo: null,
    })
    render(<TratarPrazoModal item={ITEM} onTratado={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(await screen.findByTestId('btn-redigir-minuta'))
    const ta = await screen.findByTestId('minuta-textarea')
    fireEvent.change(ta, { target: { value: 'Texto revisado pelo advogado' } })
    fireEvent.click(screen.getByTestId('btn-salvar-minuta'))
    await waitFor(() => {
      const chamadaUpload = globalThis.fetch.mock.calls.find(([url]) =>
        String(url).includes('/documentos/upload-texto-extraido')
      )
      expect(chamadaUpload).toBeTruthy()
      const fd = chamadaUpload[1].body
      expect(fd.get('caso_id')).toBe('7')
      expect(fd.get('file').name).toMatch(/^Minuta MANIFESTAÇÃO/)
    })
  })

  it('sem caso vinculado, botão de minuta não aparece', async () => {
    render(
      <TratarPrazoModal item={{ ...ITEM, caso_id: null }} onTratado={vi.fn()} onClose={vi.fn()} />
    )
    await screen.findByTestId('badge-providencia')
    expect(screen.queryByTestId('btn-redigir-minuta')).not.toBeInTheDocument()
  })
})
