/**
 * Testes do fluxo "Criar caso com os dados do tribunal" (BuscarProcessoCnjPage).
 * Cobre: busca → botão criar → escolha de polo/cliente → createCliente +
 * createCaso com campos pré-preenchidos → navegação pro caso.
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

const mockNavigate = vi.fn()
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../api/casos.js', () => ({
  buscarProcessoOnDemand: vi.fn(),
  createCaso: vi.fn(),
}))
vi.mock('../api/clientes.js', () => ({
  listClientes: vi.fn(),
  createCliente: vi.fn(),
}))

import { buscarProcessoOnDemand, createCaso } from '../api/casos.js'
import { listClientes, createCliente } from '../api/clientes.js'
import BuscarProcessoCnjPage from './BuscarProcessoCnjPage.jsx'

const RESULTADO_OK = {
  tribunal: { tribunal_nome: 'TJPR', tribunal_codigo: 'TJPR', segmento_nome: 'Estadual' },
  ja_cadastrado: null,
  resultado: {
    sucesso: true,
    fonte: 'DataJud',
    titulo_sugerido: 'Ação de Cobrança',
    cnj_normalizado: '0000472-75.2025.8.16.0075',
    classe_acao: 'Procedimento Comum Cível',
    vara_juizo: '2ª Vara Cível',
    instancia: '1º Grau',
    data_distribuicao: '2025-03-10',
    valor_causa: '15000.00',
    polo_ativo: [{ nome: 'DIRCE DE OLIVEIRA' }],
    polo_passivo: [{ nome: 'BANCO XPTO S/A' }],
    movimentacoes: [],
  },
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <BuscarProcessoCnjPage />
    </MemoryRouter>
  )

async function buscar() {
  fireEvent.change(screen.getByPlaceholderText(/0000000/), {
    target: { value: '0000472-75.2025.8.16.0075' },
  })
  fireEvent.click(screen.getByRole('button', { name: /^Buscar$/i }))
  await screen.findByText('Processo encontrado')
}

describe('BuscarProcessoCnjPage — criar caso da busca', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'tok')
    buscarProcessoOnDemand.mockResolvedValue(RESULTADO_OK)
    listClientes.mockResolvedValue([])
  })

  it('mostra botão "Criar caso" quando o processo não está cadastrado', async () => {
    renderPage()
    await buscar()
    expect(screen.getByTestId('btn-criar-caso-da-busca')).toBeInTheDocument()
  })

  it('NÃO mostra botão criar quando já cadastrado', async () => {
    buscarProcessoOnDemand.mockResolvedValue({
      ...RESULTADO_OK,
      ja_cadastrado: { caso_id: 5, titulo: 'X' },
    })
    renderPage()
    await buscar()
    expect(screen.queryByTestId('btn-criar-caso-da-busca')).not.toBeInTheDocument()
  })

  it('cria cliente novo (autor) + caso com campos do tribunal e navega', async () => {
    createCliente.mockResolvedValue({ id: 42, nome_razao_social: 'DIRCE DE OLIVEIRA' })
    createCaso.mockResolvedValue({ id: 99, publicacoes_djen_vinculadas: 2 })

    renderPage()
    await buscar()
    fireEvent.click(screen.getByTestId('btn-criar-caso-da-busca'))

    // modal abre com título sugerido
    await screen.findByText(/Criar caso com os dados do tribunal/i)
    fireEvent.click(screen.getByRole('button', { name: /Criar caso$/i }))

    await waitFor(() => expect(createCliente).toHaveBeenCalledTimes(1))
    // cliente novo = polo ativo (autor, default)
    expect(createCliente).toHaveBeenCalledWith(
      expect.objectContaining({ nome_razao_social: 'DIRCE DE OLIVEIRA', tipo_pessoa: 'PF' })
    )
    await waitFor(() => expect(createCaso).toHaveBeenCalledTimes(1))
    const payload = createCaso.mock.calls[0][0]
    expect(payload.cliente_id).toBe(42)
    expect(payload.numero_processo).toBe('0000472-75.2025.8.16.0075')
    expect(payload.tipo_acao).toBe('Procedimento Comum Cível')
    expect(payload.vara_juizo).toBe('2ª Vara Cível')
    expect(payload.valor_causa).toBe(15000)
    // cliente é autor → parte contrária é o polo passivo
    expect(payload.parte_contraria).toBe('BANCO XPTO S/A')
    expect(mockNavigate).toHaveBeenCalledWith('/casos/detalhe/99')
  })

  it('ao escolher Réu, parte contrária vira o polo ativo', async () => {
    createCliente.mockResolvedValue({ id: 7, nome_razao_social: 'BANCO XPTO S/A' })
    createCaso.mockResolvedValue({ id: 100 })

    renderPage()
    await buscar()
    fireEvent.click(screen.getByTestId('btn-criar-caso-da-busca'))
    await screen.findByText(/Criar caso com os dados do tribunal/i)

    fireEvent.click(screen.getByRole('button', { name: /Réu/i }))
    fireEvent.click(screen.getByRole('button', { name: /Criar caso$/i }))

    await waitFor(() => expect(createCaso).toHaveBeenCalledTimes(1))
    const payload = createCaso.mock.calls[0][0]
    expect(payload.parte_contraria).toBe('DIRCE DE OLIVEIRA')
    expect(createCliente).toHaveBeenCalledWith(
      expect.objectContaining({ nome_razao_social: 'BANCO XPTO S/A' })
    )
  })
})
