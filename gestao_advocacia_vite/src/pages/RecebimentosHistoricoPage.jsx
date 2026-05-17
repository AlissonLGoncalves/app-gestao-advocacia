// src/pages/RecebimentosHistoricoPage.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ArrowLeftIcon,
  ScaleIcon,
} from '@heroicons/react/24/solid'
import { getHistoricoRecebimentos, getHistoricoDespesas } from '../api/financeiro.js'
import { listClientes } from '../api/clientes.js'
import { listCasos } from '../api/casos.js'
import EmitirNFSeButton from '../components/EmitirNFSeButton.jsx'

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
  const [despesas, setDespesas] = useState(null)
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
      // Carrega recebimentos e despesas em paralelo pra compor Entrada x Saida.
      const [rec, desp] = await Promise.all([
        getHistoricoRecebimentos(params),
        getHistoricoDespesas(params),
      ])
      setHistorico(rec)
      setDespesas(desp)
    } catch (e) {
      console.error('RecebimentosHistoricoPage: erro ao carregar', e)
      setErro(e?.message || 'Falha ao carregar o histórico.')
      setHistorico(null)
      setDespesas(null)
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
  // Considera entrada E saida juntas pro grafico comparativo ficar coerente.
  const maxMes = useMemo(() => {
    const arr = []
    if (historico?.por_mes) arr.push(...historico.por_mes.map((b) => parseFloat(b.total) || 0))
    if (despesas?.por_mes) arr.push(...despesas.por_mes.map((b) => parseFloat(b.total) || 0))
    return arr.length ? Math.max(...arr) : 0
  }, [historico, despesas])

  // Calculos de saldo (Entrada x Saida — Etapa 4).
  const saldoMes = useMemo(() => {
    if (!mes || !historico || !despesas) return null
    if (historico.total_mes == null || despesas.total_mes == null) return null
    return parseFloat(historico.total_mes) - parseFloat(despesas.total_mes)
  }, [mes, historico, despesas])
  const saldoAno = useMemo(() => {
    if (!historico || !despesas) return null
    return parseFloat(historico.total_ano) - parseFloat(despesas.total_ano)
  }, [historico, despesas])

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

          {/* Entrada x Saida — Etapa 4 */}
          {despesas && (
            <div className="card border-0 shadow-sm mb-3">
              <div className="card-header bg-white border-0 pb-0">
                <h3 className="h6 mb-0 fw-bold text-dark">
                  Entrada × Saída {mes ? `— ${MESES_PT[parseInt(mes, 10) - 1]}/${ano}` : `— ${ano}`}
                </h3>
              </div>
              <div className="card-body">
                <div className="row g-3 mb-3">
                  <div className="col-md-4">
                    <div className="d-flex align-items-center p-3 rounded bg-success-subtle">
                      <ArrowTrendingUpIcon
                        style={{ width: 24, height: 24, color: '#198754' }}
                        className="me-2"
                      />
                      <div>
                        <div className="small text-muted">Entradas (recebidas)</div>
                        <div className="h5 mb-0 fw-bold text-success">
                          {formatBRL(mes ? historico.total_mes : historico.total_ano)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="d-flex align-items-center p-3 rounded bg-danger-subtle">
                      <ArrowTrendingDownIcon
                        style={{ width: 24, height: 24, color: '#dc3545' }}
                        className="me-2"
                      />
                      <div>
                        <div className="small text-muted">Saídas (pagas)</div>
                        <div className="h5 mb-0 fw-bold text-danger">
                          {formatBRL(mes ? despesas.total_mes : despesas.total_ano)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    {(() => {
                      const saldo = mes ? saldoMes : saldoAno
                      const positivo = saldo == null ? null : saldo >= 0
                      const bgClass =
                        positivo == null
                          ? 'bg-light'
                          : positivo
                            ? 'bg-success-subtle'
                            : 'bg-danger-subtle'
                      const txtClass =
                        positivo == null ? 'text-muted' : positivo ? 'text-success' : 'text-danger'
                      return (
                        <div className={`d-flex align-items-center p-3 rounded ${bgClass}`}>
                          <ScaleIcon
                            style={{
                              width: 24,
                              height: 24,
                              color: positivo ? '#198754' : '#dc3545',
                            }}
                            className="me-2"
                          />
                          <div>
                            <div className="small text-muted">Saldo</div>
                            <div className={`h5 mb-0 fw-bold ${txtClass}`}>
                              {saldo == null ? '—' : formatBRL(saldo)}
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Distribuicao mensal — barras pareadas (entrada vs saida) */}
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-header bg-white border-0 pb-0 d-flex justify-content-between align-items-center">
              <h3 className="h6 mb-0 fw-bold text-dark">Distribuição mensal — {ano}</h3>
              <div className="small text-muted">
                <span style={{ color: '#198754' }}>● Entrada</span>{' '}
                <span style={{ color: '#dc3545' }} className="ms-2">
                  ● Saída
                </span>
              </div>
            </div>
            <div className="card-body">
              <div className="d-flex flex-column gap-1">
                {historico.por_mes.map((b, i) => {
                  const totalRec = parseFloat(b.total) || 0
                  const totalDesp = despesas ? parseFloat(despesas.por_mes[i].total) || 0 : 0
                  const pctRec = maxMes > 0 ? (totalRec / maxMes) * 100 : 0
                  const pctDesp = maxMes > 0 ? (totalDesp / maxMes) * 100 : 0
                  const isMesSelecionado = mes && parseInt(mes, 10) === b.mes
                  return (
                    <div
                      key={b.mes}
                      className="d-flex align-items-center"
                      style={{
                        cursor: 'pointer',
                        fontWeight: isMesSelecionado ? 700 : 400,
                        padding: '4px 0',
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
                      <div className="flex-grow-1 me-2">
                        <div
                          style={{
                            background: '#f0f0f4',
                            height: 11,
                            borderRadius: 3,
                            marginBottom: 2,
                          }}
                        >
                          <div
                            style={{
                              width: `${pctRec}%`,
                              height: '100%',
                              background: '#198754',
                              borderRadius: 3,
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>
                        <div style={{ background: '#f0f0f4', height: 11, borderRadius: 3 }}>
                          <div
                            style={{
                              width: `${pctDesp}%`,
                              height: '100%',
                              background: '#dc3545',
                              borderRadius: 3,
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>
                      </div>
                      <div
                        style={{ width: 160, fontSize: '0.78rem' }}
                        className="text-end font-monospace"
                      >
                        <div className="text-success">{formatBRL(totalRec)}</div>
                        <div className="text-danger">{formatBRL(totalDesp)}</div>
                      </div>
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
                            <th>NFS-e</th>
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
                              <td>
                                <EmitirNFSeButton recebimento={it} />
                              </td>
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
