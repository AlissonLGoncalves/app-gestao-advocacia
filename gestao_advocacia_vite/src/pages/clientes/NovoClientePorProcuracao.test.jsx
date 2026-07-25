import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'

import NovoClientePorProcuracao from './NovoClientePorProcuracao.jsx'

const { toastMock } = vi.hoisted(() => ({
  toastMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock('react-toastify', () => ({
  toast: toastMock,
}))

const analiseMock = {
  id: 123,
  status: 'done',
  avisos_validacao: ['CPF do outorgante inválido.'],
  dados_extraidos: {
    outorgante: {
      nome_completo: 'Maria da Silva',
      cpf_cnpj: '123.456.789-00',
      tipo_pessoa: 'PF',
      nacionalidade: 'Brasileira',
      estado_civil: 'Solteira',
      profissao: 'Analista',
      rg: '12345',
      endereco: {
        logradouro: 'Rua A',
        numero: '100',
        bairro: 'Centro',
        cidade: 'Curitiba',
        uf: 'PR',
        cep: '80000-000',
      },
      telefone: '41999998888',
      email: 'maria@example.com',
    },
    processo: { numero_cnj: '0001234-12.2026.8.16.0001' },
    objeto_procuracao: 'Representação judicial ampla.',
  },
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/clientes/novo/procuracao']}>
      <Routes>
        <Route path="/clientes/novo/procuracao" element={<NovoClientePorProcuracao />} />
        <Route path="/clientes/:id" element={<div>Detalhe Cliente</div>} />
        <Route path="/clientes" element={<div>Detalhe Cliente</div>} />
        <Route path="/casos/detalhe/:id" element={<div>Detalhe Caso</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('NovoClientePorProcuracao', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'token-teste')
    globalThis.fetch = vi.fn()
  })

  it('test_upload_desabilitado_sem_arquivo', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /analisar procuração/i })).toBeDisabled()
  })

  it('test_upload_mostra_loading_e_exibe_form_com_dados_preenchidos', async () => {
    globalThis.fetch.mockResolvedValueOnce({ ok: true, json: async () => analiseMock })
    renderPage()

    const file = new File(['teste'], 'proc.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText(/selecionar arquivo/i), { target: { files: [file] } })

    fireEvent.click(screen.getByRole('button', { name: /analisar procuração/i }))
    expect(screen.getByRole('button', { name: /analisando procuração/i })).toBeInTheDocument()

    expect(await screen.findByDisplayValue('Maria da Silva')).toBeInTheDocument()
    expect(screen.getByDisplayValue('123.456.789-00')).toBeInTheDocument()
  })

  it('test_form_editavel_e_submete_para_clientes_api', async () => {
    globalThis.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => analiseMock })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 99 }) })

    renderPage()

    const file = new File(['teste'], 'proc.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText(/selecionar arquivo/i), { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: /analisar procuração/i }))

    const nomeInput = await screen.findByDisplayValue('Maria da Silva')
    fireEvent.change(nomeInput, { target: { value: 'Maria Editada' } })

    fireEvent.click(screen.getByRole('button', { name: /revisar confirmação/i }))
    fireEvent.click(screen.getByRole('button', { name: /criar cliente/i }))

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    })

    const secondCall = globalThis.fetch.mock.calls[1]
    expect(String(secondCall[0])).toContain('/clientes')
    expect(secondCall[1].method).toBe('POST')
    expect(secondCall[1].body).toContain('Maria Editada')
    expect(secondCall[1].body).toContain('0001234-12.2026.8.16.0001')
  })

  it('test_exibe_avisos_de_validacao_do_backend', async () => {
    globalThis.fetch.mockResolvedValueOnce({ ok: true, json: async () => analiseMock })
    renderPage()

    const file = new File(['teste'], 'proc.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText(/selecionar arquivo/i), { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: /analisar procuração/i }))

    expect(await screen.findByText(/avisos de validação/i)).toBeInTheDocument()
    expect(screen.getAllByText(/cpf do outorgante inválido/i).length).toBeGreaterThan(0)
  })

  it('test_campo_nao_detectado_mostra_placeholder', async () => {
    const semEmail = {
      ...analiseMock,
      dados_extraidos: {
        ...analiseMock.dados_extraidos,
        outorgante: {
          ...analiseMock.dados_extraidos.outorgante,
          email: '',
        },
      },
    }

    globalThis.fetch.mockResolvedValueOnce({ ok: true, json: async () => semEmail })
    renderPage()

    const file = new File(['teste'], 'proc.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText(/selecionar arquivo/i), { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: /analisar procuração/i }))

    expect(await screen.findByText(/não detectado — preencha manualmente/i)).toBeInTheDocument()
  })

  it('test_quando_caso_existente_exibe_toast_de_vinculo', async () => {
    globalThis.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => analiseMock })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          cliente: { id: 88, nome_razao_social: 'Maria da Silva' },
          caso_existente: true,
          caso_id: 777,
        }),
      })

    renderPage()

    const file = new File(['teste'], 'proc.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText(/selecionar arquivo/i), { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: /analisar procuração/i }))

    await screen.findByDisplayValue('Maria da Silva')
    fireEvent.click(screen.getByRole('button', { name: /revisar confirmação/i }))
    fireEvent.click(screen.getByRole('button', { name: /criar cliente/i }))

    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalled()
    })
  })

  it('test_quando_nao_existe_caso_abrir_modal_e_criar_caso', async () => {
    globalThis.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => analiseMock })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          cliente: { id: 90, nome_razao_social: 'Maria da Silva' },
          caso_existente: false,
          numero_cnj_sugerido: '0001234-12.2026.8.16.0001',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 501, numero_processo: '0001234-12.2026.8.16.0001' }),
      })

    renderPage()

    const file = new File(['teste'], 'proc.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText(/selecionar arquivo/i), { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: /analisar procuração/i }))

    await screen.findByDisplayValue('Maria da Silva')
    fireEvent.click(screen.getByRole('button', { name: /revisar confirmação/i }))
    fireEvent.click(screen.getByRole('button', { name: /criar cliente/i }))

    expect(await screen.findByText(/criar caso automaticamente/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^criar caso$/i }))

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(3)
    })
    expect(String(globalThis.fetch.mock.calls[2][0])).toContain('/procuracoes/123/criar-caso')
  })

  it('test_quando_nao_existe_caso_pode_pular_sem_criar', async () => {
    globalThis.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => analiseMock })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          cliente: { id: 91, nome_razao_social: 'Maria da Silva' },
          caso_existente: false,
          numero_cnj_sugerido: '0001234-12.2026.8.16.0001',
        }),
      })

    renderPage()

    const file = new File(['teste'], 'proc.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText(/selecionar arquivo/i), { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: /analisar procuração/i }))

    await screen.findByDisplayValue('Maria da Silva')
    fireEvent.click(screen.getByRole('button', { name: /revisar confirmação/i }))
    fireEvent.click(screen.getByRole('button', { name: /criar cliente/i }))

    expect(await screen.findByText(/criar caso automaticamente/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /pular/i }))

    await waitFor(() => {
      expect(screen.getByText(/detalhe cliente/i)).toBeInTheDocument()
    })
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })
})
