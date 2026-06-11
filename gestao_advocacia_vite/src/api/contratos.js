// Fase 1 (auditoria UX) — camada de API dos contratos de honorários.
// Antes a página global de contratos fazia fetch direto e era read-only;
// agora todo CRUD + gerar-parcelas passa por aqui (tratamento central de
// erro/401 do api/client.js).
import { api } from './client.js'

export const listContratos = () => api.get('/contratos/')
export const getContrato = (id) => api.get(`/contratos/${id}`)
export const createContrato = (payload) => api.post('/contratos/', payload)
export const updateContrato = (id, payload) => api.put(`/contratos/${id}`, payload)
export const deleteContrato = (id) => api.del(`/contratos/${id}`)

// Gera N recebimentos mensais (parcelas) a partir do valor_total do contrato.
export const gerarParcelasContrato = (id, { quantidade_parcelas, primeiro_vencimento }) =>
  api.post(`/contratos/${id}/gerar-parcelas`, { quantidade_parcelas, primeiro_vencimento })
