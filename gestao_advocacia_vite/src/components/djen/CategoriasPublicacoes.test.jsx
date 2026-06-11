import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CategoriasPublicacoes from './CategoriasPublicacoes.jsx'

// Fase 2 (inbox-zero): categorias por ESTADO DE TRATAMENTO.
const CONTAGENS = {
  todas: 256,
  nao_tratadas: 18,
  sem_processo: 9,
  tratadas: 164,
  descartadas: 65,
  importantes: 0,
}

describe('CategoriasPublicacoes (inbox-zero)', () => {
  it('renderiza as 6 categorias do inbox com contagens', () => {
    render(<CategoriasPublicacoes ativa="nao_tratadas" contagens={CONTAGENS} onChange={vi.fn()} />)
    expect(screen.getByTestId('djen-cat-nao_tratadas')).toHaveTextContent('18')
    expect(screen.getByTestId('djen-cat-sem_processo')).toHaveTextContent('9')
    expect(screen.getByTestId('djen-cat-tratadas')).toHaveTextContent('164')
    expect(screen.getByTestId('djen-cat-descartadas')).toHaveTextContent('65')
    expect(screen.getByTestId('djen-cat-todas')).toHaveTextContent('256')
    expect(screen.getByTestId('djen-cat-importantes')).toBeInTheDocument()
  })

  it('marca a categoria ativa com aria-selected=true', () => {
    render(<CategoriasPublicacoes ativa="sem_processo" contagens={CONTAGENS} onChange={vi.fn()} />)
    expect(screen.getByTestId('djen-cat-sem_processo')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('djen-cat-todas')).toHaveAttribute('aria-selected', 'false')
  })

  it('chama onChange ao clicar numa categoria', () => {
    const onChange = vi.fn()
    render(<CategoriasPublicacoes ativa="nao_tratadas" contagens={CONTAGENS} onChange={onChange} />)
    fireEvent.click(screen.getByTestId('djen-cat-tratadas'))
    expect(onChange).toHaveBeenCalledWith('tratadas')
  })

  it('Importantes esta habilitado e dispara onChange (Epic #2 / #176)', () => {
    const onChange = vi.fn()
    const contagens = { ...CONTAGENS, importantes: 5 }
    render(<CategoriasPublicacoes ativa="todas" contagens={contagens} onChange={onChange} />)
    const btn = screen.getByTestId('djen-cat-importantes')
    expect(btn).not.toBeDisabled()
    fireEvent.click(btn)
    expect(onChange).toHaveBeenCalledWith('importantes')
    expect(btn).toHaveTextContent('5')
  })

  it('aceita contagens=undefined sem quebrar (mostra 0)', () => {
    render(<CategoriasPublicacoes ativa="todas" contagens={undefined} onChange={vi.fn()} />)
    expect(screen.getByTestId('djen-cat-todas')).toHaveTextContent('0')
  })
})
