// src/api/itensAgenda.js
// Wrapper para /v1/itens-agenda — modelo unificado Prazos+Eventos (PR D3).
//
// Esta API substitui /tarefas e /eventos no frontend. Backend ainda tem
// os endpoints legados ativos (dual-write em D2 mantem item_agenda
// sempre sincronizada) — eles serao removidos em D4.
//
// Vocabulario:
//   - tipo: 'tarefa' | 'evento'
//   - categoria: 'Prazo' | 'Audiencia' | 'Reuniao' | 'Peticionamento'
//                | 'Ligacao' | 'Lembrete' | 'Outros'
//   - status: 'Pendente' | 'Em Andamento' | 'Concluido' | 'Cancelado'

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
 * Lista itens da agenda. Aceita filtros opcionais.
 *
 * Params (todos opcionais):
 *   - tipo: 'tarefa' | 'evento' — filtra por discriminador
 *   - status: enum — filtra por status
 *   - caso_id: number — filtra por caso vinculado
 */
export function listItensAgenda(params = {}) {
  return api.get(`/itens-agenda/${toQueryString(params)}`)
}

export function getItemAgenda(id) {
  return api.get(`/itens-agenda/${id}`)
}

/**
 * Cria novo item. Validacoes minimas no backend:
 *   - titulo obrigatorio
 *   - tipo obrigatorio ('tarefa' ou 'evento')
 *   - se tipo='evento', data_inicio obrigatorio
 *   - status precisa ser enum valido
 */
export function createItemAgenda(body) {
  return api.post('/itens-agenda/', body)
}

export function updateItemAgenda(id, body) {
  return api.put(`/itens-agenda/${id}`, body)
}

export function deleteItemAgenda(id) {
  return api.del(`/itens-agenda/${id}`)
}

// ---------- Endpoints do Kanban (PR D4.1) ----------

/**
 * Reordena tarefas no kanban (drag-drop).
 *
 * Body esperado:
 *   { columns: { "Pendente": [12, 5], "Em Andamento": [8] } }
 *
 * Atualiza status + posicao em batch. So afeta tipo='tarefa' — eventos
 * sao ignorados silenciosamente. IDs cross-tenant tambem sao ignorados.
 */
export function reorderItensAgenda(columns) {
  return api.put('/itens-agenda/reorder', { columns })
}

/**
 * Confirma prazo calculado pela IA. Remove o badge "IA — confirmar".
 * Opcionalmente atualiza data_vencimento e/ou prioridade.
 */
export function validarPrazoItemAgenda(id, opts = {}) {
  return api.patch(`/itens-agenda/${id}/validar-prazo`, opts)
}

/**
 * Atalho 1-clique: marca item como Concluido + prazo_validado=True.
 * Idempotente.
 */
export function concluirItemAgenda(id) {
  return api.patch(`/itens-agenda/${id}/concluir`, {})
}

/**
 * Tratamento de prazo (Onda 1).
 *
 * Acoes:
 *   - 'cumpri'  → marca Concluido, registra como_tratado, vincula peticao
 *   - 'cancelar'→ marca Cancelado (prazo nao era seu / equivoco)
 *   - 'reabrir' → volta pra Pendente (limpa tratado_em, preserva texto)
 *
 * @param {number} id
 * @param {object} opts - { acao, como_tratado?, peticao_cumpridora_id? }
 */
export function tratarItemAgenda(id, opts) {
  return api.post(`/itens-agenda/${id}/tratar`, opts)
}
