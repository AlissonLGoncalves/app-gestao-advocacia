/**
 * Intimações (redesign Stitch, set/2026) — a tela precisa responder "o que
 * fazer agora": cabeçalho com pendências + progresso do dia, toolbar de três
 * coisas (pills · tribunal · busca) com o resto num popover, cards com a zona
 * "Extraído automaticamente" (e "—" onde o tribunal não mandou nada), painel
 * lateral "Tratar" em telas largas e estados vazios como recompensa.
 *
 * Os query params ?tribunal= e ?aba= são CONTRATO com a tela Início, que
 * linka direto pra caixa filtrada — por isso têm teste próprio.
 */
import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

vi.mock('react-toastify', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
  },
}))

vi.mock('../api/djen.js', () => ({
  autoVincularPendentes: vi.fn(),
  backfillPartes: vi.fn(),
  baixarCertidao: vi.fn(),
  createOab: vi.fn(),
  deleteOab: vi.fn(),
  getPublicacao: vi.fn(),
  getSugestaoTratamento: vi.fn(),
  getSyncJobStatus: vi.fn(),
  ignorarPublicacao: vi.fn(),
  ignorarTriagem: vi.fn(),
  listOabs: vi.fn(),
  listPublicacoes: vi.fn(),
  listTriagem: vi.fn(),
  processarLoteTriagem: vi.fn(),
  reclassificarPublicacao: vi.fn(),
  syncDjen: vi.fn(),
  tratarPublicacao: vi.fn(),
  tratarPublicacoesEmLote: vi.fn(),
  updatePublicacao: vi.fn(),
  vincularDecisao: vi.fn(),
}))
vi.mock('../api/casos.js', () => ({ listCasos: vi.fn() }))
vi.mock('../api/itensAgenda.js', () => ({ createItemAgenda: vi.fn() }))

import {
  getSugestaoTratamento,
  ignorarPublicacao,
  listOabs,
  listPublicacoes,
  listTriagem,
  syncDjen,
} from '../api/djen.js'
import { listCasos } from '../api/casos.js'
import DjenPage from './DjenPage.jsx'

const OAB = { id: 1, numero_oab: '94297', uf_oab: 'PR', nome_advogado: 'Alisson' }

// Formato real de GET /casos (cliente aninhado).
const CASOS = [
  {
    id: 4,
    titulo: 'Maria × Banco',
    cliente: { id: 1, nome_razao_social: 'Maria Silva' },
    parte_contraria: 'Banco X',
  },
]

// Publicação "completa": tudo que o tribunal mandou está lá.
const PUB_COMPLETA = {
  id: 11,
  sigla_tribunal: 'TJPR',
  nome_orgao: '1ª Vara Cível de Cascavel',
  tipo_comunicacao: 'Intimação',
  data_disponibilizacao: '2026-09-08',
  numero_processo: '00077347620258160075',
  numero_processo_mascara: '0007734-76.2025.8.16.0075',
  nome_classe: 'Ação de cobrança',
  caso_id: 4,
  texto: 'Fica a parte ré intimada para apresentar contestação no prazo legal.',
  prazo_sugerido: {
    providencia: 'Contestação',
    tipo_sugerido: 'prazo',
    dias: 15,
    data_vencimento: '2026-09-23',
    regra: 'contestacao_15d',
  },
}

// Publicação "crua": sem partes, sem classe, sem prazo reconhecido.
const PUB_CRUA = {
  id: 12,
  sigla_tribunal: 'TRT9',
  data_disponibilizacao: '2026-09-08',
  numero_processo: '',
  nome_classe: '',
  caso_id: null,
  texto: 'Publicação genérica sem providência reconhecível.',
  prazo_sugerido: null,
}

const CONTAGENS = {
  todas: 40,
  nao_lidas: 3,
  pendentes: 2,
  vinculadas: 38,
  importantes: 0,
  nao_tratadas: 2,
  sem_processo: 1,
  tratadas: 38,
  descartadas: 0,
  tratadas_hoje: 6,
}

function respostaLista(items = [PUB_COMPLETA, PUB_CRUA], extra = {}) {
  return { items, total: items.length, nao_lidas: 1, contagens: CONTAGENS, ...extra }
}

function mockMatchMedia(matches) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

function renderPagina(rota = '/djen') {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <DjenPage />
    </MemoryRouter>
  )
}

describe('DjenPage — Intimações (redesign Stitch)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // O auto-backfill de partes roda uma vez por sessão; a flag deixa o teste
    // determinístico (sem refetch extra no meio das asserções).
    sessionStorage.setItem('djen_backfill_partes_ok', '1')
    mockMatchMedia(false)
    listPublicacoes.mockResolvedValue(respostaLista())
    listOabs.mockResolvedValue([OAB])
    listCasos.mockResolvedValue(CASOS)
    listTriagem.mockResolvedValue({ items: [], total: 0 })
    // Sem job_id o sync silencioso da montagem termina sem barulho.
    syncDjen.mockResolvedValue({})
    getSugestaoTratamento.mockResolvedValue({
      tipo_sugerido: 'prazo',
      categoria: 'Prazo',
      titulo: 'Intimação: 0007734-76.2025.8.16.0075',
      data_vencimento: '2026-09-23',
      dias: 15,
      regra: 'contestacao_15d',
      prioridade: 'Alta',
      providencia: 'Contestação',
      caso_id: 4,
    })
    ignorarPublicacao.mockResolvedValue({})
  })

  afterEach(() => {
    sessionStorage.clear()
  })

  it('cabeçalho: título, "n publicações aguardam sua decisão" e progresso do dia', async () => {
    renderPagina()
    expect(await screen.findByRole('heading', { name: 'Intimações', level: 1 })).toBeInTheDocument()
    expect(screen.getByTestId('dj-subtitulo')).toHaveTextContent(
      '2 publicações aguardam sua decisão'
    )
    // tratadas_hoje=6 + nao_tratadas=2 → "6 de 8 tratadas hoje"
    expect(screen.getByTestId('dj-progresso')).toHaveTextContent('6 de 8 tratadas hoje')
  })

  it('singular no subtítulo quando resta uma só', async () => {
    listPublicacoes.mockResolvedValue(
      respostaLista([PUB_COMPLETA], { contagens: { ...CONTAGENS, nao_tratadas: 1 } })
    )
    renderPagina()
    await waitFor(() =>
      expect(screen.getByTestId('dj-subtitulo')).toHaveTextContent(
        '1 publicação aguarda sua decisão'
      )
    )
  })

  it('toolbar tem só três coisas: pills, tribunal e busca — o resto no popover', async () => {
    renderPagina()
    await screen.findByTestId('djen-categorias')
    // três pills: Não tratadas · Sem processo · Tratadas
    const pills = within(screen.getByTestId('djen-categorias')).getAllByRole('tab')
    expect(pills).toHaveLength(3)
    expect(screen.getByTestId('djen-cat-nao_tratadas')).toBeInTheDocument()
    expect(screen.getByTestId('djen-cat-sem_processo')).toBeInTheDocument()
    expect(screen.getByTestId('djen-cat-tratadas')).toBeInTheDocument()
    expect(screen.getByTestId('select-tribunal')).toBeInTheDocument()
    expect(screen.getByTestId('busca-pubs')).toBeInTheDocument()

    // Nada de ordenação/período/itens por página fora do popover.
    expect(screen.queryByLabelText('Ordenar por')).not.toBeInTheDocument()
    expect(screen.queryByTestId('popover-filtros')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('btn-filtros'))
    const popover = screen.getByTestId('popover-filtros')
    // nenhum filtro foi removido — só escondido
    expect(within(popover).getByLabelText('Ordenar por')).toBeInTheDocument()
    expect(within(popover).getByLabelText('Leitura')).toBeInTheDocument()
    expect(within(popover).getByLabelText('Data início')).toBeInTheDocument()
    expect(within(popover).getByLabelText('Data fim')).toBeInTheDocument()
    expect(within(popover).getByLabelText('OAB')).toBeInTheDocument()
    expect(within(popover).getByLabelText('Origem')).toBeInTheDocument()
    expect(within(popover).getByLabelText('Por página')).toBeInTheDocument()
    expect(within(popover).getByLabelText('Caixa')).toBeInTheDocument()
  })

  it('?tribunal=TJPR pré-seleciona o dropdown e filtra server-side (contrato com o Início)', async () => {
    renderPagina('/djen?tribunal=tjpr')
    await waitFor(() =>
      expect(listPublicacoes).toHaveBeenCalledWith(
        expect.objectContaining({ sigla_tribunal: 'TJPR' })
      )
    )
    expect(screen.getByTestId('select-tribunal')).toHaveValue('TJPR')
  })

  it('?aba=tratadas pré-seleciona a pill e pede a caixa certa (contrato com o Início)', async () => {
    renderPagina('/djen?aba=tratadas')
    await waitFor(() =>
      expect(listPublicacoes).toHaveBeenCalledWith(expect.objectContaining({ inbox: 'tratadas' }))
    )
    expect(screen.getByTestId('djen-cat-tratadas')).toHaveAttribute('aria-selected', 'true')
  })

  it('?aba=sem-processo pede as não tratadas sem caso vinculado', async () => {
    renderPagina('/djen?aba=sem-processo')
    await waitFor(() =>
      expect(listPublicacoes).toHaveBeenCalledWith(
        expect.objectContaining({ inbox: 'nao_tratadas', vinculacao: 'sem_caso' })
      )
    )
    expect(screen.getByTestId('djen-cat-sem_processo')).toHaveAttribute('aria-selected', 'true')
  })

  it('?aba=oabs abre a aba de OABs monitoradas', async () => {
    renderPagina('/djen?aba=oabs')
    expect(await screen.findByTestId('aba-oabs')).toBeInTheDocument()
    expect(screen.queryByTestId('djen-categorias')).not.toBeInTheDocument()
  })

  it('trocar tribunal no dropdown grava ?tribunal= e refaz a busca', async () => {
    renderPagina()
    await screen.findByTestId('select-tribunal')
    listPublicacoes.mockClear()
    fireEvent.change(screen.getByTestId('select-tribunal'), { target: { value: 'TRT9' } })
    await waitFor(() =>
      expect(listPublicacoes).toHaveBeenCalledWith(
        expect.objectContaining({ sigla_tribunal: 'TRT9' })
      )
    )
  })

  it('busca com dígitos vira nº do processo; sem dígitos vira nome da parte', async () => {
    renderPagina()
    const campo = await screen.findByTestId('busca-pubs')

    fireEvent.change(campo, { target: { value: '0007734' } })
    fireEvent.submit(campo.closest('form'))
    await waitFor(() =>
      expect(listPublicacoes).toHaveBeenCalledWith(
        expect.objectContaining({ numero_processo: '0007734', nome_parte: undefined })
      )
    )

    fireEvent.change(campo, { target: { value: 'Maria' } })
    fireEvent.submit(campo.closest('form'))
    await waitFor(() =>
      expect(listPublicacoes).toHaveBeenCalledWith(
        expect.objectContaining({ nome_parte: 'Maria', numero_processo: undefined })
      )
    )
  })

  it('card mostra o bruto à esquerda e a grade 2×2 extraída à direita', async () => {
    renderPagina()
    const card = await screen.findByTestId('card-pub-11')
    expect(within(card).getByText('TJPR')).toBeInTheDocument()
    expect(within(card).getByText(/1ª Vara Cível de Cascavel/)).toBeInTheDocument()
    expect(within(card).getByText(/Extraído automaticamente/)).toBeInTheDocument()
    expect(within(card).getByText('Partes')).toBeInTheDocument()
    expect(within(card).getByText('Nº do processo')).toBeInTheDocument()
    expect(within(card).getByText('Assunto')).toBeInTheDocument()
    expect(within(card).getByText('Prazo')).toBeInTheDocument()
    // partes vêm do caso vinculado; prazo vem do prazo_sugerido do backend
    expect(within(card).getByTestId('partes-pub-11')).toHaveTextContent('Maria Silva × Banco X')
    expect(within(card).getByTestId('prazo-pub-11')).toHaveTextContent(
      'Contestação · 15 dias · vence 23/09/2026'
    )
    // vinculado ao caso → bolinha verde
    expect(within(card).getByTestId('dot-11')).toHaveAttribute('aria-label', 'vinculado ao caso')
  })

  it('campo que o tribunal não mandou vira "—" com title explicando (nunca inventa)', async () => {
    renderPagina()
    const card = await screen.findByTestId('card-pub-12')
    expect(within(card).getByTestId('partes-pub-12')).toHaveTextContent('—')
    expect(within(card).getByTestId('prazo-pub-12')).toHaveTextContent('—')
    expect(within(card).getByTestId('partes-pub-12')).toHaveAttribute(
      'title',
      'não extraído nesta publicação'
    )
    // sem número de processo: sem bolinha, mas com o chip "Sem processo"
    expect(within(card).queryByTestId('dot-12')).not.toBeInTheDocument()
    expect(within(card).getByText('Sem processo')).toBeInTheDocument()
  })

  it('card oferece "Abrir no tribunal" e "Descartar" além do primário "Tratar"', async () => {
    renderPagina()
    const card = await screen.findByTestId('card-pub-11')
    expect(within(card).getByTestId('btn-tratar-11')).toHaveClass('btn-primary')
    expect(within(card).getByTestId('btn-abrir-tribunal-11')).toBeInTheDocument()
    expect(within(card).getByTestId('btn-descartar-11')).toBeInTheDocument()
  })

  it('descartar pelo card confirma, chama a API e tira a intimação da caixa', async () => {
    renderPagina()
    const card = await screen.findByTestId('card-pub-11')
    fireEvent.click(within(card).getByTestId('btn-descartar-11'))
    fireEvent.click(await screen.findByRole('button', { name: /^confirmar$/i }))
    await waitFor(() => expect(ignorarPublicacao).toHaveBeenCalledWith(11))
    await waitFor(() => expect(screen.queryByTestId('card-pub-11')).not.toBeInTheDocument())
  })

  it('em ≥ lg o "Tratar" abre o painel lateral sticky (não modal)', async () => {
    mockMatchMedia(true)
    renderPagina()
    fireEvent.click(await screen.findByTestId('btn-tratar-11'))
    expect(await screen.findByTestId('tratar-intimacao-painel')).toBeInTheDocument()
    expect(screen.queryByTestId('tratar-intimacao-modal')).not.toBeInTheDocument()
    // "Sugestão do Patronus" e o rodapé de progresso da sessão
    expect(await screen.findByTestId('sugestao-patronus')).toHaveTextContent(
      'registrar prazo de Contestação — 15 dias → vence 23/09/2026'
    )
    expect(screen.getByTestId('tratar-progresso')).toHaveTextContent('Você confirmou 0 de 2.')
    // há outra pendente na fila → "Confirmar e próxima"
    expect(screen.getByTestId('btn-confirmar-tratamento')).toHaveTextContent('Confirmar e próxima')
  })

  it('abaixo de lg o "Tratar" continua modal', async () => {
    renderPagina()
    fireEvent.click(await screen.findByTestId('btn-tratar-11'))
    expect(await screen.findByTestId('tratar-intimacao-modal')).toBeInTheDocument()
    expect(screen.queryByTestId('tratar-intimacao-painel')).not.toBeInTheDocument()
  })

  it('caixa vazia sem filtro: "Caixa zerada." com a próxima leitura do DJEN', async () => {
    listPublicacoes.mockResolvedValue(
      respostaLista([], { contagens: { ...CONTAGENS, nao_tratadas: 0, tratadas_hoje: 8 } })
    )
    renderPagina()
    const vazio = await screen.findByTestId('vazio-caixa-zerada')
    expect(vazio).toHaveTextContent('Caixa zerada.')
    expect(vazio).toHaveTextContent(
      'Todas as publicações de hoje foram tratadas. Próxima leitura do DJEN amanhã às 7h.'
    )
  })

  it('sem OAB monitorada: convida a cadastrar e o botão leva pra aba OABs', async () => {
    listOabs.mockResolvedValue([])
    listPublicacoes.mockResolvedValue(
      respostaLista([], {
        contagens: { ...CONTAGENS, todas: 0, nao_tratadas: 0, tratadas: 0, tratadas_hoje: 0 },
      })
    )
    renderPagina()
    const vazio = await screen.findByTestId('vazio-sem-oab')
    expect(vazio).toHaveTextContent('Cadastre sua OAB para o Patronus ler o DJEN por você.')
    fireEvent.click(within(vazio).getByRole('button', { name: 'Cadastrar OAB' }))
    expect(await screen.findByTestId('aba-oabs')).toBeInTheDocument()
  })
})
