import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import PasswordInput from './PasswordInput.jsx'

describe('PasswordInput', () => {
  it('comeca oculto e alterna para texto ao clicar no olho', () => {
    render(<PasswordInput id="senha" value="Segredo@123" onChange={() => {}} />)
    const input = document.getElementById('senha')
    expect(input.type).toBe('password')

    fireEvent.click(screen.getByRole('button', { name: 'Exibir caracteres digitados' }))
    expect(input.type).toBe('text')

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar caracteres digitados' }))
    expect(input.type).toBe('password')
  })

  it('mostra a dica quando informada', () => {
    render(<PasswordInput value="" onChange={() => {}} hint="Mínimo 10 caracteres" />)
    expect(screen.getByText('Mínimo 10 caracteres')).toBeTruthy()
  })
})
