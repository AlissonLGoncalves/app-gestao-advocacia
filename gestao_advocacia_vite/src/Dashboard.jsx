// src/Dashboard.jsx
import React, { useState, useEffect, useCallback } from 'react'
import { API_URL } from './config.js'
import { listProximos } from './api/agenda.js'
import MovimentacoesRecentes from './components/MovimentacoesRecentes.jsx'

import {
  UsersIcon as UsersIconSolid,
  BriefcaseIcon as BriefcaseIconSolid,
  CreditCardIcon as CreditCardIconSolid,
  ArrowTrendingDownIcon as TrendingDownIconSolid,
  ClockIcon as PrazoIconSolid,
  CalendarDaysIcon as EventoIconSolid,
} from '@heroicons/react/24/solid'
import { ChevronRightIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { formatCNJ } from './utils/cnj.js'
import { getResumoFinanceiro } from './api/financeiro.js'

const StatCard = ({
  title,
  value,
  icon: IconComponent,
  colorClass = 'text-primary',
  bgColorClass = 'bg-primary-subtle',
  onClick,
}) => (
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
      <IconComponent style={{ width: '28px', height: '28px', color: 'var(--primary)' }} />
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
  const [stats, setStats] = useState({
    totalClientes: undefined,
    casosAtivos: undefined,
    recebimentosPendentesValor: 0,
    recebimentosPendentesQtd: 0,
    despesasAPagarValor: 0,
    despesasAPagarQtd: 0,
  })
  const [proximosEventos, setProximosEventos] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  // Estados do Widget de Consulta Rápida
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
        despesasAPagarValor: data.despesas_a_pagar?.valor_total ?? 0,
        despesasAPagarQtd: data.despesas_a_pagar?.quantidade ?? 0,
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

  useEffect(() => {
    fetchDashboardData()
    fetchProximosEventos()
  }, [fetchDashboardData, fetchProximosEventos])

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

  const handleConsultaRapida = async () => {
    const limpo = consultaCnjInput.replace(/\D/g, '')
    if (limpo.length !== 20) {
      setResultadoConsulta({ erro: 'Por favor, insira um número CNJ válido de 20 dígitos.' })
      return
    }

    setBuscandoConsulta(true)
    setResultadoConsulta(null)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${API_URL}/casos/consulta-publica-cnj?numero=${encodeURIComponent(limpo)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      let data = {}
      const isJson = (response.headers.get('content-type') || '').includes('application/json')
      if (isJson) {
        data = await response.json()
      } else {
        const text = await response.text()
        data = { message: text || `Erro HTTP ${response.status}` }
      }

      if (!response.ok) {
        const detalhe =
          data?.detalhes?.erro || data?.detalhes?.detalhes_servico_cnj || data?.detalhes || ''
        let mensagem = data.message || 'Falha ao buscar processo.'
        if (response.status === 503) {
          mensagem = 'Servico CNJ/DataJud indisponivel no momento.'
        }
        if (detalhe && typeof detalhe === 'string') {
          mensagem = `${mensagem} ${detalhe}`.trim()
        }
        setResultadoConsulta({ erro: mensagem })
      } else {
        setResultadoConsulta(data)
      }
    } catch (e) {
      setResultadoConsulta({ erro: 'Erro de conexão ao acessar o Tribunal/DataJud.' })
    } finally {
      setBuscandoConsulta(false)
    }
  }

  return (
    <div className="container-fluid p-0">
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
      <div className="row mt-4 g-3">
        {/* Coluna Eventos */}
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

        {/* Coluna Widget Consulta Rápida */}
        <div className="col-lg-6">
          <div className="card shadow-sm h-100 border-primary">
            <div className="card-header bg-primary text-white d-flex align-items-center">
              <MagnifyingGlassIcon style={{ width: '20px', height: '20px' }} className="me-2" />
              <h2 className="h6 mb-0 text-white">Consulta Rápida Processual (DataJud)</h2>
            </div>
            <div className="card-body">
              <p className="small text-muted mb-3">
                Pesquise informações gratuitas ao vivo no tribunal sem salvar na sua base local.
              </p>
              <div className="input-group mb-3">
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Cole aqui o número do processo..."
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
                  {buscandoConsulta ? 'Buscando...' : 'Consultar'}
                </button>
              </div>

              {/* Resultados da Consulta Rápida */}
              {resultadoConsulta && !resultadoConsulta.erro && (
                <div
                  className="border rounded p-3 bg-light"
                  style={{ maxHeight: '300px', overflowY: 'auto' }}
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
                    {resultadoConsulta.resumo_andamentos || 'Sem andamentos disponíveis recente.'}
                  </pre>
                </div>
              )}

              {resultadoConsulta && resultadoConsulta.erro && (
                <div className="alert alert-danger small py-2 mb-0">
                  <strong>Erro na busca:</strong> {resultadoConsulta.erro}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Movimentacoes Recentes Widget */}
      <div className="row mt-4 g-3">
        <div className="col-12">
          <MovimentacoesRecentes />
        </div>
      </div>{' '}
    </div>
  )
}

export default Dashboard
