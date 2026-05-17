import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { listItensAgenda } from '../api/itensAgenda.js'
import {
  ExclamationCircleIcon,
  ClockIcon,
  CalendarIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline'
import AvatarSigla from './ui/AvatarSigla.jsx'
import PrioridadeBadge from './ui/PrioridadeBadge.jsx'
import SlaBar from './ui/SlaBar.jsx'

// Mini-Kanban estilo Astrea: 3 colunas com prazos urgentes em destaque.
// Reusa AvatarSigla/PrioridadeBadge do Epico 1.

const HOJE_YMD = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const ymd = (raw) => {
  if (!raw) return null
  const s = String(raw).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

const diasEntre = (dataYmd, hojeYmd) => {
  const [ay, am, ad] = hojeYmd.split('-').map(Number)
  const [by, bm, bd] = dataYmd.split('-').map(Number)
  return Math.floor((new Date(by, bm - 1, bd) - new Date(ay, am - 1, ad)) / 86400000)
}

// Classifica tarefa em uma das 3 colunas. Exportado para teste.
export function classificarTarefa(tarefa, hoje = HOJE_YMD()) {
  if (!tarefa || tarefa.status === 'Concluído' || tarefa.status === 'Concluido') return null
  const d = ymd(tarefa.data_vencimento)
  if (!d) return null
  const diff = diasEntre(d, hoje)
  if (diff < 0) return 'vencido'
  if (diff === 0) return 'hoje'
  if (diff <= 7) return 'proximos7'
  return null
}

const COLUNAS = [
  {
    id: 'vencido',
    titulo: 'Vencidos',
    cor: 'danger',
    icon: ExclamationCircleIcon,
    rota: '/prazos?filtro=vencidos',
  },
  {
    id: 'hoje',
    titulo: 'Hoje',
    cor: 'warning',
    icon: ClockIcon,
    rota: '/prazos?filtro=hoje',
  },
  {
    id: 'proximos7',
    titulo: 'Próximos 7 dias',
    cor: 'primary',
    icon: CalendarIcon,
    rota: '/prazos',
  },
]

function TarefaCard({ tarefa, hoje }) {
  const d = ymd(tarefa.data_vencimento)
  const diff = d ? diasEntre(d, hoje) : null
  let prazoTxt = ''
  if (diff !== null) {
    if (diff < 0) prazoTxt = `${Math.abs(diff)} dia(s) atrás`
    else if (diff === 0) prazoTxt = 'Hoje'
    else prazoTxt = `Em ${diff} dia(s)`
  }
  return (
    <Link
      to={`/prazos?tarefa=${tarefa.id}`}
      className="text-decoration-none"
      style={{ display: 'block', color: 'inherit' }}
    >
      <div
        className="card border-0 shadow-sm mb-2 overflow-hidden"
        style={{
          borderRadius: 'var(--radius-sm)',
          transition: 'transform 0.15s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateX(2px)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateX(0)')}
      >
        <SlaBar
          dataVencimento={tarefa.data_vencimento}
          concluido={tarefa.status === 'Concluído' || tarefa.status === 'Concluido'}
        />
        <div className="card-body p-2">
          <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
            <div
              className="text-truncate fw-semibold"
              style={{ fontSize: '0.82rem', flex: 1 }}
              title={tarefa.titulo}
            >
              {tarefa.titulo}
            </div>
            {tarefa.responsavel_nome && (
              <AvatarSigla nome={tarefa.responsavel_nome} iniciais={tarefa.responsavel_iniciais} />
            )}
          </div>
          {tarefa.cliente_nome && (
            <div
              className="text-muted text-truncate"
              style={{ fontSize: '0.72rem' }}
              title={tarefa.cliente_nome}
            >
              {tarefa.cliente_nome}
            </div>
          )}
          <div className="d-flex align-items-center gap-2 mt-1">
            <PrioridadeBadge prioridade={tarefa.prioridade} />
            <span className="text-muted" style={{ fontSize: '0.7rem' }}>
              {prazoTxt}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function MiniKanbanPrazos() {
  const [tarefas, setTarefas] = useState([])
  const [loading, setLoading] = useState(true)
  const hoje = HOJE_YMD()

  useEffect(() => {
    const carregar = async () => {
      try {
        // PR D4.2 — usa /v1/itens-agenda. Filtra tipo=tarefa pra preservar
        // semantica do MiniKanban (so prazos, nao eventos).
        const itens = await listItensAgenda({ tipo: 'tarefa' })
        setTarefas(Array.isArray(itens) ? itens : [])
      } catch {
        // widget secundario — silencia falhas
      } finally {
        setLoading(false)
      }
    }
    carregar()
  }, [])

  const buckets = { vencido: [], hoje: [], proximos7: [] }
  for (const t of tarefas) {
    const k = classificarTarefa(t, hoje)
    if (k) buckets[k].push(t)
  }
  for (const k of Object.keys(buckets)) {
    buckets[k].sort((a, b) => {
      const da = ymd(a.data_vencimento) || ''
      const db = ymd(b.data_vencimento) || ''
      return da < db ? -1 : da > db ? 1 : 0
    })
  }

  const totalUrgente = buckets.vencido.length + buckets.hoje.length + buckets.proximos7.length

  // Esconde o widget quando nao ha nenhum prazo proximo — evita ocupar espaco
  // com "tudo zerado". Briefing do Dia ja cobre o caso de zero atrasados.
  if (!loading && totalUrgente === 0) return null

  return (
    <div className="row g-3 mb-4">
      {COLUNAS.map((col) => {
        const items = buckets[col.id]
        const Icon = col.icon
        return (
          <div key={col.id} className="col-lg-4 col-md-12">
            <div
              className="card border-0 shadow-sm h-100"
              style={{ borderRadius: 'var(--radius-md)' }}
            >
              <div
                className={`card-header bg-${col.cor}-subtle d-flex justify-content-between align-items-center`}
                style={{
                  borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
                  borderBottom: 0,
                }}
              >
                <div className={`d-flex align-items-center gap-2 text-${col.cor}-emphasis`}>
                  <Icon style={{ width: 16, height: 16 }} />
                  <strong style={{ fontSize: '0.82rem' }}>{col.titulo}</strong>
                  <span
                    className={`badge bg-${col.cor} text-white`}
                    style={{ fontSize: '0.65rem' }}
                  >
                    {items.length}
                  </span>
                </div>
                <Link
                  to={col.rota}
                  className={`small text-${col.cor}-emphasis text-decoration-none`}
                  style={{ fontSize: '0.72rem' }}
                  title={`Ver todos os prazos em ${col.titulo.toLowerCase()}`}
                >
                  Ver todos <ChevronRightIcon style={{ width: 12, height: 12 }} />
                </Link>
              </div>
              <div className="card-body p-2" style={{ minHeight: 80 }}>
                {loading && <div className="text-muted small text-center py-2">Carregando...</div>}
                {!loading && items.length === 0 && (
                  <div
                    className="text-muted small text-center py-3"
                    style={{ fontSize: '0.78rem' }}
                  >
                    Nenhum prazo nesta faixa.
                  </div>
                )}
                {items.slice(0, 3).map((t) => (
                  <TarefaCard key={t.id} tarefa={t} hoje={hoje} />
                ))}
                {items.length > 3 && (
                  <Link
                    to={col.rota}
                    className="d-block text-center small text-muted text-decoration-none mt-1"
                    style={{ fontSize: '0.72rem' }}
                  >
                    + {items.length - 3} prazo(s) a mais →
                  </Link>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
