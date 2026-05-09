import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CategoriasPublicacoes from './CategoriasPublicacoes.jsx'

const CONTAGENS = {
  todas: 256,
  nao_lidas: 18,
  pendentes: 92,
  vinculadas: 164,
  importantes: 0,
}

describe('CategoriasPublicacoes', () => {
  it('renderiza as 5 categorias com contagens', () => {
    render(<CategoriasPublicacoes ativa="todas" contagens={CONTAGENS} onChange={vi.fn()} />)
    expect(screen.getByTestId('djen-cat-todas')).toBeInTheDocument()
    expect(screen.getByTestId('djen-cat-nao_lidas')).toBeInTheDocument()
    expect(screen.getByTestId('djen-cat-pendentes')).toBeInTheDocument()
    expect(screen.getByTestId('djen-cat-vinculadas')).toBeInTheDocument()
    expect(screen.getByTestId('djen-cat-importantes')).toBeInTheDocument()

    expect(screen.getByTestId('djen-cat-todas')).toHaveTextContent('256')
    expect(screen.getByTestId('djen-cat-nao_lidas')).toHaveTextContent('18')
    expect(screen.getByTestId('djen-cat-pendentes')).toHaveTextContent('92')
    expect(screen.getByTestId('djen-cat-vinculadas')).toHaveTextContent('164')
  })

  it('marca a categoria ativa com aria-selected=true', () => {
    render(<CategoriasPublicacoes ativa="pendentes" contagens={CONTAGENS} onChange={vi.fn()} />)
    expect(screen.getByTestId('djen-cat-pendentes')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('djen-cat-todas')).toHaveAttribute('aria-selected', 'false')
  })

  it('chama onChange ao clicar numa categoria habilitada', () => {
    const onChange = vi.fn()
    render(<CategoriasPublicacoes ativa="todas" contagens={CONTAGENS} onChange={onChange} />)
    fireEvent.click(screen.getByTestId('djen-cat-pendentes'))
    expect(onChange).toHaveBeenCalledWith('pendentes')
  })

  it('NAO chama onChange ao clicar em "Importantes" (em breve)', () => {
    const onChange = vi.fn()
    render(<CategoriasPublicacoes ativa="todas" contagens={CONTAGENS} onChange={onChange} />)
    const btn = screen.getByTestId('djen-cat-importantes')
    expect(btn).toBeDisabled()
    fireEvent.click(btn)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('Importantes mostra "—" no badge enquanto nao classifica', () => {
    render(<CategoriasPublicacoes ativa="todas" contagens={CONTAGENS} onChange={vi.fn()} />)
    expect(screen.getByTestId('djen-cat-importantes')).toHaveTextContent('—')
  })

  it('aceita contagens=undefined sem quebrar (mostra 0)', () => {
    render(<CategoriasPublicacoes ativa="todas" contagens={undefined} onChange={vi.fn()} />)
    expect(screen.getByTestId('djen-cat-todas')).toHaveTextContent('0')
  })
})
