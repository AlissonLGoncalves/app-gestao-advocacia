// src/pages/RecebimentosHistoricoPage.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowTrendingUpIcon, ArrowLeftIcon } from '@heroicons/react/24/solid'
import { getHistoricoRecebimentos } from '../api/financeiro.js'
import { listClientes } from '../api/clientes.js'
import { listCasos } from '../api/casos.js'

const MESES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const formatBRL = (v) => {
  const num = typeof v === 'number' ? v : parseFloat(v)
  if (isNaN(num)) return 'R$ 0,00'
  return num.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

const formatDataBR = (iso) => {
  if (!iso) return '-'
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

function RecebimentosHistoricoPage() {
  const navigate = useNavigate()
  const anoAtual = new Date().getFullYear()
  const mesAtual = new Date().getMonth() + 1

  const [ano, setAno] = useState(anoAtual)
  // mes vazio = ano inteiro
  const [mes, setMes] = useState('')
  const [historico, setHistorico] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  // Lookup id -> nome, montado uma vez no mount. Workaround porque o
  // endpoint /historico devolve so cliente_id/caso_id e o usuario precisa
  // ver os nomes na tabela.
  const [clienteMap, setClienteMap] = useState({})
  const [casoMap, setCasoMap] = useState({})

  // Anos disponiveis no seletor: 5 anos pra tras + ano atual.
  const anosDisponiveis = useMemo(() => {
    const arr = []
    for (let y = anoAtual; y >= anoAtual - 5; y--) arr.push(y)
    return arr
  }, [anoAtual])

  useEffect(() => {
    let cancelado = false
    Promise.all([listClientes({}), listCasos({})])
      .then(([clientes, casos]) => {
        if (cancelado) return
        const cmap = {}
        clientes.forEach((c) => {
          cmap[c.id] = c.nome_razao_social || c.nome || `Cliente #${c.id}`
        })
        const kmap = {}
        casos.forEach((k) => {
          kmap[k.id] = k.titulo || `Caso #${k.id}`
        })
        setClienteMap(cmap)
        setCasoMap(kmap)
      })
      .catch((e) => {
        console.warn('RecebimentosHistoricoPage: lookup de clientes/casos falhou', e)
      })
    return () => {
      cancelado = true
    }
  }, [])

  const carregarHistorico = useCallback(async () => {
    setLoading(true)
    setErro('')
    try {
      const params = { ano }
      if (mes) params.mes = mes
      const data = await getHistoricoRecebimentos(params)
      setHistorico(data)
    } catch (e) {
      console.error('RecebimentosHistoricoPage: erro ao carregar', e)
      setErro(e?.message || 'Falha ao carregar o histórico.')
      setHistorico(null)
    } finally {
      setLoading(false)
    }
  }, [ano, mes])

  useEffect(() => {
    carregarHistorico()
  }, [carregarHistorico])

  const resolverCliente = (id) => (id ? clienteMap[id] || `Cliente #${id}` : 'Sem cliente')
  const resolverCaso = (id) => (id ? casoMap[id] || `Caso #${id}` : 'Sem caso')

  // Maior valor mensal serve de referencia pras barras (escala relativa).
  const maxMes = useMemo(() => {
    if (!historico?.por_mes) return 0
    return historico.por_mes.reduce((acc, b) => Math.max(acc, parseFloat(b.total) || 0), 0)
  }, [historico])

  return (
    <div className="container-fluid px-md-3 px-lg-4 py-3">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div className="d-flex align-items-center">
          <button
            type="button"
            className="btn btn-link text-decoration-none me-2 p-0"
            onClick={() => navigate('/recebimentos')}
            aria-label="Voltar para Recebimentos"
          >
            <ArrowLeftIcon style={{ width: 20, height: 20 }} />
          </button>
          <h2 className="h4 mb-0 fw-bold" style={{ fontFamily: 'var(--font-heading)' }}>
            Histórico de Pagamentos Recebidos
          </h2>
        </div>
      </div>

      {/* Filtros */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body py-3">
          <div className="row g-2 align-items-end">
            <div className="col-sm-4 col-md-3">
              <label htmlFor="filtro-ano" className="form-label small text-muted mb-1">
                Ano
              </label>
              <select
                id="filtro-ano"
                className="form-select"
                value={ano}
                onChange={(e) => setAno(parseInt(e.target.value, 10))}
              >
                {anosDisponiveis.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-sm-4 col-md-3">
              <label htmlFor="filtro-mes" className="form-label small text-muted mb-1">
                Mês
              </label>
              <select
                id="filtro-mes"
                className="form-select"
                value={mes}
                onChange={(e) => setMes(e.target.value)}
              >
                <option value="">Ano inteiro</option>
                {MESES_PT.map((nome, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-sm-4 col-md-3 d-flex align-items-end">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => {
                  setAno(anoAtual)
                  setMes(mesAtual)
                }}
              >
                Mês atual
              </button>
            </div>
          </div>
        </div>
      </div>

      {erro && (
        <div className="alert alert-danger" role="alert">
          {erro}
        </div>
      )}

      {loading && !historico ? (
        <div className="d-flex justify-content-center align-items-center p-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Carregando...</span>
          </div>
          <span className="ms-3 text-muted">Carregando histórico...</span>
        </div>
      ) : historico ? (
        <>
          {/* Cards consolidados */}
          <div className="row g-3 mb-3">
            <div className="col-md-6">
              <div
                className="card border-0 shadow-sm p-4 d-flex flex-row align-items-center"
                style={{ borderRadius: 'var(--radius-lg)' }}
              >
                <div
                  className="p-3 rounded-circle me-4 bg-success-subtle text-success"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(79, 70, 229, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)',
                  }}
                >
                  <ArrowTrendingUpIcon style={{ width: 28, height: 28, color: 'var(--primary)' }} />
                </div>
                <div>
                  <p
                    className="text-muted small text-uppercase mb-1"
                    style={{ fontSize: '0.75rem', letterSpacing: '0.05em', fontWeight: 600 }}
                  >
                    {mes ? `Recebido em ${MESES_PT[parseInt(mes, 10) - 1]}/${ano}` : `Selecione um mês`}
                  </p>
                  <p
                    className="h3 mb-0 fw-bold text-dark"
                    style={{ fontFamily: 'var(--font-heading)' }}
                  >
                    {mes && historico.total_mes !== null
                      ? `${historico.qtd_mes} (${formatBRL(historico.total_mes)})`
                      : '—'}
                  </p>
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div
                className="card border-0 shadow-sm p-4 d-flex flex-row align-items-center"
                style={{ borderRadius: 'var(--radius-lg)' }}
              >
                <div
                  className="p-3 rounded-circle me-4 bg-success-subtle text-success"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(79, 70, 229, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)',
                  }}
                >
                  <ArrowTrendingUpIcon style={{ width: 28, height: 28, color: 'var(--primary)' }} />
                </div>
                <div>
                  <p
                    className="text-muted small text-uppercase mb-1"
                    style={{ fontSize: '0.75rem', letterSpacing: '0.05em', fontWeight: 600 }}
                  >
                    Total no ano de {ano}
                  </p>
                  <p
                    className="h3 mb-0 fw-bold text-dark"
                    style={{ fontFamily: 'var(--font-heading)' }}
                  >
                    {historico.qtd_ano} ({formatBRL(historico.total_ano)})
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Barras por mes */}
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-header bg-white border-0 pb-0">
              <h3 className="h6 mb-0 fw-bold text-dark">Distribuição mensal — {ano}</h3>
            </div>
            <div className="card-body">
              <div className="d-flex flex-column gap-2">
                {historico.por_mes.map((b) => {
                  const total = parseFloat(b.total) || 0
                  const pct = maxMes > 0 ? (total / maxMes) * 100 : 0
                  const isMesSelecionado = mes && parseInt(mes, 10) === b.mes
                  return (
                    <div
                      key={b.mes}
                      className="d-flex align-items-center"
                      style={{
                        cursor: 'pointer',
                        fontWeight: isMesSelecionado ? 700 : 400,
                      }}
                      onClick={() => setMes(String(b.mes))}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') setMes(String(b.mes))
                      }}
                    >
                      <span style={{ width: 40, fontSize: '0.85rem' }} className="text-muted">
                        {MESES_ABREV[b.mes - 1]}
                      </span>
                      <div
                        className="flex-grow-1 me-2"
                        style={{ background: '#f0f0f4', height: 22, borderRadius: 4 }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: isMesSelecionado
                              ? 'var(--primary)'
                              : 'linear-gradient(90deg, #198754 0%, #20c997 100%)',
                            borderRadius: 4,
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                      <span style={{ width: 130, fontSize: '0.85rem' }} className="text-end">
                        {formatBRL(total)}
                      </span>
                      <span
                        style={{ width: 40, fontSize: '0.75rem' }}
                        className="text-end text-muted"
                      >
                        ({b.qtd})
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="row g-3 mb-3">
            {/* Tabela de itens */}
            <div className="col-lg-8">
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-white border-0 pb-0 d-flex justify-content-between align-items-center">
                  <h3 className="h6 mb-0 fw-bold text-dark">
                    {mes
                      ? `Pagamentos em ${MESES_PT[parseInt(mes, 10) - 1]}/${ano}`
                      : `Todos os pagamentos de ${ano}`}
                  </h3>
                  <span className="badge bg-light text-dark">{historico.itens.length}</span>
                </div>
                <div className="card-body p-0">
                  {historico.itens.length === 0 ? (
                    <div className="text-center text-muted py-5">
                      Nenhum pagamento recebido no período.
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-hover mb-0">
                        <thead className="table-light">
                          <tr>
                            <th>Data</th>
                            <th>Descrição</th>
                            <th>Cliente</th>
                            <th>Caso</th>
                            <th>Categoria</th>
                            <th className="text-end">Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {historico.itens.map((it) => (
                            <tr key={it.id}>
                              <td className="text-nowrap">{formatDataBR(it.data_pagamento)}</td>
                              <td>{it.descricao}</td>
                              <td className={it.cliente_id ? '' : 'text-muted fst-italic'}>
                                {resolverCliente(it.cliente_id)}
                              </td>
                              <td className={it.caso_id ? '' : 'text-muted fst-italic'}>
                                {resolverCaso(it.caso_id)}
                              </td>
                              <td>
                                {it.categoria || (
                                  <span className="text-muted fst-italic">Sem categoria</span>
                                )}
                              </td>
                              <td className="text-end fw-bold">{formatBRL(it.valor)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Breakdown por categoria */}
            <div className="col-lg-4">
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-white border-0 pb-0">
                  <h3 className="h6 mb-0 fw-bold text-dark">Por categoria — {ano}</h3>
                </div>
                <div className="card-body">
                  {historico.por_categoria.length === 0 ? (
                    <p className="text-muted small mb-0">Nada para mostrar.</p>
                  ) : (
                    <ul className="list-unstyled mb-0">
                      {historico.por_categoria.map((c) => (
                        <li
                          key={c.categoria}
                          className="d-flex justify-content-between align-items-center py-2 border-bottom"
                        >
                          <div>
                            <div className="fw-medium">{c.categoria}</div>
                            <div className="small text-muted">{c.qtd} pagamento(s)</div>
                          </div>
                          <div className="fw-bold text-success">{formatBRL(c.total)}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

export default RecebimentosHistoricoPage
