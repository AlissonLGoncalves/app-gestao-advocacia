import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TramitacaoSection from './TramitacaoSection.jsx'

const baseFormData = {
  parte_contraria: '',
  adv_parte_contraria: '',
  vara_juizo: '',
  comarca: '',
  instancia: '',
  fase_processual: '',
  data_distribuicao: '',
}

describe('TramitacaoSection', () => {
  it('renderiza campos de tramitacao', () => {
    render(<TramitacaoSection formData={baseFormData} onChange={vi.fn()} />)

    expect(screen.getByLabelText('Parte Contrária')).toBeInTheDocument()
    expect(screen.getByLabelText('Adv. Parte Contrária')).toBeInTheDocument()
    expect(screen.getByLabelText('Vara/Juízo')).toBeInTheDocument()
    expect(screen.getByLabelText('Comarca')).toBeInTheDocument()
    expect(screen.getByLabelText('Instância')).toBeInTheDocument()
    expect(screen.getByLabelText('Fase Processual')).toBeInTheDocument()
    expect(screen.getByLabelText('Data de Distribuição')).toBeInTheDocument()
  })

  it('exibe valores preenchidos', () => {
    render(
      <TramitacaoSection
        formData={{ ...baseFormData, parte_contraria: 'Empresa XYZ', comarca: 'Curitiba' }}
        onChange={vi.fn()}
      />
    )

    expect(screen.getByDisplayValue('Empresa XYZ')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Curitiba')).toBeInTheDocument()
  })

  it('chama onChange ao editar campo', () => {
    const onChange = vi.fn()
    render(<TramitacaoSection formData={baseFormData} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Parte Contrária'), { target: { value: 'Banco ABC' } })
    expect(onChange).toHaveBeenCalled()
  })
})
