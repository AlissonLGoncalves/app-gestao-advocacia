import { api } from './client'

/** Tokens API do projudi-agent (gerenciados pelo dono do tenant) */
export const listTokensProjudi = () => api.get('/projudi/auth/tokens')

export const gerarTokenProjudi = (nome) => api.post('/projudi/auth/tokens', { nome: nome || null })

export const revogarTokenProjudi = (tokenId) => api.del(`/projudi/auth/tokens/${tokenId}`)

/** Status da integracao com o agent (ultimo sync por tipo) */
export const getProjudiSyncStatus = () => api.get('/projudi/sync/status')
