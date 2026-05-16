import { api } from './client.js'

function toQueryString(params) {
  const search = new URLSearchParams()
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return
    search.set(key, String(value))
  })
  const query = search.toString()
  return query ? `?${query}` : ''
}

/**
 * Configuracao de NFS-e do tenant.
 *
 * GET /nfse/config — devolve config existente ou esqueleto vazio
 * PUT /nfse/config — cria ou atualiza (upsert)
 */
export function getConfigNFSe() {
  return api.get('/nfse/config')
}

export function updateConfigNFSe(body) {
  return api.put('/nfse/config', body)
}

/**
 * Dispara emissao on-demand de NFS-e para um Recebimento.
 * Recebimento precisa estar com status=Pago.
 *
 * POST /nfse/emitir/<recebimento_id>
 * Resposta: EmissaoNFSe — pode ter status=Autorizada (sucesso) ou
 *   Rejeitada (config faltando, etc). Frontend mostra mensagem_erro.
 */
export function emitirNFSe(recebimentoId) {
  return api.post(`/nfse/emitir/${recebimentoId}`, {})
}

/**
 * Lista emissoes de NFS-e do tenant. Opcionalmente filtra por
 * recebimento_id pra mostrar historico de tentativas naquele item.
 */
export function listEmissoesNFSe(params = {}) {
  return api.get(`/nfse/emissoes${toQueryString(params)}`)
}

export function getEmissaoNFSe(id) {
  return api.get(`/nfse/emissoes/${id}`)
}
