// src/Dashboard.jsx
import React, { useState, useEffect, useCallback } from 'react'
import { API_URL } from '../config.js'
import { syncDjen, listOabs } from '../api/djen.js'
import MovimentacoesRecentes from './MovimentacoesRecentes.jsx'
import OnboardingChecklist from './OnboardingChecklist.jsx'
import FilaDeTrabalho from './FilaDeTrabalho.jsx'
import { useNavigate } from 'react-router'

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
import { getResumoFinanceiro } from '../api/financeiro.js'

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
  const [oabsMonitoradas, setOabsMonitoradas] = useState(null)
  const [syncing, setSyncing] = useState(false)
  // App leve: detalhes financeiros começam recolhidos (progressive disclosure)
  const [verDetalheFinanceiro, setVerDetalheFinanceiro] = useState(false)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

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
    triggerDjenSync()
    listOabs()
      .then((data) => setOabsMonitoradas(Array.isArray(data) ? data : []))
      .catch(() => setOabsMonitoradas([]))
  }, [fetchDashboardData, triggerDjenSync])

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

  return (
    <div className="container-fluid p-0">
      {/* Feedback 26/07 ("app confuso; o que eu tenho que fazer?"): o topo do
          Início mostrava os MESMOS prazos em 3 blocos — "Meu dia", mini-kanban
          e "Próximos Prazos e Eventos" — com 3 chamadas iguais à API. Tudo isso
          virou UMA fila: cada linha é uma ação com um botão. */}
      <FilaDeTrabalho />

      {syncing && (
        <div className="text-muted small d-flex align-items-center gap-2 mb-3">
          <ArrowPathIcon style={{ width: 14, height: 14 }} className="text-primary" />
          Verificando novas publicações no DJEN...
        </div>
      )}

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
      {/* App leve: os 6 cartões de detalhe financeiro ficavam TODOS abertos no
          Início (10 cartões no total). Agora vêm recolhidos — quem quer o
          detalhe abre; quem só quer saber "o que faço hoje" não vê o ruído. */}
      <button
        type="button"
        className="btn btn-sm btn-link text-decoration-none px-1 mt-3"
        onClick={() => setVerDetalheFinanceiro((v) => !v)}
        aria-expanded={verDetalheFinanceiro}
      >
        {verDetalheFinanceiro ? 'Ocultar' : 'Ver'} detalhes financeiros
        <ChevronRightIcon
          style={{
            width: 14,
            height: 14,
            transform: verDetalheFinanceiro ? 'rotate(90deg)' : 'none',
            transition: 'transform 150ms',
          }}
          className="ms-1"
        />
      </button>

      {verDetalheFinanceiro && (
        <>
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
        </>
      )}

      {/* ── Busca de processo ──────────────────────────────────────────────── */}
      <div className="row mt-4 g-3">
        <div className="col-lg-6">
          {/* App leve: o formulario completo de busca CNJ ocupava metade do
              Inicio. Virou atalho — a busca continua em /casos/buscar e no
              Ctrl+K ("Consultar processo (CNJ)"). */}
          <div className="card h-100">
            <div className="card-body d-flex flex-column justify-content-center align-items-start gap-2">
              <div className="d-flex align-items-center gap-2">
                <MagnifyingGlassIcon style={{ width: 18, height: 18 }} className="text-primary" />
                <h2 className="h6 mb-0">Buscar processo</h2>
              </div>
              <p className="small text-muted mb-2">
                Procura nos seus casos e publicacoes; se nao achar, consulta o DataJud do CNJ.
              </p>
              <button
                className="btn btn-sm btn-outline-primary"
                onClick={() => navigate('/casos/buscar')}
              >
                Abrir busca de processo
              </button>
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
