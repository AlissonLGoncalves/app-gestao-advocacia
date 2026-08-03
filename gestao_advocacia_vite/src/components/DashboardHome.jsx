import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  ArrowPathIcon,
  ArrowRightIcon,
  BriefcaseIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
  NewspaperIcon,
  PlusIcon,
  UsersIcon,
} from '@heroicons/react/24/outline'
import { api } from '../api/client.js'
import './DashboardHome.css'

const formatarMoeda = (valor) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(valor || 0)

const formatarData = (valor, opcoes = {}) => {
  if (!valor) return ''
  return new Intl.DateTimeFormat('pt-BR', opcoes).format(new Date(valor))
}

const obterPrimeiroNome = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    return (user.nome_completo || user.username || '').trim().split(/\s+/)[0]
  } catch {
    return ''
  }
}

function MetricCard({ label, value, detail, icon: Icon, tone, onClick }) {
  return (
    <button type="button" className={`dh-metric dh-metric--${tone}`} onClick={onClick}>
      <span className="dh-metric__icon" aria-hidden="true">
        <Icon />
      </span>
      <span className="dh-metric__content">
        <span className="dh-metric__label">{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </span>
      <ArrowRightIcon className="dh-metric__arrow" aria-hidden="true" />
    </button>
  )
}

function DashboardSkeleton() {
  return (
    <div className="dashboard-home" aria-label="Carregando a tela inicial">
      <div className="dh-skeleton dh-skeleton--title" />
      <div className="dh-workspace-grid">
        <div className="dh-skeleton dh-skeleton--panel" />
        <div className="dh-skeleton dh-skeleton--panel" />
      </div>
      <div className="dh-skeleton dh-skeleton--strip" />
    </div>
  )
}

function DashboardHome() {
  const navigate = useNavigate()
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [recarregando, setRecarregando] = useState(false)

  const carregar = async (silencioso = false) => {
    if (silencioso) setRecarregando(true)
    setErro('')
    try {
      setDados(await api.get('/dashboard/home'))
    } catch (error) {
      setErro(error.message || 'Não foi possível carregar a tela inicial.')
    } finally {
      setRecarregando(false)
    }
  }

  useEffect(() => {
    let ativo = true
    api
      .get('/dashboard/home')
      .then((resultado) => {
        if (ativo) setDados(resultado)
      })
      .catch((error) => {
        if (ativo) {
          setErro(error.message || 'Não foi possível carregar a tela inicial.')
        }
      })
    return () => {
      ativo = false
    }
  }, [])

  const acoes = useMemo(() => {
    if (!dados) return []
    const itens = []
    const intimacoes = dados.resumo?.intimacoes_pendentes || 0

    if (intimacoes > 0) {
      itens.push({
        id: 'djen',
        tone: 'rust',
        icon: NewspaperIcon,
        eyebrow: 'Intimações',
        title: `${intimacoes} ${intimacoes === 1 ? 'publicação aguarda' : 'publicações aguardam'} triagem`,
        meta: 'Revise e vincule ao processo correto.',
        target: '/djen',
      })
    }

    ;(dados.tarefas_prioritarias || []).slice(0, 4).forEach((tarefa) => {
      const vencimento = formatarData(tarefa.data_vencimento, {
        day: '2-digit',
        month: 'short',
      })
      itens.push({
        id: `tarefa-${tarefa.id}`,
        tone: tarefa.urgencia === 'vencido' ? 'rust' : tarefa.urgencia === 'hoje' ? 'amber' : 'ink',
        icon: ClockIcon,
        eyebrow:
          tarefa.urgencia === 'vencido'
            ? 'Prazo vencido'
            : tarefa.urgencia === 'hoje'
              ? 'Vence hoje'
              : `Vence ${vencimento}`,
        title: tarefa.titulo,
        meta: tarefa.caso_titulo || tarefa.categoria || 'Tarefa do escritório',
        target: '/agenda?view=kanban',
      })
    })

    const financeiro = dados.resumo?.financeiro_vencido
    if (financeiro?.quantidade > 0 && itens.length < 5) {
      itens.push({
        id: 'financeiro',
        tone: 'amber',
        icon: CurrencyDollarIcon,
        eyebrow: 'Financeiro',
        title: `${financeiro.quantidade} ${financeiro.quantidade === 1 ? 'lançamento vencido' : 'lançamentos vencidos'}`,
        meta: `${formatarMoeda(financeiro.valor_total)} requer conferência.`,
        target: '/financeiro',
      })
    }

    return itens.slice(0, 5)
  }, [dados])

  if (!dados && !erro) return <DashboardSkeleton />

  if (!dados && erro) {
    return (
      <div className="dashboard-home">
        <div className="dh-error" role="alert">
          <span>Não foi possível montar sua visão do dia.</span>
          <small>{erro}</small>
          <button type="button" onClick={() => carregar()}>
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  const resumo = dados.resumo || {}
  const hoje = dados.hoje || {}
  const financeiro = resumo.financeiro_vencido
  const primeiroNome = obterPrimeiroNome()
  const dataExtenso = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())

  return (
    <main className="dashboard-home">
      <header className="dh-masthead">
        <div>
          <p className="dh-kicker">Início · {dataExtenso}</p>
          <h1>{primeiroNome ? `Bom dia, ${primeiroNome}.` : 'Bom dia.'}</h1>
          <p className="dh-subtitle">O essencial do escritório, em ordem de prioridade.</p>
        </div>
        <div className="dh-header-actions">
          <button
            type="button"
            className="dh-button dh-button--ghost"
            onClick={() => carregar(true)}
            disabled={recarregando}
          >
            <ArrowPathIcon className={recarregando ? 'is-spinning' : ''} />
            Atualizar
          </button>
          <button
            type="button"
            className="dh-button dh-button--primary"
            onClick={() => navigate('/clientes/novo')}
          >
            <PlusIcon />
            Novo cliente
          </button>
        </div>
      </header>

      {!dados.monitoramento_djen_configurado && (
        <button type="button" className="dh-setup-note" onClick={() => navigate('/djen')}>
          <NewspaperIcon />
          <span>
            <strong>Ative o monitoramento do DJEN</strong>
            Cadastre sua OAB para receber publicações automaticamente.
          </span>
          <ArrowRightIcon />
        </button>
      )}

      <section className="dh-workspace-grid" aria-label="Prioridades do dia">
        <article className="dh-panel dh-focus-panel">
          <div className="dh-panel__header">
            <div>
              <span className="dh-section-index">01</span>
              <h2>Atenção agora</h2>
            </div>
            <span className="dh-count">{acoes.length}</span>
          </div>

          {acoes.length === 0 ? (
            <div className="dh-empty-state">
              <CheckCircleIcon />
              <div>
                <strong>Nenhuma urgência encontrada</strong>
                <span>Você pode avançar no trabalho planejado.</span>
              </div>
            </div>
          ) : (
            <div className="dh-action-list">
              {acoes.map((acao) => {
                const Icon = acao.icon
                return (
                  <button
                    type="button"
                    className={`dh-action dh-action--${acao.tone}`}
                    key={acao.id}
                    onClick={() => navigate(acao.target)}
                  >
                    <span className="dh-action__icon">
                      <Icon />
                    </span>
                    <span className="dh-action__copy">
                      <small>{acao.eyebrow}</small>
                      <strong>{acao.title}</strong>
                      <span>{acao.meta}</span>
                    </span>
                    <ArrowRightIcon className="dh-action__arrow" />
                  </button>
                )
              })}
            </div>
          )}
        </article>

        <aside className="dh-panel dh-today-panel">
          <div className="dh-panel__header">
            <div>
              <span className="dh-section-index">02</span>
              <h2>Hoje</h2>
            </div>
            <CalendarDaysIcon className="dh-panel__mark" />
          </div>
          <div className="dh-today-list">
            <button type="button" onClick={() => navigate('/agenda?view=kanban')}>
              <strong>{hoje.prazos || 0}</strong>
              <span>Prazos vencendo</span>
            </button>
            <button type="button" onClick={() => navigate('/agenda')}>
              <strong>{hoje.eventos || 0}</strong>
              <span>Eventos na agenda</span>
            </button>
            <button type="button" onClick={() => navigate('/djen')}>
              <strong>{hoje.publicacoes || 0}</strong>
              <span>Publicações recebidas</span>
            </button>
          </div>
          <button type="button" className="dh-text-link" onClick={() => navigate('/agenda')}>
            Abrir agenda completa <ArrowRightIcon />
          </button>
        </aside>
      </section>

      <section className="dh-metrics" aria-label="Panorama do escritório">
        <MetricCard
          label="Clientes"
          value={resumo.clientes || 0}
          detail={`${resumo.casos_ativos || 0} casos ativos`}
          icon={UsersIcon}
          tone="teal"
          onClick={() => navigate('/clientes')}
        />
        <MetricCard
          label="Intimações"
          value={resumo.intimacoes_pendentes || 0}
          detail="aguardando triagem"
          icon={NewspaperIcon}
          tone="rust"
          onClick={() => navigate('/djen')}
        />
        <MetricCard
          label="Prazos"
          value={resumo.prazos_urgentes || 0}
          detail="vencidos ou para hoje"
          icon={BriefcaseIcon}
          tone="amber"
          onClick={() => navigate('/agenda?view=kanban')}
        />
        {financeiro && (
          <MetricCard
            label="Financeiro"
            value={financeiro.quantidade || 0}
            detail={`${formatarMoeda(financeiro.valor_total)} vencidos`}
            icon={CurrencyDollarIcon}
            tone="ink"
            onClick={() => navigate('/financeiro')}
          />
        )}
      </section>

      <section className="dh-panel dh-movements">
        <div className="dh-panel__header">
          <div>
            <span className="dh-section-index">03</span>
            <h2>Últimas movimentações</h2>
          </div>
          <button type="button" className="dh-text-link" onClick={() => navigate('/djen')}>
            Ver todas <ArrowRightIcon />
          </button>
        </div>

        {(dados.publicacoes_recentes || []).length === 0 ? (
          <p className="dh-movements__empty">Nenhuma publicação recente.</p>
        ) : (
          <div className="dh-publication-list">
            {dados.publicacoes_recentes.map((publicacao) => (
              <button type="button" key={publicacao.id} onClick={() => navigate('/djen')}>
                <span className={`dh-unread-dot ${publicacao.lida ? 'is-read' : ''}`} />
                <span className="dh-publication__date">
                  {formatarData(publicacao.data, { day: '2-digit', month: 'short' })}
                </span>
                <span className="dh-publication__body">
                  <strong>
                    {publicacao.cliente_nome || publicacao.caso_titulo || 'Publicação sem vínculo'}
                  </strong>
                  <span>{publicacao.resumo || 'Sem resumo disponível.'}</span>
                </span>
                <span className="dh-publication__court">{publicacao.tribunal}</span>
                <ArrowRightIcon />
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

export default DashboardHome
