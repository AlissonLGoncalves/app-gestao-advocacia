// Fase 4 (auditoria UX) — "Meu dia": a primeira coisa que o advogado vê.
//
// Padrão Astrea: dashboard mínimo e ACIONÁVEL. Três respostas em uma
// olhada, cada uma clicável pra agir:
//   1. O que vence hoje (e o que JÁ venceu) — prazos
//   2. Audiências e compromissos de hoje
//   3. Intimações não tratadas (inbox da Fase 2)
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ClockIcon,
  CalendarDaysIcon,
  EnvelopeOpenIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'
import { listItensAgenda } from '../api/itensAgenda.js'
import { getContadoresInbox } from '../api/djen.js'

function hojeISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

function dataDe(item) {
  const raw = item.data_vencimento || item.data_inicio
  return raw ? String(raw).slice(0, 10) : null
}

function MeuDiaCard() {
  const [prazosHoje, setPrazosHoje] = useState([])
  const [vencidos, setVencidos] = useState(0)
  const [compromissosHoje, setCompromissosHoje] = useState([])
  const [naoTratadas, setNaoTratadas] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const hoje = hojeISO()
    Promise.allSettled([listItensAgenda({ status: 'Pendente' }), getContadoresInbox()]).then(
      ([itensRes, inboxRes]) => {
        if (itensRes.status === 'fulfilled') {
          const itens = Array.isArray(itensRes.value) ? itensRes.value : []
          const tarefas = itens.filter((i) => i.tipo === 'tarefa')
          setPrazosHoje(tarefas.filter((i) => dataDe(i) === hoje))
          setVencidos(tarefas.filter((i) => (dataDe(i) || '9999') < hoje).length)
          setCompromissosHoje(itens.filter((i) => i.tipo === 'evento' && dataDe(i) === hoje))
        }
        if (inboxRes.status === 'fulfilled') {
          setNaoTratadas(inboxRes.value?.nao_tratadas ?? 0)
        }
        setLoading(false)
      }
    )
  }, [])

  if (loading) return null

  const diaLimpo = prazosHoje.length === 0 && compromissosHoje.length === 0 && !vencidos

  return (
    <div className="card border-0 shadow-sm mb-4" data-testid="meu-dia-card">
      <div className="card-body py-3">
        <h6 className="fw-bold mb-3" style={{ fontFamily: 'var(--font-heading)' }}>
          Meu dia
          <span className="text-muted fw-normal small ms-2">
            {new Date().toLocaleDateString('pt-BR', {
              weekday: 'long',
              day: '2-digit',
              month: 'long',
            })}
          </span>
        </h6>
        <div className="row g-3">
          {/* Prazos */}
          <div className="col-md-4">
            <Link to="/agenda?view=kanban" className="text-decoration-none">
              <div
                className={`p-3 rounded h-100 ${
                  vencidos > 0 || prazosHoje.length > 0 ? 'bg-danger-subtle' : 'bg-success-subtle'
                }`}
              >
                <div className="d-flex align-items-center gap-2 mb-1">
                  <ClockIcon style={{ width: 18, height: 18 }} className="text-danger" />
                  <strong className="text-dark small">Prazos</strong>
                </div>
                <div className="text-dark" data-testid="meu-dia-prazos">
                  {vencidos > 0 && (
                    <span className="d-block text-danger fw-bold">
                      {vencidos} vencido{vencidos === 1 ? '' : 's'} ⚠
                    </span>
                  )}
                  {prazosHoje.length > 0 ? (
                    <span>
                      {prazosHoje.length} vence{prazosHoje.length === 1 ? '' : 'm'} hoje
                    </span>
                  ) : (
                    vencidos === 0 && <span className="text-muted small">nada vence hoje</span>
                  )}
                </div>
              </div>
            </Link>
          </div>
          {/* Compromissos */}
          <div className="col-md-4">
            <Link to="/agenda?view=calendario" className="text-decoration-none">
              <div
                className={`p-3 rounded h-100 ${
                  compromissosHoje.length > 0 ? 'bg-warning-subtle' : 'bg-light'
                }`}
              >
                <div className="d-flex align-items-center gap-2 mb-1">
                  <CalendarDaysIcon style={{ width: 18, height: 18 }} className="text-warning" />
                  <strong className="text-dark small">Hoje na agenda</strong>
                </div>
                <div className="text-dark" data-testid="meu-dia-compromissos">
                  {compromissosHoje.length > 0 ? (
                    compromissosHoje.slice(0, 2).map((c) => (
                      <span key={c.id} className="d-block small text-truncate">
                        {String(c.data_inicio || '').slice(11, 16) || '—'} · {c.titulo}
                      </span>
                    ))
                  ) : (
                    <span className="text-muted small">sem audiências ou compromissos</span>
                  )}
                  {compromissosHoje.length > 2 && (
                    <span className="small text-muted">+{compromissosHoje.length - 2} mais</span>
                  )}
                </div>
              </div>
            </Link>
          </div>
          {/* Intimações */}
          <div className="col-md-4">
            <Link to="/djen" className="text-decoration-none">
              <div
                className={`p-3 rounded h-100 ${naoTratadas > 0 ? 'bg-warning-subtle' : 'bg-light'}`}
              >
                <div className="d-flex align-items-center gap-2 mb-1">
                  <EnvelopeOpenIcon style={{ width: 18, height: 18 }} className="text-primary" />
                  <strong className="text-dark small">Intimações</strong>
                </div>
                <div className="text-dark" data-testid="meu-dia-intimacoes">
                  {naoTratadas > 0 ? (
                    <span>
                      <strong>{naoTratadas}</strong> não tratada{naoTratadas === 1 ? '' : 's'} —
                      tratar agora
                    </span>
                  ) : (
                    <span className="text-muted small d-inline-flex align-items-center gap-1">
                      <CheckCircleIcon style={{ width: 14, height: 14 }} className="text-success" />
                      caixa zerada
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </div>
        </div>
        {diaLimpo && naoTratadas === 0 && (
          <div className="text-success small mt-2">✓ Dia sob controle — nada urgente.</div>
        )}
      </div>
    </div>
  )
}

export default MeuDiaCard
