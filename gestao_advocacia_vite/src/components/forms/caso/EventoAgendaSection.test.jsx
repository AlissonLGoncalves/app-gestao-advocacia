import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import EventoAgendaSection from './EventoAgendaSection.jsx'

const baseEvento = { titulo: '', data_hora: '', tipo: 'Prazo', notas: '' }

describe('EventoAgendaSection', () => {
  it('nao renderiza nada em modo edicao', () => {
    const { container } = render(
      <EventoAgendaSection
        isEditing={true}
        criarEvento={false}
        setCriarEvento={vi.fn()}
        eventoData={baseEvento}
        setEventoData={vi.fn()}
      />
    )

    expect(container.firstChild).toBeNull()
  })

  it('renderiza checkbox em modo criacao', () => {
    render(
      <EventoAgendaSection
        isEditing={false}
        criarEvento={false}
        setCriarEvento={vi.fn()}
        eventoData={baseEvento}
        setEventoData={vi.fn()}
      />
    )

    expect(screen.getByLabelText(/criar evento na agenda/i)).toBeInTheDocument()
  })

  it('exibe campos de evento quando checkbox ativado', () => {
    render(
      <EventoAgendaSection
        isEditing={false}
        criarEvento={true}
        setCriarEvento={vi.fn()}
        eventoData={baseEvento}
        setEventoData={vi.fn()}
      />
    )

    expect(screen.getByPlaceholderText(/prazo de contestação/i)).toBeInTheDocument()
    expect(document.querySelector('input[type="datetime-local"]')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('chama setCriarEvento ao clicar no checkbox', () => {
    const setCriarEvento = vi.fn()
    render(
      <EventoAgendaSection
        isEditing={false}
        criarEvento={false}
        setCriarEvento={setCriarEvento}
        eventoData={baseEvento}
        setEventoData={vi.fn()}
      />
    )

    fireEvent.click(screen.getByLabelText(/criar evento na agenda/i))
    expect(setCriarEvento).toHaveBeenCalledWith(true)
  })
})
