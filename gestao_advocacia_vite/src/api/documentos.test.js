import { describe, expect, it, vi } from 'vitest'
import { api } from './client.js'
import { uploadDocumento } from './documentos.js'

vi.mock('./client.js', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
    getBlob: vi.fn(),
    upload: vi.fn(),
  },
}))

describe('uploadDocumento', () => {
  it('monta FormData com file e metadata', async () => {
    const file = new File(['conteudo'], 'peticao.pdf', { type: 'application/pdf' })
    api.upload.mockResolvedValueOnce({ id: 10 })

    await uploadDocumento(42, file, {
      descricao: 'Peticao inicial',
      cliente_id: 7,
      ignorar: '',
      nulo: null,
    })

    expect(api.upload).toHaveBeenCalledTimes(1)
    const [path, formData] = api.upload.mock.calls[0]

    expect(path).toBe('/documentos/upload')
    expect(formData).toBeInstanceOf(FormData)
    expect(formData.get('file')).toBe(file)
    expect(formData.get('caso_id')).toBe('42')
    expect(formData.get('descricao')).toBe('Peticao inicial')
    expect(formData.get('cliente_id')).toBe('7')
    expect(formData.get('ignorar')).toBeNull()
    expect(formData.get('nulo')).toBeNull()
  })
})
