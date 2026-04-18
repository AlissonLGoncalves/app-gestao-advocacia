import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EnderecoSection from './EnderecoSection.jsx';

const baseFormData = {
  cep: '',
  rua: '',
  numero: '',
  bairro: '',
  cidade: '',
  estado: '',
  pais: 'Brasil',
  complemento: '',
};

describe('EnderecoSection', () => {
  it('renderiza campos de endereco', () => {
    render(<EnderecoSection formData={baseFormData} loadingCep={false} onChange={vi.fn()} onCepBlur={vi.fn()} />);

    expect(screen.getByLabelText(/^cep$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^rua$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/bairro/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cidade/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/estado \(uf\)/i)).toBeInTheDocument();
  });

  it('exibe spinner de loading CEP', () => {
    render(<EnderecoSection formData={baseFormData} loadingCep={true} onChange={vi.fn()} onCepBlur={vi.fn()} />);

    expect(document.querySelector('.spinner-border')).toBeInTheDocument();
  });

  it('exibe valores preenchidos', () => {
    render(
      <EnderecoSection
        formData={{ ...baseFormData, cidade: 'Curitiba', estado: 'PR' }}
        loadingCep={false}
        onChange={vi.fn()}
        onCepBlur={vi.fn()}
      />
    );

    expect(screen.getByDisplayValue('Curitiba')).toBeInTheDocument();
    expect(screen.getByDisplayValue('PR')).toBeInTheDocument();
  });

  it('chama onCepBlur ao sair do campo CEP', () => {
    const onCepBlur = vi.fn();
    render(<EnderecoSection formData={baseFormData} loadingCep={false} onChange={vi.fn()} onCepBlur={onCepBlur} />);

    fireEvent.blur(screen.getByLabelText(/^cep$/i));
    expect(onCepBlur).toHaveBeenCalled();
  });
});
