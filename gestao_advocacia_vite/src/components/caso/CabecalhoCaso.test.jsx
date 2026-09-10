import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { render, screen, fireEvent } from '@testing-library/react'
import CabecalhoCaso from './CabecalhoCaso.jsx'
import { linhaMetaDoCaso, tituloDoCaso } from './tituloCaso.js'
import { destinoTribunalDoCaso, siglaTribunalDoCaso } from './tribunalDoCaso.js'

const CASO = {
  id: 1,
  titulo: 'Cobrança Maria',
  numero_processo: '0001234-56.2026.8.16.0001',
  cliente_nome: 'Maria Silva',
  parte_contraria: 'Banco Alfa S.A.',
  vara_juizo: '3ª Vara Cível de Curitiba',
  comarca: 'Curitiba',
  tipo_acao: 'Ação de cobrança',
  fase_processual: 'Conhecimento',
  prioridade: 'Alta',
}

function r(props) {
  return render(
    <MemoryRouter>
      <CabecalhoCaso caso={CASO} {...props} />
    </MemoryRouter>
  )
}

describe('tituloCaso / tribunalDoCaso', () => {
  it('título "{cliente} × {parte contrária}"; sem parte contrária, título do caso', () => {
    expect(tituloDoCaso(CASO)).toBe('Maria Silva × Banco Alfa S.A.')
    expect(tituloDoCaso({ ...CASO, parte_contraria: '' })).toBe('Cobrança Maria')
    expect(tituloDoCaso({ id: 3 })).toBe('Caso #3')
  })

  it('linha de meta com tribunal inferido do CNJ e sem comarca duplicada', () => {
    expect(linhaMetaDoCaso(CASO)).toEqual(['TJPR', '3ª Vara Cível de Curitiba', 'Ação de cobrança'])
    expect(linhaMetaDoCaso({ vara_juizo: '2ª Vara', comarca: 'Londrina' })).toEqual([
      '2ª Vara',
      'Londrina',
    ])
    expect(linhaMetaDoCaso({})).toEqual([])
  })

  it('sigla: publicação DJEN tem prioridade sobre o CNJ; TRT vira sigla curta', () => {
    expect(siglaTribunalDoCaso(CASO)).toBe('TJPR')
    expect(siglaTribunalDoCaso(CASO, [{ sigla_tribunal: 'trt9' }])).toBe('TRT9')
    expect(siglaTribunalDoCaso({ numero_processo: '0001234-56.2026.5.09.0001' })).toBe('TRT9')
    expect(siglaTribunalDoCaso({ numero_processo: '' })).toBeNull()
  })

  it('destino: link da publicação > consulta pública > null', () => {
    expect(
      destinoTribunalDoCaso(CASO, [{ link: 'https://x/pub', sigla_tribunal: 'TJPR' }])
    ).toEqual({
      url: 'https://x/pub',
      nome: 'TJPR',
      precisaColar: false,
    })
    expect(destinoTribunalDoCaso(CASO)).toMatchObject({ precisaColar: true, nome: 'Projudi/TJPR' })
    expect(destinoTribunalDoCaso({ numero_processo: null })).toBeNull()
  })
})

describe('CabecalhoCaso', () => {
  it('renderiza breadcrumb, título, meta, chip de fase e prioridade', () => {
    r()
    expect(screen.getByRole('link', { name: 'Casos' })).toHaveAttribute('href', '/casos')
    expect(screen.getByTestId('caso-titulo')).toHaveTextContent('Maria Silva × Banco Alfa S.A.')
    expect(screen.getByTestId('caso-meta')).toHaveTextContent(
      '0001234-56.2026.8.16.0001 · TJPR · 3ª Vara Cível de Curitiba · Ação de cobrança'
    )
    expect(screen.getByTestId('chip-fase')).toHaveTextContent('Conhecimento')
    expect(screen.getByText('Alta')).toBeInTheDocument()
  })

  it('sem fase mostra "Fase não informada"; sem link de tribunal o botão fica desabilitado', () => {
    render(
      <MemoryRouter>
        <CabecalhoCaso caso={{ id: 2, titulo: 'Sem número', numero_processo: null }} />
      </MemoryRouter>
    )
    expect(screen.getByTestId('chip-fase')).toHaveTextContent('Fase não informada')
    const btn = screen.getByTestId('btn-abrir-tribunal')
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('title', expect.stringMatching(/Cadastre o nº do processo/))
    expect(screen.getByTestId('caso-titulo')).toHaveTextContent('Sem número')
  })

  it('"Abrir no tribunal" copia o nº e abre a consulta pública', async () => {
    const writeText = vi.fn().mockResolvedValue()
    Object.assign(navigator, { clipboard: { writeText } })
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    r()
    fireEvent.click(screen.getByTestId('btn-abrir-tribunal'))
    await Promise.resolve()
    await Promise.resolve()
    expect(writeText).toHaveBeenCalledWith('0001234-56.2026.8.16.0001')
    expect(open).toHaveBeenCalledWith(
      'https://projudi.tjpr.jus.br/projudi/',
      '_blank',
      'noopener,noreferrer'
    )
    open.mockRestore()
  })

  it('"+ Novo no caso" dispara os callbacks e "Mais ações" tem editar/agenda/DJEN', () => {
    const onNovoPrazo = vi.fn()
    const onNovoContrato = vi.fn()
    const onSincronizarDjen = vi.fn()
    r({ onNovoPrazo, onNovoContrato, onSincronizarDjen, publicacoes: [] })
    fireEvent.click(screen.getByTestId('mais-prazo'))
    fireEvent.click(screen.getByTestId('mais-contrato'))
    expect(onNovoPrazo).toHaveBeenCalled()
    expect(onNovoContrato).toHaveBeenCalled()
    expect(screen.getByRole('link', { name: /Editar caso/ })).toHaveAttribute(
      'href',
      '/casos/editar/1'
    )
    expect(screen.getByRole('link', { name: /Agenda do caso/ })).toHaveAttribute(
      'href',
      '/agenda?caso=1'
    )
    fireEvent.click(screen.getByTestId('acao-sincronizar-djen'))
    expect(onSincronizarDjen).toHaveBeenCalled()
    // sem publicações não dá pra resumir
    expect(screen.getByTestId('acao-gerar-resumo')).toBeDisabled()
  })
})
