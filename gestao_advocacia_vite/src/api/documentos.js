import { api } from './client.js'

function toQueryString(params) {
  const search = new URLSearchParams()

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') {
      return
    }

    search.set(key, String(value))
  })

  const query = search.toString()
  return query ? `?${query}` : ''
}

export function listDocumentos(casoId, params = {}) {
  const query = {
    ...params,
    ...(casoId ? { caso_id: casoId } : {}),
  }

  return api.get(`/documentos/${toQueryString(query)}`)
}

export function listDocumentosPorCliente(clienteId) {
  return api.get(`/documentos/cliente/${clienteId}`)
}

export function getDocumento(id) {
  return api.get(`/documentos/${id}`)
}

export function uploadDocumento(casoId, file, metadata = {}) {
  const formData = new FormData()

  formData.append('file', file)

  if (casoId) {
    formData.append('caso_id', String(casoId))
  }

  Object.entries(metadata).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') {
      return
    }

    formData.append(key, String(value))
  })

  return api.upload('/documentos/upload', formData)
}

export function updateDocumento(id, body) {
  return api.put(`/documentos/${id}`, body)
}

export function deleteDocumento(id) {
  return api.del(`/documentos/${id}`)
}

export async function downloadDocumento(id) {
  try {
    return await api.getBlob(`/documentos/download/${id}`)
  } catch (error) {
    if (error?.status !== 404) {
      throw error
    }

    return api.getBlob(`/documentos/${id}/download`)
  }
}
