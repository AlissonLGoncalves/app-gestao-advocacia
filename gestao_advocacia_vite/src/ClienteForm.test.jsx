import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ClienteForm from './ClienteForm.jsx';

const { toastMock } = vi.hoisted(() => ({
  toastMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('react-toastify', () => ({
  toast: toastMock,
}));

vi.mock('./components/DocumentosClienteTab.jsx', () => ({
  default: () => <div data-testid="documentos-cliente-tab" />,
}));

describe('ClienteForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn((url) => {
      if (String(url).includes('/clientes/?sort_by=')) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      return Promise.resolve({ ok: true, json: async () => ({ id: 10 }) });
    });
    localStorage.setItem('token', 'token-teste');
  });

  it('renderiza campos principais do formulario', async () => {
    render(<ClienteForm onClienteChange={vi.fn()} />);

    expect(await screen.findByLabelText(/tipo pessoa/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nome completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^cpf \*/i)).toBeInTheDocument();
  });

  it('valida obrigatorios e nao envia sem dados minimos', async () => {
    render(<ClienteForm onClienteChange={vi.fn()} />);

    fireEvent.change(await screen.findByLabelText(/nome completo/i), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText(/^cpf \*/i), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /adicionar cliente/i }));

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalled();
    });

    const calls = global.fetch.mock.calls.filter(([url]) => !String(url).includes('/clientes/?sort_by='));
    expect(calls.length).toBe(0);
  });

  it('envia com sucesso quando formulario e valido', async () => {
    const onClienteChange = vi.fn();
    render(<ClienteForm onClienteChange={onClienteChange} />);

    fireEvent.change(await screen.findByLabelText(/nome completo/i), { target: { value: 'Maria da Silva' } });
    fireEvent.change(screen.getByLabelText(/^cpf \*/i), { target: { value: '12345678901' } });
    fireEvent.click(screen.getByRole('button', { name: /adicionar cliente/i }));

    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalled();
      expect(onClienteChange).toHaveBeenCalled();
    });
  });

  it('exibe erro quando API retorna falha', async () => {
    global.fetch = vi.fn((url) => {
      if (String(url).includes('/clientes/?sort_by=')) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      return Promise.resolve({ ok: false, status: 500, json: async () => ({ erro: 'falha interna' }) });
    });

    render(<ClienteForm onClienteChange={vi.fn()} />);

    fireEvent.change(await screen.findByLabelText(/nome completo/i), { target: { value: 'Maria da Silva' } });
    fireEvent.change(screen.getByLabelText(/^cpf \*/i), { target: { value: '12345678901' } });
    fireEvent.click(screen.getByRole('button', { name: /adicionar cliente/i }));

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalled();
    });
  });
});
