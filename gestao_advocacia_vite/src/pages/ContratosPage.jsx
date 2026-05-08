import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { API_URL } from '../config.js'
import {
  DocumentCurrencyDollarIcon,
  MagnifyingGlassIcon,
  LinkIcon,
} from '@heroicons/react/24/outline'

const STATUS_OPTIONS = ['Todos', 'Ativo', 'Pendente Assinatura', 'Minuta', 'Finalizado', 'Cancelado']
const TIPO_OPTIONS = ['Todos', 'Fixo', 'Êxito', 'Misto', 'Mensal', 'Horas']

const ICON_TITLE = { width: '24px', height: '24px', display: 'inline' }
const ICON_SM = { width: '14px', height: '14px', display: 'inline' }

function fmtBRL(v) {
  if (v == null || v === '') return '-'
  const n = Number(v)
  if (Number.isNaN(n)) return '-'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtPct(v) {
  if (v == null || v === '') return '-'
  const n = Number(v)
  if (Number.isNaN(n)) return '-'
  return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

function fmtData(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-BR')
}

function statusBadgeClass(status) {
  const s = (status || '').toLowerCase()
  if (s === 'ativo') return 'badge bg-success'
  if (s.includes('pendente')) return 'badge bg-warning text-dark'
  if (s === 'minuta') return 'badge bg-secondary'
  if (s === 'cancelado') return 'badge bg-danger'
  if (s === 'finalizado') return 'badge bg-primary'
  return 'badge bg-light text-dark'
}

export default function ContratosPage() {
  const [contratos, setContratos] = useState([])
  const [clientes, setClientes] = useState({})
  const [casos, setCasos] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('Todos')
  const [filtroTipo, setFiltroTipo] = useState('Todos')

  const fetchTudo = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token) return
    setIsLoading(true)
    try {
      const headers = { Authorization: `Bearer ${token}` }
      const [resContratos, resClientes, resCasos] = await Promise.all([
        fetch(`${API_URL}/contratos/`, { headers }),
        fetch(`${API_URL}/clientes/`, { headers }),
        fetch(`${API_URL}/casos/`, { headers }),
      ])
      if (!resContratos.ok) throw new Error('Falha ao carregar contratos')
      const dataContratos = await resContratos.json()
      const dataClientes = resClientes.ok ? await resClientes.json() : []
      const dataCasos = resCasos.ok ? await resCasos.json() : []
      setContratos(Array.isArray(dataContratos) ? dataContratos : [])
      setClientes(Object.fromEntries((dataClientes || []).map((c) => [c.id, c])))
      setCasos(Object.fromEntries((dataCasos || []).map((c) => [c.id, c])))
    } catch (err) {
      console.error(err)
      toast.error('Erro ao carregar contratos.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTudo()
  }, [fetchTudo])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return contratos.filter((c) => {
      if (filtroStatus !== 'Todos' && (c.status || '') !== filtroStatus) return false
      if (filtroTipo !== 'Todos' && (c.tipo_honorario || '') !== filtroTipo) return false
      if (q) {
        const cliente = clientes[c.cliente_id]
        const nome = (cliente?.nome_razao_social || '').toLowerCase()
        const objeto = (c.objeto || '').toLowerCase()
        const arquivo = (c.arquivo_nome || '').toLowerCase()
        if (!nome.includes(q) && !objeto.includes(q) && !arquivo.includes(q)) return false
      }
      return true
    })
  }, [contratos, clientes, busca, filtroStatus, filtroTipo])

  const resumo = useMemo(() => {
    const ativos = contratos.filter((c) => c.status === 'Ativo')
    const pendentes = contratos.filter((c) => c.status === 'Pendente Assinatura')
    const valorFixoTotal = ativos
      .filter((c) => c.valor_total)
      .reduce((acc, c) => acc + Number(c.valor_total || 0), 0)
    const semCaso = contratos.filter((c) => !c.caso_id).length
    return {
      total: contratos.length,
      ativos: ativos.length,
      pendentes: pendentes.length,
      valorFixoTotal,
      semCaso,
    }
  }, [contratos])

  return (
    <div className="container-fluid p-3 p-md-4">
      <div className="d-flex align-items-center mb-3">
        <DocumentCurrencyDollarIcon className="text-primary me-2" style={ICON_TITLE} />
        <h1 className="h3 mb-0 text-dark">Contratos de Honorários</h1>
      </div>

      {/* Resumo */}
      <div className="row g-3 mb-4">
        <Card label="Total" value={resumo.total} />
        <Card label="Ativos" value={resumo.ativos} accent="text-success" />
        <Card label="Pendentes" value={resumo.pendentes} accent="text-warning" />
        <Card label="Valor fixo (ativos)" value={fmtBRL(resumo.valorFixoTotal)} />
        <Card label="Sem caso vinculado" value={resumo.semCaso} accent="text-muted" />
      </div>

      {/* Filtros */}
      <div className="card shadow-sm mb-3">
        <div className="card-body">
          <div className="row g-2 align-items-center">
            <div className="col-12 col-md">
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-white">
                  <MagnifyingGlassIcon className="text-muted" style={ICON_SM} />
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Buscar por cliente, objeto ou arquivo..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
            </div>
            <div className="col-6 col-md-auto">
              <select
                className="form-select form-select-sm"
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    Status: {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-auto">
              <select
                className="form-select form-select-sm"
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
              >
                {TIPO_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    Tipo: {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="d-flex justify-content-center align-items-center p-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Carregando...</span>
          </div>
          <span className="ms-3 text-muted">Carregando contratos...</span>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="alert alert-info text-center">
          Nenhum contrato encontrado com os filtros atuais.
        </div>
      ) : (
        <div className="card shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 small">
              <thead className="table-light">
                <tr>
                  <th>Cliente</th>
                  <th>Tipo</th>
                  <th className="text-end">Valor / %</th>
                  <th>Objeto</th>
                  <th>Assinatura</th>
                  <th>Status</th>
                  <th>Caso</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => {
                  const cliente = clientes[c.cliente_id]
                  const caso = c.caso_id ? casos[c.caso_id] : null
                  return (
                    <tr key={c.id}>
                      <td>
                        <div className="fw-semibold">
                          {cliente?.nome_razao_social || `Cliente #${c.cliente_id}`}
                        </div>
                        {c.arquivo_nome && (
                          <div
                            className="text-muted text-truncate"
                            style={{ maxWidth: 280, fontSize: '0.75rem' }}
                            title={c.arquivo_nome}
                          >
                            {c.arquivo_nome}
                          </div>
                        )}
                      </td>
                      <td>{c.tipo_honorario || '-'}</td>
                      <td className="text-end text-nowrap">
                        {c.valor_total ? fmtBRL(c.valor_total) : ''}
                        {c.valor_total && c.percentual_exito ? <br /> : ''}
                        {c.percentual_exito ? fmtPct(c.percentual_exito) : ''}
                        {!c.valor_total && !c.percentual_exito ? '-' : ''}
                        {c.percentual_recurso && (
                          <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                            recurso: {fmtPct(c.percentual_recurso)}
                          </div>
                        )}
                      </td>
                      <td style={{ maxWidth: 260 }}>
                        <div
                          className="text-truncate"
                          title={c.objeto || ''}
                          style={{ maxWidth: 260 }}
                        >
                          {c.objeto || '-'}
                        </div>
                      </td>
                      <td className="text-muted small">{fmtData(c.data_assinatura)}</td>
                      <td>
                        <span className={statusBadgeClass(c.status)}>{c.status || '-'}</span>
                      </td>
                      <td>
                        {caso ? (
                          <Link
                            to={`/casos/detalhe/${caso.id}`}
                            className="text-primary text-decoration-none small"
                          >
                            #{caso.id} {caso.numero_processo || caso.titulo || ''}
                          </Link>
                        ) : (
                          <span className="text-warning small">
                            <LinkIcon style={ICON_SM} className="me-1" />
                            sem caso
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function Card({ label, value, accent }) {
  return (
    <div className="col-6 col-md">
      <div className="card shadow-sm h-100">
        <div className="card-body py-2 px-3">
          <div className="text-muted small">{label}</div>
          <div className={`h5 mb-0 ${accent || 'text-dark'}`}>{value}</div>
        </div>
      </div>
    </div>
  )
}
