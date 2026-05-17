// src/Dashboard.jsx
import React, { useState, useEffect, useCallback } from 'react'
import { API_URL } from './config.js'
import { listProximos } from './api/agenda.js'
import { listItensAgenda } from './api/itensAgenda.js'
import { syncDjen, listOabs } from './api/djen.js'
import MovimentacoesRecentes from './components/MovimentacoesRecentes.jsx'
import OnboardingChecklist from './components/OnboardingChecklist.jsx'
import MiniKanbanPrazos from './components/MiniKanbanPrazos.jsx'
import { useNavigate } from 'react-router-dom'

import {
  UsersIcon as UsersIconSolid,
  BriefcaseIcon as BriefcaseIconSolid,
  CreditCardIcon as CreditCardIconSolid,
  ArrowTrendingDownIcon as TrendingDownIconSolid,
  ArrowTrendingUpIcon as TrendingUpIconSolid,
  ClockIcon as PrazoIconSolid,
  CalendarDaysIcon as EventoIconSolid,
} from '@heroicons/react/24/solid'
import {
  ChevronRightIcon,
  MagnifyingGlassIcon,
  NewspaperIcon,
  ExclamationTriangleIcon,
  CalendarDaysIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { formatCNJ } from './utils/cnj.js'
import { getResumoFinanceiro } from './api/financeiro.js'

const hojeLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const StatCard = ({
  title,
  value,
  icon: IconComponent,
  colorClass = 'text-primary',
  bgColorClass = 'bg-primary-subtle',
  onClick,
}) => {
  const iconElement = React.createElement(IconComponent, {
    style: { width: '28px', height: '28px', color: 'var(--primary)' },
  })

  return (
    <div
      className={`card border-0 shadow-sm transition-shadow duration-200 ease-in-out d-flex flex-row align-items-center p-4 ${onClick ? 'cursor-pointer hover-shadow-lg' : ''}`}
      onClick={onClick}
      style={
        onClick
          ? { cursor: 'pointer', borderRadius: 'var(--radius-lg)' }
          : { borderRadius: 'var(--radius-lg)' }
      }
      role={onClick ? 'button' : 'figure'}
      tabIndex={onClick ? 0 : -1}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onClick()
            }
          : undefined
      }
    >
      <div
        className={`p-3 rounded-circle me-4 ${bgColorClass} ${colorClass}`}
        style={{
          background:
            'linear-gradient(135deg, rgba(79, 70, 229, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)',
        }}
      >
        {iconElement}
      </div>
      <div className="flex-grow-1">
        <p
          className="text-muted small text-uppercase mb-1"
          style={{ fontSize: '0.75rem', letterSpacing: '0.05em', fontWeight: '600' }}
        >
          {title}
        </p>
        <p className="h3 mb-0 fw-bold text-dark" style={{ fontFamily: 'var(--font-heading)' }}>
          {value === undefined || value === null ? '...' : value}
        </p>
      </div>
    </div>
  )
}

const EventListItem = ({ evento, onClick }) => {
  if (!evento || typeof evento !== 'object' || !evento.id || !evento.data_inicio) {
    return null
  }

  let dataFormatada = 'Data inválida'
  let horaFormatada = ''
  try {
    const dataObj = new Date(evento.data_inicio)
    if (!isNaN(dataObj.getTime())) {
      dataFormatada = dataObj.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
      })
      horaFormatada = dataObj.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    }
  } catch (e) {
    console.error('EventListItem: Erro ao formatar data_inicio:', evento.data_inicio, e)
  }

  const IconeEvento = evento.tipo_evento === 'Prazo' ? PrazoIconSolid : EventoIconSolid
  const corIconeEvento = evento.tipo_evento === 'Prazo' ? 'text-danger' : 'text-primary'

  return (
    <li
      className="list-group-item list-group-item-action py-3 px-2 d-flex justify-content-between align-items-center"
      onClick={onClick}
      style={{ cursor: 'pointer' }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick()
      }}
    >
      <div className="d-flex align-items-center">
        <div className={`flex-shrink-0 me-2 ${corIconeEvento}`}>
          <IconeEvento style={{ width: '20px', height: '20px' }} />
        </div>
        <div className="flex-grow-1 min-w-0">
          <p
            className="mb-0 fw-medium text-dark text-truncate"
            style={{ fontSize: '0.9rem' }}
            title={evento.titulo || 'Evento sem título'}
          >
            {evento.titulo || 'Evento sem título'}
          </p>
          <p className="small text-muted text-truncate mb-0" style={{ fontSize: '0.75rem' }}>
            {dataFormatada} {horaFormatada && `às ${horaFormatada}`}
          </p>
        </div>
      </div>
      <ChevronRightIcon className="text-muted" style={{ width: '16px', height: '16px' }} />
    </li>
  )
}

function Dashboard({ mudarSecao }) {
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    totalClientes: undefined,
    casosAtivos: undefined,
    recebimentosPendentesValor: 0,
    recebimentosPendentesQtd: 0,
    recebimentosAReceberValor: 0,
    recebimentosAReceberQtd: 0,
    recebimentosAtrasadosValor: 0,
    recebimentosAtrasadosQtd: 0,
    despesasAPagarValor: 0,
    despesasAPagarQtd: 0,
    despesasProgramadasValor: 0,
    despesasProgramadasQtd: 0,
    despesasAtrasadasValor: 0,
    despesasAtrasadasQtd: 0,
    recebimentosPagosMesValor: 0,
    recebimentosPagosMesQtd: 0,
    recebimentosPagosAnoValor: 0,
    recebimentosPagosAnoQtd: 0,
    djenPendentesTriagem: 0,
    djenNaoLidas: 0,
  })
  const [proximosEventos, setProximosEventos] = useState([])
  const [tarefasAlerta, setTarefasAlerta] = useState({ vencidas: 0, vencendoHoje: 0 })
  const [oabsMonitoradas, setOabsMonitoradas] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  const [consultaCnjInput, setConsultaCnjInput] = useState('')
  const [buscandoConsulta, setBuscandoConsulta] = useState(false)
  const [resultadoConsulta, setResultadoConsulta] = useState(null)

  const fetchDashboardData = useCallback(async () => {
    setLoading(true)
    setErro('')

    const token = localStorage.getItem('token')
    if (!token) {
      setErro('Autenticação necessária. Faça login para visualizar o dashboard.')
      setLoading(false)
      return
    }

    try {
      const data = await getResumoFinanceiro()

      setStats({
        totalClientes: data.total_clientes ?? 0,
        casosAtivos: data.casos_ativos ?? 0,
        recebimentosPendentesValor: data.recebimentos_pendentes?.valor_total ?? 0,
        recebimentosPendentesQtd: data.recebimentos_pendentes?.quantidade ?? 0,
        // Novos counters do dashboard.py (Fase 1 do Recebimento Robusto)
        recebimentosAReceberValor: data.recebimentos_a_receber?.valor_total ?? 0,
        recebimentosAReceberQtd: data.recebimentos_a_receber?.quantidade ?? 0,
        recebimentosAtrasadosValor: data.recebimentos_atrasados?.valor_total ?? 0,
        recebimentosAtrasadosQtd: data.recebimentos_atrasados?.quantidade ?? 0,
        despesasAPagarValor: data.despesas_a_pagar?.valor_total ?? 0,
        despesasAPagarQtd: data.despesas_a_pagar?.quantidade ?? 0,
        despesasProgramadasValor: data.despesas_programadas?.valor_total ?? 0,
        despesasProgramadasQtd: data.despesas_programadas?.quantidade ?? 0,
        despesasAtrasadasValor: data.despesas_atrasadas?.valor_total ?? 0,
        despesasAtrasadasQtd: data.despesas_atrasadas?.quantidade ?? 0,
        // Pagamentos efetivamente recebidos (status=Pago) no mes/ano corrente.
        recebimentosPagosMesValor: data.recebimentos_pagos_mes?.valor_total ?? 0,
        recebimentosPagosMesQtd: data.recebimentos_pagos_mes?.quantidade ?? 0,
        recebimentosPagosAnoValor: data.recebimentos_pagos_ano?.valor_total ?? 0,
        recebimentosPagosAnoQtd: data.recebimentos_pagos_ano?.quantidade ?? 0,
        djenPendentesTriagem: data.alertas_djen?.pendentes_triagem ?? 0,
        djenNaoLidas: data.alertas_djen?.nao_lidas ?? 0,
      })
    } catch (error) {
      console.error('Dashboard: Erro ao carregar dados:', error)
      setErro(error.message || 'Ocorreu um erro ao carregar os dados do dashboard.')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchProximosEventos = useCallback(async () => {
    try {
      const eventos = await listProximos(7)
      setProximosEventos(eventos)
    } catch (error) {
      console.error('Dashboard: Erro ao carregar próximos eventos:', error)
    }
  }, [])

  const fetchTarefasAlerta = useCallback(async () => {
    try {
      // PR D4.2 — usa /v1/itens-agenda filtrando tipo=tarefa.
      // status no vocab novo: 'Concluido' (sem acento).
      const itens = await listItensAgenda({ tipo: 'tarefa' })
      const lista = Array.isArray(itens) ? itens : []
      const hoje = hojeLocal()
      // data_vencimento pode vir como 'YYYY-MM-DD' ou ISO; comparamos
      // como prefixo de 10 chars pra cobrir ambos.
      const ehVencida = (t) =>
        t.data_vencimento &&
        String(t.data_vencimento).slice(0, 10) < hoje &&
        t.status !== 'Concluido' &&
        t.status !== 'Cancelado'
      const ehHoje = (t) =>
        t.data_vencimento &&
        String(t.data_vencimento).slice(0, 10) === hoje &&
        t.status !== 'Concluido' &&
        t.status !== 'Cancelado'
      setTarefasAlerta({
        vencidas: lista.filter(ehVencida).length,
        vencendoHoje: lista.filter(ehHoje).length,
      })
    } catch (err) {
      console.warn('Dashboard: erro ao buscar tarefas alerta', err)
    }
  }, [])

  const triggerDjenSync = useCallback(async () => {
    const hoje = hojeLocal()
    if (sessionStorage.getItem('djen_synced_date') === hoje) return

    setSyncing(true)
    try {
      await syncDjen(1)
      sessionStorage.setItem('djen_synced_date', hoje)
      await fetchDashboardData()
    } catch {
      // silently ignore sync failures
    } finally {
      setSyncing(false)
    }
  }, [fetchDashboardData])

  useEffect(() => {
    fetchDashboardData()
    fetchProximosEventos()
    fetchTarefasAlerta()
    triggerDjenSync()
    listOabs()
      .then((data) => setOabsMonitoradas(Array.isArray(data) ? data : []))
      .catch(() => setOabsMonitoradas([]))
  }, [fetchDashboardData, fetchProximosEventos, fetchTarefasAlerta, triggerDjenSync])

  if (loading) {
    return (
      <div
        className="d-flex justify-content-center align-items-center"
        style={{ height: 'calc(100vh - 200px)' }}
      >
        <div
          className="spinner-border text-primary"
          role="status"
          style={{ width: '3rem', height: '3rem' }}
        >
          <span className="visually-hidden">Carregando...</span>
        </div>
        <p className="ms-3 text-muted fs-5">Carregando Dashboard...</p>
      </div>
    )
  }

  if (erro) {
    return (
      <div className="alert alert-danger mx-auto mt-5" role="alert" style={{ maxWidth: '600px' }}>
        <h4 className="alert-heading">Ocorreu um erro!</h4>
        <p>
          Não foi possível carregar os dados do dashboard. Verifique sua conexão com a API ou tente
          novamente.
        </p>
        <hr />
        <p className="mb-0 small">Detalhe: {erro}</p>
      </div>
    )
  }

  const handleCardClick = (secaoConstante) => {
    if (typeof mudarSecao === 'function') {
      mudarSecao(secaoConstante)
    }
  }

  const hoje = hojeLocal()
  const eventosHoje = proximosEventos.filter(
    (ev) => ev.data_inicio && ev.data_inicio.startsWith(hoje)
  )

  const temBriefing =
    stats.djenPendentesTriagem > 0 ||
    tarefasAlerta.vencidas > 0 ||
    tarefasAlerta.vencendoHoje > 0 ||
    eventosHoje.length > 0 ||
    syncing

  // Busca local primeiro (Caso/Publicacao). DataJud so vira opcional como fallback.
  const handleConsultaRapida = async () => {
    const inputTrimmed = consultaCnjInput.trim()
    if (!inputTrimmed) {
      setResultadoConsulta({ erro: 'Digite o número do processo (com ou sem máscara).' })
      return
    }

    setBuscandoConsulta(true)
    setResultadoConsulta(null)
    try {
      const token = localStorage.getItem('token')
      const resp = await fetch(
        `${API_URL}/casos/buscar-processo-local?numero=${encodeURIComponent(inputTrimmed)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await resp.json()
      if (!resp.ok) {
        setResultadoConsulta({ erro: data?.message || 'Falha ao buscar.' })
        return
      }
      setResultadoConsulta({ ...data, fonte: 'local' })
    } catch {
      setResultadoConsulta({ erro: 'Erro de conexão.' })
    } finally {
      setBuscandoConsulta(false)
    }
  }

  // Fallback: tenta DataJud quando local nao retornou nada.
  const handleConsultarDataJud = async () => {
    const limpo = consultaCnjInput.replace(/\D/g, '')
    if (limpo.length !== 20) {
      setResultadoConsulta((prev) => ({
        ...prev,
        erroDataJud: 'CNJ inválido. O DataJud exige 20 dígitos.',
      }))
      return
    }
    setBuscandoConsulta(true)
    try {
      const token = localStorage.getItem('token')
      const resp = await fetch(
        `${API_URL}/casos/consulta-publica-cnj?numero=${encodeURIComponent(limpo)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await resp.json()
      if (!resp.ok) {
        setResultadoConsulta((prev) => ({
          ...prev,
          erroDataJud: data?.message || 'Não localizado no DataJud.',
        }))
        return
      }
      setResultadoConsulta({ ...data, fonte: 'datajud' })
    } catch {
      setResultadoConsulta((prev) => ({
        ...prev,
        erroDataJud: 'Erro de conexão com DataJud.',
      }))
    } finally {
      setBuscandoConsulta(false)
    }
  }

  return (
    <div className="container-fluid p-0">
      {/* ── Zona 1: Pra voce agora ─────────────────────────────────────────── */}
      <h5
        className="fw-bold mb-3 mx-1"
        style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-1)' }}
      >
        Pra você agora
      </h5>

      {/* ── Briefing do Dia ─────────────────────────────────────────────────── */}
      {temBriefing && (
        <div className="row mb-4 g-0">
          <div className="col-12">
            <div
              className="card border-0 shadow-sm"
              style={{ borderRadius: 'var(--radius-lg)', borderLeft: '4px solid #f59e0b' }}
            >
              <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center border-bottom-0">
                <h6 className="mb-0 fw-bold" style={{ fontFamily: 'var(--font-heading)' }}>
                  Atenção — Hoje
                </h6>
                {syncing && (
                  <span
                    className="text-muted small d-flex align-items-center gap-2"
                    style={{ fontSize: '0.8rem' }}
                  >
                    <ArrowPathIcon style={{ width: 14, height: 14 }} className="text-primary" />
                    Verificando novas publicações no DJEN...
                  </span>
                )}
              </div>
              <div className="card-body pt-0 pb-3 px-3">
                <div className="d-flex flex-wrap gap-2">
                  {stats.djenPendentesTriagem > 0 && (
                    <button
                      className="btn btn-sm btn-warning d-flex align-items-center gap-2 rounded-pill px-3 shadow-sm"
                      onClick={() => navigate('/djen')}
                    >
                      <NewspaperIcon style={{ width: 16, height: 16 }} />
                      <span>
                        <strong>{stats.djenPendentesTriagem}</strong> publicaç
                        {stats.djenPendentesTriagem === 1 ? 'ão' : 'ões'} aguardando triagem
                      </span>
                      <ChevronRightIcon style={{ width: 14, height: 14 }} />
                    </button>
                  )}

                  {tarefasAlerta.vencidas > 0 && (
                    <button
                      className="btn btn-sm btn-danger d-flex align-items-center gap-2 rounded-pill px-3 shadow-sm"
                      onClick={() => navigate('/prazos')}
                    >
                      <ExclamationTriangleIcon style={{ width: 16, height: 16 }} />
                      <span>
                        <strong>{tarefasAlerta.vencidas}</strong> prazo
                        {tarefasAlerta.vencidas !== 1 ? 's' : ''} vencido
                        {tarefasAlerta.vencidas !== 1 ? 's' : ''}
                      </span>
                      <ChevronRightIcon style={{ width: 14, height: 14 }} />
                    </button>
                  )}

                  {tarefasAlerta.vencendoHoje > 0 && (
                    <button
                      className="btn btn-sm btn-outline-danger d-flex align-items-center gap-2 rounded-pill px-3 shadow-sm"
                      onClick={() => navigate('/prazos')}
                    >
                      <PrazoIconSolid style={{ width: 16, height: 16 }} />
                      <span>
                        <strong>{tarefasAlerta.vencendoHoje}</strong> prazo
                        {tarefasAlerta.vencendoHoje !== 1 ? 's' : ''} vence
                        {tarefasAlerta.vencendoHoje !== 1 ? 'm' : ''} hoje
                      </span>
                      <ChevronRightIcon style={{ width: 14, height: 14 }} />
                    </button>
                  )}

                  {eventosHoje.length > 0 && (
                    <button
                      className="btn btn-sm btn-primary d-flex align-items-center gap-2 rounded-pill px-3 shadow-sm"
                      onClick={() => navigate('/agenda')}
                    >
                      <CalendarDaysIcon style={{ width: 16, height: 16 }} />
                      <span>
                        <strong>{eventosHoje.length}</strong> evento
                        {eventosHoje.length !== 1 ? 's' : ''} hoje
                      </span>
                      <ChevronRightIcon style={{ width: 14, height: 14 }} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Mini-Kanban de Prazos ──────────────────────────────────────────── */}
      <MiniKanbanPrazos />

      {/* ── Banner onboarding DJEN ──────────────────────────────────────────── */}
      {oabsMonitoradas !== null && oabsMonitoradas.length === 0 && (
        <div className="row mb-4 g-0">
          <div className="col-12">
            <div
              className="alert alert-info d-flex align-items-center justify-content-between mb-0 shadow-sm gap-3"
              role="alert"
              style={{ borderRadius: 'var(--radius-lg)' }}
            >
              <div className="d-flex align-items-center gap-3">
                <NewspaperIcon style={{ width: 24, height: 24, flexShrink: 0 }} />
                <div>
                  <p className="fw-bold mb-0 small">Monitoramento DJEN não configurado</p>
                  <p className="mb-0 small">
                    Cadastre sua OAB para receber publicações dos diários de justiça
                    automaticamente.
                  </p>
                </div>
              </div>
              <button className="btn btn-info btn-sm text-nowrap" onClick={() => navigate('/djen')}>
                Configurar agora
                <ChevronRightIcon style={{ width: 14, height: 14 }} className="ms-1" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Zona 2: Panorama ───────────────────────────────────────────────── */}
      <h5
        className="fw-bold mb-3 mt-4 mx-1"
        style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-1)' }}
      >
        Panorama
      </h5>

      {/* ── Stat Cards ──────────────────────────────────────────────────────── */}
      <OnboardingChecklist
        stats={{
          totalClientes: stats.totalClientes,
          casosAtivos: stats.casosAtivos,
          oabsMonitoradas: oabsMonitoradas,
          recebimentosPendentesQtd: stats.recebimentosPendentesQtd,
        }}
      />

      <div className="row g-3">
        <div className="col-sm-6 col-lg-3">
          <StatCard
            title="Total de Clientes"
            value={stats.totalClientes}
            icon={UsersIconSolid}
            colorClass="text-indigo"
            bgColorClass="bg-indigo-subtle"
            onClick={() => handleCardClick('CLIENTES')}
          />
        </div>
        <div className="col-sm-6 col-lg-3">
          <StatCard
            title="Casos Ativos"
            value={stats.casosAtivos}
            icon={BriefcaseIconSolid}
            colorClass="text-success"
            bgColorClass="bg-success-subtle"
            onClick={() => handleCardClick('CASOS')}
          />
        </div>
        <div className="col-sm-6 col-lg-3">
          <StatCard
            title="Recebimentos Pendentes"
            value={`${stats.recebimentosPendentesQtd} (R$ ${stats.recebimentosPendentesValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`}
            icon={CreditCardIconSolid}
            colorClass="text-warning"
            bgColorClass="bg-warning-subtle"
            onClick={() => handleCardClick('RECEBIMENTOS')}
          />
        </div>
        <div className="col-sm-6 col-lg-3">
          <StatCard
            title="Despesas a Pagar"
            value={`${stats.despesasAPagarQtd} (R$ ${stats.despesasAPagarValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`}
            icon={TrendingDownIconSolid}
            colorClass="text-danger"
            bgColorClass="bg-danger-subtle"
            onClick={() => handleCardClick('DESPESAS')}
          />
        </div>
      </div>
      {/* ── Linha Recebimentos detalhados (A Receber + Atrasados) ─────────────── */}
      <div className="row mt-3 g-3">
        <div className="col-sm-6 col-lg-6">
          <StatCard
            title="A Receber (Programados)"
            value={`${stats.recebimentosAReceberQtd} (R$ ${stats.recebimentosAReceberValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`}
            icon={CreditCardIconSolid}
            colorClass="text-info"
            bgColorClass="bg-info-subtle"
            onClick={() => handleCardClick('RECEBIMENTOS')}
          />
        </div>
        <div className="col-sm-6 col-lg-6">
          <StatCard
            title="Atrasados"
            value={`${stats.recebimentosAtrasadosQtd} (R$ ${stats.recebimentosAtrasadosValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`}
            icon={CreditCardIconSolid}
            colorClass="text-danger"
            bgColorClass="bg-danger-subtle"
            onClick={() => handleCardClick('RECEBIMENTOS')}
          />
        </div>
      </div>
      {/* ── Linha Pagamentos Recebidos (caixa do mes/ano) ─────────────────── */}
      <div className="row mt-3 g-3">
        <div className="col-sm-6 col-lg-6">
          <StatCard
            title="Recebido neste Mês"
            value={`${stats.recebimentosPagosMesQtd} (R$ ${stats.recebimentosPagosMesValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`}
            icon={TrendingUpIconSolid}
            colorClass="text-success"
            bgColorClass="bg-success-subtle"
            onClick={() => handleCardClick('RECEBIMENTOS')}
          />
        </div>
        <div className="col-sm-6 col-lg-6">
          <StatCard
            title="Recebido no Ano"
            value={`${stats.recebimentosPagosAnoQtd} (R$ ${stats.recebimentosPagosAnoValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`}
            icon={TrendingUpIconSolid}
            colorClass="text-success"
            bgColorClass="bg-success-subtle"
            onClick={() => handleCardClick('RECEBIMENTOS')}
          />
        </div>
      </div>
      {/* ── Linha Despesas detalhadas (Programadas + Atrasadas) ──────────────── */}
      <div className="row mt-3 g-3">
        <div className="col-sm-6 col-lg-6">
          <StatCard
            title="Despesas Programadas"
            value={`${stats.despesasProgramadasQtd} (R$ ${stats.despesasProgramadasValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`}
            icon={TrendingDownIconSolid}
            colorClass="text-info"
            bgColorClass="bg-info-subtle"
            onClick={() => handleCardClick('DESPESAS')}
          />
        </div>
        <div className="col-sm-6 col-lg-6">
          <StatCard
            title="Despesas Atrasadas"
            value={`${stats.despesasAtrasadasQtd} (R$ ${stats.despesasAtrasadasValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`}
            icon={TrendingDownIconSolid}
            colorClass="text-danger"
            bgColorClass="bg-danger-subtle"
            onClick={() => handleCardClick('DESPESAS')}
          />
        </div>
      </div>

      {/* ── Eventos + Consulta CNJ ───────────────────────────────────────────── */}
      <div className="row mt-4 g-3">
        <div className="col-lg-6">
          <div className="card shadow-sm h-100">
            <div className="card-header bg-light">
              <h2 className="h6 mb-0 text-dark">Próximos Prazos e Eventos</h2>
            </div>
            {proximosEventos && proximosEventos.length > 0 ? (
              <ul className="list-group list-group-flush">
                {proximosEventos.map((evento) => (
                  <EventListItem
                    key={evento.id}
                    evento={evento}
                    onClick={() => handleCardClick('AGENDA')}
                  />
                ))}
              </ul>
            ) : (
              <div
                className="card-body text-center d-flex align-items-center justify-content-center"
                style={{ minHeight: '150px' }}
              >
                <p className="text-muted small mb-0">
                  Nenhum prazo ou evento pendente nos próximos dias.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card shadow-sm h-100 border-primary">
            <div className="card-header bg-primary text-white d-flex align-items-center">
              <MagnifyingGlassIcon style={{ width: '20px', height: '20px' }} className="me-2" />
              <h2 className="h6 mb-0 text-white">Buscar processo</h2>
            </div>
            <div className="card-body">
              <p className="small text-muted mb-3">
                Busca primeiro nos seus Casos e publicações DJEN. Se não achar, oferece consulta ao
                DataJud do CNJ (cobertura limitada em 2ª instância).
              </p>
              <div className="input-group mb-3">
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Número do processo (com ou sem máscara)"
                  value={consultaCnjInput}
                  onChange={(e) => setConsultaCnjInput(formatCNJ(e.target.value))}
                  maxLength={25}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConsultaRapida()
                  }}
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleConsultaRapida}
                  disabled={buscandoConsulta}
                >
                  {buscandoConsulta ? 'Buscando...' : 'Buscar'}
                </button>
              </div>

              {resultadoConsulta?.erro && (
                <div className="alert alert-danger small py-2 mb-0">
                  <strong>Erro:</strong> {resultadoConsulta.erro}
                </div>
              )}

              {/* Resultado da busca local */}
              {resultadoConsulta?.fonte === 'local' && (
                <div
                  className="border rounded p-2 bg-light"
                  style={{ maxHeight: 320, overflowY: 'auto' }}
                >
                  {resultadoConsulta.total_local === 0 ? (
                    <>
                      <p className="small text-muted mb-2 mb-0">
                        <i className="bi bi-info-circle me-1" />
                        Nada encontrado nos seus Casos ou publicações DJEN para{' '}
                        <strong>{resultadoConsulta.numero_consultado}</strong>.
                      </p>
                      <button
                        className="btn btn-outline-primary btn-sm mt-2 w-100"
                        onClick={handleConsultarDataJud}
                        disabled={buscandoConsulta}
                      >
                        <i className="bi bi-globe me-1" />
                        Tentar consultar DataJud (CNJ)
                      </button>
                      <p className="small text-muted mt-2 mb-0">
                        Cobertura limitada em 2ª instância e Justiça Federal.
                      </p>
                      {resultadoConsulta.erroDataJud && (
                        <div className="alert alert-warning small py-2 mt-2 mb-0">
                          {resultadoConsulta.erroDataJud}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {resultadoConsulta.casos?.length > 0 && (
                        <>
                          <strong className="small d-block mb-2">
                            <i className="bi bi-folder me-1 text-primary" />
                            Casos ({resultadoConsulta.casos.length})
                          </strong>
                          {resultadoConsulta.casos.map((c) => (
                            <button
                              key={c.id}
                              className="card border-0 shadow-sm w-100 text-start mb-2"
                              onClick={() => navigate(`/casos/detalhe/${c.id}`)}
                              style={{ cursor: 'pointer' }}
                            >
                              <div className="card-body py-2 px-2">
                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                  <span className="badge bg-primary">{c.status || '—'}</span>
                                  <span className="small font-monospace">{c.numero_processo}</span>
                                </div>
                                <div className="small fw-semibold mt-1">{c.titulo}</div>
                                <div className="small text-muted">
                                  {c.cliente_nome} · {c.vara_juizo || '—'}
                                </div>
                              </div>
                            </button>
                          ))}
                        </>
                      )}
                      {resultadoConsulta.publicacoes?.length > 0 && (
                        <>
                          <strong className="small d-block mt-2 mb-2">
                            <i className="bi bi-newspaper me-1 text-warning" />
                            Publicações DJEN ({resultadoConsulta.publicacoes.length})
                          </strong>
                          {resultadoConsulta.publicacoes.slice(0, 5).map((p) => (
                            <button
                              key={p.id}
                              className="card border-0 shadow-sm w-100 text-start mb-2"
                              onClick={() => navigate(`/djen?publicacao=${p.id}`)}
                              style={{ cursor: 'pointer' }}
                            >
                              <div className="card-body py-2 px-2">
                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                  <span className="badge bg-secondary">
                                    {p.sigla_tribunal || '—'}
                                  </span>
                                  <span className="badge bg-light text-dark border">
                                    {p.tipo_comunicacao || 'Comunicação'}
                                  </span>
                                  {!p.lida && <span className="badge bg-danger">Não lida</span>}
                                </div>
                                <div className="small font-monospace mt-1">
                                  {p.numero_processo_mascara || p.numero_processo}
                                </div>
                                <div className="small text-muted">
                                  {p.nome_orgao} · {p.data_disponibilizacao}
                                </div>
                              </div>
                            </button>
                          ))}
                        </>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Resultado DataJud (fallback) */}
              {resultadoConsulta?.fonte === 'datajud' && (
                <div
                  className="border rounded p-3 bg-light"
                  style={{ maxHeight: 300, overflowY: 'auto' }}
                >
                  <div className="d-flex justify-content-between mb-2">
                    <span className="badge bg-secondary">{resultadoConsulta.instancia}</span>
                    <span className="small text-muted fw-bold">
                      {resultadoConsulta.data_distribuicao?.split('-').reverse().join('/')}
                    </span>
                  </div>
                  <p className="small fw-bold text-dark mb-1">{resultadoConsulta.vara_juizo}</p>
                  <p className="small text-muted mb-2 border-bottom pb-2">
                    Ação: {resultadoConsulta.classe_acao}
                  </p>
                  <pre
                    className="small text-dark mb-0"
                    style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}
                  >
                    {resultadoConsulta.resumo_andamentos || 'Sem andamentos recentes.'}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Movimentações Recentes ───────────────────────────────────────────── */}
      <div className="row mt-4 g-3">
        <div className="col-12">
          <MovimentacoesRecentes />
        </div>
      </div>
    </div>
  )
}

export default Dashboard
