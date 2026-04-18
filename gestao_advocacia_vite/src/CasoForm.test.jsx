import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CasoForm from './CasoForm.jsx';

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

describe('CasoForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('token', 'token-teste');
    globalThis.fetch = vi.fn((url, options) => {
      if (String(url).includes('/clientes/?sort_by=')) {
        return Promise.resolve({ ok: true, json: async () => [{ id: 1, nome_razao_social: 'Cliente A' }] });
      }
      if (options?.method === 'POST' && String(url).includes('/casos')) {
        return Promise.resolve({ ok: true, json: async () => ({ id: 99 }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  });

  it('renderiza campos principais', async () => {
    render(<CasoForm onCasoChange={vi.fn()} />);

    expect(await screen.findByLabelText(/título do caso/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cliente associado/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^status/i)).toBeInTheDocument();
  });

  it('valida obrigatorios e nao envia quando invalido', async () => {
    render(<CasoForm onCasoChange={vi.fn()} />);

    fireEvent.change(await screen.findByLabelText(/título do caso/i), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText(/cliente associado/i), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /adicionar caso/i }));

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalled();
    });

    const callsCasos = globalThis.fetch.mock.calls.filter(([url]) => String(url).includes('/casos'));
    expect(callsCasos.length).toBe(0);
  });

  it('envia com sucesso quando formulario e valido', async () => {
    const onCasoChange = vi.fn();
    render(<CasoForm onCasoChange={onCasoChange} />);

    fireEvent.change(await screen.findByLabelText(/título do caso/i), { target: { value: 'Caso previdenciario' } });
    fireEvent.change(screen.getByLabelText(/cliente associado/i), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /adicionar caso/i }));

    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalled();
      expect(onCasoChange).toHaveBeenCalled();
    });
  });

  it('exibe erro quando API retorna 4xx/5xx', async () => {
    globalThis.fetch = vi.fn((url, options) => {
      if (String(url).includes('/clientes/?sort_by=')) {
        return Promise.resolve({ ok: true, json: async () => [{ id: 1, nome_razao_social: 'Cliente A' }] });
      }
      if (options?.method === 'POST' && String(url).includes('/casos')) {
        return Promise.resolve({ ok: false, status: 500, json: async () => ({ erro: 'erro ao salvar' }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(<CasoForm onCasoChange={vi.fn()} />);

    fireEvent.change(await screen.findByLabelText(/título do caso/i), { target: { value: 'Caso previdenciario' } });
    fireEvent.change(screen.getByLabelText(/cliente associado/i), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /adicionar caso/i }));

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalled();
    });
  });
});
