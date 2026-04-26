import { arrayMove } from '@dnd-kit/sortable'

export function agruparPorColuna(tarefas, colunasIds) {
  const grupos = Object.fromEntries(colunasIds.map((s) => [s, []]))
  for (const t of tarefas) {
    if (grupos[t.status]) grupos[t.status].push(t.id)
  }
  return grupos
}

export function localizarColuna(id, tarefas, colunasIds) {
  if (id == null) return null
  if (colunasIds.includes(id)) return id
  const t = tarefas.find((x) => x.id === id)
  return t ? t.status : null
}

// Recebe o estado atual (grupos por coluna), os ids do drag, e devolve {novosGrupos, payload}
// ou null se o drag nao produz mudanca. payload eh o subconjunto de colunas afetadas para
// enviar ao endpoint PUT /tarefas/reorder.
export function calcularReorder({ grupos, colunasIds, activeId, overId, tarefas }) {
  if (activeId == null || overId == null) return null

  const colunaOrigem = localizarColuna(activeId, tarefas, colunasIds)
  const colunaDestino = localizarColuna(overId, tarefas, colunasIds)
  if (!colunaOrigem || !colunaDestino) return null

  const idsOrigem = [...grupos[colunaOrigem]]
  const idxAtual = idsOrigem.indexOf(activeId)
  if (idxAtual === -1) return null

  if (colunaOrigem === colunaDestino) {
    const idxDestino = colunasIds.includes(overId)
      ? idsOrigem.length - 1
      : idsOrigem.indexOf(overId)
    if (idxDestino === -1 || idxAtual === idxDestino) return null
    const novaLista = arrayMove(idsOrigem, idxAtual, idxDestino)
    const novosGrupos = { ...grupos, [colunaOrigem]: novaLista }
    return { novosGrupos, payload: { [colunaOrigem]: novaLista } }
  }

  const idsDestino = [...grupos[colunaDestino]]
  idsOrigem.splice(idxAtual, 1)
  const idxDestino = colunasIds.includes(overId) ? idsDestino.length : idsDestino.indexOf(overId)
  idsDestino.splice(idxDestino === -1 ? idsDestino.length : idxDestino, 0, activeId)

  const novosGrupos = {
    ...grupos,
    [colunaOrigem]: idsOrigem,
    [colunaDestino]: idsDestino,
  }
  return {
    novosGrupos,
    payload: {
      [colunaOrigem]: idsOrigem,
      [colunaDestino]: idsDestino,
    },
  }
}

// Aplica novosGrupos ao estado plano de tarefas, atualizando status e posicao em sequencia.
// Tarefas com status fora das colunas conhecidas sao preservadas no fim, sem alteracao.
export function aplicarReorderEmTarefas(tarefas, novosGrupos, colunasIds) {
  const tarefasPorId = new Map(tarefas.map((t) => [t.id, t]))
  const novaLista = []
  for (const status of colunasIds) {
    novosGrupos[status].forEach((tid, idx) => {
      const t = tarefasPorId.get(tid)
      if (t) novaLista.push({ ...t, status, posicao: idx + 1 })
    })
  }
  for (const t of tarefas) {
    if (!colunasIds.includes(t.status)) novaLista.push(t)
  }
  return novaLista
}
