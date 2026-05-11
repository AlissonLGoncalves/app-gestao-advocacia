import React from 'react'

// Consolida o getStatusBadge espalhado em CasoList/ClienteList.
// Adicionar novos status: estender o objeto correspondente abaixo.
const STATUS_CASO = {
  Ativo: 'success',
  Encerrado: 'secondary',
  Suspenso: 'warning',
  Arquivado: 'info',
}

const STATUS_TAREFA = {
  'A Fazer': 'danger',
  Fazendo: 'warning',
  'Em Andamento': 'warning',
  Concluído: 'success',
  Concluido: 'success',
}

const MAPAS = {
  caso: STATUS_CASO,
  tarefa: STATUS_TAREFA,
}

// Props:
//   tipo: 'caso' | 'tarefa' (default: 'caso')
//   valor: string do status
//   subtle: boolean — usar variante -subtle/-emphasis (default: true)
export default function StatusBadge({ tipo = 'caso', valor, subtle = true }) {
  if (!valor) return null
  const mapa = MAPAS[tipo] || STATUS_CASO
  const cor = mapa[valor] || 'light'
  const className = subtle
    ? `badge bg-${cor}-subtle text-${cor}-emphasis`
    : `badge bg-${cor} text-white`
  return (
    <span className={className} style={{ fontSize: '0.68rem', fontWeight: 600 }}>
      {valor}
    </span>
  )
}
