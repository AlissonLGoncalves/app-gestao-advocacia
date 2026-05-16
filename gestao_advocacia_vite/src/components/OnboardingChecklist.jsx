// src/components/OnboardingChecklist.jsx
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircleIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid'

const STORAGE_KEY = 'patronus_onboarding_dismissed'

const PASSOS = [
  {
    id: 'cliente',
    titulo: 'Cadastre seu primeiro cliente',
    descricao: 'Todo caso precisa de um cliente vinculado. Comece por aqui.',
    acao: '/clientes',
    acaoLabel: 'Ir para Clientes',
    verificar: (stats) => stats.totalClientes > 0,
  },
  {
    id: 'caso',
    titulo: 'Crie um caso',
    descricao:
      'Cadastre o processo com o número CNJ (ex: 0000000-00.0000.8.00.0000) para habilitar a sincronização automática.',
    acao: '/casos',
    acaoLabel: 'Ir para Casos',
    verificar: (stats) => stats.casosAtivos > 0,
  },
  {
    id: 'djen',
    titulo: 'Configure o monitoramento DJEN',
    descricao:
      'Informe sua OAB para receber automaticamente as publicações do Diário da Justiça Eletrônico.',
    acao: '/djen',
    acaoLabel: 'Configurar DJEN',
    verificar: (stats) => stats.oabConfigurada,
  },
  {
    id: 'prazo',
    titulo: 'Adicione um prazo ou tarefa',
    descricao: 'Use o Kanban para controlar prazos processuais e tarefas internas.',
    acao: '/prazos',
    acaoLabel: 'Abrir Kanban',
    verificar: (stats) => stats.temPrazo,
  },
  {
    id: 'financeiro',
    titulo: 'Registre um recebimento',
    descricao: 'Controle os honorários e recebimentos dos seus clientes.',
    acao: '/recebimentos',
    acaoLabel: 'Ir para Recebimentos',
    verificar: (stats) => stats.temRecebimento,
  },
]

export default function OnboardingChecklist({ stats }) {
  const navigate = useNavigate()
  const [recolhido, setRecolhido] = useState(false)

  // Nota: o estado real de "ocultar" e feito por ocultoPermanente abaixo
  // (linha ~75). A leitura direta de STORAGE_KEY era duplicada e nao era
  // reativa — removida.

  const statsCompletos = {
    totalClientes: stats?.totalClientes ?? 0,
    casosAtivos: stats?.casosAtivos ?? 0,
    oabConfigurada: (stats?.oabsMonitoradas ?? 0) > 0,
    temPrazo: false, // conservador: não temos esse dado no stats geral ainda
    temRecebimento:
      (stats?.recebimentosPendentesQtd ?? 0) > 0 || (stats?.recebimentosPagosQtd ?? 0) > 0,
  }

  const passosConcluidos = PASSOS.filter((p) => p.verificar(statsCompletos))
  const progresso = passosConcluidos.length
  const total = PASSOS.length
  const porcentagem = Math.round((progresso / total) * 100)
  const tudo_concluido = progresso === total

  const [ocultoPermanente, setOcultoPermanente] = useState(
    sessionStorage.getItem(STORAGE_KEY) === 'true'
  )

  if (ocultoPermanente || tudo_concluido) return null

  return (
    <div
      className="card border-0 shadow-sm mb-4"
      style={{
        background: 'linear-gradient(135deg, #f0f4ff 0%, #faf5ff 100%)',
        borderRadius: 'var(--radius-lg, 12px)',
        borderLeft: '4px solid var(--primary, #4f46e5)',
      }}
    >
      <div
        className="card-header d-flex align-items-center justify-content-between py-3"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
        onClick={() => setRecolhido((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setRecolhido((v) => !v)
        }}
      >
        <div className="d-flex align-items-center gap-3">
          <div>
            <h6 className="mb-0 fw-bold" style={{ color: 'var(--primary, #4f46e5)' }}>
              🚀 Primeiros passos no Patronus
            </h6>
            <small className="text-muted">
              {progresso} de {total} concluídos
            </small>
          </div>
          <div
            className="d-none d-sm-block"
            style={{ width: 120, height: 8, background: '#e2e8f0', borderRadius: 99 }}
          >
            <div
              style={{
                width: `${porcentagem}%`,
                height: '100%',
                background: 'var(--primary, #4f46e5)',
                borderRadius: 99,
                transition: 'width 0.4s ease',
              }}
            />
          </div>
          <span className="badge bg-primary-subtle text-primary fw-semibold d-none d-sm-inline">
            {porcentagem}%
          </span>
        </div>
        <div className="d-flex align-items-center gap-2">
          <button
            className="btn btn-sm btn-link text-muted p-0"
            onClick={(e) => {
              e.stopPropagation()
              sessionStorage.setItem(STORAGE_KEY, 'true')
              setOcultoPermanente(true)
            }}
            title="Dispensar tutorial"
          >
            <small>dispensar</small>
          </button>
          {recolhido ? (
            <ChevronDownIcon style={{ width: 18, height: 18 }} />
          ) : (
            <ChevronUpIcon style={{ width: 18, height: 18 }} />
          )}
        </div>
      </div>

      {!recolhido && (
        <div className="card-body pt-0 pb-3">
          <div className="d-flex flex-column gap-2">
            {PASSOS.map((passo) => {
              const feito = passo.verificar(statsCompletos)
              return (
                <div
                  key={passo.id}
                  className="d-flex align-items-start gap-3 p-2 rounded"
                  style={{
                    background: feito ? 'rgba(34,197,94,0.07)' : 'rgba(255,255,255,0.7)',
                    opacity: feito ? 0.75 : 1,
                  }}
                >
                  <div className="flex-shrink-0 mt-1">
                    {feito ? (
                      <CheckCircleSolid style={{ width: 22, height: 22, color: '#22c55e' }} />
                    ) : (
                      <CheckCircleIcon style={{ width: 22, height: 22, color: '#cbd5e1' }} />
                    )}
                  </div>
                  <div className="flex-grow-1">
                    <p
                      className="mb-0 small fw-semibold"
                      style={{
                        color: feito ? '#6b7280' : '#1e293b',
                        textDecoration: feito ? 'line-through' : 'none',
                      }}
                    >
                      {passo.titulo}
                    </p>
                    {!feito && (
                      <p className="mb-0 text-muted" style={{ fontSize: '0.78rem' }}>
                        {passo.descricao}
                      </p>
                    )}
                  </div>
                  {!feito && (
                    <button
                      className="btn btn-sm btn-primary flex-shrink-0"
                      style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                      onClick={() => navigate(passo.acao)}
                    >
                      {passo.acaoLabel}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
