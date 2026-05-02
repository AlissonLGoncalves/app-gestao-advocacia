import { api } from './client'

const toQuery = (params = {}) => {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value))
    }
  })
  const qs = query.toString()
  return qs ? `?${qs}` : ''
}

export const listCasos = (params = {}) => api.get(`/casos/${toQuery(params)}`)
export const getCaso = (id) => api.get(`/casos/${id}`)
export const createCaso = (data) => api.post('/casos', data)
export const updateCaso = (id, data) => api.put(`/casos/${id}`, data)
export const deleteCaso = (id) => api.del(`/casos/${id}`)

export const listCasosByCliente = (clienteId, params = {}) =>
  listCasos({ ...params, cliente_id: clienteId })

export const listMovimentacoesCaso = (id) => api.get(`/casos/${id}/movimentacoes-cnj`)
export const listPublicacoesDjenCaso = (id) => api.get(`/casos/${id}/publicacoes-djen`)
export const listAndamentosCaso = (id) => api.get(`/casos/${id}/andamentos`)

export const atualizarCasoViaCnj = (id) => api.post(`/casos/${id}/atualizar-cnj`, {})
export const atualizarCasoViaDjen = (id) => api.post(`/casos/${id}/atualizar-djen`, {})
export const gerarResumoCaso = (id) => api.post(`/casos/${id}/gerar-resumo`, {})
export const consultaPublicaCnj = (numero) =>
  api.get(`/casos/consulta-publica-cnj${toQuery({ numero })}`)

export const buscarProcessoLocal = (numero) =>
  api.get(`/casos/buscar-processo-local${toQuery({ numero })}`)

export const extrairEventosDeDocumento = (documentoId) =>
  api.post(`/casos/extrair-eventos-de-documento/${documentoId}`, {})
