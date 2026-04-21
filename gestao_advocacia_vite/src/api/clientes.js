import { api } from './client'

/** @returns {Promise<Array<{id:number, nome:string, cpf_cnpj:string, email?:string}>>} */
export const listClientes = (params) => {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  return api.get(`/clientes${qs}`)
}

export const getCliente = (id) => api.get(`/clientes/${id}`)
export const createCliente = (data) => api.post('/clientes', data)
export const updateCliente = (id, data) => api.put(`/clientes/${id}`, data)
export const deleteCliente = (id) => api.del(`/clientes/${id}`)
export const extrairDadosDocumentoCliente = (formData) =>
  api.postForm('/clientes/extrair-dados-doc', formData)
export const anonimizarCliente = (id) => api.post(`/clientes/${id}/anonimizar`, {})
