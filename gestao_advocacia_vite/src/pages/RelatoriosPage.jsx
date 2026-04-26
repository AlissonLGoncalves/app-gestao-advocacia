import React, { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-toastify'
import {
  getRelatorioContasAReceber,
  getRelatorioContasAPagar,
  getRelatorioFluxoCaixa,
  getRelatorioCasosStatus,
} from '../api/financeiro.js'

const fmtBRL = (v) =>
  parseFloat(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtData = (d) => (d ? new Date(d).toLocaleDateString('pt-BR') : '—')

const CORES_STATUS = {
  Ativo: 'success',
  'Em Andamento': 'primary',
  Concluido: 'secondary',
  Arquivado: 'dark',
  Encerrado: 'dark',
  Suspenso: 'warning',
  Pendente: 'warning',
  'Sem status': 'light',
}

// ─── sub-relatórios ──────────────────────────────────────────────────────────

function ContasAReceber() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      setData(await getRelatorioContasAReceber())
    } catch (err) {
      toast.error('Erro ao carregar Contas a Receber: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  if (loading) return <div className="text-center py-4 text-muted small">Carregando...</div>
  if (!data) return null

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="fw-bold mb-0">Contas a Receber</h6>
        <span className="badge bg-warning text-dark fs-6">{fmtBRL(data.total_geral)} pendente</span>
      </div>
      {data.items.length === 0 ? (
        <p className="text-muted small">Nenhum recebimento registrado.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm table-hover align-middle">
            <thead className="table-light">
              <tr>
                <th>Descrição</th>
                <th>Cliente</th>
                <th>Caso</th>
                <th className="text-end">Valor</th>
                <th>Vencimento</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id} className={item.status === 'Vencido' ? 'table-danger' : ''}>
                  <td>{item.descricao}</td>
                  <td className="text-muted small">{item.cliente_nome || '—'}</td>
                  <td className="text-muted small">{item.caso_titulo || '—'}</td>
                  <td className="text-end fw-semibold">{fmtBRL(item.valor)}</td>
                  <td className="small">{fmtData(item.data_vencimento)}</td>
                  <td>
                    <span
                      className={`badge ${item.status === 'Pendente' ? 'bg-warning text-dark' : item.status === 'Vencido' ? 'bg-danger' : 'bg-success'}`}
                    >
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="table-light fw-bold">
              <tr>
                <td colSpan={3} className="text-end">
                  Total pendente:
                </td>
                <td className="text-end">{fmtBRL(data.total_geral)}</td>
                <td colSpan={2} className="text-muted small">
                  ({data.quantidade_items} item(s))
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

function ContasAPagar() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      setData(await getRelatorioContasAPagar())
    } catch (err) {
      toast.error('Erro ao carregar Contas a Pagar: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  if (loading) return <div className="text-center py-4 text-muted small">Carregando...</div>
  if (!data) return null

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="fw-bold mb-0">Contas a Pagar</h6>
        <span className="badge bg-danger fs-6">{fmtBRL(data.total_geral)} pendente</span>
      </div>
      {data.items.length === 0 ? (
        <p className="text-muted small">Nenhuma despesa registrada.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm table-hover align-middle">
            <thead className="table-light">
              <tr>
                <th>Descrição</th>
                <th>Caso Associado</th>
                <th className="text-end">Valor</th>
                <th>Vencimento</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id} className={item.status === 'Vencida' ? 'table-danger' : ''}>
                  <td>{item.descricao}</td>
                  <td className="text-muted small">{item.caso_titulo || 'Despesa Geral'}</td>
                  <td className="text-end fw-semibold">{fmtBRL(item.valor)}</td>
                  <td className="small">{fmtData(item.data_vencimento)}</td>
                  <td>
                    <span
                      className={`badge ${item.status === 'A Pagar' ? 'bg-warning text-dark' : item.status === 'Vencida' ? 'bg-danger' : 'bg-success'}`}
                    >
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="table-light fw-bold">
              <tr>
                <td colSpan={2} className="text-end">
                  Total pendente:
                </td>
                <td className="text-end">{fmtBRL(data.total_geral)}</td>
                <td colSpan={2} className="text-muted small">
                  ({data.quantidade_items} item(s))
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

function FluxoCaixa() {
  const anoAtual = new Date().getFullYear()
  const [ano, setAno] = useState(anoAtual)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async (a) => {
    setLoading(true)
    try {
      setData(await getRelatorioFluxoCaixa(a))
    } catch (err) {
      toast.error('Erro ao carregar Fluxo de Caixa: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar(ano)
  }, [ano, carregar])

  if (loading) return <div className="text-center py-4 text-muted small">Carregando...</div>
  if (!data) return null

  const maxVal = Math.max(...data.meses.flatMap((m) => [m.receitas, m.despesas]), 1)

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <h6 className="fw-bold mb-0">Fluxo de Caixa</h6>
        <div className="d-flex align-items-center gap-2">
          <button className="btn btn-sm btn-outline-secondary" onClick={() => setAno((a) => a - 1)}>
            ◀
          </button>
          <span className="fw-bold">{ano}</span>
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setAno((a) => a + 1)}
            disabled={ano >= anoAtual}
          >
            ▶
          </button>
        </div>
      </div>

      {/* Cards de totais */}
      <div className="row g-3 mb-4">
        {[
          { label: 'Total Receitas', valor: data.totais.receitas, cor: 'success' },
          { label: 'Total Despesas', valor: data.totais.despesas, cor: 'danger' },
          {
            label: 'Resultado do Ano',
            valor: data.totais.saldo,
            cor: data.totais.saldo >= 0 ? 'primary' : 'danger',
          },
        ].map((card) => (
          <div key={card.label} className="col-md-4">
            <div className={`card border-0 bg-${card.cor} bg-opacity-10 h-100`}>
              <div className="card-body py-3">
                <p className="text-muted small mb-1">{card.label}</p>
                <p className={`fw-bold fs-5 text-${card.cor} mb-0`}>{fmtBRL(card.valor)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabela mensal */}
      <div className="table-responsive">
        <table className="table table-sm table-hover align-middle">
          <thead className="table-light">
            <tr>
              <th>Mês</th>
              <th className="text-end">Receitas</th>
              <th className="text-end">Despesas</th>
              <th className="text-end">Saldo Mensal</th>
              <th className="text-end">Saldo Acumulado</th>
              <th style={{ width: '180px' }}>Gráfico</th>
            </tr>
          </thead>
          <tbody>
            {data.meses.map((m) => (
              <tr key={m.mes} className={m.saldo < 0 ? 'table-danger bg-opacity-25' : ''}>
                <td className="fw-semibold">{m.mes_nome}</td>
                <td className="text-end text-success">{fmtBRL(m.receitas)}</td>
                <td className="text-end text-danger">{fmtBRL(m.despesas)}</td>
                <td className={`text-end fw-bold ${m.saldo >= 0 ? 'text-success' : 'text-danger'}`}>
                  {fmtBRL(m.saldo)}
                </td>
                <td
                  className={`text-end text-muted small ${m.saldo_acumulado < 0 ? 'text-danger' : ''}`}
                >
                  {fmtBRL(m.saldo_acumulado)}
                </td>
                <td>
                  <div className="d-flex gap-1 align-items-center" style={{ height: '16px' }}>
                    {m.receitas > 0 && (
                      <div
                        className="bg-success rounded-1"
                        style={{
                          width: `${Math.round((m.receitas / maxVal) * 80)}px`,
                          height: '10px',
                          minWidth: '2px',
                        }}
                        title={`Receitas: ${fmtBRL(m.receitas)}`}
                      />
                    )}
                    {m.despesas > 0 && (
                      <div
                        className="bg-danger rounded-1"
                        style={{
                          width: `${Math.round((m.despesas / maxVal) * 80)}px`,
                          height: '10px',
                          minWidth: '2px',
                        }}
                        title={`Despesas: ${fmtBRL(m.despesas)}`}
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="table-light fw-bold">
            <tr>
              <td>TOTAL</td>
              <td className="text-end text-success">{fmtBRL(data.totais.receitas)}</td>
              <td className="text-end text-danger">{fmtBRL(data.totais.despesas)}</td>
              <td className={`text-end ${data.totais.saldo >= 0 ? 'text-success' : 'text-danger'}`}>
                {fmtBRL(data.totais.saldo)}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function CasosStatus() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      setData(await getRelatorioCasosStatus())
    } catch (err) {
      toast.error('Erro ao carregar status dos casos: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  if (loading) return <div className="text-center py-4 text-muted small">Carregando...</div>
  if (!data) return null

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="fw-bold mb-0">Casos por Status</h6>
        <span className="badge bg-primary fs-6">{data.total} casos no total</span>
      </div>

      {data.status_groups.length === 0 ? (
        <p className="text-muted small">Nenhum caso cadastrado ainda.</p>
      ) : (
        <div className="row g-3">
          {data.status_groups.map((g) => {
            const cor = CORES_STATUS[g.status] || 'secondary'
            return (
              <div key={g.status} className="col-sm-6 col-md-4">
                <div className={`card border-0 bg-${cor} bg-opacity-10 h-100`}>
                  <div className="card-body py-3">
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <p className="text-muted small mb-1">{g.status}</p>
                        <p className={`fw-bold fs-4 text-${cor === 'light' ? 'dark' : cor} mb-0`}>
                          {g.count}
                        </p>
                      </div>
                      <span
                        className={`badge bg-${cor === 'light' ? 'secondary' : cor} opacity-75 fs-6`}
                      >
                        {g.percentual}%
                      </span>
                    </div>
                    <div className="progress mt-2" style={{ height: '4px' }}>
                      <div
                        className={`progress-bar bg-${cor === 'light' ? 'secondary' : cor}`}
                        style={{ width: `${g.percentual}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── página principal ────────────────────────────────────────────────────────

const RELATORIOS = [
  {
    id: 'contas_receber',
    label: 'Contas a Receber',
    icon: 'bi-arrow-down-circle-fill',
    cor: 'success',
  },
  { id: 'contas_pagar', label: 'Contas a Pagar', icon: 'bi-arrow-up-circle-fill', cor: 'danger' },
  { id: 'fluxo_caixa', label: 'Fluxo de Caixa', icon: 'bi-bar-chart-fill', cor: 'primary' },
  { id: 'casos_status', label: 'Casos por Status', icon: 'bi-pie-chart-fill', cor: 'warning' },
]

function RelatoriosPage() {
  const [ativo, setAtivo] = useState(null)

  const renderRelatorio = () => {
    switch (ativo) {
      case 'contas_receber':
        return <ContasAReceber />
      case 'contas_pagar':
        return <ContasAPagar />
      case 'fluxo_caixa':
        return <FluxoCaixa />
      case 'casos_status':
        return <CasosStatus />
      default:
        return (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-bar-chart display-4 d-block mb-3 opacity-25" />
            Selecione um relatório acima para visualizar.
          </div>
        )
    }
  }

  return (
    <div
      className="container-fluid p-4"
      style={{ backgroundColor: '#f8fafc', minHeight: 'calc(100vh - 70px)' }}
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <h4 className="fw-bold text-dark mb-1">Central de Relatórios</h4>
        <p className="text-muted small mb-4">
          Análises financeiras e operacionais do seu escritório.
        </p>

        {/* Seletor de relatório */}
        <div className="row g-3 mb-4">
          {RELATORIOS.map((r) => (
            <div key={r.id} className="col-6 col-md-3">
              <button
                className={`card border-2 w-100 text-start p-3 shadow-sm transition ${ativo === r.id ? `border-${r.cor} bg-${r.cor} bg-opacity-10` : 'border-light bg-white'}`}
                style={{ cursor: 'pointer' }}
                onClick={() => setAtivo(ativo === r.id ? null : r.id)}
              >
                <i className={`bi ${r.icon} text-${r.cor} fs-4 d-block mb-1`} />
                <span className="fw-semibold small text-dark">{r.label}</span>
              </button>
            </div>
          ))}
        </div>

        {/* Conteúdo */}
        {ativo && (
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body p-4">{renderRelatorio()}</div>
          </div>
        )}

        {!ativo && (
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body">{renderRelatorio()}</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default RelatoriosPage
